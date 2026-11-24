import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, ClipboardPaste, Copy, X } from 'lucide-react';
import { parseNoteImportText } from '../utils/noteParser';
import type { ParsedNoteData } from '../types/notebook';

interface PasteImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: (parsed: ParsedNoteData, mode: 'append' | 'replace') => void;
}

const SAMPLE_TEXT = `["serendipity":"finding something valuable by chance"],
["ephemeral":"lasting for a very short time"],
[],
["Practice makes perfect.":"Regular practice leads to mastery."]`;

export const AI_FORMAT_PROMPT = `Convert the vocabulary, phrases, sentences, or notes I provide below into the exact plain-text import format for my Wordbook app.

Formatting rules:
1. Each entry must strictly follow: ["Language 1":"Language 2"]
2. Separate entries with commas (for example: ["term 1":"meaning 1"], ["term 2":"meaning 2"]).
3. Use [] for an unlabeled section break, or [Section Title] (without quotes) for a named section header.
4. Escape any double quotes inside text as \\", backslashes as \\\\, and line breaks as \\n.
5. Keep Language 1 (the word, phrase, or sentence to study) on the left of ":" and Language 2 (its translation, definition, or note) on the right.
6. Output ONLY the formatted lines inside a single code block with no extra commentary, bullet points, or numbering.

Example output:
[Part 1 - Core Vocabulary],
["ephemeral":"lasting for a very short time"],
["He said \\"Hello\\"":"Greeting someone warmly"],
[],
["Practice makes perfect.":"Regular practice leads to mastery."]

Here is my content to convert:
`;

export const PasteImportModal: React.FC<PasteImportModalProps> = ({
  isOpen,
  onClose,
  onConfirmImport,
}) => {
  const [rawText, setRawText] = useState('');
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const parsed = useMemo(() => {
    if (!rawText.trim()) return null;
    return parseNoteImportText(rawText);
  }, [rawText]);

  useEffect(() => {
    if (!copiedPrompt) return;
    const timer = window.setTimeout(() => setCopiedPrompt(false), 2200);
    return () => window.clearTimeout(timer);
  }, [copiedPrompt]);

  if (!isOpen) return null;

  const entryCount = parsed?.items.filter((it) => it.kind === 'entry').length ?? 0;
  const segmentCount = parsed?.items.filter((it) => it.kind === 'segment').length ?? 0;
  const canSubmit = Boolean(parsed && parsed.items.length > 0 && parsed.errors.length === 0);

  const handleCopyPrompt = async () => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(AI_FORMAT_PROMPT);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      const helper = document.createElement('textarea');
      helper.value = AI_FORMAT_PROMPT;
      helper.setAttribute('readonly', 'true');
      helper.className = 'fixed -left-[9999px] top-0 opacity-0';
      document.body.appendChild(helper);
      helper.select();
      document.execCommand('copy');
      document.body.removeChild(helper);
    }
    setCopiedPrompt(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed || parsed.items.length === 0) return;
    onConfirmImport(parsed, importMode);
    setRawText('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paste-import-title"
    >
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <ClipboardPaste className="h-4 w-4 text-blue-600" />
            <h2 id="paste-import-title" className="font-display text-base font-semibold text-slate-900">
              Paste Import Entries
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close import dialog"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <div>
              Format:
              <code className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono-tabular text-slate-800">
                [&quot;Lang 1&quot;:&quot;Lang 2&quot;],[&quot;Lang 1&quot;:&quot;Lang 2&quot;],…
              </code>
              <span className="ml-2 text-slate-500">
                Use <code className="rounded bg-slate-100 px-1 font-mono-tabular">[]</code> for sections
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCopyPrompt}
                title="Copy an English AI prompt to convert raw notes in ChatGPT or another AI into this format"
                className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  copiedPrompt
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {copiedPrompt ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Prompt Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-slate-500" />
                    Copy AI Prompt
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setRawText(SAMPLE_TEXT)}
                className="text-blue-600 hover:underline font-medium whitespace-nowrap"
              >
                Load Sample
              </button>
            </div>
          </div>

          <p className="mb-2.5 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
            Tip: Click <span className="font-medium text-slate-800">Copy AI Prompt</span>, paste it
            into ChatGPT (or any AI) followed by your raw notes, then paste the formatted output below.
          </p>

          <label htmlFor="paste-import-textarea" className="sr-only">
            Paste import data
          </label>
          <textarea
            id="paste-import-textarea"
            rows={7}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder='["apple":"manzana"],["banana":"plátano"],[],["cat":"gato"]'
            className="w-full rounded-lg border border-slate-300 bg-slate-50/50 p-3 font-mono-tabular text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15"
          />

          {parsed && (
            <div className="mt-3 space-y-2">
              {parsed.errors.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="space-y-0.5">
                    {parsed.errors.map((err, idx) => (
                      <div key={idx}>{err}</div>
                    ))}
                  </div>
                </div>
              )}

              {parsed.items.length > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>
                    Parsed <span className="font-mono-tabular font-semibold">{entryCount}</span>{' '}
                    {entryCount === 1 ? 'entry' : 'entries'}
                    {segmentCount > 0 && (
                      <>
                        , <span className="font-mono-tabular font-semibold">{segmentCount}</span>{' '}
                        {segmentCount === 1 ? 'section' : 'sections'}
                      </>
                    )}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
            <div className="flex items-center gap-4 text-xs text-slate-700">
              <label className="inline-flex cursor-pointer items-center gap-1.5">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'append'}
                  onChange={() => setImportMode('append')}
                  className="accent-blue-600"
                />
                Append to current note
              </label>
              <label className="inline-flex cursor-pointer items-center gap-1.5">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="accent-blue-600"
                />
                Replace current note
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Import ({entryCount + segmentCount})
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
