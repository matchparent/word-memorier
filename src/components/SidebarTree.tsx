import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Folder,
  FolderPlus,
  Languages,
  PanelLeftClose,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { LanguageNode, NotebookWorkspace } from '../types/notebook';

interface SidebarTreeProps {
  workspace: NotebookWorkspace;
  isDesktopOpen: boolean;
  onHideDesktop: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onSelectNote: (noteId: string) => void;
  onCreateLanguage: (name: string) => void;
  onRenameLanguage: (langId: string, name: string) => void;
  onDeleteLanguage: (langId: string) => void;
  onCreateFolder: (langId: string, name: string) => void;
  onRenameFolder: (langId: string, folderId: string, name: string) => void;
  onDeleteFolder: (langId: string, folderId: string) => void;
  onCreateNote: (langId: string, folderId: string | undefined, name: string) => void;
  onRenameNote: (noteId: string, name: string) => void;
  onDeleteNote: (noteId: string) => void;
  onExportNote: (noteId: string) => void;
  onTriggerImportTxt: (langId: string, folderId?: string) => void;
}

type CreatingTarget =
  | { type: 'language' }
  | { type: 'folder'; langId: string }
  | { type: 'note'; langId: string; folderId?: string }
  | null;

type RenamingTarget =
  | { type: 'language'; id: string; value: string }
  | { type: 'folder'; langId: string; id: string; value: string }
  | { type: 'note'; id: string; value: string }
  | null;

