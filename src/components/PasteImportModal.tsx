import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ClipboardPaste, X } from 'lucide-react';
import { parseNoteImportText } from '../utils/noteParser';
import type { ParsedNoteData } from '../types/notebook';

interface PasteImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: (parsed: ParsedNoteData, mode: 'append' | 'replace') => void;
}

const SAMPLE_TEXT = `["serendipity":"意外发现珍宝的运气"],
["ephemeral":"短暂的；转瞬即逝的"],
[],
["Practice makes perfect.":"熟能生巧。"]`;

export const PasteImportModal: React.FC<PasteImportModalProps> = ({
  isOpen,
  onClose,
  onConfirmImport,
}) => {
  const [rawText, setRawText] = useState('');
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');

  const parsed = useMemo(() => {
    if (!rawText.trim()) return null;
    return parseNoteImportText(rawText);
  }, [rawText]);

  if (!isOpen) return null;

  const entryCount = parsed?.items.filter((it) => it.kind === 'entry').length ?? 0;
  const segmentCount = parsed?.items.filter((it) => it.kind === 'segment').length ?? 0;
  const canSubmit = Boolean(parsed && parsed.items.length > 0 && parsed.errors.length === 0);

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
              粘贴导入词句数据
            </h2>
          </div>
          <button
            type="button"
            aria-label="关闭导入弹窗"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <div>
              支持格式：
              <code className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono-tabular text-slate-800">
                [&quot;语言1&quot;:&quot;语言2&quot;],[&quot;语言1&quot;:&quot;语言2&quot;],…
              </code>
              <span className="ml-2 text-slate-500">
                使用 <code className="rounded bg-slate-100 px-1 font-mono-tabular">[]</code> 表示分段
              </span>
            </div>
            <button
              type="button"
              onClick={() => setRawText(SAMPLE_TEXT)}
              className="text-blue-600 hover:underline font-medium"
            >
              填入示例数据
            </button>
          </div>

          <label htmlFor="paste-import-textarea" className="sr-only">
            粘贴导入数据
          </label>
          <textarea
            id="paste-import-textarea"
            rows={7}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder='["apple":"苹果"],["banana":"香蕉"],[],["cat":"猫"]'
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
                    已解析 <span className="font-mono-tabular font-semibold">{entryCount}</span> 条词句
                    {segmentCount > 0 && (
                      <>
                        ，<span className="font-mono-tabular font-semibold">{segmentCount}</span> 个分段
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
                追加到当前笔记末尾
              </label>
              <label className="inline-flex cursor-pointer items-center gap-1.5">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="accent-blue-600"
                />
                覆盖当前笔记全部内容
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45"
              >
                确认导入 ({entryCount + segmentCount})
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
