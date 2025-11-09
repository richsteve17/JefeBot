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

  // Render progress bar: [▮▮▮▯▯]
  private renderProgressBar(current: number, goal: number, length: number = 5): string {
    const filled = Math.min(Math.floor((current / goal) * length), length);
    const empty = length - filled;
    return '[' + '▮'.repeat(filled) + '▯'.repeat(empty) + ']';
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
    const goal = 10; // Target number of gifts
    const game: Game = {
      type: 'gift_burst',
      startTime: Date.now(),
      endTime: Date.now() + duration,
      isActive: true,
      participants: new Map(),
      goal
    };

    this.state.activeGame = game;

    const startMsg: BotMessage = {
      type: 'announcement',
      content: `⏳ 60s GIFT BURST: fill the bar and I drop a freestyle with your name!\nProgress: ${this.renderProgressBar(0, goal)}\n🌹 Drop roses NOW!`
    };

    await this.sendMessage(startMsg, this.sendMessageFn);
    this.log('Started Gift Burst game');

    // Update progress every 10 seconds
    const updateInterval = setInterval(async () => {
      if (!this.state.activeGame?.isActive) {
        clearInterval(updateInterval);
        return;
      }
      await this.updateGiftBurstProgress();
    }, 10000);

    // End game after duration
    setTimeout(async () => {
      clearInterval(updateInterval);
      await this.endGiftBurst();
    }, duration);
  }

  private async updateGiftBurstProgress(): Promise<void> {
    if (!this.sendMessageFn || !this.state.activeGame) return;

    const game = this.state.activeGame;
    const totalGifts = Array.from(game.participants.values()).reduce((a, b) => a + b, 0);
    const goal = game.goal || 10;
    const timeLeft = Math.ceil((game.endTime - Date.now()) / 1000);

    const progressMsg: BotMessage = {
      type: 'chat',
      content: `⏱️ ${timeLeft}s left! ${this.renderProgressBar(totalGifts, goal)} ${totalGifts}/${goal}`
    };

    await this.sendMessage(progressMsg, this.sendMessageFn);
  }

  private async endGiftBurst(): Promise<void> {
    if (!this.sendMessageFn || !this.state.activeGame) return;

    const game = this.state.activeGame;
    const participants = Array.from(game.participants.entries())
      .sort((a, b) => b[1] - a[1]);

    const winner = participants[0];
    const totalGifts = Array.from(game.participants.values()).reduce((a, b) => a + b, 0);
    const goal = game.goal || 10;

    let message = '';
    if (winner) {
      if (totalGifts >= goal) {
        // Goal reached! Deliver the reward
        message = `🏆 BURST COMPLETE! 🏆\n${winner[0]} wins with ${winner[1]} roses!\n🎤 Freestyle coming now with ${winner[0]}'s name! 🔥`;
      } else {
        // Winner but goal not reached
        message = `⏱️ Time's up! ${this.renderProgressBar(totalGifts, goal)} ${totalGifts}/${goal}\n👑 ${winner[0]} led with ${winner[1]} roses!\nAlmost had it - next one! 💪`;
      }
    } else {
      message = `⏱️ Time's up! No takers this round.\nNext burst starts soon 👀`;
    }

    const endMsg: BotMessage = {
      type: 'announcement',
      content: message
    };

    await this.sendMessage(endMsg, this.sendMessageFn);
    this.log('Gift Burst ended');

    this.state.activeGame = undefined;
  }

  private async startFamilyGoal(): Promise<void> {
    if (!this.sendMessageFn) return;

    const duration = 180000; // 3 minutes
    const goal = 30; // More achievable goal
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
      content: `🤝 FAMILY GOAL: Hit ${goal} gifts in 3 mins = I run the wheel!\n${this.renderProgressBar(0, goal)} 0/${goal}\nEVERY gift counts! ¡Todos juntos!`
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
    const goal = game.goal || 30;

    const progressMsg: BotMessage = {
      type: 'chat',
      content: `📊 ${this.renderProgressBar(totalGifts, goal)} ${totalGifts}/${goal}\n${totalGifts >= goal ? '✅ GOAL HIT! Wheel coming!' : '⬆️ Keep going familia!'}`
    };

    await this.sendMessage(progressMsg, this.sendMessageFn);
  }

  private async endFamilyGoal(): Promise<void> {
    if (!this.sendMessageFn || !this.state.activeGame) return;

    const game = this.state.activeGame;
    const totalGifts = Array.from(game.participants.values()).reduce((a, b) => a + b, 0);
    const goal = game.goal || 30;
    const success = totalGifts >= goal;

    const endMsg: BotMessage = {
      type: 'announcement',
      content: success
        ? `🎉 FAMILY GOAL COMPLETE! 🎉\n${this.renderProgressBar(totalGifts, goal)} ${totalGifts}/${goal}\n🎡 Spinning the wheel NOW! La familia es fuerte! 💪`
        : `⏱️ Time's up! ${this.renderProgressBar(totalGifts, goal)} ${totalGifts}/${goal}\nAlmost there! Next goal soon 👀`
    };

    await this.sendMessage(endMsg, this.sendMessageFn);
    this.log(`Family Goal ended - ${success ? 'SUCCESS' : 'FAILED'}`);

    this.state.activeGame = undefined;
  }

  private async startKingOfTheHill(): Promise<void> {
    if (!this.sendMessageFn) return;

    const duration = 90000; // 90 seconds (shorter = more excitement)
    const game: Game = {
      type: 'king_of_the_hill',
      startTime: Date.now(),
      endTime: Date.now() + duration,
      isActive: true,
      participants: new Map(),
      lastGifter: undefined
    };

    this.state.activeGame = game;

    const startMsg: BotMessage = {
      type: 'announcement',
      content: `👑 KING OF THE HILL! 👑\n90s timer. Last gift sent = you get the horn + shout-out!\nAny gift within 90s steals it. Fight for the throne! ⚔️`
    };

    await this.sendMessage(startMsg, this.sendMessageFn);
    this.log('Started King of the Hill game');

    // Announce leader every 20 seconds
    const updateInterval = setInterval(async () => {
      if (!this.state.activeGame?.isActive) {
        clearInterval(updateInterval);
        return;
      }
      await this.updateKingStatus();
    }, 20000);

    // End game after duration
    setTimeout(async () => {
      clearInterval(updateInterval);
      await this.endKingOfTheHill();
    }, duration);
  }

  private async updateKingStatus(): Promise<void> {
    if (!this.sendMessageFn || !this.state.activeGame) return;

    const game = this.state.activeGame;
    const timeLeft = Math.ceil((game.endTime - Date.now()) / 1000);
    const currentKing = game.lastGifter;

    if (currentKing) {
      const statusMsg: BotMessage = {
        type: 'chat',
        content: `⏱️ ${timeLeft}s left: ${currentKing} holds the throne!\nAny gift steals it! 👑`
      };
      await this.sendMessage(statusMsg, this.sendMessageFn);
    }
  }

  private async endKingOfTheHill(): Promise<void> {
    if (!this.sendMessageFn || !this.state.activeGame) return;

    const game = this.state.activeGame;
    const winner = game.lastGifter;

    const endMsg: BotMessage = {
      type: 'announcement',
      content: winner
        ? `👑 KING OF THE HILL OVER! 👑\n${winner} HOLDS THE THRONE!\n🔊 Horn goes to ${winner}! Respect! 🙌`
        : `⏱️ Time's up! No one claimed the throne this round.\nNext king coming soon 👀`
    };

    await this.sendMessage(endMsg, this.sendMessageFn);
    this.log('King of the Hill ended');

    this.state.activeGame = undefined;
  }

  // Track gift participation
  async onGiftReceived(username: string, _giftName: string): Promise<void> {
    if (!this.state.activeGame?.isActive) return;

    const game = this.state.activeGame;
    const current = game.participants.get(username) || 0;
    game.participants.set(username, current + 1);

    // King of the Hill: track last gifter
    if (game.type === 'king_of_the_hill') {
      game.lastGifter = username;
    }

    // Check if family goal is reached
    if (game.type === 'family_goal') {
      const totalGifts = Array.from(game.participants.values()).reduce((a, b) => a + b, 0);
      if (totalGifts >= (game.goal || 30)) {
        // Goal reached early!
        await this.endFamilyGoal();
      }
    }

    // Check if gift burst goal is reached
    if (game.type === 'gift_burst') {
      const totalGifts = Array.from(game.participants.values()).reduce((a, b) => a + b, 0);
      if (totalGifts >= (game.goal || 10)) {
        // Goal reached early!
        await this.endGiftBurst();
      }
    }
  }
}
