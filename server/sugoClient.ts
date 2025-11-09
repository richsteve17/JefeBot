// server/sugoClient.ts
import { EventEmitter } from 'events';
import WebSocket from 'ws';
import zlib from 'zlib';

export type SugoHeaders = Record<string, string>;

export interface SugoClientOpts {
  url: string;                  // wss://... from the handshake
  headers: SugoHeaders;         // headers you saw in the WS upgrade
  protocols?: string | string[]; // First-class subprotocol (e.g., "im-auth;v=1;token=...")
  roomId: string;
  token?: string;               // SUGO auth token
  uid?: string;                 // User ID
  heartbeatMs?: number;         // default 25s
  decompress?: 'auto' | 'none'; // try gzip/zlib if 'auto'
  // If the app sends a CONNECT frame after WS open, provide it:
  makeConnectFrame?: () => string | Buffer | null;
  // Exact JSON the app uses to join a room:
  makeJoinFrame: (roomId: string) => string | Buffer;
  // Exact JSON the app uses to send a chat message:
  makeSendFrame: (roomId: string, text: string) => string | Buffer;
  // Called before reconnect to fetch fresh token/protocol
  refreshToken?: () => Promise<{ protocol?: string | string[]; headers?: Record<string, string> }>;
}

export interface SugoEventMap {
  open: [];
  close: [code: number, reason: string];
  error: [err: Error];
  message: [data: any]; // decoded if possible, else raw string
  raw: [buf: Buffer];   // always the raw WS frame as bytes
  log: [msg: string];
  // SUGO-specific events
  hello: [data: SugoWireMessage];
  gift: [data: any];
  chat: [data: any];
  pk: [data: any];
  join: [data: any];
  unknown: [data: SugoWireMessage];
}

export interface SugoWireMessage {
  cmd: number;
  data?: any;
  rc?: number;
  msg?: string;
  sn?: number;
}

