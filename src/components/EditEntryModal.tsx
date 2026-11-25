import React, { useEffect, useRef, useState } from 'react';
import { Pencil, X } from 'lucide-react';
import type { NoteEntryItem } from '../types/notebook';

interface EditEntryModalProps {
  isOpen: boolean;
  entry: NoteEntryItem | null;
  lang1Label: string;
  lang2Label: string;
  initialField: 'lang1' | 'lang2';
  onClose: () => void;
  onConfirm: (entryId: string, lang1: string, lang2: string) => void;
}

export const EditEntryModal: React.FC<EditEntryModalProps> = ({
  isOpen,
  entry,
  lang1Label,
  lang2Label,
  initialField,
  onClose,
  onConfirm,
}) => {
  const [lang1Draft, setLang1Draft] = useState('');
  const [lang2Draft, setLang2Draft] = useState('');
  const lang1Ref = useRef<HTMLTextAreaElement | null>(null);
  const lang2Ref = useRef<HTMLTextAreaElement | null>(null);
  const backdropPointerDownRef = useRef(false);

  useEffect(() => {
    if (!isOpen || !entry) return;
    setLang1Draft(entry.lang1);
    setLang2Draft(entry.lang2);
    const frame = window.requestAnimationFrame(() => {
      const target = initialField === 'lang2' ? lang2Ref.current : lang1Ref.current;
      if (target) {
        target.focus();
        const len = target.value.length;
        target.setSelectionRange(len, len);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, entry, initialField]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !entry) return null;

  const canSave = Boolean(lang1Draft.trim() || lang2Draft.trim());

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canSave) return;
    onConfirm(
      entry.id,
      lang1Draft.trim() || '(Empty)',
      lang2Draft.trim() || '(Empty)',
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        onPointerDown={(e) => {
          backdropPointerDownRef.current = e.target === e.currentTarget;
        }}
        onClick={() => {
          if (backdropPointerDownRef.current) {
            onClose();
          }
          backdropPointerDownRef.current = false;
        }}
        aria-hidden="true"
      />
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-entry-dialog-title"
        className="relative z-10 w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Pencil className="h-4 w-4" />
            </div>
            <h2
              id="edit-entry-dialog-title"
              className="font-display text-sm font-semibold text-slate-900"
            >
              Edit Entry
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close edit entry dialog"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label
              htmlFor="edit-entry-lang1"
              className="block text-xs font-medium text-slate-700"
            >
              Lang 1 ({lang1Label})
            </label>
            <textarea
              id="edit-entry-lang1"
              ref={lang1Ref}
              rows={3}
              value={lang1Draft}
              onChange={(e) => setLang1Draft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={`Enter ${lang1Label}...`}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
            />
          </div>

          <div>
            <label
              htmlFor="edit-entry-lang2"
              className="block text-xs font-medium text-slate-700"
            >
              Lang 2 ({lang2Label})
            </label>
            <textarea
              id="edit-entry-lang2"
              ref={lang2Ref}
              rows={3}
              value={lang2Draft}
              onChange={(e) => setLang2Draft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={`Enter ${lang2Label}...`}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
            />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
};
