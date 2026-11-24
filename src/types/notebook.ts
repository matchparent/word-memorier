export interface NoteEntryItem {
  id: string;
  kind: 'entry';
  lang1: string;
  lang2: string;
  starred: boolean;
}

export interface NoteSegmentItem {
  id: string;
  kind: 'segment';
  title: string;
}

export type NoteItem = NoteEntryItem | NoteSegmentItem;

export interface NoteFile {
  id: string;
  type: 'note';
  name: string;
  lang1Label: string;
  lang2Label: string;
  items: NoteItem[];
  updatedAt: number;
}

export interface FolderNode {
  id: string;
  type: 'folder';
  name: string;
  children: NoteFile[];
}

export type LanguageChild = NoteFile | FolderNode;

export interface LanguageNode {
  id: string;
  type: 'language';
  name: string;
  children: LanguageChild[];
}

export interface NotebookWorkspace {
  languages: LanguageNode[];
  activeNoteId: string | null;
}

export type DisplayOrderMode = 'sequential' | 'random';

export interface ParsedNoteData {
  items: Array<
    | { kind: 'entry'; lang1: string; lang2: string; starred?: boolean }
    | { kind: 'segment'; title: string }
  >;
  errors: string[];
  meta?: {
    noteName?: string;
    languageName?: string;
    lang1Label?: string;
    lang2Label?: string;
  };
}
