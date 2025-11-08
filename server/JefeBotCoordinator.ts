// Jefe Bot Coordinator - The Brain
// Coordinates all four modules and manages SUGO API integration

import { ElMusico } from './modules/ElMusico.js';
import { ElAnunciador } from './modules/ElAnunciador.js';
import { ElMaestroDelJuego } from './modules/ElMaestroDelJuego.js';
import { ElHypeMan } from './modules/ElHypeMan.js';
import { BotConfig, ModuleConfig, BotState, PKBattle, Gift } from './types.js';

export class Rich$teve BotCoordinator {
  private config: BotConfig;
  private moduleConfig: ModuleConfig;
  private state: BotState;

  // The four modules
  private elMusico: ElMusico;
  private elAnunciador: ElAnunciador;
  private elMaestroDelJuego: ElMaestroDelJuego;
  private elHypeMan: ElHypeMan;

  private isRunning: boolean = false;

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

    // Set message sending function for all modules
    const sendMessageFn = async (msg: string) => await this.sendToSUGO(msg);
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

    this.isRunning = true;
    console.log('[Rich$teve Bot] All systems GO! 🚀');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('[Rich$teve Bot] Stopping...');

    await this.elMusico.cleanup();
    await this.elAnunciador.cleanup();
    await this.elMaestroDelJuego.cleanup();
    await this.elHypeMan.cleanup();

    this.isRunning = false;
    console.log('[Rich$teve Bot] Stopped');
  }

  updateModuleConfig(newConfig: ModuleConfig): void {
    this.moduleConfig = newConfig;
    this.applyModuleConfig(newConfig);
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

    // Notify both modules that care about gifts
    await this.elHypeMan.onGiftReceived(gift);
    await this.elMaestroDelJuego.onGiftReceived(gift.username, gift.giftName);
  }

  // SUGO API Integration (mock for now - will need real SUGO API)
  private async sendToSUGO(message: string): Promise<void> {
    // This would be the actual SUGO API call
    // For now, just log it
    console.log(`[SUGO Chat] ${message}`);

    // TODO: Implement actual SUGO chat API
    // await fetch(`https://sugo-api.example.com/rooms/${this.config.sugoRoomId}/messages`, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${this.config.botAccountToken}`,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({ message })
    // });
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
