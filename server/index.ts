// server/index.ts
import fs from 'fs';
import path from 'path';
import express from 'express';
import { WebSocketServer } from 'ws';
import { SugoClient } from './sugoClient.js';

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
    botAccountToken: 'LLAWRORtEXmBfK7Hyj3pd1MOfh3hyu67', // Your token from Proxyman
    sugoUid: '47585713',         // Your UID from Proxyman
    spotifyAccessToken: '',
    sugoWsUrl: 'wss://activity-ws-rpc.voicemaker.media/ws/activity',
    sugoWsHeaders: {
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Host': 'activity-ws-rpc.voicemaker.media',
      'Origin': 'https://www.sugo.com',
      'Pragma': 'no-cache',
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
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

  // Centrifugo-style 3-stage handshake:
  // 1. Server sends hello
  // 2. Client sends CONNECT (with token)
  // 3. Server responds with connected
  // 4. Client sends SUBSCRIBE to channel

  const makeAuthFrame = () => JSON.stringify({
    id: 1,
    method: 'connect',
    params: {
      token: config.botConfig.botAccountToken,
      data: { uid: config.botConfig.sugoUid }
    }
  });

  const makeJoinFrame = (roomId: string) => JSON.stringify({
    id: 2,
    method: 'subscribe',
    params: { channel: `room:${roomId}` }
  });

  const makeSendFrame = (roomId: string, text: string) => JSON.stringify({
    id: Date.now(),
    method: 'publish',
    params: {
      channel: `room:${roomId}`,
      data: { message: text }
    }
  });

  const client = new SugoClient({
    url,
    headers,
    roomId: config.botConfig.sugoRoomId,
    token: config.botConfig.botAccountToken,
    uid: config.botConfig.sugoUid,
    heartbeatMs: 25000,
    decompress: 'auto',
    makeAuthFrame, // Send auth as first message
    makeJoinFrame,
    makeSendFrame
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
  client.on('message', (msg) => {
    // Log incoming messages to help debug
    log(`SUGO incoming: ${JSON.stringify(msg).substring(0, 200)}`);

    // Optional: derive PK/game/song from incoming events
    try {
      if (msg?.type === 'PK_START') state.activePK = msg.payload;
      if (msg?.type === 'PK_END') state.activePK = undefined;
      if (msg?.type === 'NOW_PLAYING') state.currentSong = msg.payload;
      broadcast({ type: 'state_updated', data: state });
    } catch {}
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
