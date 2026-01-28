import { useEffect, useRef } from 'react';
import type { Player } from '../types';

interface VoiceChatProps {
  voiceEnabled: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onStartVoice: () => void;
  onStopVoice: () => void;
  peers: Record<string, { stream?: MediaStream; isSpeaking: boolean }>;
  players: Record<string, Player>;
  error?: string | null;
}

export function VoiceChat({
  voiceEnabled,
  muted,
  onToggleMute,
  onStartVoice,
  onStopVoice,
  peers,
  players,
  error,
}: VoiceChatProps) {
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  // Attach streams to audio elements
  useEffect(() => {
    Object.entries(peers).forEach(([peerId, peer]) => {
      if (peer.stream && audioRefs.current[peerId]) {
        audioRefs.current[peerId].srcObject = peer.stream;
      }
    });
  }, [peers]);

  if (!voiceEnabled) {
    return (
      <button
        onClick={onStartVoice}
        className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
      >
        <span>🎤</span>
        <span>Enable Voice Chat</span>
      </button>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Voice Chat
        </h3>
        <div className="flex gap-2">
          <button
            onClick={onToggleMute}
            className={`
              p-2 rounded-lg transition-colors
              ${muted ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}
            `}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button
            onClick={onStopVoice}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400"
          >
            ✕
          </button>
        </div>
      </div>

      {error && (
        <div className="text-red-400 text-sm mb-2">{error}</div>
      )}

      <div className="flex flex-wrap gap-2">
        {Object.entries(peers).map(([peerId, peer]) => (
          <div
            key={peerId}
            className={`
              px-3 py-1 rounded-full text-sm
              ${peer.isSpeaking ? 'bg-green-500/30 ring-2 ring-green-500' : 'bg-slate-700'}
            `}
          >
            {players[peerId]?.name || 'Unknown'}
            <audio
              ref={el => { if (el) audioRefs.current[peerId] = el; }}
              autoPlay
              playsInline
            />
          </div>
        ))}
      </div>

      {Object.keys(peers).length === 0 && (
        <div className="text-slate-500 text-sm">
          Waiting for others to join voice...
        </div>
      )}
    </div>
  );
}
