import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createPeerConnection,
  createOffer,
  createAnswer,
  setRemoteDescription,
  addIceCandidate,
  getLocalStream,
  addStreamToPeer,
  closeConnection,
} from '../lib/webrtc';
import type { ServerMessage } from '../types';

interface PeerState {
  connection: RTCPeerConnection;
  stream?: MediaStream;
  isSpeaking: boolean;
}

interface UseVoiceChatOptions {
  socket: WebSocket | null;
  playerId: string | null;
  playerIds: string[];
  enabled: boolean;
}

export function useVoiceChat({ socket, playerId, playerIds, enabled: _enabled }: UseVoiceChatOptions) {
  const [muted, setMuted] = useState(false);
  const [peers, setPeers] = useState<Record<string, PeerState>>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const peersRef = useRef<Record<string, PeerState>>({});
  const localStreamRef = useRef<MediaStream | null>(null);

  const sendSignal = useCallback((to: string, signal: RTCSessionDescriptionInit | RTCIceCandidateInit) => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'webrtc-signal', to, signal }));
    }
  }, [socket]);

  const createPeer = useCallback((peerId: string, initiator: boolean) => {
    if (peersRef.current[peerId]) return peersRef.current[peerId].connection;

    const pc = createPeerConnection(
      (candidate) => sendSignal(peerId, candidate.toJSON()),
      (stream) => {
        peersRef.current[peerId] = {
          ...peersRef.current[peerId],
          stream,
        };
        setPeers({ ...peersRef.current });
      }
    );

    // Handle renegotiation when tracks are added later
    pc.onnegotiationneeded = async () => {
      try {
        const offer = await createOffer(pc);
        sendSignal(peerId, offer);
      } catch (e) {
        console.error('Renegotiation error:', e);
      }
    };

    if (localStreamRef.current) {
      addStreamToPeer(pc, localStreamRef.current);
    }

    peersRef.current[peerId] = { connection: pc, isSpeaking: false };
    setPeers({ ...peersRef.current });

    if (initiator) {
      createOffer(pc).then(offer => sendSignal(peerId, offer));
    }

    return pc;
  }, [sendSignal]);

  const handleSignal = useCallback(async (from: string, signal: RTCSessionDescriptionInit | RTCIceCandidateInit) => {
    try {
      if ('sdp' in signal) {
        const pc = createPeer(from, false);
        await setRemoteDescription(pc, signal);

        if (signal.type === 'offer') {
          const answer = await createAnswer(pc);
          sendSignal(from, answer);
        }
      } else if ('candidate' in signal) {
        const peer = peersRef.current[from];
        if (peer) {
          await addIceCandidate(peer.connection, signal);
        }
      }
    } catch (e) {
      console.error('Signal handling error:', e);
    }
  }, [createPeer, sendSignal]);

  // Listen for WebRTC signals
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as ServerMessage;
        if (message.type === 'webrtc-signal') {
          handleSignal(message.from, message.signal);
        }
      } catch (e) {
        // Ignore parse errors
      }
    };

    socket.addEventListener('message', handleMessage);
    return () => socket.removeEventListener('message', handleMessage);
  }, [socket, handleSignal]);

  // Initialize voice chat
  const startVoice = useCallback(async () => {
    try {
      const stream = await getLocalStream();
      localStreamRef.current = stream;
      setLocalStream(stream);
      setVoiceEnabled(true);
      setError(null);

      // Add tracks to any existing peer connections (if we joined voice late)
      Object.values(peersRef.current).forEach(peer => {
        stream.getTracks().forEach(track => {
          // Check if track already added
          const senders = peer.connection.getSenders();
          const hasTrack = senders.some(s => s.track?.id === track.id);
          if (!hasTrack) {
            peer.connection.addTrack(track, stream);
          }
        });
      });

      // Connect to all players we don't have connections to yet
      playerIds.forEach(id => {
        if (id !== playerId && !peersRef.current[id]) {
          createPeer(id, true);
        }
      });
    } catch (e) {
      setError('Could not access microphone');
      console.error('Voice init error:', e);
    }
  }, [playerIds, playerId, createPeer]);

  const stopVoice = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setVoiceEnabled(false);

    Object.values(peersRef.current).forEach(peer => closeConnection(peer.connection));
    peersRef.current = {};
    setPeers({});
  }, []);

  // Handle player changes
  useEffect(() => {
    if (!voiceEnabled || !playerId) return;

    // Connect to new players
    playerIds.forEach(id => {
      if (id !== playerId && !peersRef.current[id]) {
        createPeer(id, true);
      }
    });

    // Clean up disconnected players
    Object.keys(peersRef.current).forEach(id => {
      if (!playerIds.includes(id)) {
        closeConnection(peersRef.current[id].connection);
        delete peersRef.current[id];
        setPeers({ ...peersRef.current });
      }
    });
  }, [playerIds, playerId, voiceEnabled, createPeer]);

  // Handle mute toggle
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
  }, [muted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      Object.values(peersRef.current).forEach(peer => closeConnection(peer.connection));
    };
  }, []);

  return {
    voiceEnabled,
    muted,
    setMuted,
    peers,
    localStream,
    error,
    startVoice,
    stopVoice,
  };
}
