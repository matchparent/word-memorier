import React from 'react';
import { Bookmark, CheckSquare, Square, Trash2, X } from 'lucide-react';

interface MultiSelectBarProps {
  selectedCount: number;
  totalVisibleCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onStarSelected: () => void;
  onUnstarSelected: () => void;
  onDeleteSelected: () => void;
  onExitMultiSelect: () => void;
}

export const MultiSelectBar: React.FC<MultiSelectBarProps> = ({
  selectedCount,
  totalVisibleCount,
  onSelectAll,
  onClearSelection,
  onStarSelected,
  onUnstarSelected,
  onDeleteSelected,
  onExitMultiSelect,
}) => {
  const allSelected = totalVisibleCount > 0 && selectedCount === totalVisibleCount;

  return (
    <div
      role="region"
      aria-label="多选操作栏"
      className="flex min-h-[46px] flex-wrap items-center justify-between gap-3 border-t border-blue-200 bg-blue-50/95 px-4 py-2 text-sm md:px-6"
    >
      <div className="flex items-center gap-3">
        <span className="font-medium text-blue-900">
          多选模式 · 已选择{' '}
          <span className="font-mono-tabular font-semibold">{selectedCount}</span> 项
        </span>
        <button
          type="button"
          onClick={allSelected ? onClearSelection : onSelectAll}
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-white px-2.5 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100/60 whitespace-nowrap shrink-0"
        >
          {allSelected ? (
            <>
              <Square className="h-3.5 w-3.5" />
              取消全选
            </>
          ) : (
            <>
              <CheckSquare className="h-3.5 w-3.5" />
              全选当前 ({totalVisibleCount})
            </>
          )}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={selectedCount === 0}
          onClick={onStarSelected}
          className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap shrink-0"
        >
          <Bookmark className="h-3.5 w-3.5" />
          收藏所选
        </button>
        <button
          type="button"
          disabled={selectedCount === 0}
          onClick={onUnstarSelected}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap shrink-0"
        >
          取消收藏
        </button>
        <button
          type="button"
          disabled={selectedCount === 0}
          onClick={onDeleteSelected}
          className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
          删除所选
        </button>
        <button
          type="button"
          onClick={onExitMultiSelect}
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-blue-100 hover:text-slate-900 whitespace-nowrap shrink-0"
        >
          <X className="h-3.5 w-3.5" />
          退出多选
        </button>
      </div>
    </div>
  );
};
