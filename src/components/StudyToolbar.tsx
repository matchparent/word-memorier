import React, { useState } from 'react';
import {
  ClipboardPaste,
  Download,
  ListOrdered,
  Menu,
  PanelLeftOpen,
  PanelTopClose,
  Pencil,
  RefreshCw,
  Shuffle,
  Upload,
} from 'lucide-react';
import type { DisplayOrderMode, NoteFile } from '../types/notebook';
import { MultiSelectBar } from './MultiSelectBar';

interface StudyToolbarProps {
  note: NoteFile;
  languageName: string;
  folderName?: string;
  orderMode: DisplayOrderMode;
  randomSeed: number;
  totalEntries: number;
  starredEntries: number;
  isMultiSelectMode: boolean;
  selectedCount: number;
  totalVisibleCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onStarSelected: () => void;
  onUnstarSelected: () => void;
  onDeleteSelected: () => void;
  onExitMultiSelect: () => void;
  isDesktopSidebarOpen: boolean;
  onShowDesktopSidebar: () => void;
  onHideHeader: () => void;
  onOpenMobileSidebar: () => void;
  onRenameNote: (newName: string) => void;
  onChangeOrderMode: (mode: DisplayOrderMode) => void;
  onReshuffle: () => void;
  onOpenPasteImport: () => void;
  onTriggerTxtImport: () => void;
  onExportTxt: () => void;
}

export const StudyToolbar: React.FC<StudyToolbarProps> = ({
  note,
  languageName,
  folderName,
  orderMode,
  randomSeed,
  totalEntries,
  starredEntries,
  isMultiSelectMode,
  selectedCount,
  totalVisibleCount,
  onSelectAll,
  onClearSelection,
  onStarSelected,
  onUnstarSelected,
  onDeleteSelected,
  onExitMultiSelect,
  isDesktopSidebarOpen,
  onShowDesktopSidebar,
  onHideHeader,
  onOpenMobileSidebar,
  onRenameNote,
  onChangeOrderMode,
  onReshuffle,
  onOpenPasteImport,
  onTriggerTxtImport,
  onExportTxt,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(note.name);

  const commitTitle = () => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== note.name) {
      onRenameNote(trimmed);
    }
    setIsEditingTitle(false);
  };

  return (
    <header className="border-b border-slate-200 bg-white">
      {/* Row 1: Breadcrumb + Prominent Title + File Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {!isDesktopSidebarOpen && (
            <button
              type="button"
              title="Show directory"
              aria-label="Show directory"
              onClick={onShowDesktopSidebar}
              className="hidden items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 md:inline-flex whitespace-nowrap shrink-0"
            >
              <PanelLeftOpen className="h-4 w-4 text-slate-500" />
              Directory
            </button>
          )}
          <button
            type="button"
            aria-label="Open note directory"
            onClick={onOpenMobileSidebar}
            className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 md:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="truncate">{languageName}</span>
              {folderName && (
                <>
                  <span aria-hidden="true">/</span>
                  <span className="truncate">{folderName}</span>
                </>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              {isEditingTitle ? (
                <input
                  type="text"
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={commitTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitTitle();
                    if (e.key === 'Escape') {
                      setTitleDraft(note.name);
                      setIsEditingTitle(false);
                    }
                  }}
                  className="rounded border border-blue-400 bg-white px-2 py-0.5 font-display text-base font-semibold text-slate-900 outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setTitleDraft(note.name);
                    setIsEditingTitle(true);
                  }}
                  title="Click to rename note"
                  className="inline-flex items-center gap-1.5 font-display text-base font-semibold tracking-tight text-slate-900 hover:text-blue-600"
                >
                  <span className="truncate">{note.name}</span>
                  <Pencil className="h-3.5 w-3.5 text-slate-400" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenPasteImport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <ClipboardPaste className="h-3.5 w-3.5 text-slate-500" />
            Paste Import
          </button>
          <button
            type="button"
            onClick={onTriggerTxtImport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Upload className="h-3.5 w-3.5 text-slate-500" />
            Import .txt
          </button>
          <button
            type="button"
            onClick={onExportTxt}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            Export .txt
          </button>
          <button
            type="button"
            title="Hide top toolbar"
            aria-label="Hide header"
            onClick={onHideHeader}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap shrink-0"
          >
            <PanelTopClose className="h-3.5 w-3.5" />
            Hide Header
          </button>
        </div>
      </div>

      {/* Row 2: Order Mode Toggle & Stats (or MultiSelectBar in-place with zero layout shift) */}
      {isMultiSelectMode ? (
        <MultiSelectBar
          selectedCount={selectedCount}
          totalVisibleCount={totalVisibleCount}
          onSelectAll={onSelectAll}
          onClearSelection={onClearSelection}
          onStarSelected={onStarSelected}
          onUnstarSelected={onUnstarSelected}
          onDeleteSelected={onDeleteSelected}
          onExitMultiSelect={onExitMultiSelect}
        />
      ) : (
        <div className="flex min-h-[46px] flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-2 md:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <div
              role="group"
              aria-label="Display order"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5"
            >
              <button
                type="button"
                onClick={() => onChangeOrderMode('sequential')}
                aria-pressed={orderMode === 'sequential'}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  orderMode === 'sequential'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ListOrdered className="h-3.5 w-3.5" />
                Sequential
              </button>
              <button
                type="button"
                onClick={() => onChangeOrderMode('random')}
                aria-pressed={orderMode === 'random'}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  orderMode === 'random'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Shuffle className="h-3.5 w-3.5" />
                Random
              </button>
            </div>

            {orderMode === 'random' && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <button
                  type="button"
                  onClick={onReshuffle}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="h-3 w-3" />
                  Reshuffle
                </button>
                <span className="font-mono-tabular text-slate-400">
                  Seed {randomSeed}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>
              Total <span className="font-mono-tabular font-medium text-slate-700">{totalEntries}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Starred{' '}
              <span className="font-mono-tabular font-medium text-amber-700">{starredEntries}</span>
            </span>
            <span className="hidden lg:inline" aria-hidden="true">
              ·
            </span>
            <span className="hidden lg:inline text-slate-400">
              Long-press row to select · Click masked cell to reveal · Click text to edit
            </span>
          </div>
        </div>
      )}
    </header>
  );
};
