'use client';

import React, { useEffect, useRef, useState, KeyboardEvent } from 'react';
import { Send, MessageSquare, Loader2 } from 'lucide-react';
import type { ChatMessage } from '@/lib/types';
import { SUGGESTION_TYPE_LABELS, SUGGESTION_TYPE_COLORS } from '@/lib/constants';

interface ChatPanelProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSend: (text: string) => void;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Inline markdown: **bold**, *italic*, `code` ──────────────────────────────
function renderInline(text: string, key?: number): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  if (parts.length === 1) return text;
  return (
    <span key={key}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4)
          return <strong key={i} className="font-semibold text-gray-100">{part.slice(2, -2)}</strong>;
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2)
          return <em key={i} className="italic text-gray-300">{part.slice(1, -1)}</em>;
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2)
          return <code key={i} className="px-1 py-0.5 rounded bg-[#0d0f16] text-indigo-300 font-mono text-[11px]">{part.slice(1, -1)}</code>;
        return part;
      })}
    </span>
  );
}

// ── Block markdown renderer ───────────────────────────────────────────────────
function renderMarkdown(content: string): React.ReactNode {
  const lines = content.split('\n');
  const nodes: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    // Horizontal rule
    if (/^[-*_]{3,}\s*$/.test(line.trim())) {
      nodes.push(<hr key={i} className="border-[#1e2330] my-2" />);
      return;
    }
    // Headings
    const h3 = line.match(/^###\s+(.*)/);
    const h2 = line.match(/^##\s+(.*)/);
    const h1 = line.match(/^#\s+(.*)/);
    if (h3) { nodes.push(<p key={i} className="font-bold text-gray-100 mt-2 mb-0.5">{renderInline(h3[1])}</p>); return; }
    if (h2) { nodes.push(<p key={i} className="font-bold text-gray-100 mt-2 mb-0.5">{renderInline(h2[1])}</p>); return; }
    if (h1) { nodes.push(<p key={i} className="font-bold text-gray-100 mt-2 mb-0.5">{renderInline(h1[1])}</p>); return; }
    // Numbered list  1. …
    const numbered = line.match(/^(\d+)\.\s+(.*)/);
    if (numbered) {
      nodes.push(
        <div key={i} className="flex gap-2">
          <span className="text-indigo-400 shrink-0 font-mono text-xs mt-0.5 w-4 text-right">{numbered[1]}.</span>
          <span>{renderInline(numbered[2])}</span>
        </div>,
      );
      return;
    }
    // Bullet  - …  • …  * …  (optionally indented)
    const bullet = line.match(/^(\s*)[-•*]\s+(.*)/);
    if (bullet) {
      const indent = bullet[1].length > 0;
      nodes.push(
        <div key={i} className={`flex gap-2 ${indent ? 'ml-4' : ''}`}>
          <span className="text-indigo-400 shrink-0 mt-0.5">{indent ? '◦' : '•'}</span>
          <span>{renderInline(bullet[2])}</span>
        </div>,
      );
      return;
    }
    // Blank line → small spacer
    if (line.trim() === '') { nodes.push(<div key={i} className="h-1" />); return; }
    // Plain paragraph
    nodes.push(<p key={i}>{renderInline(line)}</p>);
  });

  return <div className="space-y-1">{nodes}</div>;
}

function AssistantMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="flex flex-col gap-1 max-w-[90%]">
      {message.suggestionContext && (
        <div className="flex items-center gap-1.5 mb-1">
          <span
            style={(() => {
              const c = SUGGESTION_TYPE_COLORS[message.suggestionContext.type] ?? SUGGESTION_TYPE_COLORS.FACT_CHECK;
              return { background: c.background, color: c.color, border: c.border };
            })()}
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          >
            {SUGGESTION_TYPE_LABELS[message.suggestionContext.type] ??
              message.suggestionContext.type}
          </span>
          <span className="text-[11px] text-gray-500 truncate">
            {message.suggestionContext.title}
          </span>
        </div>
      )}

      <div className="bg-[#191c27] border border-[#1e2330] rounded-2xl rounded-tl-sm px-3 py-2.5">
        {message.content ? (
          <div className="text-sm text-gray-300 leading-relaxed">
            {renderMarkdown(message.content)}
          </div>
        ) : (
          <span className="inline-block w-2 h-4 bg-indigo-400 animate-pulse rounded-sm" />
        )}
      </div>

      <span className="text-[10px] text-gray-600 px-1">{formatTime(message.timestamp)}</span>
    </div>
  );
}

function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="flex flex-col items-end gap-1 max-w-[90%] self-end">
      <div className="bg-indigo-600/20 border border-indigo-500/30 rounded-2xl rounded-tr-sm px-3 py-2.5">
        <p className="text-sm text-indigo-100 leading-relaxed">{message.content}</p>
      </div>
      <span className="text-[10px] text-gray-600 px-1">{formatTime(message.timestamp)}</span>
    </div>
  );
}

export default function ChatPanel({ messages, isStreaming, onSend }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    onSend(text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2330] shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-200 tracking-wide uppercase">Chat</h2>
          {isStreaming && (
            <span className="flex items-center gap-1 text-xs text-indigo-400">
              <Loader2 size={12} className="animate-spin" />
              Responding
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 custom-scroll">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
              <MessageSquare size={22} className="text-indigo-500/60" />
            </div>
            <p className="text-sm text-gray-500">Click a suggestion or type a question</p>
            <p className="text-xs text-gray-600 mt-1">One continuous chat per session</p>
          </div>
        ) : (
          messages.map((m) =>
            m.role === 'user' ? (
              <UserMessage key={m.id} message={m} />
            ) : (
              <AssistantMessage key={m.id} message={m} />
            ),
          )
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-[#1e2330] shrink-0">
        <div className="flex items-end gap-2 bg-[#191c27] border border-[#1e2330] rounded-xl px-3 py-2 focus-within:border-indigo-500/50 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about the conversation…"
            rows={1}
            className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-600 resize-none outline-none leading-relaxed max-h-28"
            style={{ scrollbarWidth: 'none' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
          >
            <Send size={14} className="text-white" />
          </button>
        </div>
        <p className="text-[10px] text-gray-700 mt-1.5 px-1">Enter to send · Shift+Enter for newline</p>
      </div>
    </div>
  );
}
