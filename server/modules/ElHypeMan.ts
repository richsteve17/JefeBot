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

    // Different messages based on gift value
    let intensity = '';
    let title = '';

    if (gift.diamonds >= 10000) {
      intensity = '💥💥💥 ¡EXPLOSIÓN! 💥💥💥';
      title = '🌟 LEYENDA 🌟';
    } else if (gift.diamonds >= 5000) {
      intensity = '🔥🔥 ¡QUÉ LOCURA! 🔥🔥';
      title = '👑 ROYALTY 👑';
    } else if (gift.diamonds >= 1000) {
      intensity = '💥 ¡INCREÍBLE! 💥';
      title = '⭐ VIP ⭐';
    }

    const shoutMsg: BotMessage = {
      type: 'announcement',
      content: `[Rich$teve] ${intensity}\n[Rich$teve] ${title}\n[Rich$teve] ¡Todos saluden a ${gift.username} por el '${gift.giftName}'!\n[Rich$teve] (Everyone hail ${gift.username} for the '${gift.giftName}'!)`
    };

    await this.sendMessage(shoutMsg, this.sendMessageFn);
    this.log(`Big gift shout-out for ${gift.username} - ${gift.diamonds} diamonds`);
  }
}
