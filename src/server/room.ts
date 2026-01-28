import type * as Party from "partykit/server";

type Choice = 'C' | 'B';
type Phase = 'LOBBY' | 'ROUND' | 'REVEAL' | 'FINISHED' | 'PAUSED';

interface GameConfig {
  timerSeconds: number;
  totalRounds: number;
  streakBonus: boolean;
  revengeBonus: boolean;
}

interface Player {
  id: string;
  name: string;
  score: number;
  ready: boolean;
  connected: boolean;
}

interface RoundChoice {
  choice: Choice;
  lockedAt: number;
}

interface RoundHistory {
  roundIndex: number;
  choices: Record<string, Choice>;
  deltas: Record<string, number>;
  betrayerCount: number;
}

interface Award {
  type: 'most-trusted' | 'most-evil' | 'biggest-swing' | 'kingmaker';
  playerId: string;
  playerName: string;
  value: number;
}

interface RoomState {
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

const DEFAULT_CONFIG: GameConfig = {
  timerSeconds: 10,
  totalRounds: 20,
  streakBonus: true,
  revengeBonus: true,
};

export default class BetrayalRoom implements Party.Server {
  state: RoomState;
  roundTimer: ReturnType<typeof setTimeout> | null = null;
  revealTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(readonly room: Party.Room) {
    this.state = {
      roomCode: room.id,
      hostId: '',
      config: { ...DEFAULT_CONFIG },
      players: {},
      phase: 'LOBBY',
      roundIndex: 0,
      roundStartTime: 0,
      choices: {},
      history: [],
    };
  }

  onConnect(conn: Party.Connection) {
    // Send current state to new connection
    conn.send(JSON.stringify({
      type: 'state',
      state: this.state,
      playerId: conn.id,
    }));
  }

