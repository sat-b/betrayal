import { useEffect } from 'react';
import type { RoomState, Choice, RoundHistory } from '../types';
import { Timer } from './Timer';
import { ActionButton } from './ActionButton';
import { PlayerList } from './PlayerList';
import { Leaderboard } from './Leaderboard';
import { BetrayalHistory } from './BetrayalHistory';
import { VoiceChat } from './VoiceChat';

interface GameProps {
  state: RoomState;
  playerId: string;
  currentChoice: Choice | null;
  isLocked: boolean;
  onChoose: (choice: Choice) => void;
  onLock: () => void;
  onResetChoice: () => void;
  voiceChat: {
    voiceEnabled: boolean;
    muted: boolean;
    onToggleMute: () => void;
    onStartVoice: () => void;
    onStopVoice: () => void;
    peers: Record<string, { stream?: MediaStream; isSpeaking: boolean }>;
    error: string | null;
  };
}

export function Game({
  state,
  playerId,
  currentChoice,
  isLocked,
  onChoose,
  onLock,
  onResetChoice,
  voiceChat,
}: GameProps) {
  const isRoundPhase = state.phase === 'ROUND';
  const isRevealPhase = state.phase === 'REVEAL';

  const timerEnd = state.roundStartTime + (state.config.timerSeconds * 1000);

  // Get the latest round for reveal
  const latestRound: RoundHistory | undefined = state.history[state.history.length - 1];
  const revealedChoices = isRevealPhase ? latestRound?.choices : undefined;
  const deltas = isRevealPhase ? latestRound?.deltas : undefined;

  // Reset choice when new round starts
  useEffect(() => {
    if (isRoundPhase) {
      onResetChoice();
    }
  }, [state.roundIndex, isRoundPhase, onResetChoice]);

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <span className="text-slate-400">Room</span>
            <span className="ml-2 font-mono font-bold">{state.roomCode}</span>
          </div>
          <div className="text-center">
            <div className="text-sm text-slate-400">Round</div>
            <div className="text-2xl font-bold">
              {state.roundIndex + 1} / {state.config.totalRounds}
            </div>
          </div>
          <div className="w-20" /> {/* Spacer */}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main game area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Timer & Action */}
            {isRoundPhase && (
              <div className="bg-slate-800 rounded-2xl p-6 flex flex-col items-center gap-6">
                <Timer endTime={timerEnd} />
                <ActionButton
                  choice={currentChoice}
                  onChoose={onChoose}
                  locked={isLocked}
                  onLock={onLock}
                />
              </div>
            )}

            {/* Reveal Phase */}
            {isRevealPhase && latestRound && (
              <div className="bg-slate-800 rounded-2xl p-6">
                <h2 className="text-xl font-bold text-center mb-4">
                  Round {latestRound.roundIndex + 1} Results
                </h2>

                <div className="text-center mb-4">
                  {latestRound.betrayerCount === 0 ? (
                    <div className="text-2xl text-cooperate">
                      ✨ Everyone Cooperated! ✨
                    </div>
                  ) : latestRound.betrayerCount === 1 ? (
                    <div className="text-2xl text-betray">
                      🗡️ A Lone Betrayer!
                    </div>
                  ) : (
                    <div className="text-2xl text-amber-400">
                      ⚔️ {latestRound.betrayerCount} Betrayers!
                    </div>
                  )}
                </div>

                <PlayerList
                  players={state.players}
                  currentPlayerId={playerId}
                  hostId={state.hostId}
                  revealedChoices={revealedChoices}
                  deltas={deltas}
                />
              </div>
            )}

            {/* Waiting indicator */}
            {isRoundPhase && isLocked && (
              <div className="text-center text-slate-400">
                <div className="animate-pulse">Waiting for others...</div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Leaderboard
              players={state.players}
              currentPlayerId={playerId}
            />

            <BetrayalHistory
              history={state.history}
              players={state.players}
            />

            <VoiceChat
              voiceEnabled={voiceChat.voiceEnabled}
              muted={voiceChat.muted}
              onToggleMute={voiceChat.onToggleMute}
              onStartVoice={voiceChat.onStartVoice}
              onStopVoice={voiceChat.onStopVoice}
              peers={voiceChat.peers}
              players={state.players}
              error={voiceChat.error}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
