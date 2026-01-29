import { WebSocketServer } from 'ws';

const PORT = 1999;

// Store rooms
const rooms = new Map();

// Default config
const DEFAULT_CONFIG = {
  timerSeconds: 10,
  totalRounds: 15,
};

function createRoom(roomCode) {
  return {
    roomCode,
    hostId: '',
    config: { ...DEFAULT_CONFIG },
    players: {},
    pot: 0,
    phase: 'LOBBY',
    roundIndex: 0,
    roundStartTime: 0,
    choices: {},
    history: [],
    connections: new Map(),
    roundTimer: null,
    revealTimer: null,
  };
}

function broadcast(room, message) {
  const json = JSON.stringify(message);
  for (const [id, ws] of room.connections) {
    if (ws.readyState === 1) ws.send(json);
  }
}

function broadcastState(room) {
  for (const [id, ws] of room.connections) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'state',
        state: {
          roomCode: room.roomCode,
          hostId: room.hostId,
          config: room.config,
          players: room.players,
          pot: room.pot,
          phase: room.phase,
          roundIndex: room.roundIndex,
          roundStartTime: room.roundStartTime,
          choices: room.choices,
          history: room.history,
          awards: room.awards,
        },
        playerId: id,
      }));
    }
  }
}

function resolveRound(room, choices) {
  const results = {};
  const potBefore = room.pot;

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
      foldingTax: 0,
      imageChange: 0,
      totalDelta: 0,
    };
  }

  // Step 1: Everyone pays blind
  for (const playerId of Object.keys(choices)) {
    room.players[playerId].score -= 1;
  }

  // Step 2: Cooperators invest
  for (const playerId of cooperators) {
    const player = room.players[playerId];
    player.stack += 2;
    room.pot += 2;
    results[playerId].stackChange = 2;
    results[playerId].potContrib = 2;
  }

  // Step 3: Betrayers contest the pot
  if (B > 0) {
    // First, drain stacks from cooperators
    let totalDrain = 0;
    for (const playerId of cooperators) {
      const player = room.players[playerId];
      const drain = Math.min(2, Math.floor(player.stack * 0.25));
      player.stack -= drain;
      totalDrain += drain;
      results[playerId].stackDrain = drain;
      results[playerId].stackChange -= drain;
    }

    // Add drained amount to pot before splitting
    room.pot += totalDrain;

    // Calculate weights for betrayers
    const weights = {};
    let totalWeight = 0;
    for (const playerId of betrayers) {
      const player = room.players[playerId];
      const weight = Math.min(8, Math.max(1, 6 - player.image));
      weights[playerId] = weight;
      totalWeight += weight;
    }

    // Distribute pot to betrayers
    const potToDistribute = room.pot;
    for (const playerId of betrayers) {
      const loot = Math.floor(potToDistribute * weights[playerId] / totalWeight);
      room.players[playerId].score += loot;
      results[playerId].loot = loot;
    }

    // Pot is emptied
    room.pot = 0;

    // Cooperators suffer "called and lost" penalty
    for (const playerId of cooperators) {
      room.players[playerId].score -= 1;
      results[playerId].foldingTax = -1;
    }
  } else {
    // Clean round: cooperators get bonus
    for (const playerId of cooperators) {
      room.players[playerId].score += 2;
      results[playerId].foldingTax = 2;
    }
  }

  // Step 4: Update image
  for (const [playerId, choice] of Object.entries(choices)) {
    const player = room.players[playerId];
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
    r.totalDelta = r.blind + r.loot + r.foldingTax;
  }

  return { results, potBefore, potAfter: room.pot };
}

