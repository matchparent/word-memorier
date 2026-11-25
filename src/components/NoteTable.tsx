import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ClipboardPaste,
  PanelTopOpen,
  Plus,
  SplitSquareVertical,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import type { DisplayOrderMode, NoteEntryItem, NoteFile } from '../types/notebook';
import { INSERT_AT_TOP, shuffleWithinSegments } from '../utils/noteParser';
import {
  type ColumnKey,
  type ColumnWidths,
  getColumnCheckState,
  getVisibleColumnCount,
  isCellVisible,
  loadSavedColumnWidths,
  resizeColumnWidth,
  saveColumnWidths,
} from '../utils/tableLayout';

interface NoteTableProps {
  note: NoteFile;
  orderMode: DisplayOrderMode;
  randomSeed: number;
  showLang1: boolean;
  showLang2: boolean;
  showIndexCol: boolean;
  showStarCol: boolean;
  onlyStarred: boolean;
  cellOverrides: Readonly<Record<string, boolean>>;
  isMultiSelectMode: boolean;
  selectedIds: Set<string>;
  isHeaderHidden: boolean;
  onShowHeader: () => void;
  onToggleShowLang1: (show: boolean) => void;
  onToggleShowLang2: (show: boolean) => void;
  onToggleOnlyStarred: (only: boolean) => void;
  onToggleCellVisibility: (entryId: string, field: 'lang1' | 'lang2') => void;
  onUpdateColumnLabels: (lang1Label: string, lang2Label: string) => void;
  onToggleStar: (entryId: string) => void;
  onRequestEditEntry: (entry: NoteEntryItem, initialField: 'lang1' | 'lang2') => void;
  onUpdateSegmentTitle: (segmentId: string, title: string) => void;
  onRequestDeleteSegment: (segment: { id: string; title: string; segmentIndex: number }) => void;
  onInsertEntryAt: (lang1: string, lang2: string, afterItemId: string | null) => string;
  onInsertSegmentAt: (afterItemId: string | null) => string;
  onOpenPasteImport: () => void;
  onToggleSelectRow: (entryId: string) => void;
}

type RenderRow =
  | { kind: 'segment'; id: string; title: string; segmentIndex: number }
  | { kind: 'entry'; entry: NoteEntryItem; displayIndex: number };

const LONG_PRESS_MS = 400;

