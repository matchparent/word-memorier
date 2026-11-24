import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INSERT_AT_TOP,
  insertItemsAtPosition,
  parseNoteImportText,
  resolveUniqueFileName,
  serializeNoteToTxt,
  shuffleWithSeed,
} from './noteParser';
import {
  canCreateFolderAtLevel,
  findNoteLocation,
  getSiblingNoteNames,
} from './treeHelpers';
import type { NotebookWorkspace, NoteFile } from '../types/notebook';

test('parseNoteImportText parses pairs and [] segments cleanly', () => {
  const input = `["ephemeral":"短暂的"],["ubiquitous":"无处不在的"],[],["resilience":"韧性"]`;
  const parsed = parseNoteImportText(input);
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.items.length, 4);
  assert.deepEqual(parsed.items[0], {
    kind: 'entry',
    lang1: 'ephemeral',
    lang2: '短暂的',
    starred: false,
  });
  assert.deepEqual(parsed.items[2], { kind: 'segment', title: '' });
  assert.deepEqual(parsed.items[3], {
    kind: 'entry',
    lang1: 'resilience',
    lang2: '韧性',
    starred: false,
  });
});

test('parseNoteImportText handles colons inside quotes, escaped quotes, and multiline input', () => {
  const input = `
    ["10:30 AM":"上午 10:30"],
    ["He said \\"Hello\\"":"他说：\\"你好\\""],
    [第二阶段],
    ["key: value":"键: 值"]
  `;
  const parsed = parseNoteImportText(input);
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.items.length, 4);
  assert.equal(parsed.items[0].kind, 'entry');
  if (parsed.items[0].kind === 'entry') {
    assert.equal(parsed.items[0].lang1, '10:30 AM');
    assert.equal(parsed.items[0].lang2, '上午 10:30');
  }
  if (parsed.items[1].kind === 'entry') {
    assert.equal(parsed.items[1].lang1, 'He said "Hello"');
    assert.equal(parsed.items[1].lang2, '他说："你好"');
  }
  assert.deepEqual(parsed.items[2], { kind: 'segment', title: '第二阶段' });
});

test('serializeNoteToTxt and parseNoteImportText preserve entries, segments, and starred items', () => {
  const note: NoteFile = {
    id: 'n1',
    type: 'note',
    name: '核心词汇',
    lang1Label: 'English',
    lang2Label: '中文',
    updatedAt: 1000,
    items: [
      { id: 'e1', kind: 'entry', lang1: 'apple', lang2: '苹果', starred: true },
      { id: 's1', kind: 'segment', title: '' },
      { id: 'e2', kind: 'entry', lang1: 'banana', lang2: '香蕉', starred: false },
      { id: 'e3', kind: 'entry', lang1: 'cherry', lang2: '樱桃', starred: true },
    ],
  };

  const txt = serializeNoteToTxt(note, '英语');
  assert.ok(txt.includes('["apple":"苹果"],'));
  assert.ok(txt.includes('[],'));
  assert.ok(txt.includes('# Starred: 0,2'));

  const reparsed = parseNoteImportText(txt);
  assert.equal(reparsed.errors.length, 0);
  assert.equal(reparsed.meta?.noteName, '核心词汇');
  assert.equal(reparsed.meta?.languageName, '英语');
  assert.equal(reparsed.items.length, 4);
  assert.equal(reparsed.items[0].kind === 'entry' && reparsed.items[0].starred, true);
  assert.equal(reparsed.items[1].kind, 'segment');
  assert.equal(reparsed.items[2].kind === 'entry' && reparsed.items[2].starred, false);
  assert.equal(reparsed.items[3].kind === 'entry' && reparsed.items[3].starred, true);

  // Backward compatibility: legacy Chinese metadata headers still parse cleanly
  const legacyTxt = `# 笔记名称: LegacyNote\n# 所属语言: English\n# 语言列: English | Chinese\n# 收藏索引: 1\n["a":"甲"],\n["b":"乙"]`;
  const legacyParsed = parseNoteImportText(legacyTxt);
  assert.equal(legacyParsed.errors.length, 0);
  assert.equal(legacyParsed.meta?.noteName, 'LegacyNote');
  assert.equal(legacyParsed.meta?.languageName, 'English');
  assert.equal(legacyParsed.items[1].kind === 'entry' && legacyParsed.items[1].starred, true);
});