function computeAwards(room) {
  const awards = [];
  const playerIds = Object.keys(room.players);
  const history = room.history;

  if (playerIds.length === 0 || history.length === 0) return awards;

  // Master Thief
  let masterThief = { playerId: '', value: 0 };
  for (const playerId of playerIds) {
    let totalLoot = 0;
    for (const round of history) {
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
      playerName: room.players[masterThief.playerId].name,
      value: masterThief.value,
    });
  }

  // Most Trusted
  let mostTrusted = { playerId: '', value: Infinity };
  for (const playerId of playerIds) {
    const image = room.players[playerId].image;
    if (image < mostTrusted.value) {
      mostTrusted = { playerId, value: image };
    }
  }
  if (mostTrusted.playerId) {
    awards.push({
      type: 'most-trusted',
      playerId: mostTrusted.playerId,
      playerName: room.players[mostTrusted.playerId].name,
      value: mostTrusted.value,
    });
  }

  // Biggest Heist
  let biggestHeist = { playerId: '', value: 0 };
  for (const playerId of playerIds) {
    for (const round of history) {
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
      playerName: room.players[biggestHeist.playerId].name,
      value: biggestHeist.value,
    });
  }

  // Snake Charmer
  let snakeCharmer = { playerId: '', value: -Infinity };
  for (const playerId of playerIds) {
    const image = room.players[playerId].image;
    if (image > snakeCharmer.value) {
      snakeCharmer = { playerId, value: image };
    }
  }
  if (snakeCharmer.playerId && snakeCharmer.value > 0) {
    awards.push({
      type: 'snake-charmer',
      playerId: snakeCharmer.playerId,
      playerName: room.players[snakeCharmer.playerId].name,
      value: snakeCharmer.value,
    });
  }

  return awards;
}

function startRound(room) {
  room.phase = 'ROUND';
  room.roundStartTime = Date.now();
  room.choices = {};

  for (const playerId of Object.keys(room.players)) {
    room.choices[playerId] = { choice: 'C', lockedAt: 0 };
  }

  broadcast(room, {
    type: 'round-start',
    roundIndex: room.roundIndex,
    startTime: room.roundStartTime,
    pot: room.pot,
  });

  room.roundTimer = setTimeout(() => endRound(room), room.config.timerSeconds * 1000);
}

function endRound(room) {
  if (room.roundTimer) {
    clearTimeout(room.roundTimer);
    room.roundTimer = null;
  }

  room.phase = 'REVEAL';

  const choices = {};
  for (const [playerId, data] of Object.entries(room.choices)) {
    choices[playerId] = data.choice;
  }

  const { results, potBefore, potAfter } = resolveRound(room, choices);

  const roundHistory = {
    roundIndex: room.roundIndex,
    choices,
    results,
    potBefore,
    potAfter,
    betrayerCount: Object.values(choices).filter(c => c === 'B').length,
  };
  room.history.push(roundHistory);

  broadcast(room, {
    type: 'round-reveal',
    history: roundHistory,
    players: room.players,
    pot: room.pot,
  });

  room.revealTimer = setTimeout(() => afterReveal(room), 5000);
}

function afterReveal(room) {
  if (room.revealTimer) {
    clearTimeout(room.revealTimer);
    room.revealTimer = null;
  }

  room.roundIndex++;

  if (room.roundIndex >= room.config.totalRounds) {
    endGame(room);
  } else {
    startRound(room);
  }
}

function endGame(room) {
  room.phase = 'FINISHED';
  room.awards = computeAwards(room);

  broadcast(room, {
    type: 'game-end',
    players: room.players,
    awards: room.awards,
  });
}

function checkAllLocked(room) {
  const connectedPlayers = Object.values(room.players).filter(p => p.connected);
  const allLocked = connectedPlayers.every(p => {
    const choice = room.choices[p.id];
    return choice && choice.lockedAt > 0;
  });

  if (allLocked && room.roundTimer) {
    clearTimeout(room.roundTimer);
    endRound(room);
  }
}

const wss = new WebSocketServer({ port: PORT });

