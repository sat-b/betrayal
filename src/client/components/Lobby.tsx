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

  const copyRoomCode = () => {
    navigator.clipboard.writeText(state.roomCode);
  };

  return (
    <div className="min-h-screen p-4 flex flex-col items-center">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Betrayal Game</h1>
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
                    min={5}
                    max={50}
                    value={state.config.totalRounds}
                    onChange={(e) => onConfigChange({ totalRounds: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Streak Bonus (+2 for 3+ cooperates)</span>
                  <button
                    onClick={() => onConfigChange({ streakBonus: !state.config.streakBonus })}
                    className={`
                      w-12 h-6 rounded-full transition-colors relative
                      ${state.config.streakBonus ? 'bg-green-500' : 'bg-slate-600'}
                    `}
                  >
                    <div
                      className={`
                        absolute top-1 w-4 h-4 rounded-full bg-white transition-transform
                        ${state.config.streakBonus ? 'translate-x-7' : 'translate-x-1'}
                      `}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Revenge Bonus (+1 per revenge)</span>
                  <button
                    onClick={() => onConfigChange({ revengeBonus: !state.config.revengeBonus })}
                    className={`
                      w-12 h-6 rounded-full transition-colors relative
                      ${state.config.revengeBonus ? 'bg-green-500' : 'bg-slate-600'}
                    `}
                  >
                    <div
                      className={`
                        absolute top-1 w-4 h-4 rounded-full bg-white transition-transform
                        ${state.config.revengeBonus ? 'translate-x-7' : 'translate-x-1'}
                      `}
                    />
                  </button>
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
          <h3 className="font-semibold mb-2">How to Play</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>Each round, choose to Cooperate or Betray</li>
            <li>If everyone cooperates: +2 points each</li>
            <li>Lone betrayer gets +5, cooperators get -2</li>
            <li>Multiple betrayers: +1 each, cooperators get -3</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
