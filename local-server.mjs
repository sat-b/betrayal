import { WebSocketServer } from 'ws';

const PORT = 1999;

// Store rooms
const rooms = new Map();

// Default config
const DEFAULT_CONFIG = {
  timerSeconds: 10,
  totalRounds: 20,
  streakBonus: true,
  revengeBonus: true,
};

function createRoom(roomCode) {
  return {
    roomCode,
    hostId: '',
    config: { ...DEFAULT_CONFIG },
    players: {},
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

function computeDeltas(room, choices) {
  const B = Object.values(choices).filter(c => c === 'B').length;
  const deltas = {};

  for (const [playerId, choice] of Object.entries(choices)) {
    let delta = 0;
    if (B === 0) delta = 2;
    else if (B === 1) delta = choice === 'B' ? 5 : -2;
    else delta = choice === 'B' ? 1 : -3;

    // Streak bonus
    if (room.config.streakBonus && choice === 'C' && B === 0) {
      const history = room.history;
      if (history.length >= 3) {
        const recent = history.slice(-3);
        if (recent.every(r => r.choices[playerId] === 'C')) {
          delta += 2;
        }
      }
    }

    deltas[playerId] = delta;
  }
  return deltas;
}

function computeAwards(room) {
  const awards = [];
  const playerIds = Object.keys(room.players);
  const history = room.history;

  if (playerIds.length === 0 || history.length === 0) return awards;

  // Most Trusted
  let mostTrusted = { playerId: '', score: -Infinity };
  for (const playerId of playerIds) {
    let coopCount = 0;
    let loneBetrayCount = 0;
    for (const round of history) {
      if (round.choices[playerId] === 'C') coopCount++;
      else if (round.betrayerCount === 1 && round.choices[playerId] === 'B') loneBetrayCount++;
    }
    const score = (100 * coopCount / history.length) - (15 * loneBetrayCount);
    if (score > mostTrusted.score) mostTrusted = { playerId, score };
  }
  if (mostTrusted.playerId) {
    awards.push({ type: 'most-trusted', playerId: mostTrusted.playerId, playerName: room.players[mostTrusted.playerId].name, value: Math.round(mostTrusted.score) });
  }

  // Most Evil
  let mostEvil = { playerId: '', score: 0 };
  for (const playerId of playerIds) {
    let evilScore = 0;
    for (const round of history) {
      if (round.choices[playerId] === 'B') {
        evilScore += Object.values(round.choices).filter(c => c === 'C').length;
      }
    }
    if (evilScore > mostEvil.score) mostEvil = { playerId, score: evilScore };
  }
  if (mostEvil.playerId && mostEvil.score > 0) {
    awards.push({ type: 'most-evil', playerId: mostEvil.playerId, playerName: room.players[mostEvil.playerId].name, value: mostEvil.score });
  }

  // Biggest Swing
  let biggestSwing = { playerId: '', value: 0 };
  for (const playerId of playerIds) {
    for (const round of history) {
      const delta = Math.abs(round.deltas[playerId] || 0);
      if (delta > biggestSwing.value) biggestSwing = { playerId, value: delta };
    }
  }
  if (biggestSwing.playerId) {
    awards.push({ type: 'biggest-swing', playerId: biggestSwing.playerId, playerName: room.players[biggestSwing.playerId].name, value: biggestSwing.value });
  }

  // Kingmaker
  let kingmaker = { playerId: '', impact: 0 };
  for (const playerId of playerIds) {
    let totalImpact = 0;
    for (const round of history) {
      const actualB = round.betrayerCount;
      const flippedB = round.choices[playerId] === 'C' ? actualB + 1 : actualB - 1;
      for (const otherId of playerIds) {
        if (otherId === playerId) continue;
        const otherChoice = round.choices[otherId];
        let actualDelta = actualB === 0 ? 2 : actualB === 1 ? (otherChoice === 'B' ? 5 : -2) : (otherChoice === 'B' ? 1 : -3);
        let flippedDelta = flippedB === 0 ? 2 : flippedB === 1 ? (otherChoice === 'B' ? 5 : -2) : (otherChoice === 'B' ? 1 : -3);
        totalImpact += Math.abs(flippedDelta - actualDelta);
      }
    }
    if (totalImpact > kingmaker.impact) kingmaker = { playerId, impact: totalImpact };
  }
  if (kingmaker.playerId) {
    awards.push({ type: 'kingmaker', playerId: kingmaker.playerId, playerName: room.players[kingmaker.playerId].name, value: kingmaker.impact });
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

  const deltas = computeDeltas(room, choices);
  const scores = {};

  for (const [playerId, delta] of Object.entries(deltas)) {
    room.players[playerId].score += delta;
    scores[playerId] = room.players[playerId].score;
  }

  const roundHistory = {
    roundIndex: room.roundIndex,
    choices,
    deltas,
    betrayerCount: Object.values(choices).filter(c => c === 'B').length,
  };
  room.history.push(roundHistory);

  broadcast(room, {
    type: 'round-reveal',
    choices,
    deltas,
    scores,
    history: roundHistory,
  });

  room.revealTimer = setTimeout(() => afterReveal(room), 4000);
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

  const scores = {};
  for (const player of Object.values(room.players)) {
    scores[player.id] = player.score;
  }

  broadcast(room, {
    type: 'game-end',
    scores,
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

console.log(`🎈 Local WebSocket server running on ws://localhost:${PORT}`);

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathParts = url.pathname.split('/').filter(Boolean);

  // Expected path: /party/betrayal-game/ROOMCODE or /parties/main/ROOMCODE
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
          room.players[connId] = { id: connId, name, score: 0, ready: false, connected: true };
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
            room.config.totalRounds = Math.min(50, Math.max(5, room.config.totalRounds));
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
            player.ready = false;
          }
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

    // Clean up empty rooms
    if (room.connections.size === 0) {
      if (room.roundTimer) clearTimeout(room.roundTimer);
      if (room.revealTimer) clearTimeout(room.revealTimer);
      rooms.delete(roomCode);
    }
  });
});
