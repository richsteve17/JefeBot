// Jefe Bot Coordinator - The Brain
// Coordinates all four modules and manages SUGO API integration

import { ElMusico } from './modules/ElMusico.js';
import { ElAnunciador } from './modules/ElAnunciador.js';
import { ElMaestroDelJuego } from './modules/ElMaestroDelJuego.js';
import { ElHypeMan } from './modules/ElHypeMan.js';
import { BotConfig, ModuleConfig, BotState, PKBattle, Gift } from './types.js';

export class JefeBotCoordinator {
  private config: BotConfig;
  private moduleConfig: ModuleConfig;
  private state: BotState;

  // The four modules
  private elMusico: ElMusico;
  private elAnunciador: ElAnunciador;
  private elMaestroDelJuego: ElMaestroDelJuego;
  private elHypeMan: ElHypeMan;

  private isRunning: boolean = false;

  // Cooldown & activity tracking
  private lastBotMessageTime: number = 0;
  private lastActivityTime: number = Date.now();
  private recentGiftCount: number = 0;
  private recentMessageCount: number = 0;
  private lullCheckInterval: NodeJS.Timeout | null = null;
  private readonly MIN_MESSAGE_INTERVAL = 20000; // 20 seconds minimum between bot messages
  private readonly LULL_THRESHOLD = 75000; // 75 seconds of no activity = lull

  constructor(config: BotConfig, moduleConfig: ModuleConfig) {
    this.config = config;
    this.moduleConfig = moduleConfig;
    this.state = {
      currentSong: undefined,
      activePK: undefined,
      activeGame: undefined,
      lastGameTime: undefined
    };

    // Initialize all modules with shared state
    this.elMusico = new ElMusico(this.state);
    this.elAnunciador = new ElAnunciador(this.state);
    this.elMaestroDelJuego = new ElMaestroDelJuego(this.state);
    this.elHypeMan = new ElHypeMan(this.state);

    // Set message sending function for all modules with cooldown check
    const sendMessageFn = async (msg: string) => await this.sendWithCooldown(msg);
    this.elMusico.setSendMessageFunction(sendMessageFn);
    this.elAnunciador.setSendMessageFunction(sendMessageFn);
    this.elMaestroDelJuego.setSendMessageFunction(sendMessageFn);
    this.elHypeMan.setSendMessageFunction(sendMessageFn);
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[Rich$teve Bot] Already running');
      return;
    }

    console.log('[Rich$teve Bot] Starting...');

    // Initialize all modules
    await this.elMusico.initialize();
    await this.elAnunciador.initialize();
    await this.elMaestroDelJuego.initialize();
    await this.elHypeMan.initialize();

    // Apply module configurations
    this.applyModuleConfig(this.moduleConfig);

    // Start enabled modules
    if (this.moduleConfig.elMusico.enabled) {
      await this.elMusico.startMonitoring();
    }

    if (this.moduleConfig.elMaestroDelJuego.enabled) {
      await this.elMaestroDelJuego.startGameLoop();
    }

    // Start lull detector
    this.startLullDetector();

    this.isRunning = true;
    console.log('[Rich$teve Bot] All systems GO! 🚀');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('[Rich$teve Bot] Stopping...');

    // Stop lull detector
    if (this.lullCheckInterval) {
      clearInterval(this.lullCheckInterval);
      this.lullCheckInterval = null;
    }

    await this.elMusico.cleanup();
    await this.elAnunciador.cleanup();
    await this.elMaestroDelJuego.cleanup();
    await this.elHypeMan.cleanup();

