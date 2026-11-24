import type {
  FolderNode,
  LanguageNode,
  NotebookWorkspace,
  NoteFile,
} from '../types/notebook';

export interface NoteLocation {
  language: LanguageNode;
  folder?: FolderNode;
  note: NoteFile;
  depth: 2 | 3;
}

export const MAX_FILESYSTEM_DEPTH = 3;

/**
 * Finds a NoteFile anywhere inside the 3-level workspace tree.
 * Level 1: LanguageNode
 * Level 2: NoteFile OR FolderNode
 * Level 3: NoteFile (inside FolderNode)
 */
export function findNoteLocation(
  workspace: NotebookWorkspace,
  noteId: string | null,
): NoteLocation | null {
  if (!noteId) return null;
  for (const lang of workspace.languages) {
    for (const child of lang.children) {
      if (child.type === 'note' && child.id === noteId) {
        return { language: lang, note: child, depth: 2 };
      }
      if (child.type === 'folder') {
        for (const subNote of child.children) {
          if (subNote.id === noteId) {
            return { language: lang, folder: child, note: subNote, depth: 3 };
          }
        }
      }
    }
  }
  return null;
}

/**
 * Finds the first available NoteFile in the workspace.
 */
export function findFirstNoteId(workspace: NotebookWorkspace): string | null {
  for (const lang of workspace.languages) {
    for (const child of lang.children) {
      if (child.type === 'note') return child.id;
      if (child.type === 'folder' && child.children.length > 0) {
        return child.children[0].id;
      }
    }
  }
  return null;
}

/**
 * Lists all note names inside a target container (either directly under a LanguageNode or inside a FolderNode).
 */
export function getSiblingNoteNames(
  workspace: NotebookWorkspace,
  languageId: string,
  folderId?: string,
): string[] {
  const lang = workspace.languages.find((l) => l.id === languageId);
  if (!lang) return [];
  if (folderId) {
    const folder = lang.children.find(
      (c): c is FolderNode => c.type === 'folder' && c.id === folderId,
    );
    return folder ? folder.children.map((n) => n.name) : [];
  }
  return lang.children.filter((c): c is NoteFile => c.type === 'note').map((n) => n.name);
}

/**
 * Checks whether a folder can be created at the given level.
 * Level 1 = Language, Level 2 = Folder or Note, Level 3 = Note only.
 * Therefore folders are only allowed directly under Level 1 (Language -> Level 2).
 */
export function canCreateFolderAtLevel(parentLevel: 1 | 2 | 3): boolean {
  return parentLevel === 1 && MAX_FILESYSTEM_DEPTH >= 3;
}

export function updateNoteInWorkspace(
  workspace: NotebookWorkspace,
  noteId: string,
  updater: (note: NoteFile) => NoteFile,
): NotebookWorkspace {
  return {
    ...workspace,
    languages: workspace.languages.map((lang) => ({
      ...lang,
      children: lang.children.map((child) => {
        if (child.type === 'note' && child.id === noteId) {
          return updater(child);
        }
        if (child.type === 'folder') {
          return {
            ...child,
            children: child.children.map((subNote) =>
              subNote.id === noteId ? updater(subNote) : subNote,
            ),
          };
        }
        return child;
      }),
    })),
  };
}
