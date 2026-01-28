import { useState, useCallback, useEffect, useRef } from 'react';
import { usePartySocket } from './hooks/usePartySocket';
import { useVoiceChat } from './hooks/useVoiceChat';
import { useGameState } from './hooks/useGameState';
import { Lobby } from './components/Lobby';
import { Game } from './components/Game';
import { EndScreen } from './components/EndScreen';
import type { ServerMessage, GameConfig } from './types';

type Screen = 'home' | 'joining' | 'game';

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  const handleMessage = useCallback((_message: ServerMessage) => {
    // Don't change screen here - let the rendering logic handle it
    // based on whether player is in the game
  }, []);

  const { connected, playerId, state, error, send, socket } = usePartySocket({
    roomCode,
    onMessage: handleMessage,
  });

  const gameState = useGameState({ send });

  const voiceChat = useVoiceChat({
    socket,
    playerId,
    playerIds: state ? Object.keys(state.players) : [],
    enabled: state?.phase === 'ROUND' || state?.phase === 'REVEAL',
  });

  const createRoom = () => {
    if (!playerName.trim()) return;
    const code = generateRoomCode();
    setRoomCode(code);
    setScreen('joining');
  };

  const joinRoom = () => {
    if (!playerName.trim() || !joinCode.trim()) return;
    setRoomCode(joinCode.toUpperCase());
    setScreen('joining');
  };

  // Track if we've sent join message
  const hasJoined = useRef(false);

  // Auto-join when connected
  useEffect(() => {
    if (screen === 'joining' && connected && !hasJoined.current && playerName) {
      hasJoined.current = true;
      send({ type: 'join', name: playerName });
    }
    // Reset when going back to home
    if (screen === 'home') {
      hasJoined.current = false;
    }
  }, [screen, connected, playerName, send]);

  const handleConfigChange = (config: Partial<GameConfig>) => {
    send({ type: 'config', config });
  };

  // Home screen
  if (screen === 'home') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-2">Betrayal Game</h1>
            <p className="text-slate-400">A game of trust and deception</p>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              placeholder="Your Name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={12}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 focus:border-blue-500 focus:outline-none text-center text-lg"
            />

            <button
              onClick={createRoom}
              disabled={!playerName.trim()}
              className="w-full py-4 rounded-xl font-semibold text-lg bg-blue-500 hover:bg-blue-400 disabled:bg-slate-700 disabled:text-slate-500 transition-all"
            >
              Create Room
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-700" />
              <span className="text-slate-500 text-sm">or</span>
              <div className="flex-1 h-px bg-slate-700" />
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Room Code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={4}
                className="flex-1 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 focus:border-blue-500 focus:outline-none text-center font-mono text-lg uppercase"
              />
              <button
                onClick={joinRoom}
                disabled={!playerName.trim() || joinCode.length !== 4}
                className="px-6 py-3 rounded-xl font-semibold bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 transition-all"
              >
                Join
              </button>
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-center text-sm">{error}</div>
          )}
        </div>
      </div>
    );
  }

  // Check if player is actually in the game
  const isInGame = state && playerId && state.players[playerId];

  // Connecting/joining screen - show while connecting or waiting to join
  if (screen === 'joining' && !isInGame) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
          <div>Connecting to room {roomCode}...</div>
          {error && (
            <div className="text-red-400 text-sm">{error}</div>
          )}
          <button
            onClick={() => {
              setScreen('home');
              setRoomCode('');
            }}
            className="text-slate-400 hover:text-white text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Game screens - only show when player is in the game
  if (isInGame) {
    if (state.phase === 'LOBBY') {
      return (
        <Lobby
          state={state}
          playerId={playerId}
          onReady={gameState.toggleReady}
          onStart={gameState.startGame}
          onConfigChange={handleConfigChange}
        />
      );
    }

    if (state.phase === 'ROUND' || state.phase === 'REVEAL') {
      return (
        <Game
          state={state}
          playerId={playerId}
          currentChoice={gameState.currentChoice}
          isLocked={gameState.isLocked}
          onChoose={gameState.makeChoice}
          onLock={gameState.lockIn}
          onResetChoice={gameState.resetChoice}
          voiceChat={{
            voiceEnabled: voiceChat.voiceEnabled,
            muted: voiceChat.muted,
            onToggleMute: () => voiceChat.setMuted(!voiceChat.muted),
            onStartVoice: voiceChat.startVoice,
            onStopVoice: voiceChat.stopVoice,
            peers: voiceChat.peers,
            error: voiceChat.error,
          }}
        />
      );
    }

    if (state.phase === 'FINISHED') {
      return (
        <EndScreen
          state={state}
          playerId={playerId}
          onRematch={gameState.requestRematch}
        />
      );
    }
  }

  return null;
}
