import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Home,
  Lock,
  Shield,
  ShieldOff,
  Star,
  Columns,
  Search,
  PanelRight,
  Menu as MenuIcon,
  Globe,
  History,
  Bookmark as BookmarkIcon,
  Download,
  Settings,
  Info,
  RotateCcw,
  EyeOff,
  Terminal,
  Laptop,
  Plus,
  Printer
} from 'lucide-react';
import { WebTab, BrowserProfile, Bookmark, HistoryEntry, BrowserSettings } from '../types';

interface TitleBarProps {
  currentTab?: WebTab;
  profile: BrowserProfile;
  bookmarks: Bookmark[];
  historyEntries: HistoryEntry[];
  settings: BrowserSettings;
  omniboxRef?: React.RefObject<HTMLInputElement | null>;
  onNavigate: (url: string) => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onReload: () => void;
  onGoHome: () => void;
  onToggleBookmark: () => void;
  onToggleSplitMode: () => void;
  onToggleShieldsModal: () => void;
  onToggleSidebar: () => void;
  onOpenProfileModal: () => void;
  onOpenElectronModal: () => void;
  onOpenDevTools: () => void;
  onNewTab: () => void;
  onNewPrivateTab: () => void;
  onReopenClosedTab: () => void;
  canReopenClosedTab: boolean;
  onToggleBookmarksBar: () => void;
  isSplitActive: boolean;
  adBlockCount: number;
  isShieldActive: boolean;
}

const INTERNAL_SUGGESTIONS = [
  { title: 'Nueva pestaña', url: 'fabinav://newtab', kind: 'FabiNav' },
  { title: 'Escudos de privacidad', url: 'fabinav://shields', kind: 'FabiNav' },
  { title: 'Historial de navegación', url: 'fabinav://history', kind: 'FabiNav' },
  { title: 'Administrador de marcadores', url: 'fabinav://bookmarks', kind: 'FabiNav' },
  { title: 'Descargas', url: 'fabinav://downloads', kind: 'FabiNav' },
  { title: 'Configuración', url: 'fabinav://settings', kind: 'FabiNav' },
  { title: 'Acerca de FabiNav', url: 'fabinav://about', kind: 'FabiNav' }
];

