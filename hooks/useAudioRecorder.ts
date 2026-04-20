'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import type { Settings } from '@/lib/types';

interface UseAudioRecorderOptions {
  settings: Settings;
  onNewChunk: (text: string) => void;
  onError?: (message: string) => void;
}

// Resolvers waiting for the current onstop → transcription cycle to finish
type FlushResolver = () => void;

/**
 * Manages mic recording in 30-second chunks.
 * Each chunk is a complete, independently-decodable WebM file produced
 * by stopping and restarting MediaRecorder — this ensures Whisper can
 * decode every chunk without the WebM header problem from timeslice.
 */
export function useAudioRecorder({ settings, onNewChunk, onError }: UseAudioRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isRecordingRef = useRef(false);
  const isTranscribingRef = useRef(false); // sync version of isTranscribing state
  const settingsRef = useRef(settings);
  const chunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Resolvers called after EACH transcription cycle completes (flush + natural)
  const flushResolversRef = useRef<FlushResolver[]>([]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const transcribeBlob = useCallback(
    async (blob: Blob) => {
      if (!settingsRef.current.groqApiKey) return;
      // Skip tiny blobs (silence / failed chunks)
      if (blob.size < 2000) return;

      setIsTranscribing(true);
      isTranscribingRef.current = true;
      try {
        const formData = new FormData();
        formData.append('audio', blob, 'audio.webm');
        formData.append('model', settingsRef.current.transcriptionModel);

        const res = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'x-groq-api-key': settingsRef.current.groqApiKey },
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        const { text } = await res.json();
        if (text?.trim()) {
          onNewChunk(text.trim());
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Transcription failed';
        onError?.(msg);
      } finally {
        setIsTranscribing(false);
        isTranscribingRef.current = false;
      }
    },
    [onNewChunk, onError],
  );

  /** Start a new 30-second recording window */
  const startChunkWindow = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || !isRecordingRef.current) return;

    chunksRef.current = [];
    recorder.start();

    chunkTimerRef.current = setTimeout(() => {
      if (recorder.state === 'recording') {
        recorder.stop();
      }
    }, 30_000);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find(
        (t) => MediaRecorder.isTypeSupported(t),
      );

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        chunksRef.current = [];

        await transcribeBlob(blob);

        // Resolve any callers waiting on flushChunk() before restarting
        const resolvers = flushResolversRef.current.splice(0);
        resolvers.forEach((resolve) => resolve());

        // Restart for the next chunk if still recording
        if (isRecordingRef.current) {
          startChunkWindow();
        }
      };

      isRecordingRef.current = true;
      setIsRecording(true);
      startChunkWindow();
    } catch (err) {
      const msg =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Microphone access denied. Please allow microphone access and try again.'
          : `Could not access microphone: ${err instanceof Error ? err.message : 'Unknown error'}`;
      onError?.(msg);
    }
  }, [startChunkWindow, transcribeBlob, onError]);

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    setIsRecording(false);

    if (chunkTimerRef.current) {
      clearTimeout(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }

    const recorder = recorderRef.current;
    if (recorder?.state === 'recording') {
      recorder.stop(); // Will still transcribe the final chunk
    }

    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  /**
   * Flush the current recording window and wait until the resulting transcription
   * completes before resolving. Three cases:
   *  1. Recorder is active → stop it early, wait for Whisper to finish.
   *  2. Recorder is inactive but Whisper is running (mid-cycle gap) → just wait for
   *     the in-flight transcription to finish (resolver is called in onstop).
   *  3. Neither recording nor transcribing → resolve immediately.
   */
  const flushChunk = useCallback((): Promise<void> => {
    const recorder = recorderRef.current;

    if (recorder?.state === 'recording') {
      return new Promise<void>((resolve) => {
        flushResolversRef.current.push(resolve);
        if (chunkTimerRef.current) {
          clearTimeout(chunkTimerRef.current);
          chunkTimerRef.current = null;
        }
        recorder.stop();
      });
    }

    if (isTranscribingRef.current) {
      // Recorder stopped but Whisper is still running — wait for it
      return new Promise<void>((resolve) => {
        flushResolversRef.current.push(resolve);
      });
    }

    return Promise.resolve();
  }, []);

  return { isRecording, isTranscribing, startRecording, stopRecording, flushChunk };
}
