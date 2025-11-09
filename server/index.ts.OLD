// Jefe Bot Server - Express + WebSocket API

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { JefeBotCoordinator } from './JefeBotCoordinator.js';
import { BotConfig, ModuleConfig, Gift, PKBattle } from './types.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());

// Default configuration
let botConfig: BotConfig = {
  sugoRoomId: '',
  botAccountToken: '',
  spotifyAccessToken: undefined
};

let moduleConfig: ModuleConfig = {
  elMusico: {
    enabled: false,
    vibeCheckEnabled: true
  },
  elAnunciador: {
    enabled: false
  },
  elMaestroDelJuego: {
    enabled: false,
    intervalMinutes: 20,
    enabledGames: {
      giftBurst: true,
      familyGoal: true,
      kingOfTheHill: true
    }
  },
  elHypeMan: {
    enabled: false,
    minimumDiamonds: 1000
  }
};

let jefeBotCoordinator: JefeBotCoordinator | null = null;
let connectedClients: Set<WebSocket> = new Set();

// Broadcast to all connected dashboard clients
function broadcast(data: any) {
  const message = JSON.stringify(data);
  connectedClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('[Server] Dashboard client connected');
  connectedClients.add(ws);

  // Send current state
  ws.send(JSON.stringify({
    type: 'initial_state',
    data: {
      botConfig,
      moduleConfig,
      isRunning: jefeBotCoordinator?.isActive() || false,
      state: jefeBotCoordinator?.getState() || {}
    }
  }));

  ws.on('close', () => {
    console.log('[Server] Dashboard client disconnected');
    connectedClients.delete(ws);
  });
});

// REST API Endpoints

// Get current configuration
app.get('/api/config', (req, res) => {
  res.json({
    botConfig,
    moduleConfig,
    isRunning: jefeBotCoordinator?.isActive() || false
  });
});

// Update bot configuration
app.post('/api/config/bot', (req, res) => {
  botConfig = { ...botConfig, ...req.body };

  if (jefeBotCoordinator) {
    if (req.body.spotifyAccessToken) {
      jefeBotCoordinator.updateSpotifyToken(req.body.spotifyAccessToken);
    }
  }

  broadcast({ type: 'config_updated', data: { botConfig } });
  res.json({ success: true, botConfig });
});

// Update module configuration
app.post('/api/config/modules', (req, res) => {
  moduleConfig = { ...moduleConfig, ...req.body };

  if (jefeBotCoordinator) {
    jefeBotCoordinator.updateModuleConfig(moduleConfig);
  }

  broadcast({ type: 'config_updated', data: { moduleConfig } });
  res.json({ success: true, moduleConfig });
});

// Start the bot
app.post('/api/bot/start', async (req, res) => {
  if (jefeBotCoordinator?.isActive()) {
    return res.json({ success: false, message: 'Bot already running' });
  }

  if (!botConfig.sugoRoomId || !botConfig.botAccountToken) {
    return res.status(400).json({
      success: false,
      message: 'Missing SUGO Room ID or Bot Account Token'
    });
  }

  jefeBotCoordinator = new JefeBotCoordinator(botConfig, moduleConfig);
  await jefeBotCoordinator.start();

  broadcast({ type: 'bot_started', data: { isRunning: true } });
  res.json({ success: true, message: 'Bot started' });
});

// Stop the bot
app.post('/api/bot/stop', async (req, res) => {
  if (!jefeBotCoordinator?.isActive()) {
    return res.json({ success: false, message: 'Bot not running' });
  }

  await jefeBotCoordinator.stop();
  jefeBotCoordinator = null;

  broadcast({ type: 'bot_stopped', data: { isRunning: false } });
  res.json({ success: true, message: 'Bot stopped' });
});

// Get current bot state
app.get('/api/bot/state', (req, res) => {
  if (!jefeBotCoordinator) {
    return res.json({ state: null });
  }

  res.json({ state: jefeBotCoordinator.getState() });
});

// Simulate events (for testing)
app.post('/api/test/pk-start', async (req, res) => {
  if (!jefeBotCoordinator) {
    return res.status(400).json({ success: false, message: 'Bot not running' });
  }

  const pk: PKBattle = {
    id: 'test-pk-' + Date.now(),
    team1: 'Team Red',
    team2: 'Team Blue',
    team1Score: 0,
    team2Score: 0,
    startTime: Date.now(),
    endTime: Date.now() + 300000,
    isActive: true
  };

  await jefeBotCoordinator.onPKStart(pk);
  res.json({ success: true, pk });
});

app.post('/api/test/pk-end', async (req, res) => {
  if (!jefeBotCoordinator) {
    return res.status(400).json({ success: false, message: 'Bot not running' });
  }

  const state = jefeBotCoordinator.getState();
  if (!state.activePK) {
    return res.status(400).json({ success: false, message: 'No active PK' });
  }

  await jefeBotCoordinator.onPKEnd(state.activePK, 'Team Red', 'PlayerX');
  res.json({ success: true });
});

app.post('/api/test/gift', async (req, res) => {
  if (!jefeBotCoordinator) {
    return res.status(400).json({ success: false, message: 'Bot not running' });
  }

  const gift: Gift = {
    userId: 'user-123',
    username: req.body.username || 'TestUser',
    giftName: req.body.giftName || 'Castle',
    diamonds: req.body.diamonds || 5000,
    timestamp: Date.now()
  };

  await jefeBotCoordinator.onGiftReceived(gift);
  res.json({ success: true, gift });
});

app.post('/api/test/vibe-check', async (req, res) => {
  if (!jefeBotCoordinator) {
    return res.status(400).json({ success: false, message: 'Bot not running' });
  }

  await jefeBotCoordinator.testVibeCheck();
  res.json({ success: true });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    isRunning: jefeBotCoordinator?.isActive() || false
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`[Server] Jefe Bot Server running on http://localhost:${PORT}`);
  console.log('[Server] WebSocket available at ws://localhost:${PORT}');
});
