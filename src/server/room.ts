import type * as Party from "partykit/server";

type Choice = 'C' | 'B';
type Phase = 'LOBBY' | 'ROUND' | 'REVEAL' | 'FINISHED' | 'PAUSED';

interface GameConfig {
  timerSeconds: number;
  totalRounds: number;
}

interface Player {
  id: string;
  name: string;
  score: number;      // Win condition
  stack: number;      // Trust stack (grows with cooperation)
  image: number;      // Table image: -5 (saint) to +5 (snake)
  ready: boolean;
  connected: boolean;
}

interface RoundChoice {
  choice: Choice;
  lockedAt: number;
}

interface RoundResult {
  playerId: string;
  choice: Choice;
  blind: number;
  stackChange: number;
  potContrib: number;
  stackDrain: number;
  loot: number;
  jackpot: number;       // Bonus from cooperation streak jackpot
  foldingTax: number;
  imageChange: number;
  totalDelta: number;
}

interface RoundHistory {
  roundIndex: number;
  choices: Record<string, Choice>;
  results: Record<string, RoundResult>;
  potBefore: number;
  potAfter: number;
  betrayerCount: number;
}

interface Award {
  type: 'master-thief' | 'most-trusted' | 'biggest-heist' | 'snake-charmer';
  playerId: string;
  playerName: string;
  value: number;
}

interface RoomState {
  roomCode: string;
  hostId: string;
  config: GameConfig;
  players: Record<string, Player>;
  pot: number;
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
};

export default class BetrayalRoom implements Party.Server {
  state: RoomState;
  roundTimer: ReturnType<typeof setTimeout> | null = null;
  revealTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(readonly room: Party.Room) {
    console.log(`[Room] Created room with id: ${room.id}, name: ${room.name}`);
    this.state = {
      roomCode: room.id,
      hostId: '',
      config: { ...DEFAULT_CONFIG },
      players: {},
      pot: 0,
      phase: 'LOBBY',
      roundIndex: 0,
      roundStartTime: 0,
      choices: {},
      history: [],
    };
  }

  onConnect(conn: Party.Connection) {
    console.log(`[Room ${this.state.roomCode}] Connection: ${conn.id}, existing players: ${Object.keys(this.state.players).join(', ') || 'none'}`);
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

    if (this.state.phase === 'LOBBY') {
      const disconnectedIds = Object.entries(this.state.players)
        .filter(([_, p]) => !p.connected)
        .map(([id]) => id);

      for (const id of disconnectedIds) {
        delete this.state.players[id];
      }

      if (!this.state.players[this.state.hostId]) {
        this.state.hostId = '';
      }
    }

    const connectedCount = Object.values(this.state.players).filter(p => p.connected).length;
    if (connectedCount >= 5) {
      conn.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
      return;
    }

    const existingPlayer = this.state.players[conn.id];
    if (existingPlayer) {
      existingPlayer.connected = true;
      existingPlayer.name = name;
    } else {
      this.state.players[conn.id] = {
        id: conn.id,
        name,
        score: 0,
        stack: 10,    // Starting trust stack
        image: 0,     // Neutral image
        ready: false,
        connected: true,
      };
    }

    if (!this.state.hostId) {
      this.state.hostId = conn.id;
    }

    console.log(`[Room ${this.state.roomCode}] Player joined: ${conn.id} (${name}), total players: ${Object.keys(this.state.players).length}`);
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
      totalRounds: Math.min(30, Math.max(10, config.totalRounds ?? this.state.config.totalRounds)),
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

    // Reset game state
    this.state.pot = 0;
    for (const player of Object.values(this.state.players)) {
      player.score = 0;
      player.stack = 10;
      player.image = 0;
    }

    this.startRound();
  }

  handleChoice(conn: Party.Connection, choice: Choice) {
    if (this.state.phase !== 'ROUND') return;
    if (!this.state.players[conn.id]) return;

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

    this.checkAllLocked();
  }

  handleRematch(conn: Party.Connection) {
    if (conn.id !== this.state.hostId) return;
    if (this.state.phase !== 'FINISHED') return;

    for (const player of Object.values(this.state.players)) {
      player.score = 0;
      player.stack = 10;
      player.image = 0;
      player.ready = false;
    }
    this.state.pot = 0;
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

    for (const playerId of Object.keys(this.state.players)) {
      this.state.choices[playerId] = { choice: 'C', lockedAt: 0 };
    }

    this.broadcast({
      type: 'round-start',
      roundIndex: this.state.roundIndex,
      startTime: this.state.roundStartTime,
      pot: this.state.pot,
    });

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

    // Extract choices
    const choices: Record<string, Choice> = {};
    for (const [playerId, data] of Object.entries(this.state.choices)) {
      choices[playerId] = data.choice;
    }

    // Resolve the round with poker mechanics
    const { results, potBefore, potAfter } = this.resolveRound(choices);

    // Record history
    const roundHistory: RoundHistory = {
      roundIndex: this.state.roundIndex,
      choices,
      results,
      potBefore,
      potAfter,
      betrayerCount: Object.values(choices).filter(c => c === 'B').length,
    };
    this.state.history.push(roundHistory);

    // Send updated state to all players
    this.broadcast({
      type: 'round-reveal',
      history: roundHistory,
      players: this.state.players,
      pot: this.state.pot,
    });

    this.revealTimer = setTimeout(() => {
      this.afterReveal();
    }, 5000);
  }

