import type { Award } from '../types';

interface AwardsProps {
  awards: Award[];
}

const AWARD_CONFIG: Record<string, { emoji: string; title: string; description: string; color: string }> = {
  'master-thief': {
    emoji: '🦝',
    title: 'Master Thief',
    description: 'Most total loot stolen',
    color: 'text-amber-400',
  },
  'most-trusted': {
    emoji: '😇',
    title: 'Most Trusted',
    description: 'Lowest image (most saintly)',
    color: 'text-blue-400',
  },
  'biggest-heist': {
    emoji: '💰',
    title: 'Biggest Heist',
    description: 'Largest single steal',
    color: 'text-green-400',
  },
  'snake-charmer': {
    emoji: '🐍',
    title: 'Snake Charmer',
    description: 'Highest image (most notorious)',
    color: 'text-red-400',
  },
};

export function Awards({ awards }: AwardsProps) {
  if (awards.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-center">🏆 Awards</h3>
      <div className="grid grid-cols-2 gap-3">
        {awards.map((award) => {
          const config = AWARD_CONFIG[award.type] || {
            emoji: '🏅',
            title: award.type,
            description: '',
            color: 'text-slate-400',
          };
          return (
            <div
              key={award.type}
              className="bg-slate-800 rounded-xl p-4 text-center"
            >
              <div className="text-3xl mb-1">{config.emoji}</div>
              <div className={`font-semibold ${config.color}`}>
                {config.title}
              </div>
              <div className="text-lg font-bold mt-1">
                {award.playerName}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {config.description}
                {award.value !== undefined && (
                  <span className="ml-1">({award.value})</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
