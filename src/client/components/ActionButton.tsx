import type { Choice } from '../types';

interface ActionButtonProps {
  choice: Choice | null;
  onChoose: (choice: Choice) => void;
  locked: boolean;
  onLock: () => void;
}

export function ActionButton({ choice, onChoose, locked, onLock }: ActionButtonProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-4">
        <button
          onClick={() => onChoose('C')}
          disabled={locked}
          className={`
            w-32 h-32 sm:w-40 sm:h-40 rounded-2xl text-xl font-bold
            transition-all duration-200 transform
            ${locked ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}
            ${choice === 'C'
              ? 'bg-cooperate ring-4 ring-cooperate/50 shadow-lg shadow-cooperate/30'
              : 'bg-slate-700 hover:bg-slate-600'
            }
          `}
        >
          <div className="text-4xl mb-1">🤝</div>
          <div>Cooperate</div>
        </button>

        <button
          onClick={() => onChoose('B')}
          disabled={locked}
          className={`
            w-32 h-32 sm:w-40 sm:h-40 rounded-2xl text-xl font-bold
            transition-all duration-200 transform
            ${locked ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}
            ${choice === 'B'
              ? 'bg-betray ring-4 ring-betray/50 shadow-lg shadow-betray/30'
              : 'bg-slate-700 hover:bg-slate-600'
            }
          `}
        >
          <div className="text-4xl mb-1">🗡️</div>
          <div>Betray</div>
        </button>
      </div>

      <button
        onClick={onLock}
        disabled={!choice || locked}
        className={`
          px-8 py-3 rounded-xl font-semibold text-lg
          transition-all duration-200
          ${!choice || locked
            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
            : 'bg-amber-500 hover:bg-amber-400 text-black'
          }
        `}
      >
        {locked ? '🔒 Locked In' : '🔓 Lock In'}
      </button>
    </div>
  );
}
