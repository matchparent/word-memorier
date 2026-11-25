import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampColumnWidth,
  clearFieldOverrides,
  createDefaultNoteStudyState,
  DEFAULT_COLUMN_VISIBILITY,
  getColumnCheckState,
  getVisibleColumnCount,
  isCellVisible,
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTHS,
  normalizeNoteStudyState,
  resizeColumnWidth,
  toggleCellVisibility,
} from './tableLayout';

test('clampColumnWidth respects per-column minimum and global maximum', () => {
  assert.equal(clampColumnWidth('index', 20), MIN_COLUMN_WIDTHS.index);
  assert.equal(clampColumnWidth('star', 50), MIN_COLUMN_WIDTHS.star);
  assert.equal(clampColumnWidth('lang1', 80), MIN_COLUMN_WIDTHS.lang1);
  assert.equal(clampColumnWidth('lang2', 9999), MAX_COLUMN_WIDTH);
  assert.equal(clampColumnWidth('lang1', 345.6), 346);
});

test('resizeColumnWidth updates only the dragged column cleanly', () => {
  const initial = { index: 56, star: 128, lang1: 420, lang2: 420 };
  const resized = resizeColumnWidth(initial, 'lang1', 420, 80);
  assert.deepEqual(resized, { index: 56, star: 128, lang1: 500, lang2: 420 });

  const clamped = resizeColumnWidth(initial, 'index', 56, -100);
  assert.equal(clamped.index, MIN_COLUMN_WIDTHS.index);
});

test('getVisibleColumnCount accounts for index and star column toggles', () => {
  assert.equal(getVisibleColumnCount(DEFAULT_COLUMN_VISIBILITY), 4);
  assert.equal(getVisibleColumnCount({ index: false, star: true }), 3);
  assert.equal(getVisibleColumnCount({ index: true, star: false }), 3);
  assert.equal(getVisibleColumnCount({ index: false, star: false }), 2);
});

test('cell visibility toggles cleanly regardless of baseline column state', () => {
  // Baseline shown = true: clicking a cell hides it; clicking again removes override and shows it
  let overrides: Record<string, boolean> = {};
  assert.equal(isCellVisible('e1', 'lang1', true, overrides), true);

  overrides = toggleCellVisibility(overrides, 'e1', 'lang1', true);
  assert.equal(isCellVisible('e1', 'lang1', true, overrides), false);
  assert.deepEqual(overrides, { 'e1:lang1': false });

  overrides = toggleCellVisibility(overrides, 'e1', 'lang1', true);
  assert.equal(isCellVisible('e1', 'lang1', true, overrides), true);
  assert.deepEqual(overrides, {});

  // Baseline shown = false: clicking a masked cell reveals it; clicking again hides it
  overrides = toggleCellVisibility(overrides, 'e1', 'lang2', false);
  assert.equal(isCellVisible('e1', 'lang2', false, overrides), true);
  assert.deepEqual(overrides, { 'e1:lang2': true });

  overrides = toggleCellVisibility(overrides, 'e1', 'lang2', false);
  assert.equal(isCellVisible('e1', 'lang2', false, overrides), false);
  assert.deepEqual(overrides, {});

  // clearFieldOverrides only removes overrides for the specified field
  const mixed = { 'e1:lang1': false, 'e2:lang2': true };
  assert.deepEqual(clearFieldOverrides(mixed, 'lang1'), { 'e2:lang2': true });
});

test('getColumnCheckState computes unchecked, indeterminate, and checked states', () => {
  const ids = ['e1', 'e2', 'e3'];

  assert.equal(getColumnCheckState(ids, true, {}, 'lang1'), 'checked');
  assert.equal(getColumnCheckState(ids, true, { 'e1:lang1': false }, 'lang1'), 'indeterminate');
  assert.equal(
    getColumnCheckState(
      ids,
      true,
      { 'e1:lang1': false, 'e2:lang1': false, 'e3:lang1': false },
      'lang1',
    ),
    'unchecked',
  );
  assert.equal(getColumnCheckState(ids, false, {}, 'lang1'), 'unchecked');
  assert.equal(getColumnCheckState(ids, false, { 'e1:lang1': true }, 'lang1'), 'indeterminate');
  assert.equal(
    getColumnCheckState(ids, false, { 'e1:lang1': true, 'e2:lang1': true }, 'lang1'),
    'indeterminate',
  );
  assert.equal(
    getColumnCheckState(ids, false, { 'e1:lang1': true, 'e2:lang1': true, 'e3:lang1': true }, 'lang1'),
    'checked',
  );
  assert.equal(getColumnCheckState(ids, false, { 'e1:lang2': true }, 'lang1'), 'unchecked');
  assert.equal(getColumnCheckState([], false, {}, 'lang1'), 'unchecked');
  assert.equal(getColumnCheckState([], true, {}, 'lang1'), 'checked');
});

test('normalizeNoteStudyState preserves valid fields and sanitizes invalid ones', () => {
  const defaults = createDefaultNoteStudyState(12345);
  assert.deepEqual(defaults, {
    orderMode: 'sequential',
    randomSeed: 12345,
    showLang1: true,
    showLang2: true,
    onlyStarred: false,
    cellOverrides: {},
  });

  const normalized = normalizeNoteStudyState(
    {
      orderMode: 'random',
      randomSeed: 99999,
      showLang1: false,
      showLang2: true,
      onlyStarred: true,
      cellOverrides: {
        'e1:lang1': true,
        'e2:lang2': false,
        'bad-key': true,
      },
    },
    111,
  );
  assert.deepEqual(normalized, {
    orderMode: 'random',
    randomSeed: 99999,
    showLang1: false,
    showLang2: true,
    onlyStarred: true,
    cellOverrides: {
      'e1:lang1': true,
      'e2:lang2': false,
    },
  });
});