    this.isRunning = false;
    console.log('[Rich$teve Bot] Stopped');
  }

  updateModuleConfig(newConfig: ModuleConfig): void {
    const wasRunning = this.isRunning;
    this.moduleConfig = newConfig;

    // If bot is running, apply config changes with proper start/stop
    if (wasRunning) {
      this.applyModuleConfigRuntime(newConfig);
    } else {
      // Just update settings if bot isn't running yet
      this.applyModuleConfig(newConfig);
    }
  }

  private async applyModuleConfigRuntime(config: ModuleConfig): Promise<void> {
    // El Músico - restart if enabled state changed
    const musicoWasEnabled = this.elMusico.isEnabled();
    this.elMusico.setEnabled(config.elMusico.enabled);
    this.elMusico.setVibeCheckEnabled(config.elMusico.vibeCheckEnabled);

    if (config.elMusico.enabled && !musicoWasEnabled) {
      await this.elMusico.startMonitoring();
    } else if (!config.elMusico.enabled && musicoWasEnabled) {
      await this.elMusico.cleanup();
    }

    // El Anunciador - just toggle (event-driven, no timers)
    this.elAnunciador.setEnabled(config.elAnunciador.enabled);

    // El Maestro del Juego - restart if enabled state changed
    const maestroWasEnabled = this.elMaestroDelJuego.isEnabled();
    this.elMaestroDelJuego.setEnabled(config.elMaestroDelJuego.enabled);
    this.elMaestroDelJuego.setIntervalMinutes(config.elMaestroDelJuego.intervalMinutes);
    this.elMaestroDelJuego.setEnabledGames(config.elMaestroDelJuego.enabledGames);

    if (config.elMaestroDelJuego.enabled && !maestroWasEnabled) {
      await this.elMaestroDelJuego.startGameLoop();
    } else if (!config.elMaestroDelJuego.enabled && maestroWasEnabled) {
      await this.elMaestroDelJuego.cleanup();
    }

    // El Hype Man - just toggle (event-driven, no timers)
    this.elHypeMan.setEnabled(config.elHypeMan.enabled);
    this.elHypeMan.setMinimumDiamonds(config.elHypeMan.minimumDiamonds);

    console.log('[JefeBot] Module configuration updated at runtime');
  }

  private applyModuleConfig(config: ModuleConfig): void {
    // El Músico
    this.elMusico.setEnabled(config.elMusico.enabled);
    this.elMusico.setVibeCheckEnabled(config.elMusico.vibeCheckEnabled);

    // El Anunciador
    this.elAnunciador.setEnabled(config.elAnunciador.enabled);

    // El Maestro del Juego
    this.elMaestroDelJuego.setEnabled(config.elMaestroDelJuego.enabled);
    this.elMaestroDelJuego.setIntervalMinutes(config.elMaestroDelJuego.intervalMinutes);
    this.elMaestroDelJuego.setEnabledGames(config.elMaestroDelJuego.enabledGames);

    // El Hype Man
    this.elHypeMan.setEnabled(config.elHypeMan.enabled);
    this.elHypeMan.setMinimumDiamonds(config.elHypeMan.minimumDiamonds);

    console.log('[Rich$teve Bot] Module configuration updated');
  }

  updateSpotifyToken(token: string): void {
    this.elMusico.setSpotifyToken(token);
  }

  // Event handlers for SUGO room events

  async onPKStart(pk: PKBattle): Promise<void> {
    console.log('[Rich$teve Bot] PK detected:', pk);
    await this.elAnunciador.onPKStart(pk);
  }

  async onPKEnd(pk: PKBattle, winner: string, mvp?: string): Promise<void> {
    console.log('[Rich$teve Bot] PK ended:', winner);
    await this.elAnunciador.onPKEnd(pk, winner, mvp);
  }

  async onPKScoreUpdate(team1Score: number, team2Score: number): Promise<void> {
    await this.elAnunciador.updatePKScores(team1Score, team2Score);
  }

  async onGiftReceived(gift: Gift): Promise<void> {
    console.log('[Rich$teve Bot] Gift received:', gift);

    // Track activity
    this.trackActivity('gift');

    // Notify both modules that care about gifts
    await this.elHypeMan.onGiftReceived(gift);
    await this.elMaestroDelJuego.onGiftReceived(gift.username, gift.giftName);
  }

  async onChatMessage(): Promise<void> {
    // Track chat activity from users
    this.trackActivity('message');
  }

  // Activity & Cooldown Management
  private trackActivity(type: 'gift' | 'message'): void {
    this.lastActivityTime = Date.now();
    if (type === 'gift') {
      this.recentGiftCount++;
    } else {
      this.recentMessageCount++;
    }

    // Reset counters every minute
    setTimeout(() => {
      if (type === 'gift') this.recentGiftCount = Math.max(0, this.recentGiftCount - 1);
      else this.recentMessageCount = Math.max(0, this.recentMessageCount - 1);
    }, 60000);
  }

  private startLullDetector(): void {
    // Check every 15 seconds if we're in a lull
    this.lullCheckInterval = setInterval(() => {
      const timeSinceActivity = Date.now() - this.lastActivityTime;

      if (timeSinceActivity >= this.LULL_THRESHOLD) {
        console.log('[Lull Detector] No activity in 75s, triggering vibe check');
        this.elMusico.triggerVibeCheck();
        // Reset activity time to prevent spam
        this.lastActivityTime = Date.now();
      }
    }, 15000);
  }

  private async sendWithCooldown(message: string): Promise<void> {
    const now = Date.now();
    const timeSinceLastMessage = now - this.lastBotMessageTime;

    // Adaptive hype: if gifts >= 3 in last minute, pause prompts. Don't talk over heat.
    if (this.recentGiftCount >= 3) {
      console.log('[Cooldown] High gift activity detected, pausing bot message');
      return;
    }

    // Enforce minimum 20s cooldown
    if (timeSinceLastMessage < this.MIN_MESSAGE_INTERVAL) {
      console.log(`[Cooldown] Message blocked, ${Math.ceil((this.MIN_MESSAGE_INTERVAL - timeSinceLastMessage) / 1000)}s remaining`);
      return;
    }

    this.lastBotMessageTime = now;
    await this.sendToSUGO(message);
  }

  // SUGO API Integration
  private async sendToSUGO(message: string): Promise<void> {
    console.log(`[SUGO Chat] ${message}`);

    // STEP 1: Replace this URL with the one you found in DevTools
    const SUGO_API_URL = 'PASTE_YOUR_SUGO_API_URL_HERE';
    // Example: 'https://api.sugo.com/v1/chat/send'

    // STEP 2: Make sure your bot token is entered in the dashboard
    // It will be available as this.config.botAccountToken

    try {
      const response = await fetch(SUGO_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.botAccountToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          room_id: this.config.sugoRoomId,
          message: message,
          // Add any other fields SUGO expects - check DevTools "Payload" tab
        })
      });

      if (!response.ok) {
        console.error(`[SUGO] Failed to send message: ${response.status}`);
      } else {
        console.log(`[SUGO] ✅ Message sent successfully`);
      }
    } catch (error) {
      console.error(`[SUGO] Error sending message:`, error);
    }
  }

  getState(): BotState {
    return this.state;
  }

  getModuleConfig(): ModuleConfig {
    return this.moduleConfig;
  }

  isActive(): boolean {
    return this.isRunning;
  }

  // Manual test triggers
  async testVibeCheck(): Promise<void> {
    await this.elMusico.triggerVibeCheck();
  }
}
