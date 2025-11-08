// El Maestro del Juego - The Game Master Module
// Runs rotating mini-games to keep the room engaged

import { BaseModule } from './BaseModule.js';
import { BotMessage, BotState, Game } from '../types.js';

type GameType = 'gift_burst' | 'family_goal' | 'king_of_the_hill';

export class ElMaestroDelJuego extends BaseModule {
  private intervalMinutes: number = 20;
  private enabledGames: Set<GameType> = new Set(['gift_burst', 'family_goal', 'king_of_the_hill']);
  private gameTimer?: NodeJS.Timeout;
  private gameUpdateTimer?: NodeJS.Timeout;
  private sendMessageFn?: (msg: string) => Promise<void>;
  private currentGameIndex: number = 0;

  constructor(state: BotState) {
    super('El Maestro del Juego', state);
  }

  async initialize(): Promise<void> {
    this.log('Initializing...');
  }

  async cleanup(): Promise<void> {
    if (this.gameTimer) clearInterval(this.gameTimer);
    if (this.gameUpdateTimer) clearInterval(this.gameUpdateTimer);
  }

  setSendMessageFunction(fn: (msg: string) => Promise<void>): void {
    this.sendMessageFn = fn;
  }

  setIntervalMinutes(minutes: number): void {
    this.intervalMinutes = minutes;
    this.log(`Game interval set to ${minutes} minutes`);
  }

  setEnabledGames(games: { giftBurst: boolean; familyGoal: boolean; kingOfTheHill: boolean }): void {
    this.enabledGames.clear();
    if (games.giftBurst) this.enabledGames.add('gift_burst');
    if (games.familyGoal) this.enabledGames.add('family_goal');
    if (games.kingOfTheHill) this.enabledGames.add('king_of_the_hill');
    this.log(`Enabled games: ${Array.from(this.enabledGames).join(', ')}`);
  }

  async startGameLoop(): Promise<void> {
    if (!this.enabled || !this.sendMessageFn) return;

    // Check for games every minute
    this.gameTimer = setInterval(async () => {
      await this.checkAndStartGame();
    }, 60000);

    this.log('Game loop started');
  }

  private async checkAndStartGame(): Promise<void> {
    // Don't start a game if:
    // 1. A PK is active
    // 2. A game is already running
    // 3. Not enough time has passed since last game

    if (this.state.activePK?.isActive) {
      this.log('Skipping game - PK is active');
      return;
    }

    if (this.state.activeGame?.isActive) {
      this.log('Skipping game - Game already active');
      return;
    }

    const now = Date.now();
    const timeSinceLastGame = this.state.lastGameTime ? (now - this.state.lastGameTime) / 1000 / 60 : Infinity;

    if (timeSinceLastGame < this.intervalMinutes) {
      this.log(`Skipping game - Only ${timeSinceLastGame.toFixed(1)} minutes since last game`);
      return;
    }

    // Time to start a new game!
    await this.startNextGame();
  }

  private async startNextGame(): Promise<void> {
    if (this.enabledGames.size === 0) return;

    const gamesArray = Array.from(this.enabledGames);
    const gameType = gamesArray[this.currentGameIndex % gamesArray.length];
    this.currentGameIndex++;

    switch (gameType) {
      case 'gift_burst':
        await this.startGiftBurst();
        break;
      case 'family_goal':
        await this.startFamilyGoal();
        break;
      case 'king_of_the_hill':
        await this.startKingOfTheHill();
        break;
    }

    this.state.lastGameTime = Date.now();
  }

  private async startGiftBurst(): Promise<void> {
    if (!this.sendMessageFn) return;

    const duration = 60000; // 60 seconds
    const game: Game = {
      type: 'gift_burst',
      startTime: Date.now(),
      endTime: Date.now() + duration,
      isActive: true,
      participants: new Map()
    };

    this.state.activeGame = game;

    const startMsg: BotMessage = {
      type: 'announcement',
      content: `[Rich$teve] 🔥 ¡REGALO RÁPIDO! (Gift Burst!) 🔥\n[Rich$teve] 60 seconds! Most 'Rose' gifts wins!\n[Rich$teve] ¡VAMOS!`
    };

    await this.sendMessage(startMsg, this.sendMessageFn);
    this.log('Started Gift Burst game');

    // End game after duration
    setTimeout(async () => {
      await this.endGiftBurst();
    }, duration);
  }

  private async endGiftBurst(): Promise<void> {
    if (!this.sendMessageFn || !this.state.activeGame) return;

    const game = this.state.activeGame;
    const participants = Array.from(game.participants.entries())
      .sort((a, b) => b[1] - a[1]);

    const winner = participants[0];

    const endMsg: BotMessage = {
      type: 'announcement',
      content: winner
        ? `[Rich$teve] 🏆 ¡GANADOR! 🏆\n[Rich$teve] ${winner[0]} wins with ${winner[1]} roses!\n[Rich$teve] ¡Felicidades!`
        : `[Rich$teve] ⏱️ Time's up!\n[Rich$teve] No participants this round. Next time!`
    };

    await this.sendMessage(endMsg, this.sendMessageFn);
    this.log('Gift Burst ended');

    this.state.activeGame = undefined;
  }