  // Count how many consecutive rounds a player has betrayed (not including current round)
  getConsecutiveBetrayals(playerId: string): number {
    let streak = 0;
    // Look backwards through history
    for (let i = this.state.history.length - 1; i >= 0; i--) {
      const round = this.state.history[i];
      if (round.choices[playerId] === 'B') {
        streak++;
      } else {
        break; // Streak broken
      }
    }
    return streak;
  }

  // Count consecutive clean rounds (everyone cooperated) - not including current round
  getConsecutiveCleanRounds(): number {
    let streak = 0;
    for (let i = this.state.history.length - 1; i >= 0; i--) {
      const round = this.state.history[i];
      if (round.betrayerCount === 0) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  resolveRound(choices: Record<string, Choice>): { results: Record<string, RoundResult>; potBefore: number; potAfter: number } {
    const results: Record<string, RoundResult> = {};
    const potBefore = this.state.pot;

    const cooperators = Object.entries(choices).filter(([_, c]) => c === 'C').map(([id]) => id);
    const betrayers = Object.entries(choices).filter(([_, c]) => c === 'B').map(([id]) => id);
    const B = betrayers.length;

    // Initialize results
    for (const [playerId, choice] of Object.entries(choices)) {
      results[playerId] = {
        playerId,
        choice,
        blind: -1,
        stackChange: 0,
        potContrib: 0,
        stackDrain: 0,
        loot: 0,
        jackpot: 0,
        foldingTax: 0,
        imageChange: 0,
        totalDelta: 0,
      };
    }

    // Step 1: Everyone pays blind
    for (const playerId of Object.keys(choices)) {
      this.state.players[playerId].score -= 1;
    }

    // Step 2: Cooperators invest
    for (const playerId of cooperators) {
      const player = this.state.players[playerId];
      player.stack += 2;
      this.state.pot += 2;
      results[playerId].stackChange = 2;
      results[playerId].potContrib = 2;
    }

    // Step 3: Betrayers contest the pot
    if (B > 0) {
      // First, drain stacks from cooperators
      let totalDrain = 0;
      for (const playerId of cooperators) {
        const player = this.state.players[playerId];
        const drain = Math.min(2, Math.floor(player.stack * 0.25));
        player.stack -= drain;
        totalDrain += drain;
        results[playerId].stackDrain = drain;
        results[playerId].stackChange -= drain; // Adjust stack change
      }

      // Add drained amount to pot before splitting
      this.state.pot += totalDrain;

      // PROTECTED POT: Only 50% of pot can be stolen, 50% carries over
      const stealablePot = Math.floor(this.state.pot * 0.5);
      const protectedPot = this.state.pot - stealablePot;

      // Calculate weights for betrayers (lower image = more trusted = higher weight)
      // Also apply BETRAYER TAX: 50% less loot for each consecutive betrayal
      const weights: Record<string, number> = {};
      const taxMultipliers: Record<string, number> = {};
      let totalWeight = 0;
      for (const playerId of betrayers) {
        const player = this.state.players[playerId];
        // Cap at 8 to prevent saints from taking everything
        const baseWeight = Math.min(8, Math.max(1, 6 - player.image));

        // Betrayer tax: 50% reduction per consecutive betrayal
        const consecutiveBetrayals = this.getConsecutiveBetrayals(playerId);
        const taxMultiplier = Math.pow(0.5, consecutiveBetrayals);
        taxMultipliers[playerId] = taxMultiplier;

        const adjustedWeight = baseWeight * taxMultiplier;
        weights[playerId] = adjustedWeight;
        totalWeight += adjustedWeight;
      }

      // Distribute stealable pot to betrayers (proportional to adjusted weights)
      let totalLooted = 0;
      for (const playerId of betrayers) {
        const loot = totalWeight > 0
          ? Math.floor(stealablePot * weights[playerId] / totalWeight)
          : 0;
        this.state.players[playerId].score += loot;
        results[playerId].loot = loot;
        totalLooted += loot;
      }

      // Protected pot remains, plus any rounding leftovers
      this.state.pot = protectedPot + (stealablePot - totalLooted);

      // Cooperators suffer "called and lost" penalty
      for (const playerId of cooperators) {
        this.state.players[playerId].score -= 1;
        results[playerId].foldingTax = -1;
      }
    } else {
      // Clean round: cooperators get bonus
      for (const playerId of cooperators) {
        this.state.players[playerId].score += 2;
        results[playerId].foldingTax = 2;
      }

      // Check for COOPERATION JACKPOT: 5 consecutive clean rounds triggers pot split
      // Note: this round is clean (B === 0), so we check if previous 4 were also clean
      const previousCleanStreak = this.getConsecutiveCleanRounds();
      if (previousCleanStreak >= 4 && this.state.pot > 0) {
        // JACKPOT! Everyone splits the pot
        const playerCount = Object.keys(choices).length;
        const jackpotPerPlayer = Math.floor(this.state.pot / playerCount);

        for (const playerId of Object.keys(choices)) {
          this.state.players[playerId].score += jackpotPerPlayer;
          results[playerId].jackpot = jackpotPerPlayer;
        }

        // Pot is emptied (any remainder stays for next cycle)
        this.state.pot = this.state.pot - (jackpotPerPlayer * playerCount);
      }
    }

    // Step 4: Update image
    for (const [playerId, choice] of Object.entries(choices)) {
      const player = this.state.players[playerId];
      if (choice === 'C') {
        const oldImage = player.image;
        player.image = Math.max(-5, player.image - 1);
        results[playerId].imageChange = player.image - oldImage;
      } else {
        const oldImage = player.image;
        player.image = Math.min(5, player.image + 2);
        results[playerId].imageChange = player.image - oldImage;
      }
    }

    // Calculate total deltas
    for (const playerId of Object.keys(choices)) {
      const r = results[playerId];
      r.totalDelta = r.blind + r.loot + r.jackpot + r.foldingTax;
    }

    return { results, potBefore, potAfter: this.state.pot };
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
    this.state.awards = this.computeAwards();

    this.broadcast({
      type: 'game-end',
      players: this.state.players,
      awards: this.state.awards,
    });
  }

  computeAwards(): Award[] {
    const awards: Award[] = [];
    const playerIds = Object.keys(this.state.players);

    if (playerIds.length === 0 || this.state.history.length === 0) return awards;

    // Master Thief: Most total loot stolen
    let masterThief = { playerId: '', value: 0 };
    for (const playerId of playerIds) {
      let totalLoot = 0;
      for (const round of this.state.history) {
        totalLoot += round.results[playerId]?.loot || 0;
      }
      if (totalLoot > masterThief.value) {
        masterThief = { playerId, value: totalLoot };
      }
    }
    if (masterThief.playerId && masterThief.value > 0) {
      awards.push({
        type: 'master-thief',
        playerId: masterThief.playerId,
        playerName: this.state.players[masterThief.playerId].name,
        value: masterThief.value,
      });
    }

    // Most Trusted: Lowest final image (most saintly)
    let mostTrusted = { playerId: '', value: Infinity };
    for (const playerId of playerIds) {
      const image = this.state.players[playerId].image;
      if (image < mostTrusted.value) {
        mostTrusted = { playerId, value: image };
      }
    }
    if (mostTrusted.playerId) {
      awards.push({
        type: 'most-trusted',
        playerId: mostTrusted.playerId,
        playerName: this.state.players[mostTrusted.playerId].name,
        value: mostTrusted.value,
      });
    }

    // Biggest Heist: Single largest loot in one round
    let biggestHeist = { playerId: '', value: 0 };
    for (const playerId of playerIds) {
      for (const round of this.state.history) {
        const loot = round.results[playerId]?.loot || 0;
        if (loot > biggestHeist.value) {
          biggestHeist = { playerId, value: loot };
        }
      }
    }
    if (biggestHeist.playerId && biggestHeist.value > 0) {
      awards.push({
        type: 'biggest-heist',
        playerId: biggestHeist.playerId,
        playerName: this.state.players[biggestHeist.playerId].name,
        value: biggestHeist.value,
      });
    }

    // Snake Charmer: Highest final image (most notorious)
    let snakeCharmer = { playerId: '', value: -Infinity };
    for (const playerId of playerIds) {
      const image = this.state.players[playerId].image;
      if (image > snakeCharmer.value) {
        snakeCharmer = { playerId, value: image };
      }
    }
    if (snakeCharmer.playerId && snakeCharmer.value > 0) {
      awards.push({
        type: 'snake-charmer',
        playerId: snakeCharmer.playerId,
        playerName: this.state.players[snakeCharmer.playerId].name,
        value: snakeCharmer.value,
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
