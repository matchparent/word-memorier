import type { NoteEntryItem, NoteFile, NoteItem, ParsedNoteData } from '../types/notebook';

export function escapeQuotedText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n');
}

export function unescapeQuotedText(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\' && i + 1 < text.length) {
      const next = text[i + 1];
      if (next === '"') {
        result += '"';
        i++;
      } else if (next === '\\') {
        result += '\\';
        i++;
      } else if (next === 'n') {
        result += '\n';
        i++;
      } else if (next === 't') {
        result += '\t';
        i++;
      } else {
        result += ch;
      }
    } else {
      result += ch;
    }
  }
  return result;
}

/**
 * Parses pasted or .txt imported content in the format:
 * ["语言1":"语言2"],["语言1":"语言2"],[],["语言1":"语言2"]
 * Also supports optional # metadata comment lines at the top of exported .txt files.
 */
export function parseNoteImportText(rawText: string): ParsedNoteData {
  const errors: string[] = [];
  const items: ParsedNoteData['items'] = [];
  const meta: NonNullable<ParsedNoteData['meta']> = {};
  const starredIndices = new Set<number>();

  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  const bodyLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      const content = trimmed.slice(1).trim();
      if (content.startsWith('Note:') || content.startsWith('笔记名称:')) {
        const prefix = content.startsWith('Note:') ? 'Note:' : '笔记名称:';
        meta.noteName = content.slice(prefix.length).trim();
      } else if (content.startsWith('Language:') || content.startsWith('所属语言:')) {
        const prefix = content.startsWith('Language:') ? 'Language:' : '所属语言:';
        meta.languageName = content.slice(prefix.length).trim();
      } else if (content.startsWith('Columns:') || content.startsWith('语言列:')) {
        const prefix = content.startsWith('Columns:') ? 'Columns:' : '语言列:';
        const parts = content
          .slice(prefix.length)
          .split('|')
          .map((s) => s.trim());
        if (parts[0]) meta.lang1Label = parts[0];
        if (parts[1]) meta.lang2Label = parts[1];
      } else if (content.startsWith('Starred:') || content.startsWith('收藏索引:')) {
        const prefix = content.startsWith('Starred:') ? 'Starred:' : '收藏索引:';
        const rawIdx = content.slice(prefix.length).trim();
        if (rawIdx) {
          for (const part of rawIdx.split(',')) {
            const num = Number.parseInt(part.trim(), 10);
            if (!Number.isNaN(num) && num >= 0) {
              starredIndices.add(num);
            }
          }
        }
      }
      continue;
    }
    bodyLines.push(line);
  }

  const body = bodyLines.join('\n').trim();
  if (!body) {
    return { items: [], errors: ['Input is empty. Please paste at least one entry or section [].'], meta };
  }

  let i = 0;
  const len = body.length;
  let entryCount = 0;

  const skipSeparators = () => {
    while (i < len) {
      const ch = body[i];
      if (ch === ',' || ch === '，' || /\s/.test(ch)) {
        i++;
      } else {
        break;
      }
    }
  };

  const readQuoted = (): string | null => {
    if (body[i] !== '"') return null;
    i++; // skip opening quote
    let raw = '';
    while (i < len) {
      const ch = body[i];
      if (ch === '\\' && i + 1 < len) {
        raw += ch + body[i + 1];
        i += 2;
      } else if (ch === '"') {
        i++; // skip closing quote
        return unescapeQuotedText(raw);
      } else {
        raw += ch;
        i++;
      }
    }
    return null; // unterminated quote
  };

  while (i < len) {
    skipSeparators();
    if (i >= len) break;

    if (body[i] !== '[') {
      const snippet = body.slice(i, Math.min(len, i + 24)).replace(/\n/g, ' ');
      errors.push(`Syntax error: expected "[" but found unexpected text near "${snippet}"`);
      // Attempt recovery to next '['
      const nextBracket = body.indexOf('[', i + 1);
      if (nextBracket === -1) break;
      i = nextBracket;
      continue;
    }

    i++; // consume '['
    while (i < len && /\s/.test(body[i])) i++;

    // Empty segment []
    if (i < len && body[i] === ']') {
      i++; // consume ']'
      items.push({ kind: 'segment', title: '' });
      continue;
    }

    // Quoted pair ["Lang 1":"Lang 2"]
    if (i < len && body[i] === '"') {
      const lang1 = readQuoted();
      if (lang1 === null) {
        errors.push('Syntax error: unterminated quote in Language 1');
        break;
      }
      while (i < len && /\s/.test(body[i])) i++;
      if (i >= len || (body[i] !== ':' && body[i] !== '：')) {
        errors.push(`Syntax error: missing colon ":" after "${lang1}"`);
        const nextClose = body.indexOf(']', i);
        if (nextClose === -1) break;
        i = nextClose + 1;
        continue;
      }
      i++; // consume ':'
      while (i < len && /\s/.test(body[i])) i++;

      const lang2 = readQuoted();
      if (lang2 === null) {
        errors.push(`Syntax error: missing or unterminated quote for Language 2 after "${lang1}"`);
        break;
      }
      while (i < len && /\s/.test(body[i])) i++;
      if (i >= len || body[i] !== ']') {
        errors.push(`Syntax error: missing closing bracket "]" for ["${lang1}":"${lang2}"`);
        const nextClose = body.indexOf(']', i);
        if (nextClose === -1) break;
        i = nextClose + 1;
        continue;
      }
      i++; // consume ']'
      const isStarred = starredIndices.has(entryCount);
      entryCount++;
      items.push({ kind: 'entry', lang1, lang2, starred: isStarred });
      continue;
    }

    // Named segment like [Section 1] (no quotes inside)
    const closeIdx = body.indexOf(']', i);
    if (closeIdx === -1) {
      errors.push('Syntax error: unclosed section bracket "["');
      break;
    }
    const segTitle = body.slice(i, closeIdx).trim();
    i = closeIdx + 1;
    items.push({ kind: 'segment', title: segTitle });
  }

  if (items.length === 0 && errors.length === 0) {
    errors.push('No valid entries or sections [] could be parsed');
  }

  return { items, errors, meta };
}

