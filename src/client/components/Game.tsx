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

// Get pot size description
function getPotSize(pot: number): { label: string; color: string; emoji: string } {
  if (pot <= 5) return { label: 'Small', color: 'text-slate-400', emoji: '💰' };
  if (pot <= 15) return { label: 'Growing', color: 'text-yellow-400', emoji: '💰💰' };
  if (pot <= 30) return { label: 'Large', color: 'text-amber-400', emoji: '💰💰💰' };
  return { label: 'MASSIVE', color: 'text-red-400', emoji: '🏆💰🏆' };
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
  const potInfo = getPotSize(state.pot);

  // Get the latest round for reveal
  const latestRound: RoundHistory | undefined = state.history[state.history.length - 1];
  const revealedChoices = isRevealPhase ? latestRound?.choices : undefined;
  const results = isRevealPhase ? latestRound?.results : undefined;

  // Reset choice when new round starts
  useEffect(() => {
    if (isRoundPhase) {
      onResetChoice();
    }
  }, [state.roundIndex, isRoundPhase, onResetChoice]);

  // Calculate total loot this round
  const totalLoot = results
    ? Object.values(results).reduce((sum, r) => sum + r.loot, 0)
    : 0;

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
          {/* Pot Display */}
          <div className="text-right">
            <div className="text-sm text-slate-400">Pot</div>
            <div className={`text-xl font-bold ${potInfo.color}`}>
              {potInfo.emoji} {state.pot}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main game area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Timer & Action */}
            {isRoundPhase && (
              <div className="bg-slate-800 rounded-2xl p-6 flex flex-col items-center gap-6">
                <Timer endTime={timerEnd} />

                {/* Pot reminder during round */}
                <div className={`text-center ${potInfo.color}`}>
                  <div className="text-sm text-slate-400">Current Pot</div>
                  <div className="text-3xl font-bold">{potInfo.emoji} {state.pot}</div>
                  {state.pot >= 15 && (
                    <div className="text-sm animate-pulse">Tempting...</div>
                  )}
                </div>

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

                <div className="text-center mb-4 space-y-2">
                  {latestRound.betrayerCount === 0 ? (
                    <>
                      <div className="text-2xl text-cooperate">
                        ✨ Everyone Cooperated! ✨
                      </div>
                      <div className="text-slate-400">
                        +2 points each, pot grows to {state.pot}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-2xl text-betray">
                        {latestRound.betrayerCount === 1 ? '🗡️ Heist!' : `⚔️ ${latestRound.betrayerCount} Thieves!`}
                      </div>
                      <div className="text-amber-400">
                        Pot of {latestRound.potBefore} stolen! 💰
                      </div>
                      {totalLoot > 0 && (
                        <div className="text-sm text-slate-400">
                          Total looted: {totalLoot} points
                        </div>
                      )}
                    </>
                  )}
                </div>

                <PlayerList
                  players={state.players}
                  currentPlayerId={playerId}
                  hostId={state.hostId}
                  revealedChoices={revealedChoices}
                  results={results}
                  showFuzzy
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