export const TitleBar: React.FC<TitleBarProps> = ({
  currentTab,
  profile,
  bookmarks,
  historyEntries,
  settings,
  omniboxRef,
  onNavigate,
  onGoBack,
  onGoForward,
  onReload,
  onGoHome,
  onToggleBookmark,
  onToggleSplitMode,
  onToggleShieldsModal,
  onToggleSidebar,
  onOpenProfileModal,
  onOpenElectronModal,
  onOpenDevTools,
  onNewTab,
  onNewPrivateTab,
  onReopenClosedTab,
  canReopenClosedTab,
  onToggleBookmarksBar,
  isSplitActive,
  adBlockCount,
  isShieldActive
}) => {
  const [inputUrl, setInputUrl] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showBraveMenu, setShowBraveMenu] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentTab) {
      setInputUrl(
        currentTab.url === 'fabinav://newtab' ? '' : currentTab.displayUrl || currentTab.url
      );
    }
  }, [currentTab?.id, currentTab?.url, currentTab?.displayUrl]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowBraveMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const query = inputUrl.trim().toLowerCase();
  const suggestions =
    isFocused && query.length > 0 && query !== currentTab?.url.toLowerCase()
      ? [
          ...INTERNAL_SUGGESTIONS.filter(
            (s) => s.title.toLowerCase().includes(query) || s.url.toLowerCase().includes(query)
          ),
          ...bookmarks
            .filter(
              (b) => b.title.toLowerCase().includes(query) || b.url.toLowerCase().includes(query)
            )
            .map((b) => ({ title: b.title, url: b.url, kind: 'Marcador' })),
          ...historyEntries
            .filter(
              (h) => h.title.toLowerCase().includes(query) || h.url.toLowerCase().includes(query)
            )
            .map((h) => ({ title: h.title, url: h.url, kind: 'Historial' }))
        ].slice(0, 6)
      : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
      onNavigate(suggestions[selectedSuggestionIndex].url);
      setIsFocused(false);
      setSelectedSuggestionIndex(-1);
      omniboxRef?.current?.blur();
      return;
    }

    if (!inputUrl.trim()) return;
    onNavigate(inputUrl.trim());
    setIsFocused(false);
    setSelectedSuggestionIndex(-1);
    omniboxRef?.current?.blur();
  };

  const handleOmniboxKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Escape') {
      setIsFocused(false);
      setSelectedSuggestionIndex(-1);
    }
  };

  return (
    <header
      id="fabinav-toolbar"
      className="h-11 bg-[var(--bn-toolbar)] border-b border-[var(--bn-border)] flex items-center justify-between px-2.5 gap-2 select-none z-40 shrink-0 text-xs relative"
    >
      {/* Left: Classic Chromium/Brave Navigation Buttons */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={onGoBack}
          disabled={!currentTab?.canGoBack}
          title="Ir atrás (Alt+Izquierda)"
          className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--bn-text)] hover:bg-[var(--bn-hover)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onGoForward}
          disabled={!currentTab?.canGoForward}
          title="Ir adelante (Alt+Derecha)"
          className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--bn-text)] hover:bg-[var(--bn-hover)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onReload}
          title="Volver a cargar esta página (Ctrl+R)"
          className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--bn-text)] hover:bg-[var(--bn-hover)] transition-colors"
        >
          <RotateCw className={`w-3.5 h-3.5 ${currentTab?.isLoading ? 'animate-spin text-[var(--bn-accent)]' : ''}`} />
        </button>
        {settings.showHomeButton && (
          <button
            type="button"
            onClick={onGoHome}
            title="Abrir página principal"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--bn-text)] hover:bg-[var(--bn-hover)] transition-colors"
          >
            <Home className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Center: Brave Signature Full-Pill Omnibox */}
      <div className="flex-1 max-w-4xl mx-auto flex items-center relative">
        <form
          onSubmit={handleSubmit}
          className={`flex-1 flex items-center h-8 px-3 rounded-full border transition-colors duration-150 ${
            isFocused
              ? 'bg-[var(--bn-omnibox-focus)] border-[var(--bn-accent)] ring-2 ring-[var(--bn-accent)]/25'
              : 'bg-[var(--bn-omnibox)] border-transparent hover:border-[var(--bn-border-strong)]'
          }`}
        >
          {/* Left Security / Search indicator */}
          <div className="mr-2.5 shrink-0 flex items-center">
            {currentTab?.tabMode === 'private' ? (
              <EyeOff className="w-3.5 h-3.5 text-[#a78bfa]" />
            ) : currentTab?.url.startsWith('https://') ? (
              <Lock className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
            ) : (
              <Search className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
            )}
          </div>

          <input
            ref={omniboxRef}
            type="text"
            value={inputUrl}
            onChange={(e) => {
              setInputUrl(e.target.value);
              setSelectedSuggestionIndex(-1);
            }}
            onFocus={(e) => {
              setIsFocused(true);
              if (currentTab?.url && currentTab.url !== 'fabinav://newtab') {
                setInputUrl(currentTab.url);
              }
              setTimeout(() => e.target.select(), 0);
            }}
            onBlur={() => {
              setTimeout(() => {
                setIsFocused(false);
                if (currentTab) {
                  setInputUrl(currentTab.url === 'fabinav://newtab' ? '' : currentTab.url);
                }
              }, 150);
            }}
            onKeyDown={handleOmniboxKeyDown}
            placeholder="Busca en la web o escribe una dirección URL"
            className="w-full bg-transparent border-none text-[13px] text-[var(--bn-text-strong)] placeholder-[var(--bn-text-muted)] focus:outline-none"
            aria-label="Barra de direcciones y búsqueda"
          />

          {/* Right inside Pill: Zoom indicator & Bookmark Star */}
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {settings.zoomLevel !== 100 && (
              <span className="text-[11px] font-mono text-[var(--bn-text-muted)] tabular-nums px-1.5 py-0.5 rounded bg-[var(--bn-hover)]">
                {settings.zoomLevel}%
              </span>
            )}
            <button
              type="button"
              onClick={onToggleBookmark}
              title={currentTab?.isBookmarked ? 'Editar o quitar marcador' : 'Añadir esta pestaña a marcadores'}
              className={`p-1 rounded-full hover:bg-[var(--bn-hover)] transition-colors ${
                currentTab?.isBookmarked
                  ? 'text-[var(--bn-info)]'
                  : 'text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)]'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${currentTab?.isBookmarked ? 'fill-current' : ''}`} />
            </button>
          </div>
        </form>

        {/* Brave Shields Icon Attached Right Next to Omnibox */}
        <button
          type="button"
          onClick={onToggleShieldsModal}
          title={`Escudos FabiShields: ${isShieldActive ? `${adBlockCount} bloqueados` : 'Desactivados'}`}
          className="ml-1.5 relative w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--bn-hover)] transition-colors shrink-0"
        >
          {isShieldActive ? (
            <Shield className="w-4.5 h-4.5 text-[var(--bn-accent)] fill-[var(--bn-accent)]/20" />
          ) : (
            <ShieldOff className="w-4.5 h-4.5 text-[var(--bn-text-muted)]" />
          )}
          {isShieldActive && adBlockCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-[var(--bn-accent)] text-white text-[9px] font-semibold flex items-center justify-center tabular-nums">
              {adBlockCount}
            </span>
          )}
        </button>

        {/* Omnibox Autocomplete */}
        {suggestions.length > 0 && (
          <div className="absolute left-0 right-10 top-10 bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-xl shadow-2xl z-50 overflow-hidden py-1.5">
            {suggestions.map((item, idx) => (
              <button
                key={`${item.url}-${idx}`}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onNavigate(item.url);
                  setIsFocused(false);
                }}
                className={`w-full px-3.5 py-2 text-left flex items-center justify-between gap-3 text-xs transition-colors ${
                  idx === selectedSuggestionIndex
                    ? 'bg-[var(--bn-active)] text-[var(--bn-text-strong)]'
                    : 'text-[var(--bn-text)] hover:bg-[var(--bn-hover)]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Globe className="w-3.5 h-3.5 text-[var(--bn-text-muted)] shrink-0" />
                  <span className="truncate font-medium">{item.title}</span>
                  <span className="text-[11px] text-[var(--bn-text-muted)] truncate">{item.url}</span>
                </div>
                <span className="text-[10px] text-[var(--bn-text-muted)] shrink-0">{item.kind}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: Brave Toolbar Extensions & Menu */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={onToggleSplitMode}
          title="Vista dividida (Ctrl+\)"
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
            isSplitActive
              ? 'text-[var(--bn-accent)] bg-[var(--bn-accent-soft)]'
              : 'text-[var(--bn-text)] hover:bg-[var(--bn-hover)]'
          }`}
        >
          <Columns className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onToggleSidebar}
          title={settings.showSidebar ? 'Ocultar barra lateral' : 'Mostrar barra lateral'}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
            settings.showSidebar
              ? 'text-[var(--bn-text-strong)] bg-[var(--bn-hover)]/60'
              : 'text-[var(--bn-text)] hover:bg-[var(--bn-hover)]'
          }`}
        >
          <PanelRight className="w-4 h-4" />
        </button>

        {/* Profile Avatar */}
        <button
          type="button"
          onClick={onOpenProfileModal}
          title={`Perfil local: ${profile.name} (${profile.email})`}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--bn-hover)] transition-colors"
        >
          <img
            src={profile.avatarUrl}
            alt={profile.name}
            referrerPolicy="no-referrer"
            className="w-6 h-6 rounded-full object-cover border border-[var(--bn-border-strong)]"
          />
        </button>

        {/* Brave Main Hamburger Menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowBraveMenu(!showBraveMenu)}
            title="Personaliza y controla FabiNav"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--bn-text)] hover:bg-[var(--bn-hover)] transition-colors"
          >
            <MenuIcon className="w-4 h-4" />
          </button>

          {showBraveMenu && (
            <div className="absolute right-0 top-10 w-64 bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] shadow-2xl z-50 text-xs py-1.5 text-[var(--bn-text)] rounded-xl">
              <button
                type="button"
                onClick={() => {
                  onNewTab();
                  setShowBraveMenu(false);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nueva pestaña</span>
                </span>
                <span className="text-[10px] font-mono text-[var(--bn-text-muted)]">Ctrl+T</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onNewPrivateTab();
                  setShowBraveMenu(false);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <EyeOff className="w-3.5 h-3.5 text-[#a78bfa]" />
                  <span>Nueva pestaña privada</span>
                </span>
              </button>

              {canReopenClosedTab && (
                <button
                  type="button"
                  onClick={() => {
                    onReopenClosedTab();
                    setShowBraveMenu(false);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reabrir pestaña cerrada</span>
                  </span>
                  <span className="text-[10px] font-mono text-[var(--bn-text-muted)]">Ctrl+Shift+T</span>
                </button>
              )}

              <div className="h-[1px] bg-[var(--bn-border)] my-1.5" />

              <button
                type="button"
                onClick={() => {
                  onNavigate('fabinav://bookmarks');
                  setShowBraveMenu(false);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <BookmarkIcon className="w-3.5 h-3.5" />
                  <span>Marcadores</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onNavigate('fabinav://history');
                  setShowBraveMenu(false);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <History className="w-3.5 h-3.5" />
                  <span>Historial</span>
                </span>
                <span className="text-[10px] font-mono text-[var(--bn-text-muted)]">Ctrl+H</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onNavigate('fabinav://downloads');
                  setShowBraveMenu(false);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargas</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onToggleBookmarksBar();
                  setShowBraveMenu(false);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
              >
                <span>Mostrar barra de marcadores</span>
                <span className="text-[10px] font-mono text-[var(--bn-text-muted)]">
                  {settings.showBookmarksBar ? 'Sí' : 'No'}
                </span>
              </button>

              <div className="h-[1px] bg-[var(--bn-border)] my-1.5" />

              <button
                type="button"
                onClick={() => {
                  setShowBraveMenu(false);
                  window.print();
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir...</span>
                </span>
                <span className="text-[10px] font-mono text-[var(--bn-text-muted)]">Ctrl+P</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onOpenDevTools();
                  setShowBraveMenu(false);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Herramientas para desarrolladores</span>
                </span>
                <span className="text-[10px] font-mono text-[var(--bn-text-muted)]">F12</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onOpenElectronModal();
                  setShowBraveMenu(false);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <Laptop className="w-3.5 h-3.5" />
                  <span>Exportar proyecto Electron</span>
                </span>
              </button>

              <div className="h-[1px] bg-[var(--bn-border)] my-1.5" />

              <button
                type="button"
                onClick={() => {
                  onNavigate('fabinav://settings');
                  setShowBraveMenu(false);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <Settings className="w-3.5 h-3.5" />
                  <span>Configuración</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onNavigate('fabinav://about');
                  setShowBraveMenu(false);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <Info className="w-3.5 h-3.5" />
                  <span>Acerca de FabiNav</span>
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
