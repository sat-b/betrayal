export type Choice = 'C' | 'B';
export type Phase = 'LOBBY' | 'ROUND' | 'REVEAL' | 'FINISHED' | 'PAUSED';

export interface GameConfig {
  timerSeconds: number;
  totalRounds: number;
}

export interface Player {
  id: string;
  name: string;
  score: number;      // Win condition
  stack: number;      // Trust stack (grows with cooperation)
  image: number;      // Table image: -5 (saint) to +5 (snake)
  ready: boolean;
  connected: boolean;
}

export interface RoundChoice {
  choice: Choice;
  lockedAt: number;
}

export interface RoundResult {
  playerId: string;
  choice: Choice;
  blind: number;        // -1 always
  stackChange: number;  // +2 if cooperate, 0 if betray
  potContrib: number;   // +2 if cooperate, 0 if betray
  stackDrain: number;   // Amount drained by betrayers (if cooperator)
  loot: number;         // Amount stolen from pot (if betrayer)
  foldingTax: number;   // +2 if clean round, -1 if called and lost
  imageChange: number;  // -1 if cooperate, +2 if betray
  totalDelta: number;   // Net score change
}

export interface RoundHistory {
  roundIndex: number;
  choices: Record<string, Choice>;
  results: Record<string, RoundResult>;
  potBefore: number;
  potAfter: number;
  betrayerCount: number;
}

export interface Award {
  type: 'master-thief' | 'most-trusted' | 'biggest-heist' | 'snake-charmer';
  playerId: string;
  playerName: string;
  value: number;
}

export interface RoomState {
  roomCode: string;
  hostId: string;
  config: GameConfig;
  players: Record<string, Player>;
  pot: number;          // Shared pot
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
  | { type: 'round-start'; roundIndex: number; startTime: number; pot: number }
  | { type: 'choice-locked'; playerId: string }
  | { type: 'round-reveal'; history: RoundHistory; players: Record<string, Player>; pot: number }
  | { type: 'game-end'; players: Record<string, Player>; awards: Award[] }
  | { type: 'rematch-started' }
  | { type: 'webrtc-signal'; from: string; signal: RTCSessionDescriptionInit | RTCIceCandidateInit }
  | { type: 'error'; message: string };
