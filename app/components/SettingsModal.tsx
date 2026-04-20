'use client';

import { useState } from 'react';
import { X, Eye, EyeOff, RotateCcw } from 'lucide-react';
import type { Settings } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/constants';

interface SettingsModalProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
  onClose: () => void;
}

type Tab = 'general' | 'prompts' | 'advanced';

export default function SettingsModal({ settings, onSave, onClose }: SettingsModalProps) {
  const [draft, setDraft] = useState<Settings>(settings);
  const [showKey, setShowKey] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('general');

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const resetPrompts = () => {
    setDraft((prev) => ({
      ...prev,
      suggestionPrompt: DEFAULT_SETTINGS.suggestionPrompt,
      detailedAnswerPrompt: DEFAULT_SETTINGS.detailedAnswerPrompt,
      chatPrompt: DEFAULT_SETTINGS.chatPrompt,
    }));
  };

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 bg-[#12141a] border border-[#1e2330] rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2330] shrink-0">
          <h2 className="text-base font-semibold text-gray-100">Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-[#1e2330] transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1e2330] px-6 shrink-0">
          {(['general', 'prompts', 'advanced'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium capitalize transition-all border-b-2 -mb-px ${
                activeTab === tab
                  ? 'text-indigo-400 border-indigo-500'
                  : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 custom-scroll">
          {activeTab === 'general' && (
            <>
              <Field label="Groq API Key" hint="Paste your key from console.groq.com">
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={draft.groqApiKey}
                    onChange={(e) => set('groqApiKey', e.target.value)}
                    placeholder="gsk_..."
                    className="input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </Field>

              <Field label="Suggestion / Chat Model" hint="Model used for suggestions and chat responses">
                <input
                  type="text"
                  value={draft.suggestionModel}
                  onChange={(e) => set('suggestionModel', e.target.value)}
                  className="input"
                />
              </Field>

              <Field label="Transcription Model" hint="Whisper model for speech-to-text">
                <input
                  type="text"
                  value={draft.transcriptionModel}
                  onChange={(e) => set('transcriptionModel', e.target.value)}
                  className="input"
                />
              </Field>
            </>
          )}

          {activeTab === 'prompts' && (
            <>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-500">
                  Use <code className="text-indigo-400">{'{{RECENT_TRANSCRIPT}}'}</code>{' '}
                  and <code className="text-indigo-400">{'{{FULL_CONTEXT}}'}</code> placeholders.
                </p>
                <button
                  onClick={resetPrompts}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <RotateCcw size={11} />
                  Reset to defaults
                </button>
              </div>

              <Field label="Live Suggestions Prompt">
                <textarea
                  value={draft.suggestionPrompt}
                  onChange={(e) => set('suggestionPrompt', e.target.value)}
                  rows={10}
                  className="input resize-y font-mono text-xs"
                />
              </Field>

              <Field
                label="Detailed Answer Prompt"
                hint="Placeholders: {{TRANSCRIPT}}, {{TYPE}}, {{TITLE}}, {{PREVIEW}}"
              >
                <textarea
                  value={draft.detailedAnswerPrompt}
                  onChange={(e) => set('detailedAnswerPrompt', e.target.value)}
                  rows={10}
                  className="input resize-y font-mono text-xs"
                />
              </Field>

              <Field label="Chat Prompt" hint="Placeholder: {{TRANSCRIPT}}">
                <textarea
                  value={draft.chatPrompt}
                  onChange={(e) => set('chatPrompt', e.target.value)}
                  rows={8}
                  className="input resize-y font-mono text-xs"
                />
              </Field>
            </>
          )}

          {activeTab === 'advanced' && (
            <>
              <Field
                label="Suggestion Context Window"
                hint="Characters of recent transcript sent to the suggestions model (~150 chars ≈ 1 minute)"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={500}
                    max={10000}
                    step={500}
                    value={draft.suggestionContextWindow}
                    onChange={(e) => set('suggestionContextWindow', Number(e.target.value))}
                    className="flex-1 accent-indigo-500"
                  />
                  <span className="text-sm text-indigo-400 w-20 text-right">
                    {draft.suggestionContextWindow.toLocaleString()} chars
                  </span>
                </div>
              </Field>

              <Field
                label="Detailed Answer Context Window"
                hint="Characters of transcript sent when expanding a suggestion"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={2000}
                    max={30000}
                    step={1000}
                    value={draft.detailedAnswerContextWindow}
                    onChange={(e) => set('detailedAnswerContextWindow', Number(e.target.value))}
                    className="flex-1 accent-indigo-500"
                  />
                  <span className="text-sm text-indigo-400 w-20 text-right">
                    {draft.detailedAnswerContextWindow.toLocaleString()} chars
                  </span>
                </div>
              </Field>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#1e2330] shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
          >
            Save settings
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-300">{label}</label>
      {hint && <p className="text-xs text-gray-600">{hint}</p>}
      {children}
    </div>
  );
}
