import type { Player, RoundChoice, Choice, RoundResult } from '../types';

interface PlayerListProps {
  players: Record<string, Player>;
  currentPlayerId: string | null;
  hostId: string;
  showReady?: boolean;
  choices?: Record<string, RoundChoice>;
  revealedChoices?: Record<string, Choice>;
  results?: Record<string, RoundResult>;
  showFuzzy?: boolean; // Show fuzzy values for opponents
}

// Convert image (-5 to +5) to emoji representation
function getImageEmoji(image: number): string {
  if (image <= -4) return '😇'; // Saint
  if (image <= -2) return '😊'; // Trusted
  if (image <= 1) return '😐';  // Neutral
  if (image <= 3) return '😏';  // Suspicious
  return '🐍';                   // Snake
}

// Get stack level description
function getStackLevel(stack: number): { label: string; color: string } {
  if (stack <= 5) return { label: 'Low', color: 'text-red-400' };
  if (stack <= 12) return { label: 'Med', color: 'text-yellow-400' };
  if (stack <= 20) return { label: 'High', color: 'text-green-400' };
  return { label: 'Huge', color: 'text-emerald-400' };
}

export function PlayerList({
  players,
  currentPlayerId,
  hostId,
  showReady = false,
  choices,
  revealedChoices,
  results,
  showFuzzy = false,
}: PlayerListProps) {
  const sortedPlayers = Object.values(players).sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-2">
      {sortedPlayers.map((player, index) => {
        const isYou = player.id === currentPlayerId;
        const isHost = player.id === hostId;
        const hasLocked = choices?.[player.id];
        const revealed = revealedChoices?.[player.id];
        const result = results?.[player.id];
        const stackInfo = getStackLevel(player.stack);

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
                {!showReady && (
                  <div className="flex items-center gap-2 text-xs">
                    <span title={`Image: ${player.image}`}>
                      {getImageEmoji(player.image)}
                    </span>
                    <span className={stackInfo.color} title={`Stack: ${player.stack}`}>
                      {isYou || !showFuzzy ? `📦${player.stack}` : `📦${stackInfo.label}`}
                    </span>
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
                {result && (
                  <span
                    className={`
                      text-sm font-medium
                      ${result.totalDelta > 0 ? 'text-green-400' : result.totalDelta < 0 ? 'text-red-400' : 'text-slate-400'}
                    `}
                  >
                    {result.totalDelta > 0 ? '+' : ''}{result.totalDelta}
                    {result.loot > 0 && <span className="text-amber-400 ml-1">💰</span>}
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
