// server/index.ts
import fs from 'fs';
import path from 'path';
import express from 'express';
import { WebSocketServer } from 'ws';
import { SugoClient, SugoWireMessage } from './sugoClient.js';
import { tapWireMessage, tapGift, tapChat, tapPK } from './wireTap.js';

type Conn = import('ws').WebSocket;

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const CFG_PATH = path.join(DATA_DIR, 'config.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------------- Types ----------------
interface BotConfig {
  sugoRoomId: string;
  botAccountToken: string;
  sugoUid: string;              // SUGO user ID
  sugoDeviceId?: string;        // Device ID (did)
  sugoActivityId?: number;      // Activity/stream ID
  sugoAppVersion?: string;      // App version
  spotifyAccessToken?: string;
  // internal: WS url + headers captured via mitm; keep these server-side only
  sugoWsUrl?: string;
  sugoWsHeaders?: Record<string, string>;
}
interface ModuleConfig {
  elMusico: { enabled: boolean; vibeCheckEnabled: boolean; };
  elAnunciador: { enabled: boolean; };
  elMaestroDelJuego: {
    enabled: boolean; intervalMinutes: number;
    enabledGames: { giftBurst: boolean; familyGoal: boolean; kingOfTheHill: boolean; };
  };
  elHypeMan: { enabled: boolean; minimumDiamonds: number; };
}
interface BotState {
  currentSong?: { name: string; artist: string; };
  activePK?: any;
  activeGame?: any;
}

interface StoredConfig {
  botConfig: BotConfig;
  moduleConfig: ModuleConfig;
  isRunning: boolean;
}

// ---------------- Storage ----------------
const defaults: StoredConfig = {
  botConfig: {
    sugoRoomId: '1250911',
    botAccountToken: 'e9ScmfqaeHsklb7yR7gS9M4TnzXwiZF1', // FRESH token from latest Proxyman capture
    sugoUid: '47585713',
    sugoDeviceId: '654fab11f3b88db3fbfdd2c400e63142a3b4f455',
    sugoActivityId: 10231,
    sugoAppVersion: 'vc-392401-vn-2.40.1',
    spotifyAccessToken: '',
    sugoWsUrl: 'wss://activity-ws-rpc.voicemaker.media/ws/activity',
    sugoWsHeaders: {
      'Accept-Encoding': 'gzip, deflate',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Origin': 'https://activity-h5.voicemaker.media', // CORRECTED from www.sugo.com
      'Pragma': 'no-cache',
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) SUGO/392401 version/vc-392401-vn-2.40.1 statusHeight/54.0 LangCode/en',
      'Cookie': 'appsflyer-id=1734994530097-1901624; brand=iPhone; channel=AppStore; did=654fab11f3b88db3fbfdd2c400e63142a3b4f455; http_ip=; idfa=3984AFF3-7633-4298-91C0-7A89AFDE80F6; language=en; locale=en_US; mcc=65535; os=ios-26.1-iPhone 16 Pro Max; pkg=com.maker.sugo; show-id=47585713; timezone=-5; token=e9ScmfqaeHsklb7yR7gS9M4TnzXwiZF1; uid=47585713; version=vc-392401-vn-2.40.1'
    }
  },
  moduleConfig: {
    elMusico: { enabled: false, vibeCheckEnabled: true },
    elAnunciador: { enabled: false },
    elMaestroDelJuego: {
      enabled: false, intervalMinutes: 20,
      enabledGames: { giftBurst: true, familyGoal: true, kingOfTheHill: true }
    },
    elHypeMan: { enabled: false, minimumDiamonds: 1000 }
  },
  isRunning: false
};

function loadConfig(): StoredConfig {
  try { return JSON.parse(fs.readFileSync(CFG_PATH, 'utf8')); }
  catch { return defaults; }
}
function saveConfig(cfg: StoredConfig) {
  fs.writeFileSync(CFG_PATH, JSON.stringify(cfg, null, 2));
}

const config: StoredConfig = loadConfig();
let state: BotState = {};
// ---------------- SUGO bridge ----------------
let sugo: SugoClient | null = null;

