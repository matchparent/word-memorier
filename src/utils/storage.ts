import type { NotebookWorkspace } from '../types/notebook';

const STORAGE_KEY = 'lexnote_workspace_v1';

export function createDefaultWorkspace(): NotebookWorkspace {
  const now = Date.now();
  return {
    activeNoteId: 'note_en_ielts',
    languages: [
      {
        id: 'lang_en',
        type: 'language',
        name: 'English',
        children: [
          {
            id: 'note_en_ielts',
            type: 'note',
            name: 'Core Vocabulary & Sentences',
            lang1Label: 'English',
            lang2Label: 'Chinese',
            updatedAt: now,
            items: [
              { id: 'seg_en_1', kind: 'segment', title: 'Part 1 · Core Vocabulary' },
              {
                id: 'e_en_1',
                kind: 'entry',
                lang1: 'ephemeral',
                lang2: '短暂的；转瞬即逝的',
                starred: true,
              },
              {
                id: 'e_en_2',
                kind: 'entry',
                lang1: 'ubiquitous',
                lang2: '无处不在的；普遍存在的',
                starred: false,
              },
              {
                id: 'e_en_3',
                kind: 'entry',
                lang1: 'resilience',
                lang2: '韧性；快速恢复能力',
                starred: true,
              },
              {
                id: 'e_en_4',
                kind: 'entry',
                lang1: 'pragmatic',
                lang2: '务实的；实用主义的',
                starred: false,
              },
              { id: 'seg_en_2', kind: 'segment', title: 'Part 2 · Practical Sentences' },
              {
                id: 'e_en_5',
                kind: 'entry',
                lang1: 'Consistent daily practice compounds over time.',
                lang2: '每天坚持练习会随时间产生复利效应。',
                starred: true,
              },
              {
                id: 'e_en_6',
                kind: 'entry',
                lang1: 'Could you walk me through the reasoning behind this decision?',
                lang2: '你能带我梳理一下这个决定背后的逻辑吗？',
                starred: false,
              },
            ],
          },
          {
            id: 'folder_en_reading',
            type: 'folder',
            name: 'Focused Topics',
            children: [
              {
                id: 'note_en_academic',
                type: 'note',
                name: 'Academic Expressions',
                lang1Label: 'English',
                lang2Label: 'Chinese',
                updatedAt: now - 3600_000,
                items: [
                  {
                    id: 'e_en_ac_1',
                    kind: 'entry',
                    lang1: 'A growing body of evidence suggests that...',
                    lang2: '越来越多的证据表明……',
                    starred: true,
                  },
                  {
                    id: 'e_en_ac_2',
                    kind: 'entry',
                    lang1: 'This discrepancy can be attributed to...',
                    lang2: '这种差异可以归因于……',
                    starred: false,
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'lang_ja',
        type: 'language',
        name: 'Japanese',
        children: [
          {
            id: 'note_ja_daily',
            type: 'note',
            name: 'Daily Expressions',
            lang1Label: 'Japanese',
            lang2Label: 'Chinese',
            updatedAt: now - 7200_000,
            items: [
              {
                id: 'e_ja_1',
                kind: 'entry',
                lang1: '継続は力なり',
                lang2: '坚持就是力量',
                starred: true,
              },
              {
                id: 'e_ja_2',
                kind: 'entry',
                lang1: 'お先に失礼します',
                lang2: '我先告辞了（下班常用语）',
                starred: false,
              },
              {
                id: 'e_ja_3',
                kind: 'entry',
                lang1: '無理をしないでくださいね',
                lang2: '请不要太勉强自己',
                starred: false,
              },
            ],
          },
        ],
      },
    ],
  };
}

function migrateNoteDefaults(note: NotebookWorkspace['languages'][number]['children'][number]) {
  if (note.type !== 'note') return note;
  let nextName = note.name;
  let nextLang1 = note.lang1Label;
  let nextLang2 = note.lang2Label;

  if (note.id === 'note_en_ielts' && nextName === '核心高频词句') {
    nextName = 'Core Vocabulary & Sentences';
  } else if (note.id === 'note_en_academic' && nextName === '学术表达句型') {
    nextName = 'Academic Expressions';
  } else if (note.id === 'note_ja_daily' && nextName === '日常高频表达') {
    nextName = 'Daily Expressions';
  }

  if (nextLang1 === '语言1') nextLang1 = 'Language 1';
  if (nextLang1 === '日本語') nextLang1 = 'Japanese';
  if (nextLang2 === '语言2') nextLang2 = 'Language 2';
  if (nextLang2 === '中文释义') nextLang2 = 'Chinese';

  const nextItems = note.items.map((item) => {
    if (item.kind !== 'segment') return item;
    if (item.id === 'seg_en_1' && item.title === '第一部分 · 常用核心词汇') {
      return { ...item, title: 'Part 1 · Core Vocabulary' };
    }
    if (item.id === 'seg_en_2' && item.title === '第二部分 · 实用例句') {
      return { ...item, title: 'Part 2 · Practical Sentences' };
    }
    return item;
  });

  return {
    ...note,
    name: nextName,
    lang1Label: nextLang1,
    lang2Label: nextLang2,
    items: nextItems,
  };
}

function migrateLegacyDefaultLabels(ws: NotebookWorkspace): NotebookWorkspace {
  return {
    ...ws,
    languages: ws.languages.map((lang) => {
      let langName = lang.name;
      if (lang.id === 'lang_en' && langName === '英语') langName = 'English';
      if (lang.id === 'lang_ja' && langName === '日语') langName = 'Japanese';
      return {
        ...lang,
        name: langName,
        children: lang.children.map((child) => {
          if (child.type === 'note') {
            return migrateNoteDefaults(child);
          }
          let folderName = child.name;
          if (child.id === 'folder_en_reading' && folderName === '专项分类') {
            folderName = 'Focused Topics';
          }
          return {
            ...child,
            name: folderName,
            children: child.children.map((sub) =>
              migrateNoteDefaults(sub) as typeof sub,
            ),
          };
        }),
      };
    }),
  };
}

export function loadWorkspace(): NotebookWorkspace {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultWorkspace();
    }
    const parsed = JSON.parse(raw) as NotebookWorkspace;
    if (!parsed || !Array.isArray(parsed.languages)) {
      return createDefaultWorkspace();
    }
    return migrateLegacyDefaultLabels(parsed);
  } catch {
    return createDefaultWorkspace();
  }
}

export function saveWorkspace(workspace: NotebookWorkspace): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  } catch {
    // Ignore storage quota errors gracefully
  }
}