/**
 * Serializes a NoteFile into clean exportable .txt format.
 * Preserves metadata & starred indices in # comment headers,
 * and writes standard ["Lang 1":"Lang 2"],[] tokens in the body.
 */
export function serializeNoteToTxt(note: NoteFile, languageName?: string): string {
  const headerLines: string[] = [
    `# Note: ${note.name}`,
    ...(languageName ? [`# Language: ${languageName}`] : []),
    `# Columns: ${note.lang1Label} | ${note.lang2Label}`,
  ];

  const starredIndices: number[] = [];
  let entryIdx = 0;
  const tokens: string[] = [];

  for (const item of note.items) {
    if (item.kind === 'segment') {
      tokens.push(item.title.trim() ? `[${item.title.trim()}]` : '[]');
    } else {
      if (item.starred) {
        starredIndices.push(entryIdx);
      }
      entryIdx++;
      tokens.push(`["${escapeQuotedText(item.lang1)}":"${escapeQuotedText(item.lang2)}"]`);
    }
  }

  if (starredIndices.length > 0) {
    headerLines.push(`# Starred: ${starredIndices.join(',')}`);
  }

  const bodyLines = tokens.map((tok, idx) => (idx < tokens.length - 1 ? `${tok},` : tok));
  return `${headerLines.join('\n')}\n${bodyLines.join('\n')}\n`;
}

/**
 * Resolves filename conflicts on import by appending "(1)", "(2)", etc.
 */
export function resolveUniqueFileName(desiredName: string, existingNames: string[]): string {
  const base = desiredName.trim() || 'Untitled Note';
  const existing = new Set(existingNames.map((n) => n.trim()));
  if (!existing.has(base)) {
    return base;
  }
  let counter = 1;
  while (existing.has(`${base}(${counter})`)) {
    counter++;
  }
  return `${base}(${counter})`;
}

/**
 * Deterministic PRNG (Mulberry32) for timestamp-seeded shuffling.
 */
export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Returns a new shuffled copy of `items` using `seed` (e.g., Date.now()).
 */
export function shuffleWithSeed<T>(items: readonly T[], seed: number): T[] {
  const copy = [...items];
  const rng = createSeededRng(seed);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Shuffles entries strictly within each section separated by `segment` items.
 * All segment dividers stay in their exact positions and no entry crosses a segment boundary.
 */
export function shuffleWithinSegments(items: readonly NoteItem[], seed: number): NoteItem[] {
  const result: NoteItem[] = [];
  let buffer: NoteEntryItem[] = [];
  let groupIndex = 0;

  const flushBuffer = () => {
    if (buffer.length > 0) {
      const groupSeed = ((seed >>> 0) ^ Math.imul(groupIndex + 1, 0x9e3779b1)) >>> 0;
      result.push(...shuffleWithSeed(buffer, groupSeed));
      buffer = [];
      groupIndex++;
    }
  };

  for (const item of items) {
    if (item.kind === 'segment') {
      flushBuffer();
      result.push(item);
    } else {
      buffer.push(item);
    }
  }
  flushBuffer();
  return result;
}

export function createEntryItem(lang1: string, lang2: string, starred = false): NoteEntryItem {
  return {
    id: `entry_${cryptoRandomId()}`,
    kind: 'entry',
    lang1,
    lang2,
    starred,
  };
}

export function createSegmentItem(title = ''): NoteItem {
  return {
    id: `seg_${cryptoRandomId()}`,
    kind: 'segment',
    title,
  };
}

export function cryptoRandomId(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

export const INSERT_AT_TOP = '__TOP__';

/**
 * Inserts `newItems` into `items` at any position:
 * - `afterItemId === INSERT_AT_TOP`: prepends at index 0
 * - `afterItemId === null`: appends at the end
 * - `afterItemId === <id>`: inserts immediately after that item (falls back to append if not found)
 */
export function insertItemsAtPosition(
  items: readonly NoteItem[],
  newItems: readonly NoteItem[],
  afterItemId: string | null,
): NoteItem[] {
  if (newItems.length === 0) return [...items];
  if (afterItemId === INSERT_AT_TOP) {
    return [...newItems, ...items];
  }
  if (afterItemId === null) {
    return [...items, ...newItems];
  }
  const idx = items.findIndex((it) => it.id === afterItemId);
  if (idx === -1) {
    return [...items, ...newItems];
  }
  return [...items.slice(0, idx + 1), ...newItems, ...items.slice(idx + 1)];
}