function buildSugo() {
  if (!config.botConfig.sugoWsUrl) {
    log('SUGO WS URL missing. Set botConfig.sugoWsUrl in data/config.json');
    return null;
  }
  const url = config.botConfig.sugoWsUrl;
  const headers = config.botConfig.sugoWsHeaders || {};

  // Build the exact two-protocol format from Proxyman capture:
  // Protocol 1: token
  // Protocol 2: URL-encoded JSON with uid, did, version, activity_id
  const buildProtocol = (token: string, uid: string, deviceId: string, version: string, activityId: number): string[] => {
    const metadata = JSON.stringify({
      uid,
      did: deviceId,
      version,
      activity_id: activityId
    });
    return [
      token,
      encodeURIComponent(metadata)
    ];
  };

  const makeConnectFrame = () => {
    // If needed after protocol auth, send a CONNECT frame
    // Most protocols auth via subprotocol only and don't need this
    return null; // Set to null for now, enable if protocol requires it
  };

  const makeJoinFrame = (roomId: string) => JSON.stringify({
    id: 2,
    method: 'subscribe',
    params: { channel: `room:${roomId}` }
  });

  // Sequence number counter (small incrementing int, not timestamp!)
  let seqNum = 1;
  const nextSeq = () => seqNum++;

  const makeSendFrame = (roomId: string, text: string) => {
    // SUGO uses cmd-based protocol (we saw cmd 338 for hello)
    // Server error showed "LargestInt out of range" when using Date.now()
    // Use small incrementing sequence number instead
    const attempts = [
      // Pattern 1: Standard cmd-based chat
      {
        cmd: 301,
        sn: nextSeq(),
        data: {
          content: text,
          room_id: roomId
        }
      },
      // Pattern 2: Alternative field names
      {
        cmd: 302,
        sn: nextSeq(),
        data: {
          msg: text,
          room: roomId
        }
      },
      // Pattern 3: Message object wrapper
      {
        cmd: 310,
        sn: nextSeq(),
        data: {
          message: {
            text: text,
            type: 1
          },
          room_id: roomId
        }
      }
    ];

    // Try first pattern (most common)
    return JSON.stringify(attempts[0]);
  };

  // Refresh token from SUGO's HTTP endpoint before WS connect
  const refreshToken = async () => {
    // TODO: Implement the pre-WS HTTP call if you capture one
    // For now, rebuild protocol from stored credentials
    log('SUGO: Rebuilding protocol from stored credentials');
    const protocols = buildProtocol(
      config.botConfig.botAccountToken,
      config.botConfig.sugoUid,
      config.botConfig.sugoDeviceId || '',
      config.botConfig.sugoAppVersion || 'vc-392401-vn-2.40.1',
      config.botConfig.sugoActivityId || 10231
    );
    return { protocol: protocols };
  };

  const client = new SugoClient({
    url,
    headers,
    protocols: buildProtocol(
      config.botConfig.botAccountToken,
      config.botConfig.sugoUid,
      config.botConfig.sugoDeviceId || '',
      config.botConfig.sugoAppVersion || 'vc-392401-vn-2.40.1',
      config.botConfig.sugoActivityId || 10231
    ),
    roomId: config.botConfig.sugoRoomId,
    token: config.botConfig.botAccountToken,
    uid: config.botConfig.sugoUid,
    heartbeatMs: 25000,
    decompress: 'auto',
    makeConnectFrame,
    makeJoinFrame,
    makeSendFrame,
    refreshToken
  });

  client.on('log', (m) => log(m));
  client.on('open', () => {
    log('SUGO: connected');
    broadcast({ type: 'bot_status', data: { sugo: 'connected' } });
  });
  client.on('close', (c, r) => {
    log(`SUGO: closed ${c} ${r}`);
    broadcast({ type: 'bot_status', data: { sugo: 'disconnected' } });
  });
  client.on('error', (e) => log(`SUGO error: ${e.message}`));

  // Wire tap for analytics
  client.on('unknown', (wire: SugoWireMessage) => {
    tapWireMessage(wire);
    log(`SUGO unknown cmd ${wire.cmd}: ${JSON.stringify(wire).slice(0, 150)}`);
  });

  // Typed event handlers (will implement as we discover cmd codes)
  client.on('hello', (wire: SugoWireMessage) => {
    log(`SUGO hello cmd ${wire.cmd}: ${JSON.stringify(wire.data).slice(0, 100)}`);
  });

  client.on('gift', (wire: SugoWireMessage) => {
    tapGift(wire);
    log(`SUGO gift cmd ${wire.cmd}: ${JSON.stringify(wire).slice(0, 150)}`);
    // TODO: Wire to coordinator for ElHypeMan
  });

  client.on('chat', (wire: SugoWireMessage) => {
    tapChat(wire);
    log(`SUGO chat cmd ${wire.cmd}: ${JSON.stringify(wire).slice(0, 150)}`);
    // If this is confirmation of OUR message, we'll see the format we sent
    // If it's someone else's message, we learn the incoming format
  });

  client.on('pk', (wire: SugoWireMessage) => {
    tapPK(wire);
    log(`SUGO PK cmd ${wire.cmd}: ${JSON.stringify(wire).slice(0, 150)}`);
    // TODO: Wire to coordinator for ElAnunciador
  });

  return client;
}

