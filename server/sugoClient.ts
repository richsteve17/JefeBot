// server/sugoClient.ts
import { EventEmitter } from 'events';
import WebSocket from 'ws';
import zlib from 'zlib';

export type SugoHeaders = Record<string, string>;

export interface SugoClientOpts {
  url: string;                  // wss://... from the handshake
  headers: SugoHeaders;         // headers you saw in the WS upgrade
  roomId: string;
  token?: string;               // SUGO auth token
  uid?: string;                 // User ID
  heartbeatMs?: number;         // default 25s
  decompress?: 'auto' | 'none'; // try gzip/zlib if 'auto'
  // If the app sends an auth frame immediately after connect, provide it:
  makeAuthFrame?: () => string | Buffer | null;
  // Exact JSON the app uses to join a room:
  makeJoinFrame: (roomId: string) => string | Buffer;
  // Exact JSON the app uses to send a chat message:
  makeSendFrame: (roomId: string, text: string) => string | Buffer;
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
  private closedManually = false;

  constructor(opts: SugoClientOpts) {
    super();
    this.opts = opts;
  }

  connect() {
    this.closedManually = false;
    this.emit('log', `SUGO: connecting ${this.opts.url}`);

    // Extract Sec-WebSocket-Protocol from headers and pass as protocols arg
    const headers = { ...this.opts.headers };
    let protocols: string | string[] | undefined;
    const protoKey = Object.keys(headers).find(k => k.toLowerCase() === 'sec-websocket-protocol');
    if (protoKey) {
      const raw = String((headers as any)[protoKey]);
      delete (headers as any)[protoKey];
      const list = raw.split(',').map(s => s.trim()).filter(Boolean);
      protocols = list.length <= 1 ? list[0] : list;
      this.emit('log', `SUGO: using subprotocol: ${protocols}`);
    }

    this.ws = new WebSocket(this.opts.url, protocols, {
      headers,
      perMessageDeflate: true
    });

    this.ws.on('open', () => {
      this.emit('open');
      this.emit('log', 'SUGO: WebSocket opened, sending CONNECT immediately...');
      this.startHeartbeat();

      // Send CONNECT frame immediately (server doesn't send hello first)
      const connectFrame = this.opts.makeAuthFrame?.();
      if (connectFrame) {
        this.ws?.send(connectFrame);
        this.emit('log', 'SUGO: Sent CONNECT frame');
        stage = 'awaiting_connect_response';
      } else {
        // No auth frame, go straight to subscribe
        const sub = this.opts.makeJoinFrame(this.opts.roomId);
        this.ws?.send(sub);
        this.emit('log', 'SUGO: Sent SUBSCRIBE frame (no auth needed)');
        stage = 'subscribed';
      }
    });

    let stage: 'idle' | 'awaiting_connect_response' | 'subscribed' = 'idle';

    this.ws.on('message', (data: WebSocket.RawData) => {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as any);
      this.emit('raw', buf);

      const text = this.tryDecode(buf) ?? buf.toString('utf8');

      // Quick visibility while dialing in
      this.emit('log', `WIRE<< ${text.slice(0, 120)}`);

      // 1) Waiting for server to accept CONNECT
      if (stage === 'awaiting_connect_response') {
        this.emit('log', 'SUGO: Checking server response to CONNECT...');
        // Heuristic: if server sends plain "RECONNECT" it means it didn't like your connect payload.
        // If you see a JSON with { "result": { "client": ... } } or "connected", then subscribe.
        try {
          const j = JSON.parse(text);
          this.emit('message', j);
          if (j.result || j.connected || j.type === 'WELCOME' || j.type === 'CONNECTED') {
            this.emit('log', 'SUGO: Server accepted CONNECT, sending SUBSCRIBE...');
            const sub = this.opts.makeJoinFrame(this.opts.roomId);
            this.ws?.send(sub);
            this.emit('log', 'SUGO: Sent SUBSCRIBE frame');
            stage = 'subscribed';
          } else if (text.includes('RECONNECT') || text.includes('Not handshaked')) {
            this.emit('log', 'SUGO: Server rejected with RECONNECT - auth failed!');
          }
        } catch {
          // Not JSON, check for plain text indicators
          this.emit('message', text);
          if (/connected|welcome/i.test(text)) {
            this.emit('log', 'SUGO: Server accepted (non-JSON), sending SUBSCRIBE...');
            const sub = this.opts.makeJoinFrame(this.opts.roomId);
            this.ws?.send(sub);
            stage = 'subscribed';
          }
        }
        return;
      }

      // 2) After subscribed, just emit normal messages
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
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.close(1000, 'client-closed');
    this.ws = null;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
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

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), 2000);
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
