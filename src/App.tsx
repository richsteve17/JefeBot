import { useState, useEffect } from 'react';
import './App.css';

interface BotConfig {
  sugoRoomId: string;
  botAccountToken: string;
  spotifyAccessToken?: string;
}

interface ModuleConfig {
  elMusico: {
    enabled: boolean;
    vibeCheckEnabled: boolean;
  };
  elAnunciador: {
    enabled: boolean;
  };
  elMaestroDelJuego: {
    enabled: boolean;
    intervalMinutes: number;
    enabledGames: {
      giftBurst: boolean;
      familyGoal: boolean;
      kingOfTheHill: boolean;
    };
  };
  elHypeMan: {
    enabled: boolean;
    minimumDiamonds: number;
  };
}

interface BotState {
  currentSong?: {
    name: string;
    artist: string;
  };
  activePK?: any;
  activeGame?: any;
}

function App() {
  const [botConfig, setBotConfig] = useState<BotConfig>({
    sugoRoomId: '',
    botAccountToken: '',
    spotifyAccessToken: ''
  });

  const [moduleConfig, setModuleConfig] = useState<ModuleConfig>({
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
  });

  const [isRunning, setIsRunning] = useState(false);
  const [botState, setBotState] = useState<BotState>({});
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [testChatMessage, setTestChatMessage] = useState('🎯 Test from Jefe Bot');
  const [testChatStatus, setTestChatStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  useEffect(() => {
    // Load initial config
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.botConfig) setBotConfig(data.botConfig);
        if (data.moduleConfig) setModuleConfig(data.moduleConfig);
        setIsRunning(data.isRunning);
      });

    // Connect to WebSocket
    // Use wss:// for HTTPS (production/Railway), ws:// for HTTP (local dev)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    console.log('Connecting to WebSocket:', wsUrl);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Connected to Jefe Bot Server');
      setConnectionStatus('connected');
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log('WS Message:', message);

      switch (message.type) {
        case 'initial_state':
          if (message.data.botConfig) setBotConfig(message.data.botConfig);
          if (message.data.moduleConfig) setModuleConfig(message.data.moduleConfig);
          setIsRunning(message.data.isRunning);
          setBotState(message.data.state);
          break;
        case 'config_updated':
          if (message.data.botConfig) setBotConfig(message.data.botConfig);
          if (message.data.moduleConfig) setModuleConfig(message.data.moduleConfig);
          break;
        case 'bot_started':
          setIsRunning(true);
          break;
        case 'bot_stopped':
          setIsRunning(false);
          break;
      }
    };

    ws.onclose = () => {
      console.log('Disconnected from Jefe Bot Server');
      setConnectionStatus('disconnected');
    };

    return () => ws.close();
  }, []);

  const updateBotConfig = async (updates: Partial<BotConfig>) => {
    const newConfig = { ...botConfig, ...updates };
    setBotConfig(newConfig);
    await fetch('/api/config/bot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
  };

  const updateModuleConfig = async (updates: Partial<ModuleConfig>) => {
    const newConfig = { ...moduleConfig, ...updates };
    setModuleConfig(newConfig);
    await fetch('/api/config/modules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
  };

  const startBot = async () => {
    const res = await fetch('/api/bot/start', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      setIsRunning(true);
    } else {
      alert(data.message);
    }
  };

  const stopBot = async () => {
    await fetch('/api/bot/stop', { method: 'POST' });
    setIsRunning(false);
  };

  const testPK = async () => {
    await fetch('/api/test/pk-start', { method: 'POST' });
  };

  const testGift = async () => {
    await fetch('/api/test/gift', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Kelsey',
        giftName: 'Castle',
        diamonds: 5000
      })
    });
  };

  const testVibeCheck = async () => {
    await fetch('/api/test/vibe-check', { method: 'POST' });
  };

  const testChat = async () => {
    setTestChatStatus('sending');
    try {
      const res = await fetch('/api/test/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: testChatMessage })
      });
      const data = await res.json();
      if (data.success) {
        setTestChatStatus('success');
        setTimeout(() => setTestChatStatus('idle'), 2000);
      } else {
        setTestChatStatus('error');
        setTimeout(() => setTestChatStatus('idle'), 3000);
      }
    } catch (err) {
      setTestChatStatus('error');
      setTimeout(() => setTestChatStatus('idle'), 3000);
    }
  };

  const testChatDiscovery = async () => {
    try {
      await fetch('/api/test/chat-discovery', { method: 'POST' });
      alert('Testing 4 chat formats - check Railway logs for server responses!');
    } catch (err) {
      alert('Discovery test failed - check connection');
    }
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>💰 RICH $TEVE BOT 💰</h1>
        <p className="tagline">The Rich Legacy - Your Interactive MC</p>
        <div className="connection-status">
          <span className={`status-indicator ${connectionStatus}`}></span>
          {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
        </div>
      </header>

      <div className="main-controls">
        <div className="config-section">
          <h2>⚙️ Configuration</h2>
          <div className="form-group">
            <label>SUGO Room ID</label>
            <input
              type="text"
              value={botConfig.sugoRoomId}
              onChange={(e) => updateBotConfig({ sugoRoomId: e.target.value })}
              placeholder="Enter your SUGO room ID"
              disabled={isRunning}
            />
          </div>
          <div className="form-group">
            <label>Bot Account Token</label>
            <input
              type="password"
              value={botConfig.botAccountToken}
              onChange={(e) => updateBotConfig({ botAccountToken: e.target.value })}
              placeholder="Enter bot account token"
              disabled={isRunning}
            />
          </div>
          <div className="form-group">
            <label>Spotify Access Token (Optional)</label>
            <input
              type="password"
              value={botConfig.spotifyAccessToken || ''}
              onChange={(e) => updateBotConfig({ spotifyAccessToken: e.target.value })}
              placeholder="Enter Spotify access token"
            />
          </div>
        </div>

        <div className="power-control">
          <button
            className={`power-button ${isRunning ? 'stop' : 'start'}`}
            onClick={isRunning ? stopBot : startBot}
          >
            {isRunning ? '⏹ STOP BOT' : '▶ START BOT'}
          </button>
          <div className="bot-status">
            {isRunning ? '🟢 Bot is RUNNING' : '🔴 Bot is STOPPED'}
          </div>
        </div>
      </div>

      <div className="modules-grid">
        {/* El Músico */}
        <div className="module-card">
          <div className="module-header">
            <h3>🎧 El Músico</h3>
            <label className="toggle">
              <input
                type="checkbox"
                checked={moduleConfig.elMusico.enabled}
                onChange={(e) => updateModuleConfig({
                  elMusico: { ...moduleConfig.elMusico, enabled: e.target.checked }
                })}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
          <p className="module-description">The Musician - Spotify integration + Vibe Check polls</p>
          <div className="module-settings">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={moduleConfig.elMusico.vibeCheckEnabled}
                onChange={(e) => updateModuleConfig({
                  elMusico: { ...moduleConfig.elMusico, vibeCheckEnabled: e.target.checked }
                })}
                disabled={!moduleConfig.elMusico.enabled}
              />
              Enable "Vibe Check" Polls
            </label>
          </div>
          {botState.currentSong && (
            <div className="module-status">
              <strong>Now Playing:</strong><br />
              {botState.currentSong.name} - {botState.currentSong.artist}
            </div>
          )}
        </div>

        {/* El Anunciador */}
        <div className="module-card">
          <div className="module-header">
            <h3>📢 El Anunciador</h3>
            <label className="toggle">
              <input
                type="checkbox"
                checked={moduleConfig.elAnunciador.enabled}
                onChange={(e) => updateModuleConfig({
                  elAnunciador: { enabled: e.target.checked }
                })}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
          <p className="module-description">The PK Announcer - Automatic battle commentary</p>
          <div className="module-status">
            {botState.activePK ? (
              <>
                <strong>Active PK:</strong><br />
                {botState.activePK.team1} vs {botState.activePK.team2}
              </>
            ) : (
              'No active PK'
            )}
          </div>
        </div>

        {/* El Maestro del Juego */}
        <div className="module-card">
          <div className="module-header">
            <h3>🎮 El Maestro del Juego</h3>
            <label className="toggle">
              <input
                type="checkbox"
                checked={moduleConfig.elMaestroDelJuego.enabled}
                onChange={(e) => updateModuleConfig({
                  elMaestroDelJuego: { ...moduleConfig.elMaestroDelJuego, enabled: e.target.checked }
                })}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
          <p className="module-description">The Game Master - Rotating mini-games</p>
          <div className="module-settings">
            <label>Game Interval (minutes)</label>
            <input
              type="number"
              min="5"
              max="60"
              value={moduleConfig.elMaestroDelJuego.intervalMinutes}
              onChange={(e) => updateModuleConfig({
                elMaestroDelJuego: { ...moduleConfig.elMaestroDelJuego, intervalMinutes: parseInt(e.target.value) }
              })}
              disabled={!moduleConfig.elMaestroDelJuego.enabled}
            />
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={moduleConfig.elMaestroDelJuego.enabledGames.giftBurst}
                onChange={(e) => updateModuleConfig({
                  elMaestroDelJuego: {
                    ...moduleConfig.elMaestroDelJuego,
                    enabledGames: { ...moduleConfig.elMaestroDelJuego.enabledGames, giftBurst: e.target.checked }
                  }
                })}
                disabled={!moduleConfig.elMaestroDelJuego.enabled}
              />
              Gift Burst
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={moduleConfig.elMaestroDelJuego.enabledGames.familyGoal}
                onChange={(e) => updateModuleConfig({
                  elMaestroDelJuego: {
                    ...moduleConfig.elMaestroDelJuego,
                    enabledGames: { ...moduleConfig.elMaestroDelJuego.enabledGames, familyGoal: e.target.checked }
                  }
                })}
                disabled={!moduleConfig.elMaestroDelJuego.enabled}
              />
              Family Goal
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={moduleConfig.elMaestroDelJuego.enabledGames.kingOfTheHill}
                onChange={(e) => updateModuleConfig({
                  elMaestroDelJuego: {
                    ...moduleConfig.elMaestroDelJuego,
                    enabledGames: { ...moduleConfig.elMaestroDelJuego.enabledGames, kingOfTheHill: e.target.checked }
                  }
                })}
                disabled={!moduleConfig.elMaestroDelJuego.enabled}
              />
              King of the Hill
            </label>
          </div>
          {botState.activeGame && (
            <div className="module-status">
              <strong>Active Game:</strong> {botState.activeGame.type}
            </div>
          )}
        </div>

        {/* El Hype Man */}
        <div className="module-card">
          <div className="module-header">
            <h3>🔥 El Hype Man</h3>
            <label className="toggle">
              <input
                type="checkbox"
                checked={moduleConfig.elHypeMan.enabled}
                onChange={(e) => updateModuleConfig({
                  elHypeMan: { ...moduleConfig.elHypeMan, enabled: e.target.checked }
                })}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
          <p className="module-description">The Hype Man - Instant big gift shout-outs</p>
          <div className="module-settings">
            <label>Minimum Diamonds for Shout-Out</label>
            <input
              type="number"
              min="100"
              max="10000"
              step="100"
              value={moduleConfig.elHypeMan.minimumDiamonds}
              onChange={(e) => updateModuleConfig({
                elHypeMan: { ...moduleConfig.elHypeMan, minimumDiamonds: parseInt(e.target.value) }
              })}
              disabled={!moduleConfig.elHypeMan.enabled}
            />
          </div>
        </div>
      </div>

      {/* Test Controls */}
      <div className="test-controls">
        <h3>🧪 Test Controls</h3>
        <div className="test-buttons">
          <button onClick={testVibeCheck} disabled={!isRunning}>
            Test Vibe Check
          </button>
          <button onClick={testPK} disabled={!isRunning}>
            Test PK Start
          </button>
          <button onClick={testGift} disabled={!isRunning}>
            Test Big Gift
          </button>
          <button onClick={testChatDiscovery} disabled={!isRunning} style={{ backgroundColor: '#9333ea' }}>
            🔍 Discover Chat Format
          </button>
        </div>

        <div className="test-chat-section">
          <h4>💬 Send Test Message</h4>
          <div className="test-chat-controls">
            <input
              type="text"
              value={testChatMessage}
              onChange={(e) => setTestChatMessage(e.target.value)}
              placeholder="Enter test message..."
              disabled={!isRunning || testChatStatus === 'sending'}
            />
            <button
              onClick={testChat}
              disabled={!isRunning || testChatStatus === 'sending'}
              className={`test-chat-btn ${testChatStatus}`}
            >
              {testChatStatus === 'sending' && '⏳ Sending...'}
              {testChatStatus === 'success' && '✅ Sent!'}
              {testChatStatus === 'error' && '❌ Failed'}
              {testChatStatus === 'idle' && '📤 Send to Chat'}
            </button>
          </div>
          {testChatStatus === 'success' && (
            <div className="test-feedback success">Message sent to SUGO chat!</div>
          )}
          {testChatStatus === 'error' && (
            <div className="test-feedback error">Failed to send - check if bot is connected</div>
          )}
        </div>
      </div>

      <footer className="dashboard-footer">
        <p>Rich $teve Bot v1.0 - Building the Legacy 24/7</p>
      </footer>
    </div>
  );
}

export default App;