console.log(`🎰 Poker Betrayal server running on ws://localhost:${PORT}`);

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathParts = url.pathname.split('/').filter(Boolean);

  let roomCode = pathParts[pathParts.length - 1]?.toUpperCase() || 'TEST';

  const connId = Math.random().toString(36).substring(2, 10);

  if (!rooms.has(roomCode)) {
    rooms.set(roomCode, createRoom(roomCode));
  }

  const room = rooms.get(roomCode);
  room.connections.set(connId, ws);

  // Send initial state
  ws.send(JSON.stringify({
    type: 'state',
    state: {
      roomCode: room.roomCode,
      hostId: room.hostId,
      config: room.config,
      players: room.players,
      pot: room.pot,
      phase: room.phase,
      roundIndex: room.roundIndex,
      roundStartTime: room.roundStartTime,
      choices: room.choices,
      history: room.history,
    },
    playerId: connId,
  }));

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case 'join': {
          const name = msg.name?.slice(0, 12) || 'Player';
          if (Object.keys(room.players).length >= 5) {
            ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
            return;
          }
          room.players[connId] = {
            id: connId,
            name,
            score: 0,
            stack: 10,
            image: 0,
            ready: false,
            connected: true,
          };
          if (!room.hostId) room.hostId = connId;
          broadcast(room, { type: 'player-joined', player: room.players[connId] });
          broadcastState(room);
          break;
        }

        case 'ready': {
          if (room.players[connId] && room.phase === 'LOBBY') {
            room.players[connId].ready = msg.ready;
            broadcast(room, { type: 'player-ready', playerId: connId, ready: msg.ready });
          }
          break;
        }

        case 'config': {
          if (connId === room.hostId && room.phase === 'LOBBY') {
            room.config = { ...room.config, ...msg.config };
            room.config.timerSeconds = Math.min(20, Math.max(5, room.config.timerSeconds));
            room.config.totalRounds = Math.min(30, Math.max(10, room.config.totalRounds));
            broadcast(room, { type: 'config-updated', config: room.config });
          }
          break;
        }

        case 'start': {
          if (connId !== room.hostId || room.phase !== 'LOBBY') return;
          const players = Object.values(room.players).filter(p => p.connected);
          if (players.length < 2) {
            ws.send(JSON.stringify({ type: 'error', message: 'Need at least 2 players' }));
            return;
          }
          if (!players.every(p => p.ready)) {
            ws.send(JSON.stringify({ type: 'error', message: 'Not all players are ready' }));
            return;
          }
          // Reset game state
          room.pot = 0;
          for (const player of Object.values(room.players)) {
            player.score = 0;
            player.stack = 10;
            player.image = 0;
          }
          startRound(room);
          break;
        }

        case 'choice': {
          if (room.phase !== 'ROUND' || !room.players[connId]) return;
          const existing = room.choices[connId];
          if (!existing || existing.lockedAt === 0) {
            room.choices[connId] = { choice: msg.choice, lockedAt: 0 };
          }
          break;
        }

        case 'lock': {
          if (room.phase !== 'ROUND') return;
          const choice = room.choices[connId];
          if (!choice || choice.lockedAt > 0) return;
          choice.lockedAt = Date.now();
          broadcast(room, { type: 'choice-locked', playerId: connId });
          checkAllLocked(room);
          break;
        }

        case 'rematch': {
          if (connId !== room.hostId || room.phase !== 'FINISHED') return;
          for (const player of Object.values(room.players)) {
            player.score = 0;
            player.stack = 10;
            player.image = 0;
            player.ready = false;
          }
          room.pot = 0;
          room.phase = 'LOBBY';
          room.roundIndex = 0;
          room.history = [];
          room.choices = {};
          room.awards = undefined;
          broadcast(room, { type: 'rematch-started' });
          broadcastState(room);
          break;
        }

        case 'webrtc-signal': {
          const target = room.connections.get(msg.to);
          if (target && target.readyState === 1) {
            target.send(JSON.stringify({ type: 'webrtc-signal', from: connId, signal: msg.signal }));
          }
          break;
        }
      }
    } catch (e) {
      console.error('Message error:', e);
    }
  });

  ws.on('close', () => {
    room.connections.delete(connId);
    if (room.players[connId]) {
      room.players[connId].connected = false;
      broadcast(room, { type: 'player-left', playerId: connId });

      if (connId === room.hostId) {
        const connected = Object.values(room.players).find(p => p.connected);
        if (connected) {
          room.hostId = connected.id;
          broadcastState(room);
        }
      }
    }

    if (room.connections.size === 0) {
      if (room.roundTimer) clearTimeout(room.roundTimer);
      if (room.revealTimer) clearTimeout(room.revealTimer);
      rooms.delete(roomCode);
    }
  });
});
