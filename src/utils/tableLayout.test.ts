import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampColumnWidth,
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTHS,
  resizeColumnWidth,
} from './tableLayout';

test('clampColumnWidth respects per-column minimum and global maximum', () => {
  assert.equal(clampColumnWidth('index', 20), MIN_COLUMN_WIDTHS.index);
  assert.equal(clampColumnWidth('star', 50), MIN_COLUMN_WIDTHS.star);
  assert.equal(clampColumnWidth('lang1', 80), MIN_COLUMN_WIDTHS.lang1);
  assert.equal(clampColumnWidth('lang2', 9999), MAX_COLUMN_WIDTH);
  assert.equal(clampColumnWidth('lang1', 345.6), 346);
});

test('resizeColumnWidth updates only the dragged column cleanly', () => {
  const initial = { index: 96, star: 128, lang1: 420, lang2: 420 };
  const resized = resizeColumnWidth(initial, 'lang1', 420, 80);
  assert.deepEqual(resized, { index: 96, star: 128, lang1: 500, lang2: 420 });

  const clamped = resizeColumnWidth(initial, 'index', 96, -100);
  assert.equal(clamped.index, MIN_COLUMN_WIDTHS.index);
});
