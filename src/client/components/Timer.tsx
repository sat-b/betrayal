import { useState, useEffect } from 'react';

interface TimerProps {
  endTime: number;
  onTimeUp?: () => void;
}

export function Timer({ endTime, onTimeUp }: TimerProps) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((endTime - now) / 1000));
      setRemaining(diff);

      if (diff === 0) {
        onTimeUp?.();
      }
    };

    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [endTime, onTimeUp]);

  const isUrgent = remaining <= 3 && remaining > 0;

  return (
    <div
      className={`text-center transition-all duration-300 ${
        isUrgent ? 'scale-125 text-red-500 animate-pulse' : ''
      }`}
    >
      <div className="text-6xl font-bold tabular-nums">
        {remaining}
      </div>
      <div className="text-sm text-slate-400 uppercase tracking-wider">
        seconds
      </div>
    </div>
  );
}
