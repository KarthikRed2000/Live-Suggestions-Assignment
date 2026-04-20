'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Settings as SettingsIcon } from 'lucide-react';

import TranscriptPanel from './components/TranscriptPanel';
import SuggestionsPanel from './components/SuggestionsPanel';
import ChatPanel from './components/ChatPanel';
import SettingsModal from './components/SettingsModal';

import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { DEFAULT_SETTINGS } from '@/lib/constants';
import type { ChatMessage, Settings, Suggestion, SuggestionBatch, TranscriptChunk } from '@/lib/types';

const SETTINGS_KEY = 'twinmind_settings';

function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  } catch {}
  return DEFAULT_SETTINGS;
}

function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {}
}

export default function Home() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [transcriptChunks, setTranscriptChunks] = useState<TranscriptChunk[]>([]);
  const [suggestionBatches, setSuggestionBatches] = useState<SuggestionBatch[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [isChatStreaming, setIsChatStreaming] = useState(false);

  // Keep refs for use inside callbacks to avoid stale closures
  const transcriptRef = useRef<TranscriptChunk[]>([]);
  const chatMessagesRef = useRef<ChatMessage[]>([]);
  const settingsRef = useRef<Settings>(DEFAULT_SETTINGS);
  // Holds the suggestion auto-refresh interval so it can be started/stopped independently
  const suggestionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Tracks the transcript text last sent to the suggestions API — skip if unchanged
  const lastUsedTranscriptRef = useRef<string>('');

  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    settingsRef.current = s;
    if (!s.groqApiKey) setShowSettings(true);
  }, []);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const showError = (msg: string) => {
    setErrorBanner(msg);
    setTimeout(() => setErrorBanner(null), 5000);
  };

  // ─── Suggestions generation ────────────────────────────────────────────────

  const generateSuggestions = useCallback(async () => {
    const s = settingsRef.current;
    if (!s.groqApiKey) {
      setShowSettings(true);
      return;
    }

    const chunks = transcriptRef.current;

    // Use only the latest chunk as the suggestion context (most recent ~30s of speech)
    const latestChunkText = chunks[chunks.length - 1]?.text ?? '';
    const recentTranscript = latestChunkText.slice(-s.suggestionContextWindow);

    // Skip the API call if this exact transcript was already used
    if (!recentTranscript || recentTranscript === lastUsedTranscriptRef.current) return;
    lastUsedTranscriptRef.current = recentTranscript;

    const earlierContext = '';

    setIsGeneratingSuggestions(true);
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-groq-api-key': s.groqApiKey,
        },
        body: JSON.stringify({
          recentTranscript,
          earlierContext,
          prompt: s.suggestionPrompt,
          model: s.suggestionModel,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const { suggestions } = await res.json();
      if (!suggestions?.length) return;

      const batch: SuggestionBatch = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        suggestions: suggestions.map((s: { type: string; title: string; preview: string }) => ({
          ...s,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
        })),
      };

      setSuggestionBatches((prev) => [batch, ...prev]);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to generate suggestions');
    } finally {
      setIsGeneratingSuggestions(false);
    }
  }, []);

  // ─── Suggestion interval timer (completely independent of transcript timer) ──
  //
  // Timeline:
  //   t=0        → recording starts, no suggestions yet
  //   t≈30s      → first transcript chunk arrives → suggestions generated immediately
  //                 → 30s suggestion timer STARTS here
  //   t≈60s      → suggestion timer fires → reads latest transcriptRef → new batch
  //   t≈60s      → second transcript chunk also arrives (separate MediaRecorder cycle)
  //   t≈90s      → suggestion timer fires again → reads latest transcript → new batch
  //   …and so on, the two timers run on their own independent clocks.

  const startSuggestionTimer = useCallback(() => {
    // Clear any existing timer before starting a fresh one
    if (suggestionIntervalRef.current) {
      clearInterval(suggestionIntervalRef.current);
    }
    suggestionIntervalRef.current = setInterval(() => {
      generateSuggestions();
    }, 30_000);
  }, [generateSuggestions]);

  const stopSuggestionTimer = useCallback(() => {
    if (suggestionIntervalRef.current) {
      clearInterval(suggestionIntervalRef.current);
      suggestionIntervalRef.current = null;
    }
  }, []);

  // ─── New transcript chunk from recorder ────────────────────────────────────

  const handleNewChunk = useCallback(
    (text: string) => {
      const chunk: TranscriptChunk = {
        id: crypto.randomUUID(),
        text,
        timestamp: Date.now(),
      };
      const updated = [...transcriptRef.current, chunk];
      transcriptRef.current = updated;
      setTranscriptChunks(updated);

      if (updated.length === 1) {
        // First chunk: show suggestions immediately, then start the independent
        // 30s suggestion timer. All subsequent transcript chunks do NOT trigger
        // suggestions — the timer handles that on its own clock.
        generateSuggestions();
        startSuggestionTimer();
      }
    },
    [generateSuggestions, startSuggestionTimer],
  );

  const { isRecording, isTranscribing, startRecording, stopRecording, flushChunk } =
    useAudioRecorder({
      settings,
      onNewChunk: handleNewChunk,
      onError: showError,
    });

  // Stop the suggestion timer whenever recording stops
  // useEffect(() => {
  //   if (!isRecording) stopSuggestionTimer();
  // }, [isRecording, stopSuggestionTimer]);

  // ─── Manual refresh: flush audio → wait for transcription → then suggest ───

  const handleRefresh = useCallback(async () => {
    // Wait for any in-flight or active recording chunk to be transcribed first
    // so suggestions are built on the very latest transcript.
    if (isRecording) {
      await flushChunk();
    }
    // Force a fresh API call even if the transcript hasn't changed since last time
    lastUsedTranscriptRef.current = '';
    await generateSuggestions();
    if (isRecording) {
      startSuggestionTimer();
    }
  }, [isRecording, flushChunk, generateSuggestions, startSuggestionTimer]);

  // ─── Chat ──────────────────────────────────────────────────────────────────

  const handleSuggestionClick = useCallback(
    (suggestion: Suggestion) => {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: suggestion.title,
        timestamp: Date.now(),
        suggestionContext: {
          type: suggestion.type,
          title: suggestion.title,
          preview: suggestion.preview,
        },
      };
      sendChatRequest(userMsg, suggestion);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleSendMessage = useCallback((text: string) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    sendChatRequest(userMsg, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendChatRequest = useCallback(
    async (userMsg: ChatMessage, suggestion: Suggestion | null) => {
      const s = settingsRef.current;
      if (!s.groqApiKey) {
        setShowSettings(true);
        return;
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        ...(suggestion
          ? { suggestionContext: { type: suggestion.type, title: suggestion.title, preview: suggestion.preview } }
          : {}),
      };

      const newMessages = [...chatMessagesRef.current, userMsg, assistantMsg];
      chatMessagesRef.current = newMessages;
      setChatMessages([...newMessages]);
      setIsChatStreaming(true);

      const fullTranscript = transcriptRef.current.map((c) => c.text).join('\n');
      const transcript = fullTranscript.slice(-s.detailedAnswerContextWindow);

      // Pass previous messages (exclude the two just added) as history for regular chat
      const chatHistory = chatMessagesRef.current
        .slice(0, -2)
        .map((m) => ({ role: m.role, content: m.content }));

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-groq-api-key': s.groqApiKey,
          },
          body: JSON.stringify({
            message: userMsg.content,
            transcript,
            chatHistory: suggestion ? [] : chatHistory,
            suggestion: suggestion
              ? { type: suggestion.type, title: suggestion.title, preview: suggestion.preview }
              : null,
            model: s.suggestionModel,
            chatPrompt: s.chatPrompt,
            detailedAnswerPrompt: s.detailedAnswerPrompt,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response stream');

        const decoder = new TextDecoder();
        let content = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          content += decoder.decode(value, { stream: true });

          setChatMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { ...updated[updated.length - 1], content };
            return updated;
          });
        }

        // Sync ref
        chatMessagesRef.current = chatMessagesRef.current.map((m, i, arr) =>
          i === arr.length - 1 ? { ...m, content } : m,
        );
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Something went wrong';
        showError(errMsg);
        setChatMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: `Error: ${errMsg}`,
          };
          return updated;
        });
      } finally {
        setIsChatStreaming(false);
      }
    },
    [],
  );

  // ─── Export ────────────────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    const session = {
      exportedAt: new Date().toISOString(),
      transcript: transcriptRef.current.map((c) => ({
        timestamp: new Date(c.timestamp).toISOString(),
        text: c.text,
      })),
      suggestionBatches: suggestionBatches.map((b) => ({
        timestamp: new Date(b.timestamp).toISOString(),
        suggestions: b.suggestions.map((s) => ({
          type: s.type,
          title: s.title,
          preview: s.preview,
        })),
      })),
      chat: chatMessagesRef.current.map((m) => ({
        timestamp: new Date(m.timestamp).toISOString(),
        role: m.role,
        content: m.content,
        ...(m.suggestionContext ? { suggestionContext: m.suggestionContext } : {}),
      })),
    };

    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `twinmind-session-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [suggestionBatches]);

  // ─── Settings save ─────────────────────────────────────────────────────────

  const handleSaveSettings = useCallback((s: Settings) => {
    setSettings(s);
    settingsRef.current = s;
    saveSettings(s);
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-[#1e2330] bg-[#0d0f15] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">TM</span>
          </div>
          <span className="text-sm font-semibold text-gray-200">TwinMind</span>
          <span className="text-xs text-gray-600 border border-[#1e2330] rounded px-1.5 py-0.5">
            Live Suggestions
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 border border-[#1e2330] rounded-lg hover:border-gray-600 hover:text-gray-200 transition-all"
          >
            <Download size={12} />
            Export
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 border border-[#1e2330] rounded-lg hover:border-gray-600 hover:text-gray-200 transition-all"
          >
            <SettingsIcon size={12} />
            Settings
          </button>
        </div>
      </header>

      {/* Error banner */}
      {errorBanner && (
        <div className="px-5 py-2 bg-red-500/10 border-b border-red-500/20 text-sm text-red-400 shrink-0">
          {errorBanner}
        </div>
      )}

      {/* No API key banner */}
      {!settings.groqApiKey && (
        <div className="px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-3 shrink-0">
          <span className="text-sm text-amber-400">
            Paste your Groq API key in Settings to get started.
          </span>
          <button
            onClick={() => setShowSettings(true)}
            className="text-xs text-amber-300 underline underline-offset-2 hover:text-amber-200"
          >
            Open Settings
          </button>
        </div>
      )}

      {/* Three-column layout */}
      <div className="flex flex-1 overflow-hidden divide-x divide-[#1e2330]">
        {/* Left — Transcript (28%) */}
        <div className="w-[28%] min-w-[260px] flex flex-col overflow-hidden">
          <TranscriptPanel
            chunks={transcriptChunks}
            isRecording={isRecording}
            isTranscribing={isTranscribing}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onExport={handleExport}
          />
        </div>

        {/* Middle — Suggestions (36%) */}
        <div className="w-[36%] flex flex-col overflow-hidden">
          <SuggestionsPanel
            batches={suggestionBatches}
            isGenerating={isGeneratingSuggestions}
            isRecording={isRecording}
            onRefresh={handleRefresh}
            onSuggestionClick={handleSuggestionClick}
          />
        </div>

        {/* Right — Chat (36%) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <ChatPanel
            messages={chatMessages}
            isStreaming={isChatStreaming}
            onSend={handleSendMessage}
          />
        </div>
      </div>

      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