export const NoteTable: React.FC<NoteTableProps> = ({
  note,
  orderMode,
  randomSeed,
  showLang1,
  showLang2,
  showIndexCol,
  showStarCol,
  onlyStarred,
  cellOverrides,
  isMultiSelectMode,
  selectedIds,
  isHeaderHidden,
  onShowHeader,
  onToggleShowLang1,
  onToggleShowLang2,
  onToggleOnlyStarred,
  onToggleCellVisibility,
  onUpdateColumnLabels,
  onToggleStar,
  onRequestEditEntry,
  onUpdateSegmentTitle,
  onRequestDeleteSegment,
  onInsertEntryAt,
  onInsertSegmentAt,
  onOpenPasteImport,
  onToggleSelectRow,
}) => {
  // Editing segment title
  const [editingSegment, setEditingSegment] = useState<{ id: string; value: string } | null>(null);
  // Editing column labels
  const [editingColLabel, setEditingColLabel] = useState<'lang1' | 'lang2' | null>(null);
  const [colLabelDraft, setColLabelDraft] = useState('');

  // Inline arbitrary-position insert state
  const [inlineInsertAnchor, setInlineInsertAnchor] = useState<string | null>(null);
  const [inlineLang1, setInlineLang1] = useState('');
  const [inlineLang2, setInlineLang2] = useState('');
  const inlineLang1Ref = useRef<HTMLInputElement | null>(null);

  // Draggable column widths (applied on tablet/desktop viewports >= 768px)
  const [colWidths, setColWidths] = useState<ColumnWidths | null>(() => loadSavedColumnWidths());
  const [resizingCol, setResizingCol] = useState<ColumnKey | null>(null);
  const [isCompactViewport, setIsCompactViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );
  const thRefs = useRef<Record<ColumnKey, HTMLTableCellElement | null>>({
    index: null,
    star: null,
    lang1: null,
    lang2: null,
  });

  // Long-press handling refs for cell edit modal
  const cellLongPressTimerRef = useRef<number | null>(null);
  const cellPointerOriginRef = useRef<{ x: number; y: number } | null>(null);
  const suppressCellClickRef = useRef(false);
  const [pressingCellKey, setPressingCellKey] = useState<string | null>(null);

  // Long-press handling refs for column header rename
  const colLabelTimerRef = useRef<number | null>(null);
  const colLabelOriginRef = useRef<{ x: number; y: number } | null>(null);
  const suppressColLabelClickRef = useRef(false);
  const lang1CheckboxRef = useRef<HTMLInputElement | null>(null);
  const lang2CheckboxRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setInlineInsertAnchor(null);
    setInlineLang1('');
    setInlineLang2('');
    setEditingSegment(null);
  }, [note.id]);

  useEffect(() => {
    saveColumnWidths(colWidths);
  }, [colWidths]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsCompactViewport(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const handleToggleColumn1 = (checked: boolean) => {
    onToggleShowLang1(checked);
  };

  const handleToggleColumn2 = (checked: boolean) => {
    onToggleShowLang2(checked);
  };

  // Compute display rows according to orderMode + onlyStarred (random shuffles only within each section)
  const renderRows = useMemo<RenderRow[]>(() => {
    const orderedItems =
      orderMode === 'random' ? shuffleWithinSegments(note.items, randomSeed) : note.items;

    const result: RenderRow[] = [];
    let entryNum = 1;
    let segNum = 1;

    if (!onlyStarred) {
      for (const item of orderedItems) {
        if (item.kind === 'segment') {
          result.push({
            kind: 'segment',
            id: item.id,
            title: item.title,
            segmentIndex: segNum++,
          });
        } else {
          result.push({
            kind: 'entry',
            entry: item,
            displayIndex: entryNum++,
          });
        }
      }
      return result;
    }

    // When filtering only starred, keep segments that actually contain starred items
    let pendingSegment: { id: string; title: string; segmentIndex: number } | null = null;
    for (const item of orderedItems) {
      if (item.kind === 'segment') {
        pendingSegment = { id: item.id, title: item.title, segmentIndex: segNum++ };
      } else if (item.starred) {
        if (pendingSegment) {
          result.push({ kind: 'segment', ...pendingSegment });
          pendingSegment = null;
        }
        result.push({
          kind: 'entry',
          entry: item,
          displayIndex: entryNum++,
        });
      }
    }
    return result;
  }, [note.items, orderMode, randomSeed, onlyStarred]);

  const visibleEntryIds = useMemo(
    () =>
      renderRows
        .filter((r): r is Extract<RenderRow, { kind: 'entry' }> => r.kind === 'entry')
        .map((r) => r.entry.id),
    [renderRows],
  );

  const col1CheckState = useMemo(
    () => getColumnCheckState(visibleEntryIds, showLang1, cellOverrides, 'lang1'),
    [visibleEntryIds, showLang1, cellOverrides],
  );

  const col2CheckState = useMemo(
    () => getColumnCheckState(visibleEntryIds, showLang2, cellOverrides, 'lang2'),
    [visibleEntryIds, showLang2, cellOverrides],
  );

  useEffect(() => {
    if (lang1CheckboxRef.current) {
      lang1CheckboxRef.current.indeterminate = col1CheckState === 'indeterminate';
    }
  }, [col1CheckState]);

  useEffect(() => {
    if (lang2CheckboxRef.current) {
      lang2CheckboxRef.current.indeterminate = col2CheckState === 'indeterminate';
    }
  }, [col2CheckState]);

  const clearCellLongPress = () => {
    if (cellLongPressTimerRef.current !== null) {
      window.clearTimeout(cellLongPressTimerRef.current);
      cellLongPressTimerRef.current = null;
    }
    cellPointerOriginRef.current = null;
    setPressingCellKey(null);
  };

  const handleCellPointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    entry: NoteEntryItem,
    field: 'lang1' | 'lang2',
  ) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (isMultiSelectMode) return;

    clearCellLongPress();
    const cellKey = `${entry.id}:${field}`;
    cellPointerOriginRef.current = { x: e.clientX, y: e.clientY };
    setPressingCellKey(cellKey);

    cellLongPressTimerRef.current = window.setTimeout(() => {
      cellLongPressTimerRef.current = null;
      cellPointerOriginRef.current = null;
      setPressingCellKey(null);
      suppressCellClickRef.current = true;
      onRequestEditEntry(entry, field);
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(20);
      }
      window.setTimeout(() => {
        suppressCellClickRef.current = false;
      }, 400);
    }, LONG_PRESS_MS);
  };

  const handleCellPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!cellPointerOriginRef.current) return;
    const dx = Math.abs(e.clientX - cellPointerOriginRef.current.x);
    const dy = Math.abs(e.clientY - cellPointerOriginRef.current.y);
    if (dx > 8 || dy > 8) {
      clearCellLongPress();
    }
  };

  const handleCellClick = (
    e: React.MouseEvent<HTMLButtonElement>,
    entryId: string,
    field: 'lang1' | 'lang2',
  ) => {
    if (suppressCellClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressCellClickRef.current = false;
      return;
    }
    if (isMultiSelectMode) {
      return;
    }
    e.stopPropagation();
    onToggleCellVisibility(entryId, field);
  };

  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>, entryId: string) => {
    if (isMultiSelectMode) {
      const target = e.target as HTMLElement;
      if (target.closest('[data-no-longpress="true"]')) return;
      onToggleSelectRow(entryId);
    }
  };

  const commitSegmentEdit = () => {
    if (!editingSegment) return;
    onUpdateSegmentTitle(editingSegment.id, editingSegment.value.trim());
    setEditingSegment(null);
  };

  const commitColLabel = (field: 'lang1' | 'lang2') => {
    const trimmed = colLabelDraft.trim();
    if (trimmed) {
      if (field === 'lang1') {
        onUpdateColumnLabels(trimmed, note.lang2Label);
      } else {
        onUpdateColumnLabels(note.lang1Label, trimmed);
      }
    }
    setEditingColLabel(null);
  };

  const clearColLabelLongPress = () => {
    if (colLabelTimerRef.current !== null) {
      window.clearTimeout(colLabelTimerRef.current);
      colLabelTimerRef.current = null;
    }
    colLabelOriginRef.current = null;
  };

  const handleColLabelPointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    field: 'lang1' | 'lang2',
  ) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    clearColLabelLongPress();
    colLabelOriginRef.current = { x: e.clientX, y: e.clientY };

    colLabelTimerRef.current = window.setTimeout(() => {
      colLabelTimerRef.current = null;
      colLabelOriginRef.current = null;
      suppressColLabelClickRef.current = true;
      setColLabelDraft(field === 'lang1' ? note.lang1Label : note.lang2Label);
      setEditingColLabel(field);
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(20);
      }
      window.setTimeout(() => {
        suppressColLabelClickRef.current = false;
      }, 350);
    }, LONG_PRESS_MS);
  };

  const handleColLabelPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!colLabelOriginRef.current) return;
    const dx = Math.abs(e.clientX - colLabelOriginRef.current.x);
    const dy = Math.abs(e.clientY - colLabelOriginRef.current.y);
    if (dx > 8 || dy > 8) {
      clearColLabelLongPress();
    }
  };

  const handleColLabelClick = (field: 'lang1' | 'lang2') => {
    if (suppressColLabelClickRef.current) {
      return;
    }
    if (field === 'lang1') {
      handleToggleColumn1(col1CheckState !== 'checked');
    } else {
      handleToggleColumn2(col2CheckState !== 'checked');
    }
  };

  const startColumnResize = (key: ColumnKey, e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const baseWidths: ColumnWidths = colWidths ?? {
      index: Math.round(thRefs.current.index?.getBoundingClientRect().width ?? 96),
      star: Math.round(thRefs.current.star?.getBoundingClientRect().width ?? 128),
      lang1: Math.round(thRefs.current.lang1?.getBoundingClientRect().width ?? 420),
      lang2: Math.round(thRefs.current.lang2?.getBoundingClientRect().width ?? 420),
    };

    const startX = e.clientX;
    const startWidth = baseWidths[key];
    setColWidths(baseWidths);
    setResizingCol(key);

    const handleMove = (moveEv: PointerEvent) => {
      const deltaX = moveEv.clientX - startX;
      setColWidths(resizeColumnWidth(baseWidths, key, startWidth, deltaX));
    };

    const handleUp = () => {
      setResizingCol(null);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  };

  const resetColumnWidths = () => {
    setColWidths(null);
  };

  const renderResizeHandle = (key: ColumnKey, label: string) => (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label} column`}
      title="Drag to resize column (double-click to reset)"
      onPointerDown={(e) => startColumnResize(key, e)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        resetColumnWidths();
      }}
      className={`hidden md:block absolute top-0 right-0 z-20 h-full w-2.5 cursor-col-resize touch-none select-none transition-colors ${
        resizingCol === key
          ? 'bg-blue-500/35'
          : 'hover:bg-blue-500/20'
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-2 bottom-2 right-0 w-px ${
          resizingCol === key ? 'bg-blue-600' : 'bg-slate-200'
        }`}
      />
    </div>
  );

  const openInlineInsert = (anchorId: string) => {
    setInlineInsertAnchor(anchorId);
    setInlineLang1('');
    setInlineLang2('');
    window.requestAnimationFrame(() => {
      inlineLang1Ref.current?.focus();
    });
  };

  const closeInlineInsert = () => {
    setInlineInsertAnchor(null);
    setInlineLang1('');
    setInlineLang2('');
  };

  const submitInlineInsert = () => {
    if (!inlineInsertAnchor) return;
    const l1 = inlineLang1.trim();
    const l2 = inlineLang2.trim();
    if (!l1 && !l2) return;
    const newId = onInsertEntryAt(l1 || '(Empty)', l2 || '(Empty)', inlineInsertAnchor);
    setInlineInsertAnchor(newId);
    setInlineLang1('');
    setInlineLang2('');
    window.requestAnimationFrame(() => {
      inlineLang1Ref.current?.focus();
    });
  };

  const insertInlineSegment = () => {
    if (!inlineInsertAnchor) return;
    const newSegId = onInsertSegmentAt(inlineInsertAnchor);
    setInlineInsertAnchor(newSegId);
    window.requestAnimationFrame(() => {
      inlineLang1Ref.current?.focus();
    });
  };

  const visibleColCount = getVisibleColumnCount({
    index: showIndexCol,
    star: showStarCol,
  });

  const renderInlineInsertRow = () => (
    <tr
      data-testid="inline-insert-row"
      className="border-y border-blue-200 bg-blue-50/60"
    >
      {isCompactViewport ? (
        <td colSpan={visibleColCount} className="p-3 align-middle">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-blue-600 text-[10px] font-bold text-white">
                  +
                </span>
                New Row
              </span>
              <button
                type="button"
                aria-label="Cancel insert"
                onClick={closeInlineInsert}
                className="rounded-md p-1 text-slate-500 hover:bg-blue-100 hover:text-slate-800"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <input
              ref={inlineLang1Ref}
              type="text"
              value={inlineLang1}
              onChange={(e) => setInlineLang1(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitInlineInsert();
                } else if (e.key === 'Escape') {
                  closeInlineInsert();
                }
              }}
              aria-label={`Insert ${note.lang1Label} here`}
              placeholder={`Enter ${note.lang1Label} (Lang 1)...`}
              className="w-full min-w-0 rounded-md border border-blue-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
            />
            <input
              type="text"
              value={inlineLang2}
              onChange={(e) => setInlineLang2(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitInlineInsert();
                } else if (e.key === 'Escape') {
                  closeInlineInsert();
                }
              }}
              aria-label={`Insert ${note.lang2Label} here`}
              placeholder={`Enter ${note.lang2Label} (Lang 2)...`}
              className="w-full min-w-0 rounded-md border border-blue-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!inlineLang1.trim() && !inlineLang2.trim()}
                onClick={submitInlineInsert}
                className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Add Row
              </button>
              <button
                type="button"
                onClick={insertInlineSegment}
                title="Insert section [] here"
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                + Section []
              </button>
            </div>
          </div>
        </td>
      ) : (
        <>
          {showIndexCol && (
            <td className="px-2 py-2 text-center align-middle">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-blue-600 text-[11px] font-bold text-white">
                +
              </span>
            </td>
          )}
          {showStarCol && (
            <td className="px-3 py-2 text-center align-middle">
              <span className="text-[11px] font-medium text-blue-700">New Row</span>
            </td>
          )}
          <td className="px-4 py-2 align-middle">
            <input
              ref={inlineLang1Ref}
              type="text"
              value={inlineLang1}
              onChange={(e) => setInlineLang1(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitInlineInsert();
                } else if (e.key === 'Escape') {
                  closeInlineInsert();
                }
              }}
              aria-label={`Insert ${note.lang1Label} here`}
              placeholder={`Enter ${note.lang1Label} (Lang 1)...`}
              className="w-full rounded-md border border-blue-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
            />
          </td>
          <td className="px-4 py-2 align-middle">
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="text"
                value={inlineLang2}
                onChange={(e) => setInlineLang2(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submitInlineInsert();
                  } else if (e.key === 'Escape') {
                    closeInlineInsert();
                  }
                }}
                aria-label={`Insert ${note.lang2Label} here`}
                placeholder={`Enter ${note.lang2Label} (Lang 2)...`}
                className="min-w-[140px] flex-1 rounded-md border border-blue-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
              />
              <button
                type="button"
                disabled={!inlineLang1.trim() && !inlineLang2.trim()}
                onClick={submitInlineInsert}
                className="rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap shrink-0"
              >
                Add Row
              </button>
              <button
                type="button"
                onClick={insertInlineSegment}
                title="Insert section [] here"
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                + Section []
              </button>
              <button
                type="button"
                aria-label="Cancel insert"
                onClick={closeInlineInsert}
                className="rounded-md p-1.5 text-slate-500 hover:bg-blue-100 hover:text-slate-800"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </td>
        </>
      )}
    </tr>
  );

  const renderLanguageCell = (
    entry: NoteEntryItem,
    field: 'lang1' | 'lang2',
    displayIndex: number,
  ) => {
    const isColumnShown = field === 'lang1' ? showLang1 : showLang2;
    const cellKey = `${entry.id}:${field}`;
    const isTextVisible = isCellVisible(entry.id, field, isColumnShown, cellOverrides);
    const textValue = field === 'lang1' ? entry.lang1 : entry.lang2;
    const colTitle = field === 'lang1' ? note.lang1Label : note.lang2Label;
    const isPressingCell = pressingCellKey === cellKey;

    if (!isTextVisible) {
      return (
        <button
          type="button"
          onPointerDown={(e) => handleCellPointerDown(e, entry, field)}
          onPointerMove={handleCellPointerMove}
          onPointerUp={clearCellLongPress}
          onPointerCancel={clearCellLongPress}
          onPointerLeave={clearCellLongPress}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => handleCellClick(e, entry.id, field)}
          aria-label={`Show row ${displayIndex} ${colTitle}`}
          title="Click to show · Long-press to edit"
          className={`group/mask flex min-h-9 w-full min-w-0 select-none items-center justify-between rounded-md border border-dashed px-2 py-1.5 text-left text-xs transition-colors md:px-3 ${
            isPressingCell
              ? 'border-blue-400 bg-blue-100/80 text-blue-700'
              : 'border-slate-200 bg-slate-100/90 text-slate-400 hover:border-slate-300 hover:bg-slate-200/70 hover:text-slate-600'
          }`}
        >
          <span className="select-none tracking-widest">••••••</span>
          <span className="hidden opacity-0 transition-opacity group-hover/mask:opacity-100 sm:inline">
            Click to show
          </span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onPointerDown={(e) => handleCellPointerDown(e, entry, field)}
        onPointerMove={handleCellPointerMove}
        onPointerUp={clearCellLongPress}
        onPointerCancel={clearCellLongPress}
        onPointerLeave={clearCellLongPress}
        onContextMenu={(e) => e.preventDefault()}
        onClick={(e) => handleCellClick(e, entry.id, field)}
        aria-label={`Hide row ${displayIndex} ${colTitle}: ${textValue}`}
        title="Click to hide · Long-press to edit"
        className={`min-h-9 w-full min-w-0 select-none rounded-md px-1.5 py-1.5 text-left text-[13px] leading-relaxed text-slate-900 transition-colors whitespace-pre-wrap break-words [overflow-wrap:anywhere] md:px-2 md:text-sm ${
          isPressingCell ? 'bg-blue-100/70' : 'hover:bg-slate-100/80'
        }`}
      >
        {textValue}
      </button>
    );
  };

  const activeColWidths = isCompactViewport ? null : colWidths;
  const totalTableWidth = activeColWidths
    ? (showIndexCol ? activeColWidths.index : 0) +
      (showStarCol ? activeColWidths.star : 0) +
      activeColWidths.lang1 +
      activeColWidths.lang2
    : undefined;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white">
      <div className="flex-1 overflow-auto">
        <table
          width={totalTableWidth}
          className={`table-fixed border-collapse text-left ${
            activeColWidths ? 'min-w-full' : 'w-full'
          }`}
        >
          <colgroup>
            {showIndexCol && (
              <col
                width={activeColWidths?.index}
                className={activeColWidths ? undefined : 'w-10 md:w-14'}
              />
            )}
            {showStarCol && (
              <col
                width={activeColWidths?.star}
                className={activeColWidths ? undefined : 'w-14 md:w-22'}
              />
            )}
            <col width={activeColWidths?.lang1} />
            <col width={activeColWidths?.lang2} />
          </colgroup>
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur-xs">
            <tr className="text-[11px] font-semibold text-slate-600 md:text-xs">
              {/* Column 1: # (checkbox column header, no index numbers or +) */}
              {showIndexCol && (
                <th
                  ref={(el) => {
                    thRefs.current.index = el;
                  }}
                  scope="col"
                  className="relative px-1 py-2 text-center md:px-2 md:py-2.5"
                >
                  <span>#</span>
                  {renderResizeHandle('index', 'Index')}
                </th>
              )}

              {/* Column 2: Star + Single-Row Filter Checkbox */}
              {showStarCol && (
                <th
                  ref={(el) => {
                    thRefs.current.star = el;
                  }}
                  scope="col"
                  className="relative px-1 py-2 text-center md:px-3 md:py-2.5"
                >
                  <label
                    title="Show starred entries only"
                    className="inline-flex cursor-pointer items-center justify-center gap-1 font-semibold text-slate-600 hover:text-slate-900 whitespace-nowrap md:gap-1.5"
                  >
                    <input
                      type="checkbox"
                      checked={onlyStarred}
                      onChange={(e) => onToggleOnlyStarred(e.target.checked)}
                      aria-label="Star"
                      className="h-3.5 w-3.5 rounded border-slate-300 accent-amber-600"
                    />
                    <span>Star</span>
                  </label>
                  {renderResizeHandle('star', 'Star')}
                </th>
              )}

              {/* Column 3: Lang 1 + Checkbox */}
              <th
                ref={(el) => {
                  thRefs.current.lang1 = el;
                }}
                scope="col"
                className="relative px-2 py-2 md:px-4 md:py-2.5"
              >
                <div className="flex min-w-0 items-center gap-1.5 pr-1">
                  <input
                    ref={lang1CheckboxRef}
                    type="checkbox"
                    checked={col1CheckState === 'checked'}
                    aria-checked={col1CheckState === 'indeterminate' ? 'mixed' : col1CheckState === 'checked'}
                    onChange={() => handleToggleColumn1(col1CheckState !== 'checked')}
                    title={
                      col1CheckState === 'checked'
                        ? `Hide ${note.lang1Label} text`
                        : `Show all ${note.lang1Label} text`
                    }
                    aria-label={`Show ${note.lang1Label} text`}
                    className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-slate-300 accent-blue-600"
                  />
                  {editingColLabel === 'lang1' ? (
                    <input
                      type="text"
                      autoFocus
                      value={colLabelDraft}
                      onChange={(e) => setColLabelDraft(e.target.value)}
                      onBlur={() => commitColLabel('lang1')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitColLabel('lang1');
                        if (e.key === 'Escape') setEditingColLabel(null);
                      }}
                      className="min-w-0 w-full max-w-32 rounded border border-blue-400 bg-white px-1.5 py-0.5 text-xs text-slate-900 outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onPointerDown={(e) => handleColLabelPointerDown(e, 'lang1')}
                      onPointerMove={handleColLabelPointerMove}
                      onPointerUp={clearColLabelLongPress}
                      onPointerCancel={clearColLabelLongPress}
                      onPointerLeave={clearColLabelLongPress}
                      onClick={() => handleColLabelClick('lang1')}
                      title="Click to toggle text visibility · Long-press to rename column"
                      className="min-w-0 flex-1 select-none text-left leading-snug whitespace-normal break-words [overflow-wrap:anywhere] hover:text-blue-600"
                    >
                      Lang 1 ({note.lang1Label})
                    </button>
                  )}
                </div>
                {renderResizeHandle('lang1', 'Language 1')}
              </th>

              {/* Column 4: Lang 2 + Checkbox only + Show Header button if hidden */}
              <th
                ref={(el) => {
                  thRefs.current.lang2 = el;
                }}
                scope="col"
                className="relative px-2 py-2 md:px-4 md:py-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5 pr-1">
                  <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <input
                      ref={lang2CheckboxRef}
                      type="checkbox"
                      checked={col2CheckState === 'checked'}
                      aria-checked={
                        col2CheckState === 'indeterminate' ? 'mixed' : col2CheckState === 'checked'
                      }
                      onChange={() => handleToggleColumn2(col2CheckState !== 'checked')}
                      title={
                        col2CheckState === 'checked'
                          ? `Hide ${note.lang2Label} text`
                          : `Show all ${note.lang2Label} text`
                      }
                      aria-label={`Show ${note.lang2Label} text`}
                      className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-slate-300 accent-blue-600"
                    />
                    {editingColLabel === 'lang2' ? (
                      <input
                        type="text"
                        autoFocus
                        value={colLabelDraft}
                        onChange={(e) => setColLabelDraft(e.target.value)}
                        onBlur={() => commitColLabel('lang2')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitColLabel('lang2');
                          if (e.key === 'Escape') setEditingColLabel(null);
                        }}
                        className="min-w-0 w-full max-w-32 rounded border border-blue-400 bg-white px-1.5 py-0.5 text-xs text-slate-900 outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onPointerDown={(e) => handleColLabelPointerDown(e, 'lang2')}
                        onPointerMove={handleColLabelPointerMove}
                        onPointerUp={clearColLabelLongPress}
                        onPointerCancel={clearColLabelLongPress}
                        onPointerLeave={clearColLabelLongPress}
                        onClick={() => handleColLabelClick('lang2')}
                        title="Click to toggle text visibility · Long-press to rename column"
                        className="min-w-0 flex-1 select-none text-left leading-snug whitespace-normal break-words [overflow-wrap:anywhere] hover:text-blue-600"
                      >
                        Lang 2 ({note.lang2Label})
                      </button>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {isHeaderHidden && (
                      <button
                        type="button"
                        title="Show top toolbar"
                        aria-label="Show header"
                        onClick={onShowHeader}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0 md:px-2 md:py-1"
                      >
                        <PanelTopOpen className="h-3.5 w-3.5 text-slate-500" />
                        <span className="hidden sm:inline">Show Header</span>
                      </button>
                    )}
                    {!isMultiSelectMode && (
                      <button
                        type="button"
                        title="Insert at top of table"
                        aria-label="Insert row at top"
                        onClick={() => openInlineInsert(INSERT_AT_TOP)}
                        className="shrink-0 rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {renderResizeHandle('lang2', 'Language 2')}
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {inlineInsertAnchor === INSERT_AT_TOP && renderInlineInsertRow()}

            {renderRows.length === 0 && inlineInsertAnchor !== INSERT_AT_TOP && (
              <tr>
                <td colSpan={visibleColCount} className="px-6 py-16 text-center">
                  <div className="mx-auto max-w-md space-y-3">
                    <p className="text-sm font-medium text-slate-700">
                      {onlyStarred ? 'No starred entries in this note' : 'No entries in this note yet'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {onlyStarred
                        ? 'Uncheck "Star" in the header, or click a star icon to bookmark entries.'
                        : 'Use + in the table header or the buttons below to add rows, insert sections [], or paste import.'}
                    </p>
                    {!onlyStarred && (
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => openInlineInsert(INSERT_AT_TOP)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add First Row
                        </button>
                        <button
                          type="button"
                          onClick={() => onInsertSegmentAt(null)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <SplitSquareVertical className="h-3.5 w-3.5 text-slate-500" />
                          Add Section []
                        </button>
                        <button
                          type="button"
                          onClick={onOpenPasteImport}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <ClipboardPaste className="h-3.5 w-3.5 text-slate-500" />
                          Paste Import
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {renderRows.map((row) => {
              if (row.kind === 'segment') {
                const isEditingSeg = editingSegment?.id === row.id;
                return (
                  <React.Fragment key={row.id}>
                    <tr className="group/seg border-y border-slate-200 bg-slate-50/80">
                      <td colSpan={visibleColCount} className="px-4 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono-tabular text-xs font-medium text-slate-400">
                              []
                            </span>
                            {isEditingSeg ? (
                              <input
                                type="text"
                                autoFocus
                                value={editingSegment.value}
                                onChange={(e) =>
                                  setEditingSegment({ id: row.id, value: e.target.value })
                                }
                                onBlur={commitSegmentEdit}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitSegmentEdit();
                                  if (e.key === 'Escape') setEditingSegment(null);
                                }}
                                placeholder={`Section ${row.segmentIndex} title (optional)`}
                                className="w-64 rounded border border-blue-400 bg-white px-2 py-0.5 text-xs font-medium text-slate-800 outline-none"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingSegment({ id: row.id, value: row.title })
                                }
                                className="text-xs font-semibold text-slate-600 hover:text-blue-600"
                              >
                                {row.title || `Section ${row.segmentIndex}`}
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            {!isMultiSelectMode && (
                              <button
                                type="button"
                                title="Insert row below this section"
                                aria-label={`Insert below section ${row.title || row.segmentIndex}`}
                                onClick={() => openInlineInsert(row.id)}
                                className="rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              aria-label={`Delete section ${row.title || row.segmentIndex}`}
                              onClick={() =>
                                onRequestDeleteSegment({
                                  id: row.id,
                                  title: row.title,
                                  segmentIndex: row.segmentIndex,
                                })
                              }
                              className="rounded p-1 text-slate-400 opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600 md:opacity-0 md:group-hover/seg:opacity-100 md:focus-visible:opacity-100"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                    {inlineInsertAnchor === row.id && renderInlineInsertRow()}
                  </React.Fragment>
                );
              }

              const { entry, displayIndex } = row;
              const isSelected = selectedIds.has(entry.id);
              const selectionCheckbox = (
                <span
                  aria-hidden="true"
                  className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors ${
                    isSelected
                      ? 'border-2 border-blue-700 bg-blue-100 text-slate-950'
                      : 'border border-slate-500 bg-white'
                  }`}
                >
                  {isSelected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
              );

              return (
                <React.Fragment key={entry.id}>
                  <tr
                    data-entry-id={entry.id}
                    data-selected={isSelected ? 'true' : 'false'}
                    onClick={(e) => handleRowClick(e, entry.id)}
                    className={`group/row transition-colors ${
                      isSelected ? 'bg-blue-50/85 hover:bg-blue-50' : 'hover:bg-slate-50/70'
                    } ${isMultiSelectMode ? 'cursor-pointer select-none' : ''}`}
                  >
                    {/* Column 1: # (always directly shows row selection checkbox) */}
                    {showIndexCol && (
                      <td className="px-1 py-1.5 text-center align-middle md:px-2 md:py-2">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={isSelected}
                          aria-label={
                            isSelected ? `Deselect row ${displayIndex}` : `Select row ${displayIndex}`
                          }
                          data-no-longpress="true"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleSelectRow(entry.id);
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
                        >
                          {selectionCheckbox}
                        </button>
                      </td>
                    )}

                    {/* Column 2: Star */}
                    {showStarCol && (
                      <td className="px-1 py-2 text-center align-middle md:px-3 md:py-2.5">
                        <button
                          type="button"
                          data-no-longpress="true"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleStar(entry.id);
                          }}
                          aria-label={
                            entry.starred
                              ? `Unstar row ${displayIndex}`
                              : `Star row ${displayIndex}`
                          }
                          aria-pressed={entry.starred}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                            entry.starred
                              ? 'text-amber-500 hover:bg-amber-50'
                              : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500'
                          }`}
                        >
                          <Star
                            className="h-4 w-4"
                            fill={entry.starred ? 'currentColor' : 'none'}
                          />
                        </button>
                      </td>
                    )}

                    {/* Column 3: Lang 1 */}
                    <td className="px-1.5 py-2 align-middle md:px-4">
                      {!showIndexCol && isMultiSelectMode ? (
                        <div className="flex min-w-0 items-center gap-2">
                          {selectionCheckbox}
                          <div className="min-w-0 flex-1">
                            {renderLanguageCell(entry, 'lang1', displayIndex)}
                          </div>
                        </div>
                      ) : (
                        renderLanguageCell(entry, 'lang1', displayIndex)
                      )}
                    </td>

                    {/* Column 4: Lang 2 + Permanent Far-Right + */}
                    <td className="px-1.5 py-2 align-middle md:px-4">
                      <div className="flex min-w-0 items-start gap-1">
                        <div className="min-w-0 flex-1">
                          {renderLanguageCell(entry, 'lang2', displayIndex)}
                        </div>
                        {!isMultiSelectMode && (
                          <button
                            type="button"
                            data-no-longpress="true"
                            title="Insert below this row"
                            aria-label={`Insert below row ${displayIndex}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              openInlineInsert(entry.id);
                            }}
                            className="mt-1.5 shrink-0 rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {inlineInsertAnchor === entry.id && renderInlineInsertRow()}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
