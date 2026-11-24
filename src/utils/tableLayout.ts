export type ColumnKey = 'index' | 'star' | 'lang1' | 'lang2';

export type ColumnWidths = Record<ColumnKey, number>;

export const MIN_COLUMN_WIDTHS: ColumnWidths = {
  index: 72,
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

export function getColumnCheckState(
  entryIds: readonly string[],
  isColumnShown: boolean,
  revealedCells: ReadonlySet<string>,
  field: 'lang1' | 'lang2',
): ColumnCheckState {
  if (entryIds.length === 0) {
    return isColumnShown ? 'checked' : 'unchecked';
  }
  if (isColumnShown) {
    return 'checked';
  }
  let shownCount = 0;
  for (const id of entryIds) {
    if (revealedCells.has(`${id}:${field}`)) {
      shownCount++;
    }
  }
  if (shownCount === 0) return 'unchecked';
  if (shownCount === entryIds.length) return 'checked';
  return 'indeterminate';
}


