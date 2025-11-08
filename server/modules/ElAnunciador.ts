// El Anunciador - The PK Announcer Module
// Watches for PK battles and provides live commentary

import { BaseModule } from './BaseModule.js';
import { BotMessage, BotState, PKBattle } from '../types.js';

export class ElAnunciador extends BaseModule {
  private updateInterval?: NodeJS.Timeout;
  private sendMessageFn?: (msg: string) => Promise<void>;

  constructor(state: BotState) {
    super('El Anunciador', state);
  }

  async initialize(): Promise<void> {
    this.log('Initializing...');
  }

  async cleanup(): Promise<void> {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }

  setSendMessageFunction(fn: (msg: string) => Promise<void>): void {
    this.sendMessageFn = fn;
  }

  // Called when a PK battle is detected
  async onPKStart(pk: PKBattle): Promise<void> {
    if (!this.enabled || !this.sendMessageFn) return;

    this.state.activePK = pk;

    const startMsg: BotMessage = {
      type: 'announcement',
      content: `[Rich$teve] 🔴🔵 ¡ES TIEMPO DE BATALLA! 🔴🔵\n[Rich$teve] ${pk.team1} vs ${pk.team2}\n[Rich$teve] ¡VAMOS! Let's GO!`
    };

    await this.sendMessage(startMsg, this.sendMessageFn);
    this.log(`PK Started: ${pk.team1} vs ${pk.team2}`);

    // Start providing updates every 60 seconds
    this.startUpdates();
  }

  private startUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(async () => {
      if (!this.state.activePK || !this.state.activePK.isActive) {
        if (this.updateInterval) clearInterval(this.updateInterval);
        return;
      }

      await this.sendUpdate();
    }, 60000); // Every 60 seconds
  }

  private async sendUpdate(): Promise<void> {
    if (!this.sendMessageFn || !this.state.activePK) return;

    const pk = this.state.activePK;
    const timeRemaining = Math.ceil((pk.endTime - Date.now()) / 1000 / 60);

    let leader = '';
    if (pk.team1Score > pk.team2Score) {
      leader = `${pk.team1} is LEADING! 🔴`;
    } else if (pk.team2Score > pk.team1Score) {
      leader = `${pk.team2} is LEADING! 🔵`;
    } else {
      leader = `It's TIED! 🟡`;
    }

    const updateMsg: BotMessage = {
      type: 'chat',
      content: `[Rich$teve] ⚡ PK UPDATE ⚡\n[Rich$teve] ${pk.team1}: ${pk.team1Score} | ${pk.team2}: ${pk.team2Score}\n[Rich$teve] ${leader}\n[Rich$teve] ${timeRemaining} minutes remaining!`
    };

    await this.sendMessage(updateMsg, this.sendMessageFn);
  }

  async onPKEnd(pk: PKBattle, winner: string, mvp?: string): Promise<void> {
    if (!this.enabled || !this.sendMessageFn) return;

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    const endMsg: BotMessage = {
      type: 'announcement',
      content: `[Rich$teve] 🏆 ¡BATALLA TERMINADA! 🏆\n[Rich$teve] Winner: ${winner}!\n[Rich$teve] Final Score: ${pk.team1}: ${pk.team1Score} | ${pk.team2}: ${pk.team2Score}${mvp ? `\n[Rich$teve] 👑 MVP: ${mvp}! 👑` : ''}`
    };

    await this.sendMessage(endMsg, this.sendMessageFn);
    this.log(`PK Ended: ${winner} wins!`);

    this.state.activePK = undefined;
  }

  // Update scores in real-time
  async updatePKScores(team1Score: number, team2Score: number): Promise<void> {
    if (this.state.activePK) {
      this.state.activePK.team1Score = team1Score;
      this.state.activePK.team2Score = team2Score;
    }
  }
}