  onClose(conn: Party.Connection) {
    const player = this.state.players[conn.id];
    if (player) {
      player.connected = false;
      this.broadcast({ type: 'player-left', playerId: conn.id });

      // If host left, assign new host
      if (conn.id === this.state.hostId) {
        const connectedPlayers = Object.values(this.state.players).filter(p => p.connected);
        if (connectedPlayers.length > 0) {
          this.state.hostId = connectedPlayers[0].id;
          this.broadcastState();
        }
      }
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const data = JSON.parse(message);
      this.handleMessage(data, sender);
    } catch (e) {
      sender.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  }

  handleMessage(data: Record<string, unknown>, sender: Party.Connection) {
    switch (data.type) {
      case 'join':
        this.handleJoin(sender, data.name as string);
        break;
      case 'ready':
        this.handleReady(sender, data.ready as boolean);
        break;
      case 'config':
        this.handleConfig(sender, data.config as Partial<GameConfig>);
        break;
      case 'start':
        this.handleStart(sender);
        break;
      case 'choice':
        this.handleChoice(sender, data.choice as Choice);
        break;
      case 'lock':
        this.handleLock(sender);
        break;
      case 'rematch':
        this.handleRematch(sender);
        break;
      case 'webrtc-signal':
        this.handleWebRTCSignal(sender, data.to as string, data.signal);
        break;
    }
  }

  handleJoin(conn: Party.Connection, name: string) {
    if (!name || name.length > 12) {
      conn.send(JSON.stringify({ type: 'error', message: 'Invalid name' }));
      return;
    }

    const playerCount = Object.keys(this.state.players).length;
    if (playerCount >= 5) {
      conn.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
      return;
    }

    // Check if player is reconnecting
    const existingPlayer = this.state.players[conn.id];
    if (existingPlayer) {
      existingPlayer.connected = true;
      existingPlayer.name = name;
    } else {
      // New player
      this.state.players[conn.id] = {
        id: conn.id,
        name,
        score: 0,
        ready: false,
        connected: true,
      };

      // First player becomes host
      if (!this.state.hostId) {
        this.state.hostId = conn.id;
      }
    }

    this.broadcast({ type: 'player-joined', player: this.state.players[conn.id] });
    this.broadcastState();
  }

  handleReady(conn: Party.Connection, ready: boolean) {
    const player = this.state.players[conn.id];
    if (!player || this.state.phase !== 'LOBBY') return;

    player.ready = ready;
    this.broadcast({ type: 'player-ready', playerId: conn.id, ready });
  }

  handleConfig(conn: Party.Connection, config: Partial<GameConfig>) {
    if (conn.id !== this.state.hostId || this.state.phase !== 'LOBBY') return;

    this.state.config = {
      ...this.state.config,
      ...config,
      timerSeconds: Math.min(20, Math.max(5, config.timerSeconds ?? this.state.config.timerSeconds)),
      totalRounds: Math.min(50, Math.max(5, config.totalRounds ?? this.state.config.totalRounds)),
    };

    this.broadcast({ type: 'config-updated', config: this.state.config });
  }

  handleStart(conn: Party.Connection) {
    if (conn.id !== this.state.hostId) return;
    if (this.state.phase !== 'LOBBY') return;

    const players = Object.values(this.state.players).filter(p => p.connected);
    if (players.length < 2) {
      conn.send(JSON.stringify({ type: 'error', message: 'Need at least 2 players' }));
      return;
    }

    if (!players.every(p => p.ready)) {
      conn.send(JSON.stringify({ type: 'error', message: 'Not all players are ready' }));
      return;
    }

    this.startRound();
  }

  handleChoice(conn: Party.Connection, choice: Choice) {
    if (this.state.phase !== 'ROUND') return;
    if (!this.state.players[conn.id]) return;

    // Update choice (can change until locked)
    const existing = this.state.choices[conn.id];
    if (!existing || existing.lockedAt === 0) {
      this.state.choices[conn.id] = { choice, lockedAt: 0 };
    }
  }

  handleLock(conn: Party.Connection) {
    if (this.state.phase !== 'ROUND') return;

    const choice = this.state.choices[conn.id];
    if (!choice || choice.lockedAt > 0) return;

    choice.lockedAt = Date.now();
    this.broadcast({ type: 'choice-locked', playerId: conn.id });

    // Check if all players have locked
    this.checkAllLocked();
  }

  handleRematch(conn: Party.Connection) {
    if (conn.id !== this.state.hostId) return;
    if (this.state.phase !== 'FINISHED') return;

    // Reset game state
    for (const player of Object.values(this.state.players)) {
      player.score = 0;
      player.ready = false;
    }
    this.state.phase = 'LOBBY';
    this.state.roundIndex = 0;
    this.state.history = [];
    this.state.choices = {};
    this.state.awards = undefined;

    this.broadcast({ type: 'rematch-started' });
    this.broadcastState();
  }

  handleWebRTCSignal(sender: Party.Connection, to: string, signal: unknown) {
    const target = this.room.getConnection(to);
    if (target) {
      target.send(JSON.stringify({
        type: 'webrtc-signal',
        from: sender.id,
        signal,
      }));
    }
  }

  startRound() {
    this.state.phase = 'ROUND';
    this.state.roundStartTime = Date.now();
    this.state.choices = {};

    // Default all players to cooperate (can change)
    for (const playerId of Object.keys(this.state.players)) {
      this.state.choices[playerId] = { choice: 'C', lockedAt: 0 };
    }

    this.broadcast({
      type: 'round-start',
      roundIndex: this.state.roundIndex,
      startTime: this.state.roundStartTime,
    });

    // Set timer to end round
    this.roundTimer = setTimeout(() => {
      this.endRound();
    }, this.state.config.timerSeconds * 1000);
  }

  checkAllLocked() {
    const connectedPlayers = Object.values(this.state.players).filter(p => p.connected);
    const allLocked = connectedPlayers.every(p => {
      const choice = this.state.choices[p.id];
      return choice && choice.lockedAt > 0;
    });

    if (allLocked && this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.endRound();
    }
  }

  endRound() {
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }

    this.state.phase = 'REVEAL';

    // Extract just the choices
    const choices: Record<string, Choice> = {};
    for (const [playerId, data] of Object.entries(this.state.choices)) {
      choices[playerId] = data.choice;
    }

    // Calculate deltas
    const deltas = this.computeDeltas(choices);

    // Update scores
    const scores: Record<string, number> = {};
    for (const [playerId, delta] of Object.entries(deltas)) {
      const player = this.state.players[playerId];
      if (player) {
        player.score += delta;
        scores[playerId] = player.score;
      }
    }

    // Record history
    const roundHistory: RoundHistory = {
      roundIndex: this.state.roundIndex,
      choices,
      deltas,
      betrayerCount: Object.values(choices).filter(c => c === 'B').length,
    };
    this.state.history.push(roundHistory);

    this.broadcast({
      type: 'round-reveal',
      choices,
      deltas,
      scores,
      history: roundHistory,
    });

    // Start reveal timer
    this.revealTimer = setTimeout(() => {
      this.afterReveal();
    }, 4000);
  }

