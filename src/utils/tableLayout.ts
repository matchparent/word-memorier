import type { DisplayOrderMode } from '../types/notebook';

export type ColumnKey = 'index' | 'star' | 'lang1' | 'lang2';

export type ColumnWidths = Record<ColumnKey, number>;

export const MIN_COLUMN_WIDTHS: ColumnWidths = {
  index: 48,
  star: 96,
  lang1: 160,
  lang2: 160,
};

export const MAX_COLUMN_WIDTH = 1400;

const COL_WIDTHS_STORAGE_KEY = 'lexnote_col_widths_v1';

export function clampColumnWidth(key: ColumnKey, width: number): number {
  const min = MIN_COLUMN_WIDTHS[key];
  return Math.min(MAX_COLUMN_WIDTH, Math.max(min, Math.round(width)));
}

export function resizeColumnWidth(
  current: ColumnWidths,
  key: ColumnKey,
  startWidth: number,
  deltaX: number,
): ColumnWidths {
  return {
    ...current,
    [key]: clampColumnWidth(key, startWidth + deltaX),
  };
}

export function loadSavedColumnWidths(): ColumnWidths | null {
  try {
    const raw = window.localStorage.getItem(COL_WIDTHS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ColumnWidths>;
    if (
      typeof parsed.index === 'number' &&
      typeof parsed.star === 'number' &&
      typeof parsed.lang1 === 'number' &&
      typeof parsed.lang2 === 'number'
    ) {
      return {
        index: clampColumnWidth('index', parsed.index),
        star: clampColumnWidth('star', parsed.star),
        lang1: clampColumnWidth('lang1', parsed.lang1),
        lang2: clampColumnWidth('lang2', parsed.lang2),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveColumnWidths(widths: ColumnWidths | null): void {
  try {
    if (widths === null) {
      window.localStorage.removeItem(COL_WIDTHS_STORAGE_KEY);
    } else {
      window.localStorage.setItem(COL_WIDTHS_STORAGE_KEY, JSON.stringify(widths));
    }
  } catch {
    // Ignore storage errors
  }
}

export interface ColumnVisibility {
  index: boolean;
  star: boolean;
}

export const DEFAULT_COLUMN_VISIBILITY: ColumnVisibility = {
  index: true,
  star: true,
};

const COL_VISIBILITY_STORAGE_KEY = 'lexnote_col_visibility_v1';

export function getVisibleColumnCount(visibility: ColumnVisibility): number {
  return 2 + (visibility.index ? 1 : 0) + (visibility.star ? 1 : 0);
}

export function loadColumnVisibility(): ColumnVisibility {
  try {
    const raw = window.localStorage.getItem(COL_VISIBILITY_STORAGE_KEY);
    if (!raw) return DEFAULT_COLUMN_VISIBILITY;
    const parsed = JSON.parse(raw) as Partial<ColumnVisibility>;
    return {
      index: typeof parsed.index === 'boolean' ? parsed.index : true,
      star: typeof parsed.star === 'boolean' ? parsed.star : true,
    };
  } catch {
    return DEFAULT_COLUMN_VISIBILITY;
  }
}

export function saveColumnVisibility(visibility: ColumnVisibility): void {
  try {
    window.localStorage.setItem(COL_VISIBILITY_STORAGE_KEY, JSON.stringify(visibility));
  } catch {
    // Ignore storage errors
  }
}

export type ColumnCheckState = 'checked' | 'unchecked' | 'indeterminate';

export function isCellVisible(
  entryId: string,
  field: 'lang1' | 'lang2',
  isColumnShown: boolean,
  cellOverrides: Readonly<Record<string, boolean>>,
): boolean {
  const key = `${entryId}:${field}`;
  if (Object.prototype.hasOwnProperty.call(cellOverrides, key)) {
    return Boolean(cellOverrides[key]);
  }
  return isColumnShown;
}

export function toggleCellVisibility(
  cellOverrides: Readonly<Record<string, boolean>>,
  entryId: string,
  field: 'lang1' | 'lang2',
  isColumnShown: boolean,
): Record<string, boolean> {
  const key = `${entryId}:${field}`;
  const currentlyVisible = isCellVisible(entryId, field, isColumnShown, cellOverrides);
  const nextVisible = !currentlyVisible;
  const next: Record<string, boolean> = { ...cellOverrides };
  if (nextVisible === isColumnShown) {
    delete next[key];
  } else {
    next[key] = nextVisible;
  }
  return next;
}

export function clearFieldOverrides(
  cellOverrides: Readonly<Record<string, boolean>>,
  field: 'lang1' | 'lang2',
): Record<string, boolean> {
  const suffix = `:${field}`;
  const next: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(cellOverrides)) {
    if (!k.endsWith(suffix)) {
      next[k] = v;
    }
  }
  return next;
}

export function getColumnCheckState(
  entryIds: readonly string[],
  isColumnShown: boolean,
  cellOverrides: Readonly<Record<string, boolean>>,
  field: 'lang1' | 'lang2',
): ColumnCheckState {
  if (entryIds.length === 0) {
    return isColumnShown ? 'checked' : 'unchecked';
  }
  let shownCount = 0;
  for (const id of entryIds) {
    if (isCellVisible(id, field, isColumnShown, cellOverrides)) {
      shownCount++;
    }
  }
  if (shownCount === 0) return 'unchecked';
  if (shownCount === entryIds.length) return 'checked';
  return 'indeterminate';
}

export interface NoteStudyState {
  orderMode: DisplayOrderMode;
  randomSeed: number;
  showLang1: boolean;
  showLang2: boolean;
  onlyStarred: boolean;
  cellOverrides: Record<string, boolean>;
}

export type NoteStudyStateMap = Record<string, NoteStudyState>;

const NOTE_STUDY_STATE_STORAGE_KEY = 'lexnote_note_study_states_v1';

export function createDefaultNoteStudyState(seed: number = Date.now()): NoteStudyState {
  return {
    orderMode: 'sequential',
    randomSeed: seed,
    showLang1: true,
    showLang2: true,
    onlyStarred: false,
    cellOverrides: {},
  };
}

export function normalizeNoteStudyState(
  raw: Partial<NoteStudyState> | null | undefined,
  fallbackSeed: number = Date.now(),
): NoteStudyState {
  const orderMode: DisplayOrderMode = raw?.orderMode === 'random' ? 'random' : 'sequential';
  const randomSeed =
    typeof raw?.randomSeed === 'number' && Number.isFinite(raw.randomSeed)
      ? raw.randomSeed
      : fallbackSeed;
  const showLang1 = typeof raw?.showLang1 === 'boolean' ? raw.showLang1 : true;
  const showLang2 = typeof raw?.showLang2 === 'boolean' ? raw.showLang2 : true;
  const onlyStarred = typeof raw?.onlyStarred === 'boolean' ? raw.onlyStarred : false;

  const cellOverrides: Record<string, boolean> = {};
  if (raw?.cellOverrides && typeof raw.cellOverrides === 'object') {
    for (const [k, v] of Object.entries(raw.cellOverrides)) {
      if (typeof v === 'boolean' && (k.endsWith(':lang1') || k.endsWith(':lang2'))) {
        cellOverrides[k] = v;
      }
    }
  }

  return {
    orderMode,
    randomSeed,
    showLang1,
    showLang2,
    onlyStarred,
    cellOverrides,
  };
}

export function loadNoteStudyStates(): NoteStudyStateMap {
  try {
    const raw = window.localStorage.getItem(NOTE_STUDY_STATE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<NoteStudyState>>;
    if (!parsed || typeof parsed !== 'object') return {};
    const result: NoteStudyStateMap = {};
    for (const [noteId, state] of Object.entries(parsed)) {
      if (noteId && state && typeof state === 'object') {
        result[noteId] = normalizeNoteStudyState(state);
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function saveNoteStudyStates(states: NoteStudyStateMap): void {
  try {
    window.localStorage.setItem(NOTE_STUDY_STATE_STORAGE_KEY, JSON.stringify(states));
  } catch {
    // Ignore storage errors
  }
}
