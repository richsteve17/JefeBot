// El Músico - The Musician Module
// Handles Spotify integration and "Vibe Check" polls

import { BaseModule } from './BaseModule.js';
import { BotMessage, BotState, SpotifyTrack } from '../types.js';

export class ElMusico extends BaseModule {
  private vibeCheckEnabled: boolean = true;
  private spotifyToken?: string;
  private currentTrackUri?: string;
  private pollInterval?: NodeJS.Timeout;
  private sendMessageFn?: (msg: string) => Promise<void>;

  constructor(state: BotState) {
    super('El Músico', state);
  }

  async initialize(): Promise<void> {
    this.log('Initializing...');
  }

  async cleanup(): Promise<void> {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  setSpotifyToken(token: string): void {
    this.spotifyToken = token;
    this.log('Spotify token updated');
  }

  setVibeCheckEnabled(enabled: boolean): void {
    this.vibeCheckEnabled = enabled;
    this.log(`Vibe Check ${enabled ? 'enabled' : 'disabled'}`);
  }

  setSendMessageFunction(fn: (msg: string) => Promise<void>): void {
    this.sendMessageFn = fn;
  }

  async startMonitoring(): Promise<void> {
    if (!this.enabled || !this.spotifyToken || !this.sendMessageFn) {
      this.log('Cannot start monitoring - missing token or send function');
      return;
    }

    // Poll Spotify every 5 seconds for current track
    this.pollInterval = setInterval(async () => {
      await this.checkCurrentTrack();
    }, 5000);

    this.log('Started monitoring Spotify');
  }

  private async checkCurrentTrack(): Promise<void> {
    if (!this.spotifyToken || !this.sendMessageFn) return;

    try {
      const track = await this.getCurrentSpotifyTrack();

      if (track && track.uri !== this.currentTrackUri) {
        // New song detected!
        this.currentTrackUri = track.uri;
        this.state.currentSong = track;

        await this.announceNewSong(track);
      }
    } catch (error) {
      this.log(`Error checking Spotify: ${error}`);
    }
  }

  private async getCurrentSpotifyTrack(): Promise<SpotifyTrack | null> {
    if (!this.spotifyToken) return null;

    const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: {
        'Authorization': `Bearer ${this.spotifyToken}`
      }
    });

    if (response.status === 204 || response.status === 404) {
      return null; // Nothing playing
    }

    const data = await response.json();

    if (data.item) {
      return {
        name: data.item.name,
        artist: data.item.artists.map((a: any) => a.name).join(', '),
        uri: data.item.uri
      };
    }

    return null;
  }

  private async announceNewSong(track: SpotifyTrack): Promise<void> {
    if (!this.sendMessageFn) return;

    // Message 1: Now Playing
    const nowPlayingMsg: BotMessage = {
      type: 'chat',
      content: `[Rich$teve] 🎧 Now Playing: '${track.name}' - ${track.artist}`
    };

    await this.sendMessage(nowPlayingMsg, this.sendMessageFn);

    // Message 2: Vibe Check (5 seconds later)
    if (this.vibeCheckEnabled) {
      const vibeCheckMsg: BotMessage = {
        type: 'chat',
        content: `[Rich$teve] 🔥 VIBE CHECK! 🔥 How we feeling?\n[Rich$teve] Send a 'Corazón' (❤️) if you LOVE this song!\n[Rich$teve] Send a 'Broken Heart' (💔) if it hurts so good!`,
        delay: 5000
      };

      await this.sendMessage(vibeCheckMsg, this.sendMessageFn);
    }

    this.log(`Announced: ${track.name} by ${track.artist}`);
  }

  // Manual trigger for testing
  async triggerVibeCheck(): Promise<void> {
    if (!this.sendMessageFn || !this.state.currentSong) return;

    const vibeCheckMsg: BotMessage = {
      type: 'chat',
      content: `[Rich$teve] 🔥 VIBE CHECK! 🔥 How we feeling?\n[Rich$teve] Send a 'Corazón' (❤️) if you LOVE this song!\n[Rich$teve] Send a 'Broken Heart' (💔) if it hurts so good!`
    };

    await this.sendMessage(vibeCheckMsg, this.sendMessageFn);
  }
}