export class SugoClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private opts: SugoClientOpts;
  private timer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private helloTimer: NodeJS.Timeout | null = null;
  private closedManually = false;
  private stage: 'idle' | 'awaiting_connect_response' | 'subscribed' = 'idle';
  private joined = false; // Single-flight JOIN guard

  constructor(opts: SugoClientOpts) {
    super();
    this.opts = opts;
  }

  connect() {
    this.closedManually = false;
    this.emit('log', `SUGO: connecting ${this.opts.url}`);

    const headers = { ...this.opts.headers };
    const protocols = this.opts.protocols; // Use first-class protocols value

    // Log the protocol we're sending (redact token for security)
    if (protocols) {
      const protocolStr = Array.isArray(protocols) ? protocols : [protocols];
      const redacted = protocolStr.map((p, i) => i === 0 ? `${p.slice(0, 8)}...` : p);
      this.emit('log', `SUGO: Sending protocols: [${redacted.join(', ')}]`);
    }

    this.ws = new WebSocket(this.opts.url, protocols, {
      headers,
      perMessageDeflate: false  // Fewer surprises while testing
    });

    this.ws.on('open', () => {
      const negotiated = (this.ws as any)?.protocol || '';
      this.emit('log', `SUGO: Negotiated protocol: ${negotiated || 'none'}`);

      // CRITICAL: If server rejected subprotocol, refresh token and reconnect
      if (!negotiated) {
        this.emit('log', 'SUGO: No protocol accepted → refresh token and retry');
        this.ws?.close(1000, 'no-protocol');
        this.scheduleReconnect(true); // true = refresh before reconnecting
        return;
      }

      this.emit('open');
      this.emit('log', 'SUGO: Protocol accepted, proceeding with handshake');
      this.startHeartbeat();

      // Fallback: if no hello in 500ms, send CONNECT ourselves (client-first protocol)
      this.helloTimer = setTimeout(() => {
        if (this.stage !== 'idle') return;
        this.emit('log', 'SUGO: No hello received, sending client-first CONNECT...');
        const connectFrame = this.opts.makeConnectFrame?.();
        if (connectFrame) {
          this.emit('log', `WIRE>> ${connectFrame.slice(0, 200)}`);
          this.ws?.send(connectFrame);
          this.emit('log', 'SUGO: Sent CONNECT (client-first fallback)');
          this.stage = 'awaiting_connect_response';
        } else {
          // No CONNECT frame defined, go straight to JOIN
          this.sendJoin();
        }
      }, 500);
    });

    this.ws.on('message', (data: WebSocket.RawData) => {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as any);
      this.emit('raw', buf);

      const text = this.tryDecode(buf) ?? buf.toString('utf8');

      // Quick visibility while dialing in
      this.emit('log', `WIRE<< ${text.slice(0, 160)}`);

      // Special case: RECONNECT means server wants us to refresh and reconnect
      if (/^"?RECONNECT"?$/i.test(text.trim())) {
        this.emit('log', 'SUGO: Server requested RECONNECT (likely stale token)');
        this.scheduleReconnect(true); // Refresh token before reconnecting
        return;
      }

      // 1) If we're still idle, server sent hello first (hello-first protocol)
      if (this.stage === 'idle') {
        if (this.helloTimer) {
          clearTimeout(this.helloTimer);
          this.helloTimer = null;
        }
        this.emit('log', 'SUGO: Received server hello, sending CONNECT...');
        const connectFrame = this.opts.makeConnectFrame?.();
        if (connectFrame) {
          this.emit('log', `WIRE>> ${connectFrame.slice(0, 200)}`);
          this.ws?.send(connectFrame);
          this.emit('log', 'SUGO: Sent CONNECT (hello-first path)');
          this.stage = 'awaiting_connect_response';
        } else {
          this.sendJoin();
        }

        // Route the hello message
        this.routeMessage(text);
        return;
      }

      // 2) Waiting for server to accept CONNECT
      if (this.stage === 'awaiting_connect_response') {
        this.emit('log', 'SUGO: Checking server response to CONNECT...');
        let ok = false;
        try {
          const j = JSON.parse(text);
          ok = !!(j.result || j.connected || j.ok || j.type === 'WELCOME' || j.type === 'CONNECTED' || (j.rc === 0 && j.msg === 'OK'));
        } catch {
          ok = /connected|welcome|ok/i.test(text);
        }

        if (ok) {
          this.emit('log', 'SUGO: Server accepted CONNECT, sending JOIN...');
          this.sendJoin();
        } else {
          this.emit('log', 'SUGO: Server response unclear, treating as rejection');
        }

        // Route the message regardless
        this.routeMessage(text);
        return;
      }

      // 3) After subscribed, route all messages through cmd handler
      this.routeMessage(text);
    });

    this.ws.on('close', (code, reason) => {
      this.emit('close', code, reason.toString());
      this.stopHeartbeat();
      if (!this.closedManually) {
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (err) => {
      this.emit('error', err as Error);
    });
  }

  disconnect() {
    this.closedManually = true;
    this.stopHeartbeat();
    if (this.helloTimer) {
      clearTimeout(this.helloTimer);
      this.helloTimer = null;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.close(1000, 'client-closed');
    this.ws = null;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stage = 'idle';
    this.joined = false; // Reset JOIN guard on disconnect
  }

  // Single-flight JOIN to prevent duplicates
  private sendJoin() {
    if (this.joined) {
      this.emit('log', 'SUGO: JOIN already sent, skipping duplicate');
      return;
    }
    this.ws?.send(this.opts.makeJoinFrame(this.opts.roomId));
    this.joined = true;
    this.stage = 'subscribed';
    this.emit('log', 'SUGO: Sent JOIN');
  }

  // Cmd-based message router
  private routeMessage(text: string) {
    let wire: SugoWireMessage;
    try {
      wire = JSON.parse(text);
    } catch {
      // Not JSON, emit as raw message
      this.emit('message', text);
      return;
    }

    // Always emit the generic message event
    this.emit('message', wire);

    // Route by cmd if present
    if (typeof wire.cmd !== 'number') return;

    switch (wire.cmd) {
      case 338: // Hello/auth success
        this.emit('hello', wire);
        break;

      // Common cmd codes discovered in live streaming protocols
      case 301: // Likely chat message (outgoing confirmation or incoming)
      case 302:
      case 310:
      case 311:
        this.emit('chat', wire);
        break;

      case 320: // Likely gift events
      case 321:
      case 322:
        this.emit('gift', wire);
        break;

      case 330: // Likely PK/battle events
      case 331:
      case 332:
        this.emit('pk', wire);
        break;

      case 340: // Likely join/leave events
      case 341:
        this.emit('join', wire);
        break;

      default:
        // Log unknown for discovery
        this.emit('log', `Unknown cmd ${wire.cmd}: ${JSON.stringify(wire).slice(0, 100)}`);
        this.emit('unknown', wire);
        break;
    }
  }

  isOpen() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  sendChat(text: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    const frame = this.opts.makeSendFrame(this.opts.roomId, text);
    this.emit('log', `WIRE>> ${frame.toString().slice(0, 200)}`);
    this.ws.send(frame);
    return true;
  }

  private startHeartbeat() {
    const ms = this.opts.heartbeatMs ?? 25000;
    this.stopHeartbeat();
    this.timer = setInterval(() => {
      // If SUGO expects a specific ping, add it here. Most stacks accept WS-level ping.
      try { this.ws?.ping(); } catch {}
    }, ms);
  }

  private stopHeartbeat() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private scheduleReconnect(refresh = false) {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(async () => {
      if (refresh && this.opts.refreshToken) {
        this.emit('log', 'SUGO: Refreshing token before reconnect...');
        try {
          const res = await this.opts.refreshToken();
          if (res?.protocol) {
            this.opts.protocols = res.protocol;
            const protocolStr = Array.isArray(res.protocol) ? res.protocol.join(', ') : res.protocol;
            this.emit('log', `SUGO: Got fresh protocol: ${protocolStr.slice(0, 60)}...`);
          }
          if (res?.headers) {
            this.opts.headers = { ...this.opts.headers, ...res.headers };
          }
        } catch (err: any) {
          this.emit('log', `SUGO: Token refresh failed: ${err.message}`);
        }
      }
      this.connect();
    }, 1500);
  }

  private tryDecode(buf: Buffer): string | null {
    if (this.opts.decompress === 'none') return buf.toString('utf8');
    // try gzip
    try { return zlib.gunzipSync(buf).toString('utf8'); } catch {}
    // try zlib
    try { return zlib.inflateSync(buf).toString('utf8'); } catch {}
    // maybe it was already text
    try { return buf.toString('utf8'); } catch {}
    return null;
  }
}
