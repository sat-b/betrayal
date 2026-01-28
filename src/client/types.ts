export type Choice = 'C' | 'B';
export type Phase = 'LOBBY' | 'ROUND' | 'REVEAL' | 'FINISHED' | 'PAUSED';

export interface GameConfig {
  timerSeconds: number;
  totalRounds: number;
  streakBonus: boolean;
  revengeBonus: boolean;
}

export interface Player {
  id: string;
  name: string;
  score: number;
  ready: boolean;
  connected: boolean;
}

export interface RoundChoice {
  choice: Choice;
  lockedAt: number;
}

export interface RoundHistory {
  roundIndex: number;
  choices: Record<string, Choice>;
  deltas: Record<string, number>;
  betrayerCount: number;
}

export interface Award {
  type: 'most-trusted' | 'most-evil' | 'biggest-swing' | 'kingmaker';
  playerId: string;
  playerName: string;
  value: number;
}

export interface RoomState {
  roomCode: string;
  hostId: string;
  config: GameConfig;
  players: Record<string, Player>;
  phase: Phase;
  roundIndex: number;
  roundStartTime: number;
  choices: Record<string, RoundChoice>;
  history: RoundHistory[];
  awards?: Award[];
}

// Client -> Server messages
export type ClientMessage =
  | { type: 'join'; name: string }
  | { type: 'ready'; ready: boolean }
  | { type: 'config'; config: Partial<GameConfig> }
  | { type: 'start' }
  | { type: 'choice'; choice: Choice }
  | { type: 'lock' }
  | { type: 'rematch' }
  | { type: 'webrtc-signal'; to: string; signal: RTCSessionDescriptionInit | RTCIceCandidateInit };

// Server -> Client messages
export type ServerMessage =
  | { type: 'state'; state: RoomState; playerId: string }
  | { type: 'player-joined'; player: Player }
  | { type: 'player-left'; playerId: string }
  | { type: 'player-ready'; playerId: string; ready: boolean }
  | { type: 'config-updated'; config: GameConfig }
  | { type: 'round-start'; roundIndex: number; startTime: number }
  | { type: 'choice-locked'; playerId: string }
  | { type: 'round-reveal'; choices: Record<string, Choice>; deltas: Record<string, number>; scores: Record<string, number>; history: RoundHistory }
  | { type: 'game-end'; scores: Record<string, number>; awards: Award[] }
  | { type: 'rematch-started' }
  | { type: 'webrtc-signal'; from: string; signal: RTCSessionDescriptionInit | RTCIceCandidateInit }
  | { type: 'error'; message: string };
