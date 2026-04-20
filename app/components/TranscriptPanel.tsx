'use client';

import { useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2, Download } from 'lucide-react';
import type { TranscriptChunk } from '@/lib/types';

interface TranscriptPanelProps {
  chunks: TranscriptChunk[];
  isRecording: boolean;
  isTranscribing: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onExport: () => void;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function TranscriptPanel({
  chunks,
  isRecording,
  isTranscribing,
  onStartRecording,
  onStopRecording,
  onExport,
}: TranscriptPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest transcript
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chunks]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2330] shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-200 tracking-wide uppercase">Transcript</h2>
          {isRecording && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs text-red-400">Live</span>
            </span>
          )}
          {isTranscribing && (
            <span className="flex items-center gap-1 text-xs text-indigo-400">
              <Loader2 size={12} className="animate-spin" />
              Transcribing
            </span>
          )}
        </div>

        <button
          onClick={isRecording ? onStopRecording : onStartRecording}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            isRecording
              ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
              : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 hover:bg-indigo-500/30'
          }`}
        >
          {isRecording ? (
            <>
              <MicOff size={14} />
              Stop
            </>
          ) : (
            <>
              <Mic size={14} />
              Start
            </>
          )}
        </button>
      </div>

      {/* Transcript body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 custom-scroll">
        {chunks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
              <Mic size={22} className="text-indigo-500/60" />
            </div>
            <p className="text-sm text-gray-500">
              Click <span className="text-indigo-400">Start</span> to begin recording
            </p>
            <p className="text-xs text-gray-600 mt-1">Transcript appears here in ~30s chunks</p>
          </div>
        ) : (
          chunks.map((chunk) => (
            <div key={chunk.id} className="group">
              <span className="text-[10px] text-gray-600 block mb-1">{formatTime(chunk.timestamp)}</span>
              <p className="text-sm text-gray-300 leading-relaxed">{chunk.text}</p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Export footer — always visible once there's content */}
      {chunks.length > 0 && (
        <div className="px-4 py-2.5 border-t border-[#1e2330] shrink-0">
          <button
            onClick={onExport}
            className="flex items-center gap-2 w-full justify-center px-3 py-2 rounded-lg text-xs font-medium text-gray-400 border border-[#1e2330] hover:border-indigo-500/40 hover:text-indigo-400 hover:bg-indigo-500/5 transition-all"
          >
            <Download size={13} />
            Export full session (transcript + suggestions + chat)
          </button>
        </div>
      )}
    </div>
  );
}
