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
    botAccountToken: '',
    spotifyAccessToken: '',
    // TODO: paste from your capture:
    sugoWsUrl: 'wss://activity-ws-rpc.voicemaker.media/ws/activity', // FILL THIS from mitmproxy
    sugoWsHeaders: {
      // TODO: Add headers you saw in the WebSocket handshake:
      // 'Origin': 'https://app.sugo.example',
      // 'Cookie': 'sid=...',
      // 'Authorization': 'Bearer ...',
      // 'User-Agent': 'okhttp/4.9.3'
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

  // TODO: replace the two frames below with the exact shapes your app uses, as seen in mitmweb:
  // Look at the OUTGOING WebSocket messages when you send a chat in SUGO
  const makeJoinFrame = (roomId: string) => JSON.stringify({
    // TODO: Fill this with the exact JSON SUGO sends to join a room
    action: 'join',
    roomId
  });

  const makeSendFrame = (roomId: string, text: string) => JSON.stringify({
    // TODO: Fill this with the exact JSON SUGO sends when you type a chat message
    // Example from what we saw: might have "cmd", "data", etc.
    cmd: 338, // might be different - check your capture
    data: {
      room_id: roomId,
      message: text
    }
  });

  const client = new SugoClient({
    url,
    headers,
    roomId: config.botConfig.sugoRoomId,
    heartbeatMs: 25000,
    decompress: 'auto',
    // If your capture showed an auth frame after connect, add it here:
    // makeAuthFrame: () => JSON.stringify({ op: 'auth', token: config.botConfig.botAccountToken }),
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
    spotifyAccessToken: b.spotifyAccessToken ? redact(b.spotifyAccessToken) : '',
    // never send ws headers/url back to the browser; keep server-side
  };
}
function log(msg: string) {
  console.log(`[R$ BOT] ${msg}`);
}