  afterReveal() {
    if (this.revealTimer) {
      clearTimeout(this.revealTimer);
      this.revealTimer = null;
    }

    this.state.roundIndex++;

    if (this.state.roundIndex >= this.state.config.totalRounds) {
      this.endGame();
    } else {
      this.startRound();
    }
  }

  endGame() {
    this.state.phase = 'FINISHED';

    // Calculate awards
    this.state.awards = this.computeAwards();

    const scores: Record<string, number> = {};
    for (const player of Object.values(this.state.players)) {
      scores[player.id] = player.score;
    }

    this.broadcast({
      type: 'game-end',
      scores,
      awards: this.state.awards,
    });
  }

  computeDeltas(choices: Record<string, Choice>): Record<string, number> {
    const B = Object.values(choices).filter(c => c === 'B').length;
    const deltas: Record<string, number> = {};

    for (const [playerId, choice] of Object.entries(choices)) {
      let delta = 0;

      // Base scoring
      if (B === 0) {
        delta = 2;
      } else if (B === 1) {
        delta = choice === 'B' ? 5 : -2;
      } else {
        delta = choice === 'B' ? 1 : -3;
      }

      // Streak bonus
      if (this.state.config.streakBonus && choice === 'C' && B === 0) {
        if (this.hasCooperatedStreak(playerId, 3)) {
          delta += 2;
        }
      }

      // Revenge bonus
      if (this.state.config.revengeBonus && choice === 'B') {
        delta += this.countRevengeTargets(playerId, choices);
      }

      deltas[playerId] = delta;
    }

    return deltas;
  }

  hasCooperatedStreak(playerId: string, streakLength: number): boolean {
    if (this.state.history.length < streakLength) return false;

    const recent = this.state.history.slice(-streakLength);
    return recent.every(round => round.choices[playerId] === 'C');
  }

  countRevengeTargets(playerId: string, currentChoices: Record<string, Choice>): number {
    if (this.state.history.length === 0) return 0;

    const lastRound = this.state.history[this.state.history.length - 1];
    let count = 0;

    for (const [otherId, otherChoice] of Object.entries(currentChoices)) {
      if (otherId === playerId) continue;

      const theyBetrayedUs = lastRound.choices[otherId] === 'B';
      const theyCoopNow = otherChoice === 'C';

      if (theyBetrayedUs && theyCoopNow) {
        count++;
      }
    }

    return count;
  }

