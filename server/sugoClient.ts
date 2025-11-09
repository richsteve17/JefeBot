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
  refreshToken?: () => Promise<{ protocol?: string; headers?: Record<string, string> }>;
}

export interface SugoEventMap {
  open: [];
  close: [code: number, reason: string];
  error: [err: Error];
  message: [data: any]; // decoded if possible, else raw string
  raw: [buf: Buffer];   // always the raw WS frame as bytes
  log: [msg: string];
}

export class SugoClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private opts: SugoClientOpts;
  private timer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private helloTimer: NodeJS.Timeout | null = null;
  private closedManually = false;
  private stage: 'idle' | 'awaiting_connect_response' | 'subscribed' = 'idle';

  constructor(opts: SugoClientOpts) {
    super();
    this.opts = opts;
  }

  connect() {
    this.closedManually = false;
    this.emit('log', `SUGO: connecting ${this.opts.url}`);

    const headers = { ...this.opts.headers };
    const protocols = this.opts.protocols; // Use first-class protocols value

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
          this.ws?.send(this.opts.makeJoinFrame(this.opts.roomId));
          this.emit('log', 'SUGO: Sent JOIN (no CONNECT in this protocol)');
          this.stage = 'subscribed';
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
          this.ws?.send(this.opts.makeJoinFrame(this.opts.roomId));
          this.emit('log', 'SUGO: Sent JOIN');
          this.stage = 'subscribed';
        }
        return;
      }

      // 2) Waiting for server to accept CONNECT
      if (this.stage === 'awaiting_connect_response') {
        this.emit('log', 'SUGO: Checking server response to CONNECT...');
        let ok = false;
        try {
          const j = JSON.parse(text);
          this.emit('message', j);
          ok = !!(j.result || j.connected || j.ok || j.type === 'WELCOME' || j.type === 'CONNECTED');
        } catch {
          this.emit('message', text);
          ok = /connected|welcome|ok/i.test(text);
        }

        if (ok) {
          this.emit('log', 'SUGO: Server accepted CONNECT, sending JOIN...');
          this.ws?.send(this.opts.makeJoinFrame(this.opts.roomId));
          this.emit('log', 'SUGO: Sent JOIN after CONNECT');
          this.stage = 'subscribed';
        } else {
          this.emit('log', 'SUGO: Server response unclear, treating as rejection');
        }
        return;
      }

      // 3) After subscribed, just emit normal messages
      try {
        const j = JSON.parse(text);
        this.emit('message', j);
      } catch {
        this.emit('message', text);
      }
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
  }

  isOpen() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  sendChat(text: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    const frame = this.opts.makeSendFrame(this.opts.roomId, text);
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
            this.emit('log', `SUGO: Got fresh protocol: ${res.protocol.slice(0, 60)}...`);
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