// ---------------- Express ----------------
const app = express();
app.use(express.json());

// Serve static files from Vite build in production
const DIST_DIR = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  log(`Serving static files from ${DIST_DIR}`);
}

// Health check endpoints (prevent Railway from killing container)
app.get('/healthz', (_req, res) => res.status(200).send('ok'));
app.get('/health', (_req, res) => res.status(200).send('ok'));
app.get('/', (_req, res) => res.status(200).send('Rich $teve Bot up'));

app.get('/api/config', (_req, res) => {
  res.json({
    botConfig: redactBotConfig(config.botConfig),
    moduleConfig: config.moduleConfig,
    isRunning: config.isRunning,
    state
  });
});

app.post('/api/config/bot', (req, res) => {
  config.botConfig = { ...config.botConfig, ...req.body };
  saveConfig(config);
  broadcast({ type: 'config_updated', data: { botConfig: redactBotConfig(config.botConfig) } });
  res.json({ ok: true });
});

app.post('/api/config/modules', (req, res) => {
  config.moduleConfig = { ...config.moduleConfig, ...req.body };
  saveConfig(config);
  broadcast({ type: 'config_updated', data: { moduleConfig: config.moduleConfig } });
  res.json({ ok: true });
});

app.post('/api/bot/start', (_req, res) => {
  if (!sugo) sugo = buildSugo();
  if (!sugo) return res.status(400).json({ success: false, message: 'Missing SUGO WS url/headers.' });
  if (!sugo.isOpen()) sugo.connect();
  config.isRunning = true;
  saveConfig(config);
  broadcast({ type: 'bot_started' });
  res.json({ success: true });
});

app.post('/api/bot/stop', (_req, res) => {
  config.isRunning = false;
  saveConfig(config);
  if (sugo) sugo.disconnect();
  broadcast({ type: 'bot_stopped' });
  res.json({ success: true });
});

// ---- Test routes your UI calls
app.post('/api/test/pk-start', (_req, res) => {
  state.activePK = { team1: 'Rich Legacy', team2: 'Them' };
  broadcast({ type: 'state_updated', data: state });
  if (sugo?.isOpen()) sugo.sendChat('🥊 PK just started! Drop heat for 🧡🐦‍🔥');
  res.json({ ok: true });
});

app.post('/api/test/gift', (req, res) => {
  const { username, giftName, diamonds } = req.body || {};
  if (config.moduleConfig.elHypeMan.enabled && sugo?.isOpen()) {
    const min = config.moduleConfig.elHypeMan.minimumDiamonds;
    if (diamonds >= min) sugo.sendChat(`🔥 ${username} sent ${giftName} (${diamonds})! Show love!`);
  }
  res.json({ ok: true });
});

app.post('/api/test/vibe-check', (_req, res) => {
  if (config.moduleConfig.elMusico.enabled && config.moduleConfig.elMusico.vibeCheckEnabled) {
    if (sugo?.isOpen()) sugo.sendChat('🎧 Vibe check: 1 = mid, 5 = banger. Drop your number.');
  }
  res.json({ ok: true });
});

// Test chat connectivity
app.post('/api/test/chat', (req, res) => {
  const { message } = req.body || {};
  log(`Test chat request: "${message}"`);

  if (!sugo) {
    log('Test chat failed: SUGO client not initialized');
    return res.status(400).json({ success: false, message: 'SUGO not initialized' });
  }

  if (!sugo.isOpen()) {
    log('Test chat failed: SUGO not connected');
    return res.status(400).json({ success: false, message: 'SUGO not connected' });
  }

  log(`Sending to SUGO: "${message}"`);
  const sent = sugo.sendChat(message || '🎯 Test message from Jefe Bot');
  log(`Send result: ${sent}`);
  res.json({ success: sent });
});