  computeAwards(): Award[] {
    const awards: Award[] = [];
    const playerIds = Object.keys(this.state.players);

    if (playerIds.length === 0 || this.state.history.length === 0) return awards;

    // Most Trusted
    let mostTrusted = { playerId: '', score: -Infinity };
    for (const playerId of playerIds) {
      let coopCount = 0;
      let loneBetrayCount = 0;

      for (const round of this.state.history) {
        if (round.choices[playerId] === 'C') {
          coopCount++;
        } else if (round.betrayerCount === 1 && round.choices[playerId] === 'B') {
          loneBetrayCount++;
        }
      }

      const trustedScore = (100 * coopCount / this.state.history.length) - (15 * loneBetrayCount);
      if (trustedScore > mostTrusted.score) {
        mostTrusted = { playerId, score: trustedScore };
      }
    }

    if (mostTrusted.playerId) {
      awards.push({
        type: 'most-trusted',
        playerId: mostTrusted.playerId,
        playerName: this.state.players[mostTrusted.playerId].name,
        value: Math.round(mostTrusted.score),
      });
    }

    // Most Evil
    let mostEvil = { playerId: '', score: -Infinity };
    for (const playerId of playerIds) {
      let evilScore = 0;

      for (const round of this.state.history) {
        if (round.choices[playerId] === 'B') {
          const coopersInRound = Object.values(round.choices).filter(c => c === 'C').length;
          evilScore += coopersInRound;
        }
      }

      if (evilScore > mostEvil.score) {
        mostEvil = { playerId, score: evilScore };
      }
    }

    if (mostEvil.playerId && mostEvil.score > 0) {
      awards.push({
        type: 'most-evil',
        playerId: mostEvil.playerId,
        playerName: this.state.players[mostEvil.playerId].name,
        value: mostEvil.score,
      });
    }

    // Biggest Swing
    let biggestSwing = { playerId: '', value: 0 };
    for (const playerId of playerIds) {
      for (const round of this.state.history) {
        const delta = Math.abs(round.deltas[playerId] || 0);
        if (delta > biggestSwing.value) {
          biggestSwing = { playerId, value: delta };
        }
      }
    }

    if (biggestSwing.playerId) {
      awards.push({
        type: 'biggest-swing',
        playerId: biggestSwing.playerId,
        playerName: this.state.players[biggestSwing.playerId].name,
        value: biggestSwing.value,
      });
    }

    // Kingmaker
    let kingmaker = { playerId: '', impact: 0 };
    for (const playerId of playerIds) {
      let totalImpact = 0;

      for (const round of this.state.history) {
        const actualB = round.betrayerCount;
        const flippedB = round.choices[playerId] === 'C' ? actualB + 1 : actualB - 1;

        for (const otherId of playerIds) {
          if (otherId === playerId) continue;

          const otherChoice = round.choices[otherId];

          let actualDelta = 0;
          if (actualB === 0) actualDelta = 2;
          else if (actualB === 1) actualDelta = otherChoice === 'B' ? 5 : -2;
          else actualDelta = otherChoice === 'B' ? 1 : -3;

          let flippedDelta = 0;
          if (flippedB === 0) flippedDelta = 2;
          else if (flippedB === 1) flippedDelta = otherChoice === 'B' ? 5 : -2;
          else flippedDelta = otherChoice === 'B' ? 1 : -3;

          totalImpact += Math.abs(flippedDelta - actualDelta);
        }
      }

      if (totalImpact > kingmaker.impact) {
        kingmaker = { playerId, impact: totalImpact };
      }
    }

    if (kingmaker.playerId) {
      awards.push({
        type: 'kingmaker',
        playerId: kingmaker.playerId,
        playerName: this.state.players[kingmaker.playerId].name,
        value: kingmaker.impact,
      });
    }

    return awards;
  }

  broadcast(message: Record<string, unknown>) {
    const json = JSON.stringify(message);
    for (const conn of this.room.getConnections()) {
      conn.send(json);
    }
  }

  broadcastState() {
    for (const conn of this.room.getConnections()) {
      conn.send(JSON.stringify({
        type: 'state',
        state: this.state,
        playerId: conn.id,
      }));
    }
  }
}