test('resolveUniqueFileName appends (1), (2), ... on filename conflicts', () => {
  assert.equal(resolveUniqueFileName('雅思词汇', []), '雅思词汇');
  assert.equal(resolveUniqueFileName('雅思词汇', ['雅思词汇']), '雅思词汇(1)');
  assert.equal(resolveUniqueFileName('雅思词汇', ['雅思词汇', '雅思词汇(1)']), '雅思词汇(2)');
  assert.equal(
    resolveUniqueFileName('雅思词汇(1)', ['雅思词汇', '雅思词汇(1)']),
    '雅思词汇(1)(1)',
  );
});

test('shuffleWithSeed is deterministic for a given timestamp seed and differs across seeds', () => {
  const source = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const a1 = shuffleWithSeed(source, 1732352449123);
  const a2 = shuffleWithSeed(source, 1732352449123);
  const b = shuffleWithSeed(source, 1732352449999);

  assert.deepEqual(a1, a2);
  assert.notDeepEqual(a1, source);
  assert.notDeepEqual(a1, b);
  assert.deepEqual([...a1].sort((x, y) => x - y), source);
});

test('3-level filesystem enforces depth <= 3 and resolves note locations', () => {
  assert.equal(canCreateFolderAtLevel(1), true);
  assert.equal(canCreateFolderAtLevel(2), false);
  assert.equal(canCreateFolderAtLevel(3), false);

  const ws: NotebookWorkspace = {
    activeNoteId: 'n3',
    languages: [
      {
        id: 'l1',
        type: 'language',
        name: '英语',
        children: [
          {
            id: 'n2',
            type: 'note',
            name: '日常口语',
            lang1Label: 'English',
            lang2Label: '中文',
            items: [],
            updatedAt: 1,
          },
          {
            id: 'f2',
            type: 'folder',
            name: '专项突破',
            children: [
              {
                id: 'n3',
                type: 'note',
                name: '学术词汇',
                lang1Label: 'English',
                lang2Label: '中文',
                items: [],
                updatedAt: 2,
              },
            ],
          },
        ],
      },
    ],
  };

  const loc2 = findNoteLocation(ws, 'n2');
  assert.equal(loc2?.depth, 2);
  assert.equal(loc2?.language.name, '英语');
  assert.equal(loc2?.folder, undefined);

  const loc3 = findNoteLocation(ws, 'n3');
  assert.equal(loc3?.depth, 3);
  assert.equal(loc3?.folder?.name, '专项突破');

  assert.deepEqual(getSiblingNoteNames(ws, 'l1'), ['日常口语']);
  assert.deepEqual(getSiblingNoteNames(ws, 'l1', 'f2'), ['学术词汇']);
});

test('insertItemsAtPosition inserts at top, after specific entry/segment, and at end', () => {
  const base = [
    { id: 's1', kind: 'segment' as const, title: '段1' },
    { id: 'e1', kind: 'entry' as const, lang1: 'a', lang2: '甲', starred: false },
    { id: 'e2', kind: 'entry' as const, lang1: 'b', lang2: '乙', starred: false },
  ];
  const added = [{ id: 'new1', kind: 'entry' as const, lang1: 'x', lang2: '新', starred: false }];

  // Top
  const atTop = insertItemsAtPosition(base, added, INSERT_AT_TOP);
  assert.deepEqual(
    atTop.map((i) => i.id),
    ['new1', 's1', 'e1', 'e2'],
  );

  // Middle (after segment s1)
  const afterSeg = insertItemsAtPosition(base, added, 's1');
  assert.deepEqual(
    afterSeg.map((i) => i.id),
    ['s1', 'new1', 'e1', 'e2'],
  );

  // Middle (after entry e1)
  const afterEntry = insertItemsAtPosition(base, added, 'e1');
  assert.deepEqual(
    afterEntry.map((i) => i.id),
    ['s1', 'e1', 'new1', 'e2'],
  );

  // End (null)
  const atEnd = insertItemsAtPosition(base, added, null);
  assert.deepEqual(
    atEnd.map((i) => i.id),
    ['s1', 'e1', 'e2', 'new1'],
  );
});