export const SidebarTree: React.FC<SidebarTreeProps> = ({
  workspace,
  isDesktopOpen,
  onHideDesktop,
  isMobileOpen,
  onCloseMobile,
  onSelectNote,
  onCreateLanguage,
  onRenameLanguage,
  onDeleteLanguage,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onCreateNote,
  onRenameNote,
  onDeleteNote,
  onExportNote,
  onTriggerImportTxt,
}) => {
  const [expandedLangs, setExpandedLangs] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    workspace.languages.forEach((l) => {
      init[l.id] = true;
    });
    return init;
  });

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    workspace.languages.forEach((l) => {
      l.children.forEach((c) => {
        if (c.type === 'folder') init[c.id] = true;
      });
    });
    return init;
  });

  const [creating, setCreating] = useState<CreatingTarget>(null);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<RenamingTarget>(null);

  const toggleLang = (id: string) => {
    setExpandedLangs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const submitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed || !creating) return;
    if (creating.type === 'language') {
      onCreateLanguage(trimmed);
    } else if (creating.type === 'folder') {
      onCreateFolder(creating.langId, trimmed);
      setExpandedLangs((prev) => ({ ...prev, [creating.langId]: true }));
    } else if (creating.type === 'note') {
      onCreateNote(creating.langId, creating.folderId, trimmed);
      setExpandedLangs((prev) => ({ ...prev, [creating.langId]: true }));
      if (creating.folderId) {
        setExpandedFolders((prev) => ({ ...prev, [creating.folderId!]: true }));
      }
    }
    setCreating(null);
    setNewName('');
  };

  const submitRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renaming) return;
    const trimmed = renaming.value.trim();
    if (!trimmed) {
      setRenaming(null);
      return;
    }
    if (renaming.type === 'language') {
      onRenameLanguage(renaming.id, trimmed);
    } else if (renaming.type === 'folder') {
      onRenameFolder(renaming.langId, renaming.id, trimmed);
    } else if (renaming.type === 'note') {
      onRenameNote(renaming.id, trimmed);
    }
    setRenaming(null);
  };

  const renderInlineCreator = (placeholder: string) => (
    <form onSubmit={submitCreate} className="flex items-center gap-1.5 px-2 py-1.5">
      <input
        type="text"
        autoFocus
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded-md border border-blue-400 bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setCreating(null);
            setNewName('');
          }
        }}
      />
      <button
        type="submit"
        className="shrink-0 rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
      >
        Add
      </button>
      <button
        type="button"
        aria-label="Cancel creation"
        onClick={() => {
          setCreating(null);
          setNewName('');
        }}
        className="shrink-0 rounded-md p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </form>
  );

  const renderLanguageNode = (lang: LanguageNode) => {
    const isExpanded = expandedLangs[lang.id] ?? true;
    const isRenamingLang = renaming?.type === 'language' && renaming.id === lang.id;

    return (
      <div key={lang.id} className="mb-1">
        <div className="group flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-slate-200/70">
          {isRenamingLang ? (
            <form onSubmit={submitRename} className="flex flex-1 items-center gap-1">
              <input
                type="text"
                autoFocus
                value={renaming.value}
                onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
                onBlur={submitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setRenaming(null);
                }}
                className="min-w-0 flex-1 rounded border border-blue-400 bg-white px-1.5 py-0.5 text-sm text-slate-900 outline-none"
              />
            </form>
          ) : (
            <button
              type="button"
              onClick={() => toggleLang(lang.id)}
              aria-expanded={isExpanded}
              className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm font-semibold text-slate-800"
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              )}
              <Languages className="h-3.5 w-3.5 shrink-0 text-blue-600" />
              <span className="truncate">{lang.name}</span>
            </button>
          )}

          <div className="flex shrink-0 items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
            <button
              type="button"
              title="New note (Level 2)"
              aria-label={`New note under ${lang.name}`}
              onClick={() => {
                setCreating({ type: 'note', langId: lang.id });
                setNewName('');
              }}
              className="rounded p-1 text-slate-500 hover:bg-slate-300/60 hover:text-slate-900"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="New folder (Level 2)"
              aria-label={`New folder under ${lang.name}`}
              onClick={() => {
                setCreating({ type: 'folder', langId: lang.id });
                setNewName('');
              }}
              className="rounded p-1 text-slate-500 hover:bg-slate-300/60 hover:text-slate-900"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Import .txt to this language"
              aria-label={`Import txt to ${lang.name}`}
              onClick={() => onTriggerImportTxt(lang.id)}
              className="rounded p-1 text-slate-500 hover:bg-slate-300/60 hover:text-slate-900"
            >
              <Upload className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Rename language"
              aria-label={`Rename language ${lang.name}`}
              onClick={() => setRenaming({ type: 'language', id: lang.id, value: lang.name })}
              className="rounded p-1 text-slate-500 hover:bg-slate-300/60 hover:text-slate-900"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              type="button"
              title="Delete language"
              aria-label={`Delete language ${lang.name}`}
              onClick={() => onDeleteLanguage(lang.id)}
              className="rounded p-1 text-slate-500 hover:bg-red-100 hover:text-red-700"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="ml-3 border-l border-slate-200 pl-2">
            {creating?.type === 'note' &&
              creating.langId === lang.id &&
              !creating.folderId &&
              renderInlineCreator('Enter note name...')}
            {creating?.type === 'folder' &&
              creating.langId === lang.id &&
              renderInlineCreator('Enter folder name...')}

            {lang.children.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-slate-400">No notes yet. Click + to add</div>
            )}

            {lang.children.map((child) => {
              if (child.type === 'note') {
                const isActive = workspace.activeNoteId === child.id;
                const isRenamingNote = renaming?.type === 'note' && renaming.id === child.id;

                return (
                  <div
                    key={child.id}
                    className={`group flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-slate-700 hover:bg-slate-200/60'
                    }`}
                  >
                    {isRenamingNote ? (
                      <form onSubmit={submitRename} className="flex flex-1 items-center">
                        <input
                          type="text"
                          autoFocus
                          value={renaming.value}
                          onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
                          onBlur={submitRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setRenaming(null);
                          }}
                          className="min-w-0 flex-1 rounded border border-blue-400 bg-white px-1.5 py-0.5 text-xs text-slate-900 outline-none"
                        />
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectNote(child.id);
                          onCloseMobile();
                        }}
                        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                      >
                        <FileText
                          className={`h-3.5 w-3.5 shrink-0 ${
                            isActive ? 'text-blue-600' : 'text-slate-400'
                          }`}
                        />
                        <span className="truncate">{child.name}</span>
                      </button>
                    )}

                    <div className="flex shrink-0 items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                      <button
                        type="button"
                        title="Export as .txt"
                        aria-label={`Export ${child.name}`}
                        onClick={() => onExportNote(child.id)}
                        className="rounded p-1 text-slate-500 hover:bg-slate-300/60 hover:text-slate-900"
                      >
                        <Download className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        title="Rename note"
                        aria-label={`Rename note ${child.name}`}
                        onClick={() => setRenaming({ type: 'note', id: child.id, value: child.name })}
                        className="rounded p-1 text-slate-500 hover:bg-slate-300/60 hover:text-slate-900"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        title="Delete note"
                        aria-label={`Delete note ${child.name}`}
                        onClick={() => onDeleteNote(child.id)}
                        className="rounded p-1 text-slate-500 hover:bg-red-100 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              }

              // Level 2 FolderNode (can contain Level 3 NoteFiles only)
              const folderExpanded = expandedFolders[child.id] ?? true;
              const isRenamingFolder = renaming?.type === 'folder' && renaming.id === child.id;

              return (
                <div key={child.id} className="mt-0.5">
                  <div className="group flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-slate-200/60">
                    {isRenamingFolder ? (
                      <form onSubmit={submitRename} className="flex flex-1 items-center">
                        <input
                          type="text"
                          autoFocus
                          value={renaming.value}
                          onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
                          onBlur={submitRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setRenaming(null);
                          }}
                          className="min-w-0 flex-1 rounded border border-blue-400 bg-white px-1.5 py-0.5 text-xs text-slate-900 outline-none"
                        />
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleFolder(child.id)}
                        aria-expanded={folderExpanded}
                        className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm font-medium text-slate-700"
                      >
                        {folderExpanded ? (
                          <ChevronDown className="h-3 w-3 shrink-0 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />
                        )}
                        <Folder className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                        <span className="truncate">{child.name}</span>
                      </button>
                    )}

                    {/* Max depth is 3: inside Level 2 folder, only Level 3 Notes or .txt import allowed (no sub-folders) */}
                    <div className="flex shrink-0 items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                      <button
                        type="button"
                        title="New note (Level 3)"
                        aria-label={`New note in ${child.name}`}
                        onClick={() => {
                          setCreating({ type: 'note', langId: lang.id, folderId: child.id });
                          setNewName('');
                        }}
                        className="rounded p-1 text-slate-500 hover:bg-slate-300/60 hover:text-slate-900"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Import .txt to this folder"
                        aria-label={`Import txt to ${child.name}`}
                        onClick={() => onTriggerImportTxt(lang.id, child.id)}
                        className="rounded p-1 text-slate-500 hover:bg-slate-300/60 hover:text-slate-900"
                      >
                        <Upload className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        title="Rename folder"
                        aria-label={`Rename folder ${child.name}`}
                        onClick={() =>
                          setRenaming({
                            type: 'folder',
                            langId: lang.id,
                            id: child.id,
                            value: child.name,
                          })
                        }
                        className="rounded p-1 text-slate-500 hover:bg-slate-300/60 hover:text-slate-900"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        title="Delete folder"
                        aria-label={`Delete folder ${child.name}`}
                        onClick={() => onDeleteFolder(lang.id, child.id)}
                        className="rounded p-1 text-slate-500 hover:bg-red-100 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {folderExpanded && (
                    <div className="ml-3 border-l border-slate-200 pl-2">
                      {creating?.type === 'note' &&
                        creating.langId === lang.id &&
                        creating.folderId === child.id &&
                        renderInlineCreator('Enter level-3 note name...')}

                      {child.children.length === 0 && (
                        <div className="px-2 py-1 text-xs text-slate-400">Empty folder</div>
                      )}

                      {child.children.map((subNote) => {
                        const isActive = workspace.activeNoteId === subNote.id;
                        const isRenamingSub =
                          renaming?.type === 'note' && renaming.id === subNote.id;

                        return (
                          <div
                            key={subNote.id}
                            className={`group flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${
                              isActive
                                ? 'bg-blue-50 text-blue-700 font-medium'
                                : 'text-slate-700 hover:bg-slate-200/60'
                            }`}
                          >
                            {isRenamingSub ? (
                              <form onSubmit={submitRename} className="flex flex-1 items-center">
                                <input
                                  type="text"
                                  autoFocus
                                  value={renaming.value}
                                  onChange={(e) =>
                                    setRenaming({ ...renaming, value: e.target.value })
                                  }
                                  onBlur={submitRename}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') setRenaming(null);
                                  }}
                                  className="min-w-0 flex-1 rounded border border-blue-400 bg-white px-1.5 py-0.5 text-xs text-slate-900 outline-none"
                                />
                              </form>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectNote(subNote.id);
                                  onCloseMobile();
                                }}
                                className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                              >
                                <FileText
                                  className={`h-3.5 w-3.5 shrink-0 ${
                                    isActive ? 'text-blue-600' : 'text-slate-400'
                                  }`}
                                />
                                <span className="truncate">{subNote.name}</span>
                              </button>
                            )}

                            <div className="flex shrink-0 items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                              <button
                                type="button"
                                title="Export as .txt"
                                aria-label={`Export ${subNote.name}`}
                                onClick={() => onExportNote(subNote.id)}
                                className="rounded p-1 text-slate-500 hover:bg-slate-300/60 hover:text-slate-900"
                              >
                                <Download className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                title="Rename note"
                                aria-label={`Rename note ${subNote.name}`}
                                onClick={() =>
                                  setRenaming({
                                    type: 'note',
                                    id: subNote.id,
                                    value: subNote.name,
                                  })
                                }
                                className="rounded p-1 text-slate-500 hover:bg-slate-300/60 hover:text-slate-900"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                title="Delete note"
                                aria-label={`Delete note ${subNote.name}`}
                                onClick={() => onDeleteNote(subNote.id)}
                                className="rounded p-1 text-slate-500 hover:bg-red-100 hover:text-red-700"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const sidebarContent = (
    <aside
      aria-label="Note directory"
      className="flex h-full w-72 flex-col border-r border-slate-200 bg-slate-100/90"
    >
      <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
        <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
          Wordbook
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setCreating({ type: 'language' });
              setNewName('');
            }}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            New Language
          </button>
          <button
            type="button"
            title="Hide directory"
            aria-label="Hide directory"
            onClick={onHideDesktop}
            className="hidden rounded-md p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800 md:inline-flex"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Close directory"
            onClick={onCloseMobile}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-200 md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="mb-2 flex items-center justify-between px-2 text-xs font-medium text-slate-500">
          <span>Directory</span>
          <span>Up to 3 levels</span>
        </div>

        {creating?.type === 'language' && renderInlineCreator('Enter language name (e.g. French)...')}

        {workspace.languages.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-slate-500">
            No languages yet. Click &ldquo;New Language&rdquo; above.
          </div>
        ) : (
          workspace.languages.map(renderLanguageNode)
        )}
      </div>

      <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
        Saved locally in your browser
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop collapsible sidebar */}
      {isDesktopOpen && (
        <div className="hidden md:block md:h-full md:shrink-0">{sidebarContent}</div>
      )}

      {/* Mobile slide-over drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-[1px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full shadow-xl">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};
