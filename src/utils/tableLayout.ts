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
