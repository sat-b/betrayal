import type { Award } from '../types';

interface AwardsProps {
  awards: Award[];
}

const AWARD_CONFIG = {
  'most-trusted': {
    emoji: '🕊️',
    title: 'Most Trusted',
    description: 'Highest cooperation score',
    color: 'text-blue-400',
  },
  'most-evil': {
    emoji: '😈',
    title: 'Most Evil',
    description: 'Betrayed the most cooperators',
    color: 'text-red-400',
  },
  'biggest-swing': {
    emoji: '📈',
    title: 'Biggest Swing',
    description: 'Largest single-round change',
    color: 'text-amber-400',
  },
  'kingmaker': {
    emoji: '👑',
    title: 'Kingmaker',
    description: 'Most impact on others\' scores',
    color: 'text-purple-400',
  },
};

export function Awards({ awards }: AwardsProps) {
  if (awards.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-center">Awards</h3>
      <div className="grid grid-cols-2 gap-3">
        {awards.map((award) => {
          const config = AWARD_CONFIG[award.type];
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
