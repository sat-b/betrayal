import { useState, useCallback } from 'react';
import type { Choice, ClientMessage } from '../types';

interface UseGameStateOptions {
  send: (message: ClientMessage) => void;
}

export function useGameState({ send }: UseGameStateOptions) {
  const [currentChoice, setCurrentChoice] = useState<Choice | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  const makeChoice = useCallback((choice: Choice) => {
    if (isLocked) return;
    setCurrentChoice(choice);
    send({ type: 'choice', choice });
  }, [isLocked, send]);

  const lockIn = useCallback(() => {
    if (!currentChoice || isLocked) return;
    setIsLocked(true);
    send({ type: 'lock' });
  }, [currentChoice, isLocked, send]);

  const resetChoice = useCallback(() => {
    setCurrentChoice(null);
    setIsLocked(false);
  }, []);

  const toggleReady = useCallback((ready: boolean) => {
    send({ type: 'ready', ready });
  }, [send]);

  const startGame = useCallback(() => {
    send({ type: 'start' });
  }, [send]);

  const requestRematch = useCallback(() => {
    send({ type: 'rematch' });
  }, [send]);

  return {
    currentChoice,
    isLocked,
    makeChoice,
    lockIn,
    resetChoice,
    toggleReady,
    startGame,
    requestRematch,
  };
}
