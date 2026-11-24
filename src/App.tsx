/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { FilePlus2, Menu, PanelLeftOpen, X } from 'lucide-react';
import type {
  DisplayOrderMode,
  FolderNode,
  LanguageNode,
  NotebookWorkspace,
  NoteEntryItem,
  NoteFile,
  NoteItem,
  ParsedNoteData,
} from './types/notebook';
import {
  createEntryItem,
  createSegmentItem,
  cryptoRandomId,
  insertItemsAtPosition,
  resolveUniqueFileName,
  serializeNoteToTxt,
} from './utils/noteParser';
import {
  findFirstNoteId,
  findNoteLocation,
  getSiblingNoteNames,
  updateNoteInWorkspace,
} from './utils/treeHelpers';
import { loadWorkspace, saveWorkspace } from './utils/storage';
import { loadColumnVisibility, saveColumnVisibility } from './utils/tableLayout';
import { SidebarTree } from './components/SidebarTree';
import { StudyToolbar } from './components/StudyToolbar';
import { MultiSelectBar } from './components/MultiSelectBar';
import { NoteTable } from './components/NoteTable';
import { PasteImportModal } from './components/PasteImportModal';
import { ConfirmDialog } from './components/ConfirmDialog';

type PendingDeleteAction =
  | { kind: 'segment'; id: string; label: string }
  | { kind: 'entries'; ids: string[]; preview: string }
  | { kind: 'language'; id: string; name: string }
  | { kind: 'folder'; langId: string; id: string; name: string }
  | { kind: 'note'; id: string; name: string }
  | null;

