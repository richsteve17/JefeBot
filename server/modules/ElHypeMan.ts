// El Hype Man - The Big Gift Shout-Out Module
// Instantly recognizes high-value gifts

import { BaseModule } from './BaseModule.js';
import { BotMessage, BotState, Gift } from '../types.js';

export class ElHypeMan extends BaseModule {
  private minimumDiamonds: number = 1000;
  private sendMessageFn?: (msg: string) => Promise<void>;

  constructor(state: BotState) {
    super('El Hype Man', state);
  }

  async initialize(): Promise<void> {
    this.log('Initializing...');
  }

  async cleanup(): Promise<void> {
    // Nothing to clean up
  }

  setSendMessageFunction(fn: (msg: string) => Promise<void>): void {
    this.sendMessageFn = fn;
  }

  setMinimumDiamonds(diamonds: number): void {
    this.minimumDiamonds = diamonds;
    this.log(`Minimum diamonds set to ${diamonds}`);
  }

  async onGiftReceived(gift: Gift): Promise<void> {
    if (!this.enabled || !this.sendMessageFn) return;

    if (gift.diamonds >= this.minimumDiamonds) {
      await this.shoutOut(gift);
    }
  }

  private async shoutOut(gift: Gift): Promise<void> {
    if (!this.sendMessageFn) return;

    // Tiered shoutouts with social proof & CTAs
    let message = '';

    if (gift.diamonds >= 5000) {
      // WHALE TIER: Massive recognition + throne mechanics
      message = `🔥🔥🔥 ${gift.username} just dropped ${gift.giftName} (${gift.diamonds})! 🔥🔥🔥\n👑 THE THRONE IS THEIRS 👑\nWho's brave enough to challenge the king?`;
    } else if (gift.diamonds >= 2000) {
      // HIGH TIER: Strong recognition + competition hook
      message = `💥💥 ${gift.username} sent ${gift.giftName} (${gift.diamonds})! 💥💥\n⭐ VIP STATUS UNLOCKED ⭐\nCan anyone match this energy?`;
    } else if (gift.diamonds >= 1000) {
      // MID TIER: Recognition + social proof
      message = `🎯 ${gift.username} dropped ${gift.giftName} (${gift.diamonds})!\n✨ Making moves! ✨\nShow love in chat!`;
    } else if (gift.diamonds >= 300) {
      // BASE TIER: Appreciation + encouragement (catches the long tail)
      message = `🙌 ${gift.username} sent ${gift.giftName}! Real one!\nEvery gift counts familia 🧡`;
    }

    if (message) {
      const shoutMsg: BotMessage = {
        type: 'announcement',
        content: message
      };

      await this.sendMessage(shoutMsg, this.sendMessageFn);
      this.log(`Tiered shout-out for ${gift.username} - ${gift.diamonds} diamonds`);
    }
  }
}
