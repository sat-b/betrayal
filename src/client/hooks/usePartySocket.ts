import { useEffect, useRef, useState, useCallback } from 'react';
import type { ClientMessage, ServerMessage, RoomState } from '../types';

const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST || 'localhost:1999';

interface UsePartySocketOptions {
  roomCode: string;
  onMessage?: (message: ServerMessage) => void;
}

export function usePartySocket({ roomCode, onMessage }: UsePartySocketOptions) {
  const socketRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [state, setState] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomCode) return;

    // Use plain WebSocket for local dev, PartySocket URL format for production
    const isLocal = PARTYKIT_HOST.includes('localhost');
    const protocol = isLocal ? 'ws' : 'wss';
    const wsUrl = `${protocol}://${PARTYKIT_HOST}/parties/main/${roomCode.toUpperCase()}`;

    const socket = new WebSocket(wsUrl);

    socketRef.current = socket;

    socket.addEventListener('open', () => {
      setConnected(true);
      setError(null);
    });

    socket.addEventListener('close', () => {
      setConnected(false);
    });

    socket.addEventListener('error', () => {
      setError('Connection error');
    });

    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data) as ServerMessage;

        if (message.type === 'state') {
          setState(message.state);
          setPlayerId(message.playerId);
        } else if (message.type === 'error') {
          setError(message.message);
        } else if (message.type === 'player-joined') {
          setState(prev => prev ? {
            ...prev,
            players: { ...prev.players, [message.player.id]: message.player }
          } : null);
        } else if (message.type === 'player-left') {
          setState(prev => {
            if (!prev) return null;
            const { [message.playerId]: _, ...players } = prev.players;
            return { ...prev, players };
          });
        } else if (message.type === 'player-ready') {
          setState(prev => prev ? {
            ...prev,
            players: {
              ...prev.players,
              [message.playerId]: { ...prev.players[message.playerId], ready: message.ready }
            }
          } : null);
        } else if (message.type === 'config-updated') {
          setState(prev => prev ? { ...prev, config: message.config } : null);
        } else if (message.type === 'round-start') {
          setState(prev => prev ? {
            ...prev,
            phase: 'ROUND',
            roundIndex: message.roundIndex,
            roundStartTime: message.startTime,
            choices: {},
          } : null);
        } else if (message.type === 'choice-locked') {
          setState(prev => prev ? {
            ...prev,
            choices: {
              ...prev.choices,
              [message.playerId]: { choice: 'C', lockedAt: Date.now() } // We don't know actual choice yet
            }
          } : null);
        } else if (message.type === 'round-reveal') {
          setState(prev => prev ? {
            ...prev,
            phase: 'REVEAL',
            history: [...prev.history, message.history],
            players: Object.fromEntries(
              Object.entries(prev.players).map(([id, p]) => [
                id,
                { ...p, score: message.scores[id] ?? p.score }
              ])
            ),
          } : null);
        } else if (message.type === 'game-end') {
          setState(prev => prev ? {
            ...prev,
            phase: 'FINISHED',
            awards: message.awards,
            players: Object.fromEntries(
              Object.entries(prev.players).map(([id, p]) => [
                id,
                { ...p, score: message.scores[id] ?? p.score }
              ])
            ),
          } : null);
        } else if (message.type === 'rematch-started') {
          setState(prev => prev ? {
            ...prev,
            phase: 'LOBBY',
            roundIndex: 0,
            history: [],
            choices: {},
            awards: undefined,
            players: Object.fromEntries(
              Object.entries(prev.players).map(([id, p]) => [
                id,
                { ...p, score: 0, ready: false }
              ])
            ),
          } : null);
        }

        onMessage?.(message);
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [roomCode, onMessage]);

  const send = useCallback((message: ClientMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  }, []);

  return {
    connected,
    playerId,
    state,
    error,
    send,
    socket: socketRef.current,
  };
}