// Diagnostic: Try multiple chat formats to discover the correct one
app.post('/api/test/chat-discovery', (_req, res) => {
  if (!sugo?.isOpen()) {
    return res.status(400).json({ success: false, message: 'SUGO not connected' });
  }

  const roomId = config.botConfig.sugoRoomId;
  const testMsg = '🔍 Format discovery test';

  log('===== CHAT FORMAT DISCOVERY =====');

  // Use small sequence numbers (not Date.now() which is too large)
  let testSeq = 1;

  // Format 1: cmd 301 with content field
  const f1 = JSON.stringify({
    cmd: 301,
    sn: testSeq++,
    data: { content: testMsg, room_id: roomId }
  });
  log(`TRY 1 (cmd 301): ${f1}`);
  (sugo as any).ws?.send(f1);

  // Format 2: cmd 302 with msg field
  setTimeout(() => {
    const f2 = JSON.stringify({
      cmd: 302,
      sn: testSeq++,
      data: { msg: testMsg, room: roomId }
    });
    log(`TRY 2 (cmd 302): ${f2}`);
    (sugo as any).ws?.send(f2);
  }, 1000);

  // Format 3: cmd 310 with message wrapper
  setTimeout(() => {
    const f3 = JSON.stringify({
      cmd: 310,
      sn: testSeq++,
      data: { message: { text: testMsg, type: 1 }, room_id: roomId }
    });
    log(`TRY 3 (cmd 310): ${f3}`);
    (sugo as any).ws?.send(f3);
  }, 2000);

  // Format 4: Centrifugo-style (original)
  setTimeout(() => {
    const f4 = JSON.stringify({
      id: testSeq++,
      method: 'publish',
      params: { channel: `room:${roomId}`, data: { message: testMsg } }
    });
    log(`TRY 4 (Centrifugo): ${f4}`);
    (sugo as any).ws?.send(f4);
  }, 3000);

  log('===== Watch the logs above for server responses =====');
  log('===== If one format works, you\'ll see it echo or get confirmation =====');

  res.json({ success: true, message: 'Testing 4 formats over 3 seconds - watch logs for responses' });
});

// Serve index.html for all other routes (SPA fallback)
app.get('*', (_req, res) => {
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('App not built. Run `npm run build` first.');
  }
});

// -------------- HTTP + WS server --------------
const server = app.listen(PORT, () => log(`Server listening on ${PORT}`));
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: Conn) => {
  // initial snapshot
  send(ws, {
    type: 'initial_state',
    data: {
      botConfig: redactBotConfig(config.botConfig),
      moduleConfig: config.moduleConfig,
      isRunning: config.isRunning,
      state
    }
  });
});

function broadcast(msg: any) {
  const str = JSON.stringify(msg);
  for (const client of wss.clients) {
    try { client.send(str); } catch {}
  }
}
function send(ws: Conn, msg: any) {
  try { ws.send(JSON.stringify(msg)); } catch {}
}
function redactBotConfig(b: BotConfig) {
  const redact = (v?: string) => v ? v.replace(/.(?=.{4})/g, '•') : '';
  return {
    sugoRoomId: b.sugoRoomId,
    botAccountToken: b.botAccountToken ? redact(b.botAccountToken) : '',
    sugoUid: b.sugoUid ? redact(b.sugoUid) : '',
    spotifyAccessToken: b.spotifyAccessToken ? redact(b.spotifyAccessToken) : '',
    // never send ws headers/url back to the browser; keep server-side
  };
}
function log(msg: string) {
  console.log(`[R$ BOT] ${msg}`);
}

// Graceful shutdown
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down gracefully');
  try { sugo?.disconnect(); } catch {}
  server.close(() => {
    log('Server closed');
    process.exit(0);
  });
  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => {
    log('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

process.on('SIGINT', () => {
  log('SIGINT received, shutting down gracefully');
  try { sugo?.disconnect(); } catch {}
  server.close(() => {
    log('Server closed');
    process.exit(0);
  });
});
