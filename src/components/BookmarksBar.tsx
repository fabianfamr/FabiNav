import React from 'react';
import { FolderOpen, Globe, Plus } from 'lucide-react';
import { Bookmark } from '../types';

interface BookmarksBarProps {
  bookmarks: Bookmark[];
  onNavigate: (url: string) => void;
  onAddBookmark: () => void;
  onOpenBookmarksPage: () => void;
}

export const BookmarksBar: React.FC<BookmarksBarProps> = ({
  bookmarks,
  onNavigate,
  onAddBookmark,
  onOpenBookmarksPage
}) => {
  return (
    <div
      id="fabinav-bookmarks-bar"
      className="h-8 bg-[var(--bn-toolbar)] border-b border-[var(--bn-border)] px-3 flex items-center justify-between text-xs select-none z-30 shrink-0"
    >
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1">
        <button
          type="button"
          onClick={onOpenBookmarksPage}
          title="Administrador de marcadores"
          className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[var(--bn-text)] hover:bg-[var(--bn-hover)] active:scale-95 text-[11px] font-medium shrink-0 transition-all fabi-transition-xs"
        >
          <FolderOpen className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
          <span>Marcadores</span>
        </button>

        <span className="h-3.5 w-[1px] bg-[var(--bn-border)] mx-1 shrink-0" aria-hidden="true" />

        {bookmarks.length > 0 ? (
          <div className="flex items-center gap-1">
            {bookmarks.slice(0, 12).map((bm) => (
              <button
                key={bm.id}
                type="button"
                onClick={() => onNavigate(bm.url)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[var(--bn-text)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)] active:scale-95 text-[11px] shrink-0 transition-all fabi-transition-xs whitespace-nowrap"
                title={`${bm.title} · ${bm.url}`}
              >
                <Globe className="w-3 h-3 text-[var(--bn-text-muted)]" />
                <span className="truncate max-w-[140px]">{bm.title}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[11px] text-[var(--bn-text-muted)]">
            <span>Para acceder rápido, guarda marcadores aquí.</span>
            <button
              type="button"
              onClick={onAddBookmark}
              className="text-[var(--bn-accent)] hover:underline font-medium"
            >
              Guardar página actual
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onAddBookmark}
        title="Añadir pestaña actual a marcadores"
        className="p-1 rounded-full text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)] active:scale-90 transition-all fabi-transition-xs shrink-0 ml-2"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
