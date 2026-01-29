import type { RoomState, Player } from '../types';
import { Awards } from './Awards';

interface EndScreenProps {
  state: RoomState;
  playerId: string;
  onRematch: () => void;
}

// Convert image to emoji
function getImageEmoji(image: number): string {
  if (image <= -4) return '😇';
  if (image <= -2) return '😊';
  if (image <= 1) return '😐';
  if (image <= 3) return '😏';
  return '🐍';
}

export function EndScreen({ state, playerId, onRematch }: EndScreenProps) {
  const sortedPlayers = Object.values(state.players).sort((a, b) => b.score - a.score);
  const isHost = playerId === state.hostId;
  const winner = sortedPlayers[0];

  const getRank = (player: Player) => {
    const index = sortedPlayers.findIndex(p => p.id === player.id);
    if (index === 0) return { emoji: '🥇', class: 'text-amber-400' };
    if (index === 1) return { emoji: '🥈', class: 'text-slate-300' };
    if (index === 2) return { emoji: '🥉', class: 'text-amber-600' };
    return { emoji: `#${index + 1}`, class: 'text-slate-500' };
  };

  // Calculate total heist amount
  const totalHeisted = state.history.reduce((sum, r) => {
    return sum + Object.values(r.results || {}).reduce((s, res) => s + res.loot, 0);
  }, 0);

  return (
    <div className="min-h-screen p-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-md space-y-8">
        {/* Winner announcement */}
        <div className="text-center">
          <div className="text-6xl mb-4">👑</div>
          <h1 className="text-3xl font-bold mb-2">Game Over!</h1>
          <div className="text-xl">
            <span className="text-amber-400 font-bold">{winner.name}</span>
            <span className="text-slate-400"> wins with </span>
            <span className="text-amber-400 font-bold">{winner.score}</span>
            <span className="text-slate-400"> points!</span>
          </div>
        </div>

        {/* Final standings */}
        <div className="bg-slate-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Final Standings
          </h2>
          <div className="space-y-3">
            {sortedPlayers.map((player) => {
              const rank = getRank(player);
              const isYou = player.id === playerId;

              return (
                <div
                  key={player.id}
                  className={`
                    flex items-center justify-between p-3 rounded-lg
                    ${isYou ? 'bg-blue-500/20 ring-1 ring-blue-500' : 'bg-slate-700/50'}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-2xl ${rank.class}`}>{rank.emoji}</span>
                    <div>
                      <div className="font-medium">
                        {player.name}
                        {isYou && <span className="text-blue-400 ml-1">(You)</span>}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2">
                        <span>{getImageEmoji(player.image)} Final image: {player.image}</span>
                        <span>📦 Stack: {player.stack}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-2xl font-bold tabular-nums">{player.score}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Awards */}
        {state.awards && state.awards.length > 0 && (
          <Awards awards={state.awards} />
        )}

        {/* Stats summary */}
        <div className="bg-slate-800/50 rounded-xl p-4 text-center">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-2xl font-bold">{state.config.totalRounds}</div>
              <div className="text-slate-400">Rounds</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {state.history.filter(r => r.betrayerCount === 0).length}
              </div>
              <div className="text-slate-400">Clean Rounds</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-400">
                💰{totalHeisted}
              </div>
              <div className="text-slate-400">Total Heisted</div>
            </div>
          </div>
        </div>

        {/* Rematch button */}
        {isHost ? (
          <button
            onClick={onRematch}
            className="w-full py-4 rounded-xl font-semibold text-lg bg-amber-500 hover:bg-amber-400 text-black transition-all"
          >
            Play Again
          </button>
        ) : (
          <div className="text-center text-slate-400">
            Waiting for host to start rematch...
          </div>
        )}
      </div>
    </div>
  );
}