export default function App() {
  const [workspace, setWorkspace] = useState<NotebookWorkspace>(() => loadWorkspace());

  // Study controls state
  const [showLang1, setShowLang1] = useState(true);
  const [showLang2, setShowLang2] = useState(true);
  const [initialColVis] = useState(() => loadColumnVisibility());
  const [showIndexCol, setShowIndexCol] = useState(initialColVis.index);
  const [showStarCol, setShowStarCol] = useState(initialColVis.star);
  const [onlyStarred, setOnlyStarred] = useState(false);
  const [orderMode, setOrderMode] = useState<DisplayOrderMode>('sequential');
  const [randomSeed, setRandomSeed] = useState<number>(() => Date.now());

  // Multi-select state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  // UI overlays & file input
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem('lexnote_sidebar_open');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [isHeaderHidden, setIsHeaderHidden] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('lexnote_header_hidden') === 'true';
    } catch {
      return false;
    }
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteAction>(null);
  const [toastMessage, setToastMessage] = useState<{
    type: 'info' | 'error';
    text: string;
  } | null>(null);

  // Persist workspace to localStorage whenever it changes
  useEffect(() => {
    saveWorkspace(workspace);
  }, [workspace]);

  useEffect(() => {
    try {
      window.localStorage.setItem('lexnote_sidebar_open', String(isDesktopSidebarOpen));
    } catch {
      // Ignore storage errors
    }
  }, [isDesktopSidebarOpen]);

  useEffect(() => {
    try {
      window.localStorage.setItem('lexnote_header_hidden', String(isHeaderHidden));
    } catch {
      // Ignore storage errors
    }
  }, [isHeaderHidden]);

  useEffect(() => {
    saveColumnVisibility({ index: showIndexCol, star: showStarCol });
  }, [showIndexCol, showStarCol]);

  // Auto-dismiss toast after 4.5 seconds
  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const activeLocation = useMemo(
    () => findNoteLocation(workspace, workspace.activeNoteId),
    [workspace],
  );

  const activeNote = activeLocation?.note ?? null;

  const entryStats = useMemo(() => {
    if (!activeNote) return { total: 0, starred: 0 };
    let total = 0;
    let starred = 0;
    for (const item of activeNote.items) {
      if (item.kind === 'entry') {
        total++;
        if (item.starred) starred++;
      }
    }
    return { total, starred };
  }, [activeNote]);

  const visibleEntryIds = useMemo(() => {
    if (!activeNote) return [];
    return activeNote.items
      .filter((it): it is NoteEntryItem => it.kind === 'entry')
      .filter((it) => !onlyStarred || it.starred)
      .map((it) => it.id);
  }, [activeNote, onlyStarred]);

  const exitMultiSelect = () => {
    setIsMultiSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleSelectNote = (noteId: string) => {
    exitMultiSelect();
    setWorkspace((prev) => ({ ...prev, activeNoteId: noteId }));
  };

  // --- Filesystem CRUD (Max 3 Levels) ---
  const handleCreateLanguage = (name: string) => {
    const newLang: LanguageNode = {
      id: `lang_${cryptoRandomId()}`,
      type: 'language',
      name,
      children: [],
    };
    setWorkspace((prev) => ({
      ...prev,
      languages: [...prev.languages, newLang],
    }));
  };

  const handleRenameLanguage = (langId: string, name: string) => {
    setWorkspace((prev) => ({
      ...prev,
      languages: prev.languages.map((l) => (l.id === langId ? { ...l, name } : l)),
    }));
  };

  const handleDeleteLanguage = (langId: string) => {
    setWorkspace((prev) => {
      const languages = prev.languages.filter((l) => l.id !== langId);
      const nextWs: NotebookWorkspace = { ...prev, languages };
      const stillExists = findNoteLocation(nextWs, prev.activeNoteId);
      return {
        ...nextWs,
        activeNoteId: stillExists ? prev.activeNoteId : findFirstNoteId(nextWs),
      };
    });
  };

  const handleCreateFolder = (langId: string, name: string) => {
    const folder: FolderNode = {
      id: `folder_${cryptoRandomId()}`,
      type: 'folder',
      name,
      children: [],
    };
    setWorkspace((prev) => ({
      ...prev,
      languages: prev.languages.map((l) =>
        l.id === langId ? { ...l, children: [...l.children, folder] } : l,
      ),
    }));
  };

  const handleRenameFolder = (langId: string, folderId: string, name: string) => {
    setWorkspace((prev) => ({
      ...prev,
      languages: prev.languages.map((l) =>
        l.id === langId
          ? {
              ...l,
              children: l.children.map((c) =>
                c.type === 'folder' && c.id === folderId ? { ...c, name } : c,
              ),
            }
          : l,
      ),
    }));
  };

  const handleDeleteFolder = (langId: string, folderId: string) => {
    setWorkspace((prev) => {
      const languages = prev.languages.map((l) =>
        l.id === langId
          ? { ...l, children: l.children.filter((c) => c.id !== folderId) }
          : l,
      );
      const nextWs: NotebookWorkspace = { ...prev, languages };
      const stillExists = findNoteLocation(nextWs, prev.activeNoteId);
      return {
        ...nextWs,
        activeNoteId: stillExists ? prev.activeNoteId : findFirstNoteId(nextWs),
      };
    });
  };

  const handleCreateNote = (langId: string, folderId: string | undefined, rawName: string) => {
    setWorkspace((prev) => {
      const siblings = getSiblingNoteNames(prev, langId, folderId);
      const uniqueName = resolveUniqueFileName(rawName, siblings);
      const newNote: NoteFile = {
        id: `note_${cryptoRandomId()}`,
        type: 'note',
        name: uniqueName,
        lang1Label: 'Language 1',
        lang2Label: 'Language 2',
        items: [],
        updatedAt: Date.now(),
      };
      const languages = prev.languages.map((l) => {
        if (l.id !== langId) return l;
        if (!folderId) {
          return { ...l, children: [...l.children, newNote] };
        }
        return {
          ...l,
          children: l.children.map((c) =>
            c.type === 'folder' && c.id === folderId
              ? { ...c, children: [...c.children, newNote] }
              : c,
          ),
        };
      });
      return {
        languages,
        activeNoteId: newNote.id,
      };
    });
    exitMultiSelect();
  };

  const handleRenameNote = (noteId: string, rawName: string) => {
    const trimmed = rawName.trim();
    if (!trimmed) return;
    setWorkspace((prev) =>
      updateNoteInWorkspace(prev, noteId, (n) => ({
        ...n,
        name: trimmed,
        updatedAt: Date.now(),
      })),
    );
  };

  const handleDeleteNote = (noteId: string) => {
    setWorkspace((prev) => {
      const languages = prev.languages.map((l) => ({
        ...l,
        children: l.children
          .filter((c) => !(c.type === 'note' && c.id === noteId))
          .map((c) =>
            c.type === 'folder'
              ? { ...c, children: c.children.filter((sub) => sub.id !== noteId) }
              : c,
          ),
      }));
      const nextWs: NotebookWorkspace = { ...prev, languages };
      const nextActive =
        prev.activeNoteId === noteId ? findFirstNoteId(nextWs) : prev.activeNoteId;
      return { ...nextWs, activeNoteId: nextActive };
    });
    if (workspace.activeNoteId === noteId) {
      exitMultiSelect();
    }
  };

  // --- Note Content Handlers ---
  const mutateActiveNote = (updater: (note: NoteFile) => NoteFile) => {
    if (!activeNote) return;
    setWorkspace((prev) => updateNoteInWorkspace(prev, activeNote.id, updater));
  };

  const handleChangeOrderMode = (mode: DisplayOrderMode) => {
    if (mode === 'random') {
      // Switch to random display using current timestamp seed
      setRandomSeed(Date.now());
    }
    setOrderMode(mode);
  };

  const handleReshuffle = () => {
    setRandomSeed(Date.now());
  };

  const handleToggleStar = (entryId: string) => {
    mutateActiveNote((n) => ({
      ...n,
      updatedAt: Date.now(),
      items: n.items.map((it) =>
        it.kind === 'entry' && it.id === entryId ? { ...it, starred: !it.starred } : it,
      ),
    }));
  };

  const handleUpdateEntry = (entryId: string, field: 'lang1' | 'lang2', value: string) => {
    mutateActiveNote((n) => ({
      ...n,
      updatedAt: Date.now(),
      items: n.items.map((it) =>
        it.kind === 'entry' && it.id === entryId ? { ...it, [field]: value } : it,
      ),
    }));
  };

  const handleUpdateSegmentTitle = (segmentId: string, title: string) => {
    mutateActiveNote((n) => ({
      ...n,
      updatedAt: Date.now(),
      items: n.items.map((it) =>
        it.kind === 'segment' && it.id === segmentId ? { ...it, title } : it,
      ),
    }));
  };

  const handleDeleteSegment = (segmentId: string) => {
    mutateActiveNote((n) => ({
      ...n,
      updatedAt: Date.now(),
      items: n.items.filter((it) => it.id !== segmentId),
    }));
  };

  const handleInsertEntryAt = (
    lang1: string,
    lang2: string,
    afterItemId: string | null,
  ): string => {
    const newItem = createEntryItem(lang1, lang2, false);
    mutateActiveNote((n) => ({
      ...n,
      updatedAt: Date.now(),
      items: insertItemsAtPosition(n.items, [newItem], afterItemId),
    }));
    return newItem.id;
  };

  const handleInsertSegmentAt = (afterItemId: string | null): string => {
    if (orderMode === 'random') {
      setOrderMode('sequential');
    }
    const newSeg = createSegmentItem('');
    mutateActiveNote((n) => ({
      ...n,
      updatedAt: Date.now(),
      items: insertItemsAtPosition(n.items, [newSeg], afterItemId),
    }));
    return newSeg.id;
  };

  const handleUpdateColumnLabels = (lang1Label: string, lang2Label: string) => {
    mutateActiveNote((n) => ({
      ...n,
      lang1Label,
      lang2Label,
      updatedAt: Date.now(),
    }));
  };

  // --- Multi-Select Handlers ---
  const handleEnterMultiSelectWithRow = (entryId: string) => {
    setIsMultiSelectMode(true);
    setSelectedIds(new Set([entryId]));
  };

  const handleToggleSelectRow = (entryId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    setSelectedIds(new Set(visibleEntryIds));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBatchStar = (starred: boolean) => {
    if (selectedIds.size === 0) return;
    mutateActiveNote((n) => ({
      ...n,
      updatedAt: Date.now(),
      items: n.items.map((it) =>
        it.kind === 'entry' && selectedIds.has(it.id) ? { ...it, starred } : it,
      ),
    }));
  };

  const handleRequestDeleteSelected = () => {
    if (selectedIds.size === 0 || !activeNote) return;
    const ids = Array.from(selectedIds);
    let preview = '';
    if (ids.length === 1) {
      const target = activeNote.items.find(
        (it): it is NoteEntryItem => it.kind === 'entry' && it.id === ids[0],
      );
      if (target) {
        preview = `${target.lang1} — ${target.lang2}`;
      }
    }
    setPendingDelete({ kind: 'entries', ids, preview });
  };

  const handleRequestDeleteSegment = (segment: {
    id: string;
    title: string;
    segmentIndex: number;
  }) => {
    const label = segment.title.trim() || `Section ${segment.segmentIndex}`;
    setPendingDelete({ kind: 'segment', id: segment.id, label });
  };

  const handleRequestDeleteLanguage = (lang: { id: string; name: string }) => {
    setPendingDelete({ kind: 'language', id: lang.id, name: lang.name });
  };

  const handleRequestDeleteFolder = (folder: { langId: string; id: string; name: string }) => {
    setPendingDelete({
      kind: 'folder',
      langId: folder.langId,
      id: folder.id,
      name: folder.name,
    });
  };

  const handleRequestDeleteNote = (note: { id: string; name: string }) => {
    setPendingDelete({ kind: 'note', id: note.id, name: note.name });
  };

  const handleConfirmPendingDelete = () => {
    if (!pendingDelete) return;
    if (pendingDelete.kind === 'segment') {
      handleDeleteSegment(pendingDelete.id);
    } else if (pendingDelete.kind === 'entries') {
      const idSet = new Set(pendingDelete.ids);
      mutateActiveNote((n) => ({
        ...n,
        updatedAt: Date.now(),
        items: n.items.filter((it) => !idSet.has(it.id)),
      }));
      exitMultiSelect();
    } else if (pendingDelete.kind === 'language') {
      handleDeleteLanguage(pendingDelete.id);
    } else if (pendingDelete.kind === 'folder') {
      handleDeleteFolder(pendingDelete.langId, pendingDelete.id);
    } else if (pendingDelete.kind === 'note') {
      handleDeleteNote(pendingDelete.id);
    }
    setPendingDelete(null);
  };

  // --- Paste Import Handler ---
  const handleConfirmPasteImport = (parsed: ParsedNoteData, mode: 'append' | 'replace') => {
    const newItems: NoteItem[] = parsed.items.map((item) =>
      item.kind === 'segment'
        ? createSegmentItem(item.title)
        : createEntryItem(item.lang1, item.lang2, Boolean(item.starred)),
    );
    mutateActiveNote((n) => ({
      ...n,
      updatedAt: Date.now(),
      items: mode === 'replace' ? newItems : [...n.items, ...newItems],
    }));
    setToastMessage({
      type: 'info',
      text: `Imported ${newItems.length} ${newItems.length === 1 ? 'item' : 'items'}`,
    });
  };

  // --- .txt Export ---
  const handleExportNote = (noteId: string) => {
    const loc = findNoteLocation(workspace, noteId);
    if (!loc) return;
    const content = serializeNoteToTxt(loc.note, loc.language.name);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${loc.note.name}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const confirmDialogProps = (() => {
    if (!pendingDelete) {
      return { title: '', message: '', detail: undefined };
    }
    switch (pendingDelete.kind) {
      case 'segment':
        return {
          title: 'Delete Section?',
          message:
            'Are you sure you want to delete this section divider? Entries under it will stay in the note.',
          detail: pendingDelete.label,
        };
      case 'entries':
        return {
          title:
            pendingDelete.ids.length === 1
              ? 'Delete Entry?'
              : `Delete ${pendingDelete.ids.length} Entries?`,
          message:
            pendingDelete.ids.length === 1
              ? 'Are you sure you want to delete this entry? This action cannot be undone.'
              : 'Are you sure you want to delete the selected entries? This action cannot be undone.',
          detail: pendingDelete.preview || undefined,
        };
      case 'language':
        return {
          title: 'Delete Language?',
          message:
            'Are you sure you want to delete this language and all folders and notes inside it? This action cannot be undone.',
          detail: pendingDelete.name,
        };
      case 'folder':
        return {
          title: 'Delete Folder?',
          message:
            'Are you sure you want to delete this folder and all notes inside it? This action cannot be undone.',
          detail: pendingDelete.name,
        };
      case 'note':
        return {
          title: 'Delete Note?',
          message: 'Are you sure you want to delete this note? This action cannot be undone.',
          detail: pendingDelete.name,
        };
    }
  })();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900">
      <SidebarTree
        workspace={workspace}
        isDesktopOpen={isDesktopSidebarOpen}
        onHideDesktop={() => setIsDesktopSidebarOpen(false)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onSelectNote={handleSelectNote}
        onCreateLanguage={handleCreateLanguage}
        onRenameLanguage={handleRenameLanguage}
        onRequestDeleteLanguage={handleRequestDeleteLanguage}
        onCreateFolder={handleCreateFolder}
        onRenameFolder={handleRenameFolder}
        onRequestDeleteFolder={handleRequestDeleteFolder}
        onCreateNote={handleCreateNote}
        onRenameNote={handleRenameNote}
        onRequestDeleteNote={handleRequestDeleteNote}
        onExportNote={handleExportNote}
      />

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {toastMessage && (
          <div
            role="status"
            className={`fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-medium shadow-lg ${
              toastMessage.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-slate-200 bg-slate-900 text-white'
            }`}
          >
            <span>{toastMessage.text}</span>
            <button
              type="button"
              aria-label="Close notification"
              onClick={() => setToastMessage(null)}
              className="rounded p-0.5 opacity-75 hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {activeNote && activeLocation ? (
          <>
            {!isHeaderHidden ? (
              <StudyToolbar
                note={activeNote}
                languageName={activeLocation.language.name}
                folderName={activeLocation.folder?.name}
                orderMode={orderMode}
                randomSeed={randomSeed}
                totalEntries={entryStats.total}
                starredEntries={entryStats.starred}
                isMultiSelectMode={isMultiSelectMode}
                selectedCount={selectedIds.size}
                totalVisibleCount={visibleEntryIds.length}
                onSelectAll={handleSelectAllVisible}
                onClearSelection={handleClearSelection}
                onStarSelected={() => handleBatchStar(true)}
                onUnstarSelected={() => handleBatchStar(false)}
                onDeleteSelected={handleRequestDeleteSelected}
                onExitMultiSelect={exitMultiSelect}
                isDesktopSidebarOpen={isDesktopSidebarOpen}
                onShowDesktopSidebar={() => setIsDesktopSidebarOpen(true)}
                onHideHeader={() => setIsHeaderHidden(true)}
                onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
                onRenameNote={(name) => handleRenameNote(activeNote.id, name)}
                onChangeOrderMode={handleChangeOrderMode}
                onReshuffle={handleReshuffle}
                onOpenPasteImport={() => setIsPasteModalOpen(true)}
                onExportTxt={() => handleExportNote(activeNote.id)}
                showIndexCol={showIndexCol}
                showStarCol={showStarCol}
                onToggleShowIndexCol={setShowIndexCol}
                onToggleShowStarCol={setShowStarCol}
              />
            ) : (
              isMultiSelectMode && (
                <MultiSelectBar
                  selectedCount={selectedIds.size}
                  totalVisibleCount={visibleEntryIds.length}
                  onSelectAll={handleSelectAllVisible}
                  onClearSelection={handleClearSelection}
                  onStarSelected={() => handleBatchStar(true)}
                  onUnstarSelected={() => handleBatchStar(false)}
                  onDeleteSelected={handleRequestDeleteSelected}
                  onExitMultiSelect={exitMultiSelect}
                />
              )
            )}

            <NoteTable
              note={activeNote}
              orderMode={orderMode}
              randomSeed={randomSeed}
              showLang1={showLang1}
              showLang2={showLang2}
              showIndexCol={showIndexCol}
              showStarCol={showStarCol}
              onlyStarred={onlyStarred}
              isMultiSelectMode={isMultiSelectMode}
              selectedIds={selectedIds}
              isHeaderHidden={isHeaderHidden}
              onShowHeader={() => setIsHeaderHidden(false)}
              onToggleShowLang1={setShowLang1}
              onToggleShowLang2={setShowLang2}
              onToggleOnlyStarred={setOnlyStarred}
              onUpdateColumnLabels={handleUpdateColumnLabels}
              onToggleStar={handleToggleStar}
              onUpdateEntry={handleUpdateEntry}
              onUpdateSegmentTitle={handleUpdateSegmentTitle}
              onRequestDeleteSegment={handleRequestDeleteSegment}
              onInsertEntryAt={handleInsertEntryAt}
              onInsertSegmentAt={handleInsertSegmentAt}
              onOpenPasteImport={() => setIsPasteModalOpen(true)}
              onEnterMultiSelectWithRow={handleEnterMultiSelectWithRow}
              onToggleSelectRow={handleToggleSelectRow}
            />

            <PasteImportModal
              isOpen={isPasteModalOpen}
              onClose={() => setIsPasteModalOpen(false)}
              onConfirmImport={handleConfirmPasteImport}
            />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
            {!isDesktopSidebarOpen && (
              <button
                type="button"
                onClick={() => setIsDesktopSidebarOpen(true)}
                className="mb-6 hidden items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 md:inline-flex"
              >
                <PanelLeftOpen className="h-4 w-4" />
                Show Directory
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="mb-6 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 md:hidden"
            >
              <Menu className="h-4 w-4" />
              Open Directory
            </button>
            <FilePlus2 className="mb-3 h-10 w-10 text-slate-300" />
            <h1 className="font-display text-lg font-semibold text-slate-800">
              Select or create a note
            </h1>
            <p className="mt-1.5 max-w-sm text-xs text-slate-500">
              Choose a note from the directory on the left, or create a new note to begin studying.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (workspace.languages.length > 0) {
                    handleCreateNote(workspace.languages[0].id, undefined, 'New Vocabulary Note');
                  } else {
                    const langId = `lang_${cryptoRandomId()}`;
                    const noteId = `note_${cryptoRandomId()}`;
                    setWorkspace({
                      activeNoteId: noteId,
                      languages: [
                        {
                          id: langId,
                          type: 'language',
                          name: 'English',
                          children: [
                            {
                              id: noteId,
                              type: 'note',
                              name: 'New Vocabulary Note',
                              lang1Label: 'Language 1',
                              lang2Label: 'Language 2',
                              items: [],
                              updatedAt: Date.now(),
                            },
                          ],
                        },
                      ],
                    });
                  }
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
              >
                New Note
              </button>
            </div>
          </div>
        )}

        <ConfirmDialog
          isOpen={pendingDelete !== null}
          title={confirmDialogProps.title}
          message={confirmDialogProps.message}
          detail={confirmDialogProps.detail}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={handleConfirmPendingDelete}
          onCancel={() => setPendingDelete(null)}
        />
      </main>
    </div>
  );
}