  private async startFamilyGoal(): Promise<void> {
    if (!this.sendMessageFn) return;

    const duration = 180000; // 3 minutes
    const goal = 50;
    const game: Game = {
      type: 'family_goal',
      startTime: Date.now(),
      endTime: Date.now() + duration,
      isActive: true,
      participants: new Map(),
      goal
    };

    this.state.activeGame = game;

    const startMsg: BotMessage = {
      type: 'announcement',
      content: `[Rich$teve] 🤝 ¡META FAMILIAR! (Family Goal!) 🤝\n[Rich$teve] Let's hit ${goal} 'Palomitas' (Popcorn) gifts TOGETHER in 3 minutes!\n[Rich$teve] ¡Todos juntos! (All together!)`
    };

    await this.sendMessage(startMsg, this.sendMessageFn);
    this.log('Started Family Goal game');

    // Update progress every 30 seconds
    const updateInterval = setInterval(async () => {
      if (!this.state.activeGame?.isActive) {
        clearInterval(updateInterval);
        return;
      }
      await this.updateFamilyGoalProgress();
    }, 30000);

    // End game after duration
    setTimeout(async () => {
      clearInterval(updateInterval);
      await this.endFamilyGoal();
    }, duration);
  }

  private async updateFamilyGoalProgress(): Promise<void> {
    if (!this.sendMessageFn || !this.state.activeGame) return;

    const game = this.state.activeGame;
    const totalGifts = Array.from(game.participants.values()).reduce((a, b) => a + b, 0);
    const goal = game.goal || 50;

    const progressMsg: BotMessage = {
      type: 'chat',
      content: `[Rich$teve] 📊 Progress: ${totalGifts}/${goal}\n[Rich$teve] ${totalGifts >= goal ? '¡LO LOGRAMOS! (We did it!)' : '¡Sigue así! (Keep going!)'}`
    };

    await this.sendMessage(progressMsg, this.sendMessageFn);
  }

  private async endFamilyGoal(): Promise<void> {
    if (!this.sendMessageFn || !this.state.activeGame) return;

    const game = this.state.activeGame;
    const totalGifts = Array.from(game.participants.values()).reduce((a, b) => a + b, 0);
    const goal = game.goal || 50;
    const success = totalGifts >= goal;

    const endMsg: BotMessage = {
      type: 'announcement',
      content: success
        ? `[Rich$teve] 🎉 ¡META ALCANZADA! 🎉\n[Rich$teve] ${totalGifts}/${goal} gifts!\n[Rich$teve] ¡La familia es fuerte! (The family is strong!)`
        : `[Rich$teve] ⏱️ Time's up!\n[Rich$teve] ${totalGifts}/${goal} gifts. Almost there!\n[Rich$teve] Next time we'll get it!`
    };

    await this.sendMessage(endMsg, this.sendMessageFn);
    this.log(`Family Goal ended - ${success ? 'SUCCESS' : 'FAILED'}`);

    this.state.activeGame = undefined;
  }

  private async startKingOfTheHill(): Promise<void> {
    if (!this.sendMessageFn) return;

    const duration = 300000; // 5 minutes
    const game: Game = {
      type: 'king_of_the_hill',
      startTime: Date.now(),
      endTime: Date.now() + duration,
      isActive: true,
      participants: new Map()
    };

    this.state.activeGame = game;

    const startMsg: BotMessage = {
      type: 'announcement',
      content: `[Rich$teve] 👑 ¡REY DE LA COLINA! (King of the Hill!) 👑\n[Rich$teve] 5-minute timer. The person who sends the LAST gift before the timer hits 0 wins the crown!\n[Rich$teve] ¡Pelea por la corona! (Fight for the crown!)`
    };

    await this.sendMessage(startMsg, this.sendMessageFn);
    this.log('Started King of the Hill game');

    // End game after duration
    setTimeout(async () => {
      await this.endKingOfTheHill();
    }, duration);
  }

  private async endKingOfTheHill(): Promise<void> {
    if (!this.sendMessageFn || !this.state.activeGame) return;

    const game = this.state.activeGame;
    // The last participant to send a gift wins
    const participants = Array.from(game.participants.entries());
    const winner = participants[participants.length - 1];

    const endMsg: BotMessage = {
      type: 'announcement',
      content: winner
        ? `[Rich$teve] 👑 ¡EL REY/LA REINA! 👑\n[Rich$teve] ${winner[0]} holds the crown!\n[Rich$teve] ¡Felicidades!`
        : `[Rich$teve] ⏱️ Time's up!\n[Rich$teve] No king this round!`
    };

    await this.sendMessage(endMsg, this.sendMessageFn);
    this.log('King of the Hill ended');

    this.state.activeGame = undefined;
  }

  // Track gift participation
  async onGiftReceived(username: string, giftName: string): Promise<void> {
    if (!this.state.activeGame?.isActive) return;

    const game = this.state.activeGame;
    const current = game.participants.get(username) || 0;
    game.participants.set(username, current + 1);

    // Check if family goal is reached
    if (game.type === 'family_goal') {
      const totalGifts = Array.from(game.participants.values()).reduce((a, b) => a + b, 0);
      if (totalGifts >= (game.goal || 50)) {
        // Goal reached early!
        await this.endFamilyGoal();
      }
    }
  }
}
