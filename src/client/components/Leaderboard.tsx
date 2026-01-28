import type { Player } from '../types';

interface LeaderboardProps {
  players: Record<string, Player>;
  currentPlayerId: string | null;
}

export function Leaderboard({ players, currentPlayerId }: LeaderboardProps) {
  const sorted = Object.values(players).sort((a, b) => b.score - a.score);

  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
        Leaderboard
      </h3>
      <div className="space-y-2">
        {sorted.map((player, index) => {
          const isYou = player.id === currentPlayerId;
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';

          return (
            <div
              key={player.id}
              className={`
                flex items-center justify-between py-1
                ${isYou ? 'text-blue-400' : ''}
              `}
            >
              <div className="flex items-center gap-2">
                <span className="w-6 text-center">{medal || `#${index + 1}`}</span>
                <span className={isYou ? 'font-semibold' : ''}>
                  {player.name}
                  {isYou && ' (You)'}
                </span>
              </div>
              <span className="font-bold tabular-nums">{player.score}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
