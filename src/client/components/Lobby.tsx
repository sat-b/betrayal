import { useState } from 'react';
import type { RoomState, GameConfig } from '../types';
import { PlayerList } from './PlayerList';

interface LobbyProps {
  state: RoomState;
  playerId: string;
  onReady: (ready: boolean) => void;
  onStart: () => void;
  onConfigChange: (config: Partial<GameConfig>) => void;
}

export function Lobby({ state, playerId, onReady, onStart, onConfigChange }: LobbyProps) {
  const isHost = playerId === state.hostId;
  const currentPlayer = state.players[playerId];
  const playerCount = Object.keys(state.players).length;
  const allReady = Object.values(state.players).every(p => p.ready);
  const canStart = isHost && playerCount >= 2 && allReady;

  const [showConfig, setShowConfig] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(state.roomCode);
  };

  return (
    <div className="min-h-screen p-4 flex flex-col items-center">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">🎰 Poker Betrayal</h1>
          <div className="flex items-center justify-center gap-2">
            <span className="text-slate-400">Room Code:</span>
            <button
              onClick={copyRoomCode}
              className="text-2xl font-mono font-bold bg-slate-800 px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
            >
              {state.roomCode}
            </button>
          </div>
        </div>

        {/* Players */}
        <div className="bg-slate-800/50 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Players ({playerCount}/5)
          </h2>
          <PlayerList
            players={state.players}
            currentPlayerId={playerId}
            hostId={state.hostId}
            showReady
          />
        </div>

        {/* Host Controls */}
        {isHost && (
          <div className="bg-slate-800/50 rounded-xl p-4">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="w-full flex items-center justify-between text-sm font-semibold text-slate-400 uppercase tracking-wider"
            >
              <span>Game Settings</span>
              <span>{showConfig ? '▲' : '▼'}</span>
            </button>

            {showConfig && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">
                    Timer: {state.config.timerSeconds}s
                  </label>
                  <input
                    type="range"
                    min={5}
                    max={20}
                    value={state.config.timerSeconds}
                    onChange={(e) => onConfigChange({ timerSeconds: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">
                    Total Rounds: {state.config.totalRounds}
                  </label>
                  <input
                    type="range"
                    min={10}
                    max={30}
                    value={state.config.totalRounds}
                    onChange={(e) => onConfigChange({ totalRounds: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ready / Start */}
        <div className="space-y-3">
          {!isHost && (
            <button
              onClick={() => onReady(!currentPlayer?.ready)}
              className={`
                w-full py-4 rounded-xl font-semibold text-lg transition-all
                ${currentPlayer?.ready
                  ? 'bg-green-500 hover:bg-green-400'
                  : 'bg-slate-700 hover:bg-slate-600'
                }
              `}
            >
              {currentPlayer?.ready ? '✓ Ready!' : 'Ready Up'}
            </button>
          )}

          {isHost && (
            <>
              <button
                onClick={() => onReady(!currentPlayer?.ready)}
                className={`
                  w-full py-3 rounded-xl font-semibold transition-all
                  ${currentPlayer?.ready
                    ? 'bg-green-500/20 text-green-400 border border-green-500'
                    : 'bg-slate-700 hover:bg-slate-600'
                  }
                `}
              >
                {currentPlayer?.ready ? '✓ You\'re Ready' : 'Ready Up'}
              </button>

              <button
                onClick={onStart}
                disabled={!canStart}
                className={`
                  w-full py-4 rounded-xl font-semibold text-lg transition-all
                  ${canStart
                    ? 'bg-amber-500 hover:bg-amber-400 text-black'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  }
                `}
              >
                {playerCount < 2
                  ? 'Need 2+ Players'
                  : !allReady
                    ? 'Waiting for Players...'
                    : 'Start Game'
                }
              </button>
            </>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-slate-800/30 rounded-xl p-4 text-sm text-slate-400">
          <button
            onClick={() => setShowRules(!showRules)}
            className="w-full flex items-center justify-between font-semibold"
          >
            <span>How to Play</span>
            <span>{showRules ? '▲' : '▼'}</span>
          </button>

          {showRules && (
            <div className="mt-3 space-y-3">
              <div>
                <h4 className="text-white font-medium">🎯 Goal</h4>
                <p>Highest score wins. Balance trust and betrayal like poker!</p>
              </div>

              <div>
                <h4 className="text-white font-medium">💰 Every Round</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>Everyone pays <span className="text-red-400">-1 blind</span></li>
                  <li>Cooperate: Build your stack (+2) & grow the pot</li>
                  <li>Betray: Steal the pot (split by image)</li>
                </ul>
              </div>

              <div>
                <h4 className="text-white font-medium">🎭 Image System</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>😇 Saints steal BIG when they betray</li>
                  <li>🐍 Snakes get crumbs (bad reputation)</li>
                  <li>Cooperate = improve image, Betray = tank it</li>
                </ul>
              </div>

              <div>
                <h4 className="text-white font-medium">⚡ Key Insight</h4>
                <p className="text-amber-400">Time your betrayal! Wait for a fat pot and good image, then strike.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
