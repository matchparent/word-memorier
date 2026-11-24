import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ClipboardPaste,
  EyeOff,
  PanelTopOpen,
  Plus,
  SplitSquareVertical,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import type { DisplayOrderMode, NoteEntryItem, NoteFile } from '../types/notebook';
import { INSERT_AT_TOP, shuffleWithSeed } from '../utils/noteParser';
import {
  type ColumnKey,
  type ColumnWidths,
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
  onlyStarred: boolean;
  isMultiSelectMode: boolean;
  selectedIds: Set<string>;
  isHeaderHidden: boolean;
  onShowHeader: () => void;
  onToggleShowLang1: (show: boolean) => void;
  onToggleShowLang2: (show: boolean) => void;
  onToggleOnlyStarred: (only: boolean) => void;
  onUpdateColumnLabels: (lang1Label: string, lang2Label: string) => void;
  onToggleStar: (entryId: string) => void;
  onUpdateEntry: (entryId: string, field: 'lang1' | 'lang2', value: string) => void;
  onUpdateSegmentTitle: (segmentId: string, title: string) => void;
  onDeleteSegment: (segmentId: string) => void;
  onInsertEntryAt: (lang1: string, lang2: string, afterItemId: string | null) => string;
  onInsertSegmentAt: (afterItemId: string | null) => string;
  onOpenPasteImport: () => void;
  onEnterMultiSelectWithRow: (entryId: string) => void;
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
  onlyStarred,
  isMultiSelectMode,
  selectedIds,
  isHeaderHidden,
  onShowHeader,
  onToggleShowLang1,
  onToggleShowLang2,
  onToggleOnlyStarred,
  onUpdateColumnLabels,
  onToggleStar,
  onUpdateEntry,
  onUpdateSegmentTitle,
  onDeleteSegment,
  onInsertEntryAt,
  onInsertSegmentAt,
  onOpenPasteImport,
  onEnterMultiSelectWithRow,
  onToggleSelectRow,
}) => {
  // Temporarily revealed individual cells when column is hidden
  const [revealedCells, setRevealedCells] = useState<Set<string>>(() => new Set());
  // Currently editing cell
  const [editingCell, setEditingCell] = useState<{
    id: string;
    field: 'lang1' | 'lang2';
    value: string;
  } | null>(null);
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

  // Draggable column widths
  const [colWidths, setColWidths] = useState<ColumnWidths | null>(() => loadSavedColumnWidths());
  const [resizingCol, setResizingCol] = useState<ColumnKey | null>(null);
  const thRefs = useRef<Record<ColumnKey, HTMLTableCellElement | null>>({
    index: null,
    star: null,
    lang1: null,
    lang2: null,
  });

  // Long-press handling refs
  const longPressTimerRef = useRef<number | null>(null);
  const pointerOriginRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const [pressingRowId, setPressingRowId] = useState<string | null>(null);

  useEffect(() => {
    setInlineInsertAnchor(null);
    setInlineLang1('');
    setInlineLang2('');
    setEditingCell(null);
    setEditingSegment(null);
    setRevealedCells(new Set());
  }, [note.id]);

  useEffect(() => {
    saveColumnWidths(colWidths);
  }, [colWidths]);

  const handleToggleColumn1 = (checked: boolean) => {
    setRevealedCells((prev) => {
      const next = new Set(prev);
      for (const key of next) {
        if (key.endsWith(':lang1')) next.delete(key);
      }
      return next;
    });
    onToggleShowLang1(checked);
  };

  const handleToggleColumn2 = (checked: boolean) => {
    setRevealedCells((prev) => {
      const next = new Set(prev);
      for (const key of next) {
        if (key.endsWith(':lang2')) next.delete(key);
      }
      return next;
    });
    onToggleShowLang2(checked);
  };

  // Compute display rows according to orderMode + onlyStarred
  const renderRows = useMemo<RenderRow[]>(() => {
    if (orderMode === 'random') {
      const entries = note.items.filter((it): it is NoteEntryItem => it.kind === 'entry');
      const shuffled = shuffleWithSeed(entries, randomSeed);
      const filtered = onlyStarred ? shuffled.filter((e) => e.starred) : shuffled;
      return filtered.map((entry, idx) => ({
        kind: 'entry',
        entry,
        displayIndex: idx + 1,
      }));
    }

    // Sequential mode: preserve [] segments
    const result: RenderRow[] = [];
    let entryNum = 1;
    let segNum = 1;

    if (!onlyStarred) {
      for (const item of note.items) {
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

    // When filtering only starred in sequential mode, show segments that actually contain starred items
    let pendingSegment: { id: string; title: string; segmentIndex: number } | null = null;
    for (const item of note.items) {
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

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pointerOriginRef.current = null;
    setPressingRowId(null);
  };

  const handleRowPointerDown = (e: React.PointerEvent<HTMLTableRowElement>, entryId: string) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const target = e.target as HTMLElement;
    if (
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('[data-no-longpress="true"]')
    ) {
      return;
    }
    if (isMultiSelectMode) return;

    clearLongPress();
    pointerOriginRef.current = { x: e.clientX, y: e.clientY };
    setPressingRowId(entryId);

    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      setPressingRowId(null);
      suppressClickRef.current = true;
      onEnterMultiSelectWithRow(entryId);
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(20);
      }
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 350);
    }, LONG_PRESS_MS);
  };

  const handleRowPointerMove = (e: React.PointerEvent<HTMLTableRowElement>) => {
    if (!pointerOriginRef.current) return;
    const dx = Math.abs(e.clientX - pointerOriginRef.current.x);
    const dy = Math.abs(e.clientY - pointerOriginRef.current.y);
    if (dx > 8 || dy > 8) {
      clearLongPress();
    }
  };

  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>, entryId: string) => {
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (isMultiSelectMode) {
      const target = e.target as HTMLElement;
      if (target.closest('[data-no-longpress="true"]')) return;
      onToggleSelectRow(entryId);
    }
  };

  const commitCellEdit = () => {
    if (!editingCell) return;
    const trimmed = editingCell.value.trim();
    if (trimmed) {
      onUpdateEntry(editingCell.id, editingCell.field, trimmed);
    }
    setEditingCell(null);
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
      className={`absolute top-0 right-0 z-20 h-full w-2.5 cursor-col-resize touch-none select-none transition-colors ${
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

  const renderInlineInsertRow = () => (
    <tr
      data-testid="inline-insert-row"
      className="border-y border-blue-200 bg-blue-50/60"
    >
      <td className="px-2 py-2 text-center align-middle">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-blue-600 text-[11px] font-bold text-white">
          +
        </span>
      </td>
      <td className="px-3 py-2 text-center align-middle">
        <span className="text-[11px] font-medium text-blue-700">New Row</span>
      </td>
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
    </tr>
  );

  const renderLanguageCell = (
    entry: NoteEntryItem,
    field: 'lang1' | 'lang2',
    displayIndex: number,
  ) => {
    const isColumnShown = field === 'lang1' ? showLang1 : showLang2;
    const cellKey = `${entry.id}:${field}`;
    const isIndividuallyRevealed = revealedCells.has(cellKey);
    const isTextVisible = isColumnShown || isIndividuallyRevealed;
    const textValue = field === 'lang1' ? entry.lang1 : entry.lang2;
    const colTitle = field === 'lang1' ? note.lang1Label : note.lang2Label;

    const isEditing = editingCell?.id === entry.id && editingCell?.field === field;

    if (isEditing) {
      return (
        <textarea
          autoFocus
          rows={Math.min(4, Math.max(1, textValue.split('\n').length))}
          value={editingCell.value}
          onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
          onBlur={commitCellEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              commitCellEdit();
            } else if (e.key === 'Escape') {
              setEditingCell(null);
            }
          }}
          aria-label={`Edit row ${displayIndex} ${colTitle}`}
          className="w-full resize-none rounded-md border border-blue-500 bg-white px-2.5 py-1.5 text-sm leading-relaxed text-slate-900 outline-none ring-2 ring-blue-500/15"
        />
      );
    }

    if (!isTextVisible) {
      return (
        <button
          type="button"
          onClick={(e) => {
            if (suppressClickRef.current || isMultiSelectMode) return;
            e.stopPropagation();
            setRevealedCells((prev) => {
              const next = new Set(prev);
              next.add(cellKey);
              return next;
            });
          }}
          aria-label={`Reveal row ${displayIndex} ${colTitle}`}
          className="group/mask flex min-h-9 w-full items-center justify-between rounded-md border border-dashed border-slate-200 bg-slate-100/90 px-3 py-1.5 text-left text-xs text-slate-400 transition-colors hover:border-slate-300 hover:bg-slate-200/70 hover:text-slate-600"
        >
          <span className="select-none tracking-widest">••••••</span>
          <span className="opacity-0 transition-opacity group-hover/mask:opacity-100">
            Click to reveal
          </span>
        </button>
      );
    }

    return (
      <div className="group/cell flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={(e) => {
            if (suppressClickRef.current || isMultiSelectMode) return;
            e.stopPropagation();
            setEditingCell({ id: entry.id, field, value: textValue });
          }}
          aria-label={`Edit row ${displayIndex} ${colTitle}: ${textValue}`}
          className="min-h-9 flex-1 rounded-md px-2 py-1.5 text-left text-sm leading-relaxed text-slate-900 transition-colors hover:bg-slate-100/80 whitespace-pre-wrap break-words"
        >
          {textValue}
        </button>

        {!isColumnShown && isIndividuallyRevealed && !isMultiSelectMode && (
          <button
            type="button"
            data-no-longpress="true"
            title="Hide again"
            aria-label={`Hide row ${displayIndex} ${colTitle}`}
            onClick={(e) => {
              e.stopPropagation();
              setRevealedCells((prev) => {
                const next = new Set(prev);
                next.delete(cellKey);
                return next;
              });
            }}
            className="mt-1.5 shrink-0 rounded p-1 text-slate-400 opacity-0 transition-opacity hover:bg-slate-200 hover:text-slate-700 group-hover/cell:opacity-100"
          >
            <EyeOff className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  };

  const totalTableWidth = colWidths
    ? colWidths.index + colWidths.star + colWidths.lang1 + colWidths.lang2
    : undefined;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white">
      <div className="flex-1 overflow-auto">
        <table
          width={totalTableWidth}
          className={`table-fixed border-collapse text-left ${
            colWidths ? 'min-w-full' : 'w-full min-w-[640px]'
          }`}
        >
          <colgroup>
            <col width={colWidths?.index} className={colWidths ? undefined : 'w-24'} />
            <col width={colWidths?.star} className={colWidths ? undefined : 'w-32'} />
            <col width={colWidths?.lang1} />
            <col width={colWidths?.lang2} />
          </colgroup>
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur-xs">
            <tr className="text-xs font-semibold text-slate-600">
              {/* Column 1: # + Insert at Top trigger */}
              <th
                ref={(el) => {
                  thRefs.current.index = el;
                }}
                scope="col"
                className="relative px-3 py-2.5 text-center"
              >
                <div className="inline-flex items-center justify-center gap-1">
                  <span>#</span>
                  {!isMultiSelectMode && (
                    <button
                      type="button"
                      title="Insert at top of table"
                      aria-label="Insert row at top"
                      onClick={() => openInlineInsert(INSERT_AT_TOP)}
                      className="rounded p-0.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {renderResizeHandle('index', 'Index')}
              </th>

              {/* Column 2: Star + Single-Row Filter Checkbox */}
              <th
                ref={(el) => {
                  thRefs.current.star = el;
                }}
                scope="col"
                className="relative px-3 py-2.5 text-center"
              >
                <label
                  title="Show starred entries only"
                  className="inline-flex cursor-pointer items-center justify-center gap-1.5 font-semibold text-slate-600 hover:text-slate-900 whitespace-nowrap"
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

              {/* Column 3: Lang 1 + Top Show/Hide Checkbox */}
              <th
                ref={(el) => {
                  thRefs.current.lang1 = el;
                }}
                scope="col"
                className="relative px-4 py-2.5"
              >
                <div className="flex items-center justify-between gap-2 pr-1">
                  <div className="min-w-0 flex items-center gap-1.5">
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
                        className="w-28 rounded border border-blue-400 bg-white px-1.5 py-0.5 text-xs text-slate-900 outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setColLabelDraft(note.lang1Label);
                          setEditingColLabel('lang1');
                        }}
                        title="Click to rename Language 1 column"
                        className="truncate hover:text-blue-600"
                      >
                        Lang 1 ({note.lang1Label})
                      </button>
                    )}
                  </div>

                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-normal text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0">
                    <input
                      type="checkbox"
                      checked={showLang1}
                      onChange={(e) => handleToggleColumn1(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300 accent-blue-600"
                    />
                    Show text
                  </label>
                </div>
                {renderResizeHandle('lang1', 'Language 1')}
              </th>

              {/* Column 4: Lang 2 + Top Show/Hide Checkbox + Show Header button if hidden */}
              <th
                ref={(el) => {
                  thRefs.current.lang2 = el;
                }}
                scope="col"
                className="relative px-4 py-2.5"
              >
                <div className="flex items-center justify-between gap-2 pr-1">
                  <div className="min-w-0 flex items-center gap-1.5">
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
                        className="w-28 rounded border border-blue-400 bg-white px-1.5 py-0.5 text-xs text-slate-900 outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setColLabelDraft(note.lang2Label);
                          setEditingColLabel('lang2');
                        }}
                        title="Click to rename Language 2 column"
                        className="truncate hover:text-blue-600"
                      >
                        Lang 2 ({note.lang2Label})
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-normal text-slate-600 hover:text-slate-900 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={showLang2}
                        onChange={(e) => handleToggleColumn2(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-slate-300 accent-blue-600"
                      />
                      Show text
                    </label>
                    {isHeaderHidden && (
                      <button
                        type="button"
                        title="Show top toolbar"
                        aria-label="Show header"
                        onClick={onShowHeader}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
                      >
                        <PanelTopOpen className="h-3.5 w-3.5 text-slate-500" />
                        Show Header
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
                <td colSpan={4} className="px-6 py-16 text-center">
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
                      <td colSpan={4} className="px-4 py-2">
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

                          <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:transition-opacity md:group-hover/seg:opacity-100 md:focus-within:opacity-100">
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
                              onClick={() => onDeleteSegment(row.id)}
                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
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
              const isPressing = pressingRowId === entry.id;

              return (
                <React.Fragment key={entry.id}>
                  <tr
                    data-entry-id={entry.id}
                    data-selected={isSelected ? 'true' : 'false'}
                    onPointerDown={(e) => handleRowPointerDown(e, entry.id)}
                    onPointerMove={handleRowPointerMove}
                    onPointerUp={clearLongPress}
                    onPointerCancel={clearLongPress}
                    onPointerLeave={clearLongPress}
                    onClick={(e) => handleRowClick(e, entry.id)}
                    className={`group/row transition-colors ${
                      isSelected
                        ? 'bg-blue-50/85 hover:bg-blue-50'
                        : isPressing
                          ? 'bg-slate-100'
                          : 'hover:bg-slate-50/70'
                    } ${isMultiSelectMode ? 'cursor-pointer select-none' : ''}`}
                  >
                    {/* Column 1: 序号 + Insert Below Row affordance */}
                    <td className="px-3 py-2.5 text-center align-middle">
                      <div className="inline-flex items-center justify-center gap-1.5">
                        {isMultiSelectMode && (
                          <span
                            aria-hidden="true"
                            className={`inline-flex h-4 w-4 items-center justify-center rounded border ${
                              isSelected
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                          </span>
                        )}
                        <span className="font-mono-tabular text-xs font-medium text-slate-500">
                          {displayIndex}
                        </span>
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
                            className="rounded p-0.5 text-slate-400 opacity-75 transition-opacity hover:bg-blue-50 hover:text-blue-600 md:opacity-0 md:group-hover/row:opacity-100 md:focus-visible:opacity-100"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Column 2: Star */}
                    <td className="px-3 py-2.5 text-center align-middle">
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

                    {/* Column 3: 语言1 */}
                    <td className="px-4 py-2 align-middle">
                      {renderLanguageCell(entry, 'lang1', displayIndex)}
                    </td>

                    {/* Column 4: 语言2 */}
                    <td className="px-4 py-2 align-middle">
                      {renderLanguageCell(entry, 'lang2', displayIndex)}
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
