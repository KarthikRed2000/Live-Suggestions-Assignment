'use client';

import { RefreshCw, Loader2, Sparkles } from 'lucide-react';
import type { Suggestion, SuggestionBatch } from '@/lib/types';
import { SUGGESTION_TYPE_LABELS, SUGGESTION_TYPE_COLORS } from '@/lib/constants';

interface SuggestionsPanelProps {
  batches: SuggestionBatch[];
  isGenerating: boolean;
  isRecording: boolean;
  onRefresh: () => void;
  onSuggestionClick: (suggestion: Suggestion) => void;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function SuggestionCard({
  suggestion,
  onClick,
}: {
  suggestion: Suggestion;
  onClick: () => void;
}) {
  const typeColors = SUGGESTION_TYPE_COLORS[suggestion.type] ?? SUGGESTION_TYPE_COLORS.FACT_CHECK;
  const typeLabel = SUGGESTION_TYPE_LABELS[suggestion.type] ?? suggestion.type;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-xl bg-[#191c27] border border-[#1e2330] hover:border-indigo-500/40 hover:bg-[#1d2035] transition-all group"
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          style={{ background: typeColors.background, color: typeColors.color, border: typeColors.border }}
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
        >
          {typeLabel}
        </span>

      </div>
      <p className="text-sm font-semibold text-gray-200 mb-1 leading-snug">{suggestion.title}</p>
      <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">{suggestion.preview}</p>
      <p className="text-[10px] text-indigo-500/60 mt-2 group-hover:text-indigo-400 transition-colors">
        Click for detailed answer →
      </p>
    </button>
  );
}

export default function SuggestionsPanel({
  batches,
  isGenerating,
  isRecording,
  onRefresh,
  onSuggestionClick,
}: SuggestionsPanelProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2330] shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-200 tracking-wide uppercase">
            Live Suggestions
          </h2>
          {isGenerating && (
            <Loader2 size={13} className="animate-spin text-indigo-400 shrink-0" />
          )}
        </div>

        <button
          onClick={onRefresh}
          disabled={isGenerating}
          title="Refresh transcript and suggestions"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 border border-[#1e2330] hover:border-indigo-500/40 hover:text-indigo-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCw size={13} className={isGenerating ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Suggestion batches */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-6 custom-scroll">
        {batches.length === 0 && !isGenerating ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
              <Sparkles size={22} className="text-indigo-500/60" />
            </div>
            <p className="text-sm text-gray-500">
              {isRecording
                ? 'Suggestions appear after the first transcript chunk'
                : 'Start recording to get live suggestions'}
            </p>
          </div>
        ) : (
          <>
            {/* Loading skeleton for in-flight batch */}
            {isGenerating && (
              <div className="space-y-2">
                <div className="h-3 w-20 bg-[#1e2330] rounded animate-pulse" />
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-3 rounded-xl bg-[#191c27] border border-[#1e2330] space-y-2">
                    <div className="h-3 w-16 bg-[#1e2330] rounded animate-pulse" />
                    <div className="h-4 w-3/4 bg-[#1e2330] rounded animate-pulse" />
                    <div className="h-3 w-full bg-[#1e2330] rounded animate-pulse" />
                    <div className="h-3 w-2/3 bg-[#1e2330] rounded animate-pulse" />
                  </div>
                ))}
              </div>
            )}

            {batches.map((batch, batchIdx) => {
              const isLatest = batchIdx === 0;
              // Older batches: progressively dimmer + desaturated so the latest stands out clearly
              const opacity = isLatest ? 1 : Math.max(0.18, 0.55 - (batchIdx - 1) * 0.18);
              const grayscale = isLatest ? 0 : Math.min(90, batchIdx * 35);
              return (
                <div
                  key={batch.id}
                  style={{ opacity, filter: grayscale > 0 ? `grayscale(${grayscale}%)` : undefined }}
                  className="transition-all duration-300"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] text-gray-600 font-medium">
                      {formatTime(batch.timestamp)}
                    </span>
                    {isLatest && !isGenerating && (
                      <span className="text-[10px] text-indigo-500 font-medium">Latest</span>
                    )}
                    {!isLatest && (
                      <span className="text-[10px] text-gray-700 font-medium">Older</span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {batch.suggestions.map((s) => (
                      <SuggestionCard
                        key={s.id}
                        suggestion={s}
                        onClick={() => onSuggestionClick(s)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
