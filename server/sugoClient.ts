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
      this.emit('log', 'SUGO: WebSocket opened, waiting for server hello...');
      this.startHeartbeat();
    });

    let sentHandshake = false;
    this.ws.on('message', (data: WebSocket.RawData) => {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as any);
      this.emit('raw', buf);

      // Log first 64 bytes to see protocol
      if (!sentHandshake) {
        this.emit('log', `[wire <<] ${buf.slice(0, 64).toString('hex')} len=${buf.length}`);
      }

      const decoded = this.tryDecode(buf);
      if (decoded !== null) {
        try {
          const maybeJson = JSON.parse(decoded);
          this.emit('message', maybeJson);

          // Send auth/join only after first server message (hello/nonce/etc)
          if (!sentHandshake) {
            sentHandshake = true;
            this.emit('log', 'SUGO: received server hello, sending handshake...');
            if (this.opts.makeAuthFrame) {
              const auth = this.opts.makeAuthFrame();
              if (auth) {
                this.ws?.send(auth);
                this.emit('log', 'SUGO: sent auth frame');
              }
            }
            const joinFrame = this.opts.makeJoinFrame(this.opts.roomId);
            this.ws?.send(joinFrame);
            this.emit('log', 'SUGO: sent join frame');
          }
        } catch {
          this.emit('message', decoded);
          if (!sentHandshake) {
            sentHandshake = true;
            this.emit('log', 'SUGO: received non-JSON hello, sending handshake...');
            if (this.opts.makeAuthFrame) {
              const auth = this.opts.makeAuthFrame();
              if (auth) this.ws?.send(auth);
            }
            this.ws?.send(this.opts.makeJoinFrame(this.opts.roomId));
          }
        }
      } else {
        this.emit('message', buf);
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
