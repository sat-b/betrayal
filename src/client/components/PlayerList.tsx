import type { Player, RoundChoice, Choice } from '../types';

interface PlayerListProps {
  players: Record<string, Player>;
  currentPlayerId: string | null;
  hostId: string;
  showReady?: boolean;
  choices?: Record<string, RoundChoice>;
  revealedChoices?: Record<string, Choice>;
  deltas?: Record<string, number>;
}

export function PlayerList({
  players,
  currentPlayerId,
  hostId,
  showReady = false,
  choices,
  revealedChoices,
  deltas,
}: PlayerListProps) {
  const sortedPlayers = Object.values(players).sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-2">
      {sortedPlayers.map((player, index) => {
        const isYou = player.id === currentPlayerId;
        const isHost = player.id === hostId;
        const hasLocked = choices?.[player.id];
        const revealed = revealedChoices?.[player.id];
        const delta = deltas?.[player.id];

        return (
          <div
            key={player.id}
            className={`
              flex items-center justify-between p-3 rounded-lg
              ${isYou ? 'bg-slate-700 ring-2 ring-blue-500' : 'bg-slate-800'}
              ${!player.connected ? 'opacity-50' : ''}
            `}
          >
            <div className="flex items-center gap-3">
              <div className="w-6 text-center text-slate-400 font-mono">
                #{index + 1}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{player.name}</span>
                  {isYou && <span className="text-xs text-blue-400">(You)</span>}
                  {isHost && <span className="text-xs text-amber-400">👑</span>}
                </div>
                {showReady && (
                  <div className={`text-xs ${player.ready ? 'text-green-400' : 'text-slate-500'}`}>
                    {player.ready ? '✓ Ready' : 'Not ready'}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {hasLocked && !revealed && (
                <span className="text-xs text-amber-400">🔒</span>
              )}

              {revealed && (
                <span
                  className={`
                    w-8 h-8 flex items-center justify-center rounded-full text-lg
                    ${revealed === 'C' ? 'bg-cooperate/20 text-cooperate' : 'bg-betray/20 text-betray'}
                  `}
                >
                  {revealed === 'C' ? '🤝' : '🗡️'}
                </span>
              )}

              <div className="flex items-center gap-2 min-w-[80px] justify-end">
                {delta !== undefined && (
                  <span
                    className={`
                      text-sm font-medium
                      ${delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-slate-400'}
                    `}
                  >
                    {delta > 0 ? '+' : ''}{delta}
                  </span>
                )}
                <span className="font-bold text-lg tabular-nums">
                  {player.score}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
