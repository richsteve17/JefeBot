// Core Types for Jefe Bot System

export interface BotConfig {
  sugoRoomId: string;
  botAccountToken: string;
  spotifyAccessToken?: string;
}

export interface ModuleConfig {
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

export interface BotMessage {
  type: 'chat' | 'announcement';
  content: string;
  delay?: number; // milliseconds
}

export interface SpotifyTrack {
  name: string;
  artist: string;
  uri: string;
}

export interface PKBattle {
  id: string;
  team1: string;
  team2: string;
  team1Score: number;
  team2Score: number;
  startTime: number;
  endTime: number;
  isActive: boolean;
}

export interface Gift {
  userId: string;
  username: string;
  giftName: string;
  diamonds: number;
  timestamp: number;
}

export interface Game {
  type: 'gift_burst' | 'family_goal' | 'king_of_the_hill';
  startTime: number;
  endTime: number;
  isActive: boolean;
  participants: Map<string, number>;
  goal?: number; // for family goal and gift burst
  lastGifter?: string; // for king of the hill
}

export interface BotState {
  currentSong?: SpotifyTrack;
  activePK?: PKBattle;
  activeGame?: Game;
  lastGameTime?: number;
}
