import type { RoundHistory, Player } from '../types';

interface BetrayalHistoryProps {
  history: RoundHistory[];
  players: Record<string, Player>;
  maxRounds?: number;
}

export function BetrayalHistory({ history, players, maxRounds = 5 }: BetrayalHistoryProps) {
  const recentHistory = history.slice(-maxRounds).reverse();

  if (recentHistory.length === 0) {
    return null;
  }

  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
        Recent Rounds
      </h3>
      <div className="space-y-2">
        {recentHistory.map((round) => {
          const totalLoot = round.results
            ? Object.values(round.results).reduce((sum, r) => sum + r.loot, 0)
            : 0;

          return (
            <div key={round.roundIndex} className="flex items-center gap-3 text-sm">
              <span className="text-slate-500 w-8">R{round.roundIndex + 1}</span>
              <div className="flex gap-1 flex-wrap flex-1">
                {Object.entries(round.choices).map(([playerId, choice]) => (
                  <span
                    key={playerId}
                    className={`
                      px-2 py-0.5 rounded text-xs
                      ${choice === 'C' ? 'bg-cooperate/20 text-cooperate' : 'bg-betray/20 text-betray'}
                    `}
                    title={players?.[playerId]?.name}
                  >
                    {players?.[playerId]?.name?.slice(0, 3) || '???'}
                  </span>
                ))}
              </div>
              <span className="text-slate-500 text-xs">
                {round.betrayerCount === 0
                  ? '✨'
                  : totalLoot > 0 ? `💰${totalLoot}` : '🗡️'
                }
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
