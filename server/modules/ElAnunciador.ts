// El Anunciador - The PK Announcer Module
// Watches for PK battles and provides live commentary

import { BaseModule } from './BaseModule.js';
import { BotMessage, BotState, PKBattle } from '../types.js';

export class ElAnunciador extends BaseModule {
  private updateInterval?: NodeJS.Timeout;
  private snipeTimers: NodeJS.Timeout[] = [];
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
    this.clearSnipeTimers();
  }

  private clearSnipeTimers(): void {
    this.snipeTimers.forEach(timer => clearTimeout(timer));
    this.snipeTimers = [];
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
      content: `🥊 PK BATTLE STARTING! 🥊\n${pk.team1} 🔴 vs 🔵 ${pk.team2}\n5 minutes on the clock. Drop gifts for your team!\n¡VAMOS!`
    };

    await this.sendMessage(startMsg, this.sendMessageFn);
    this.log(`PK Started: ${pk.team1} vs ${pk.team2}`);

    // Schedule snipe callouts at 30/15/5 seconds
    this.scheduleSnipeCallouts(pk);

    // Start providing updates every 60 seconds
    this.startUpdates();
  }

  private scheduleSnipeCallouts(pk: PKBattle): void {
    this.clearSnipeTimers();

    const pkDuration = pk.endTime - Date.now();

    // 30 second callout
    const timer30s = setTimeout(() => {
      this.snipeCallout(30);
    }, pkDuration - 30000);

    // 15 second callout
    const timer15s = setTimeout(() => {
      this.snipeCallout(15);
    }, pkDuration - 15000);

    // 5 second callout
    const timer5s = setTimeout(() => {
      this.snipeCallout(5);
    }, pkDuration - 5000);

    this.snipeTimers.push(timer30s, timer15s, timer5s);
  }

  private async snipeCallout(secondsRemaining: number): Promise<void> {
    if (!this.sendMessageFn || !this.state.activePK) return;

    const pk = this.state.activePK;
    const diff = Math.abs(pk.team1Score - pk.team2Score);
    const leader = pk.team1Score > pk.team2Score ? pk.team1 : pk.team2;
    const trailing = pk.team1Score < pk.team2Score ? pk.team1 : pk.team2;

    let message = '';

    if (diff === 0) {
      // Tied game - anyone can snipe
      message = `⏱️ ${secondsRemaining}s: IT'S TIED!\nNext gift WINS the PK! 🔥`;
    } else if (diff < 1000) {
      // Close game - snipe ready
      message = `⏱️ ${secondsRemaining}s: ${leader} up by ${diff}!\n🎯 SNIPE READY! One gift flips it!`;
    } else {
      // Bigger gap - comeback narrative
      message = `⏱️ ${secondsRemaining}s: ${leader} leading!\n💥 ${trailing} fam - COMEBACK TIME! Drop heat!`;
    }

    const snipeMsg: BotMessage = {
      type: 'chat',
      content: message
    };

    await this.sendMessage(snipeMsg, this.sendMessageFn);
    this.log(`Snipe callout: ${secondsRemaining}s remaining`);
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
    this.clearSnipeTimers();

    const endMsg: BotMessage = {
      type: 'announcement',
      content: `🏆 PK OVER! 🏆\n${winner} TAKES IT!\nFinal: ${pk.team1} ${pk.team1Score} - ${pk.team2Score} ${pk.team2}${mvp ? `\n👑 MVP: ${mvp}! 👑` : ''}\nGG to everyone who showed up!`
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
