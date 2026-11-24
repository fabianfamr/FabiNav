import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Home,
  Lock,
  ShieldOff,
  ShieldCheck,
  ShieldAlert,
  Star,
  Columns,
  Search,
  PanelRight,
  PanelLeft,
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
  Printer,
  User,
  Cookie,
  Trash2,
  X,
  Compass,
  ChevronRight,
  Minus,
  Maximize2,
  Minimize2,
  HelpCircle,
  LogOut,
  Wrench,
  StickyNote,
  ZoomIn,
  AppWindow,
  Scissors,
  Copy,
  Clipboard,
  FileDown,
  Camera,
  Link2,
  QrCode,
  Activity,
  Tag,
  Check,
  PanelTop,
  Command,
  Puzzle,
  Languages,
  Pin
} from 'lucide-react';
import {
  WebTab,
  Bookmark,
  HistoryEntry,
  ClosedTabRecord,
  BrowserSettings,
  GoogleUserProfile,
  TlsInspectionResult,
  StoredCookieItem,
  BrowserExtension
} from '../types';
import { t } from '../i18n/translations';
import { FabiSwitch } from './FabiSwitch';

interface TitleBarProps {
  currentTab?: WebTab;
  googleUser: GoogleUserProfile | null;
  bookmarks: Bookmark[];
  historyEntries: HistoryEntry[];
  closedTabs: ClosedTabRecord[];
  settings: BrowserSettings;
  extensions?: BrowserExtension[];
  omniboxRef?: React.RefObject<HTMLInputElement | null>;
  onNavigate: (url: string) => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onReload: () => void;
  onGoHome: () => void;
  onUpdateSettings: (updates: Partial<BrowserSettings>) => void;
  onToggleExtension?: (id: string) => void;
  onUpdateExtension?: (id: string, updates: Partial<BrowserExtension>) => void;
  onTranslatePage?: () => void;
  onResetZoom: () => void;
  onToggleBookmark: () => void;
  onToggleSplitMode: () => void;
  onToggleShieldsModal: () => void;
  onToggleSidebar: () => void;
  onOpenBackupModal: () => void;
  onOpenElectronModal: () => void;
  onOpenDevTools: () => void;
  onOpenNotes: () => void;
  onOpenCommandPalette: () => void;
  onNewTab: () => void;
  onNewWindow: () => void;
  onNewPrivateTab: () => void;
  onReopenClosedTab: (recordId?: string) => void;
  canReopenClosedTab: boolean;
  onToggleBookmarksBar: () => void;
  onClearBrowsingData: () => void;
  onOpenFindInPage: () => void;
  onEditAction: (action: 'cut' | 'copy' | 'paste') => void;
  onSavePageAs: () => void;
  onCaptureView: () => void;
  onCopyLink: () => void;
  onOpenQrModal: () => void;
  onOpenTabSearch: () => void;
  onOpenRenameWindow: () => void;
  onOpenTaskManager: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onCloseWindow: () => void;
  isSplitActive: boolean;
  shieldCount: number;
  isShieldActive: boolean;
}

const INTERNAL_SUGGESTIONS = [
  { title: 'Nueva pestaña', url: 'fabinav://newtab', kind: 'FabiNav' },
  { title: 'Extensiones', url: 'fabinav://extensions', kind: 'FabiNav' },
  { title: 'Escudos, Cookies y TLS', url: 'fabinav://shields', kind: 'FabiNav' },
  { title: 'Historial de navegación', url: 'fabinav://history', kind: 'FabiNav' },
  { title: 'Administrador de marcadores', url: 'fabinav://bookmarks', kind: 'FabiNav' },
  { title: 'Descargas', url: 'fabinav://downloads', kind: 'FabiNav' },
  { title: 'Configuración', url: 'fabinav://settings', kind: 'FabiNav' },
  { title: 'Acerca de FabiNav', url: 'fabinav://about', kind: 'FabiNav' }
];

const ZOOM_STEPS = [50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200];
const EASE_OUT: [number, number, number, number] = [0, 0, 0.58, 1];

type MenuSubmenuId =
  | 'history'
  | 'bookmarks'
  | 'findEdit'
  | 'saveShare'
  | 'moreTools'
  | 'help';

export const TitleBar: React.FC<TitleBarProps> = ({
  currentTab,
  googleUser,
  bookmarks,
  historyEntries,
  closedTabs,
  settings,
  extensions = [],
  omniboxRef,
  onNavigate,
  onGoBack,
  onGoForward,
  onReload,
  onGoHome,
  onUpdateSettings,
  onToggleExtension,
  onUpdateExtension,
  onTranslatePage,
  onResetZoom,
  onToggleBookmark,
  onToggleSplitMode,
  onToggleShieldsModal,
  onToggleSidebar,
  onOpenBackupModal,
  onOpenElectronModal,
  onOpenDevTools,
  onOpenNotes,
  onOpenCommandPalette,
  onNewTab,
  onNewWindow,
  onNewPrivateTab,
  onReopenClosedTab,
  canReopenClosedTab,
  onToggleBookmarksBar,
  onClearBrowsingData,
  onOpenFindInPage,
  onEditAction,
  onSavePageAs,
  onCaptureView,
  onCopyLink,
  onOpenQrModal,
  onOpenTabSearch,
  onOpenRenameWindow,
  onOpenTaskManager,
  isFullscreen,
  onToggleFullscreen,
  onCloseWindow,
  isSplitActive,
  shieldCount,
  isShieldActive
}) => {
  const [inputUrl, setInputUrl] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showMainMenu, setShowMainMenu] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<MenuSubmenuId | null>(null);
  const [showSecurityPopover, setShowSecurityPopover] = useState(false);
  const [showExtensionsPopover, setShowExtensionsPopover] = useState(false);
  const [tlsInfo, setTlsInfo] = useState<TlsInspectionResult | null>(null);
  const [siteCookies, setSiteCookies] = useState<StoredCookieItem[]>([]);
  const [loadingSecurity, setLoadingSecurity] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const lang = settings.language || 'es';
  const menuRef = useRef<HTMLDivElement>(null);
  const securityRef = useRef<HTMLDivElement>(null);
  const extensionsRef = useRef<HTMLDivElement>(null);
  const submenuCloseTimer = useRef<number | null>(null);

  const openSubmenu = (id: MenuSubmenuId | null) => {
    if (submenuCloseTimer.current) {
      window.clearTimeout(submenuCloseTimer.current);
      submenuCloseTimer.current = null;
    }
    setActiveSubmenu(id);
  };

  const scheduleCloseSubmenu = () => {
    if (submenuCloseTimer.current) {
      window.clearTimeout(submenuCloseTimer.current);
    }
    submenuCloseTimer.current = window.setTimeout(() => {
      setActiveSubmenu(null);
    }, 160);
  };

  useEffect(() => {
    if (currentTab) {
      if (currentTab.url === 'fabinav://newtab') {
        setInputUrl('');
      } else if (currentTab.url.startsWith('fabinav://search?q=')) {
        setInputUrl(decodeURIComponent(currentTab.url.replace('fabinav://search?q=', '')));
      } else {
        setInputUrl(currentTab.displayUrl || currentTab.url);
      }
    }
    setShowSecurityPopover(false);
  }, [currentTab?.id, currentTab?.url, currentTab?.displayUrl]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMainMenu(false);
        setActiveSubmenu(null);
      }
      if (securityRef.current && !securityRef.current.contains(e.target as Node)) {
        setShowSecurityPopover(false);
      }
      if (extensionsRef.current && !extensionsRef.current.contains(e.target as Node)) {
        setShowExtensionsPopover(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowMainMenu(false);
        setActiveSubmenu(null);
        setShowSecurityPopover(false);
        setShowExtensionsPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
      if (submenuCloseTimer.current) {
        window.clearTimeout(submenuCloseTimer.current);
      }
    };
  }, []);

  const isExternalUrl =
    !!currentTab?.url &&
    (currentTab.url.startsWith('https://') || currentTab.url.startsWith('http://'));

  const currentHost = (() => {
    if (!isExternalUrl || !currentTab?.url) return '';
    try {
      return new URL(currentTab.url).hostname;
    } catch {
      return '';
    }
  })();

  const partition = currentTab?.tabMode === 'private' ? 'private' : 'normal';

  const openSecurityInspector = async () => {
    const next = !showSecurityPopover;
    setShowSecurityPopover(next);
    if (!next || !isExternalUrl || !currentTab?.url) return;

    setLoadingSecurity(true);
    try {
      const [tlsRes, cookiesRes] = await Promise.all([
        fetch(`/api/tls?url=${encodeURIComponent(currentTab.url)}`),
        fetch(`/api/cookies?partition=${partition}&domain=${encodeURIComponent(currentHost)}`)
      ]);
      if (tlsRes.ok) {
        setTlsInfo((await tlsRes.json()) as TlsInspectionResult);
      }
      if (cookiesRes.ok) {
        const cData = (await cookiesRes.json()) as { cookies?: StoredCookieItem[] };
        setSiteCookies(cData.cookies || []);
      }
    } catch {
      // Ignore transient network errors
    } finally {
      setLoadingSecurity(false);
    }
  };

  const handleClearSiteCookies = async () => {
    if (!currentHost) return;
    await fetch(
      `/api/cookies?partition=${partition}&domain=${encodeURIComponent(currentHost)}`,
      { method: 'DELETE' }
    );
    setSiteCookies([]);
  };

  const handleStepZoom = (direction: -1 | 1) => {
    const currentIdx = ZOOM_STEPS.findIndex((z) => z >= settings.zoomLevel);
    const idx = currentIdx === -1 ? ZOOM_STEPS.indexOf(100) : currentIdx;
    const nextIdx = Math.min(ZOOM_STEPS.length - 1, Math.max(0, idx + direction));
    onUpdateSettings({ zoomLevel: ZOOM_STEPS[nextIdx] });
  };

  const sidebarMode: 'on' | 'auto' | 'off' =
    settings.sidebarMode || (settings.showSidebar ? 'on' : 'off');

  const setSidebarMode = (mode: 'on' | 'auto' | 'off') => {
    onUpdateSettings({
      sidebarMode: mode,
      showSidebar: mode !== 'off'
    });
  };

  const trimmedInput = inputUrl.trim();
  const query = trimmedInput.toLowerCase();
  const looksLikeUrl =
    trimmedInput.startsWith('http://') ||
    trimmedInput.startsWith('https://') ||
    trimmedInput.startsWith('fabinav://') ||
    (trimmedInput.includes('.') && !trimmedInput.includes(' '));

  const matchedSuggestions =
    isFocused && query.length > 0 && query !== currentTab?.url.toLowerCase()
      ? [
          {
            title: looksLikeUrl
              ? `Ir a ${trimmedInput}`
              : `Buscar «${trimmedInput}» en FabiNav Search`,
            url: trimmedInput,
            kind: looksLikeUrl ? 'Sitio web' : 'Búsqueda'
          },
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
        ].slice(0, 7)
      : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSuggestionIndex >= 0 && matchedSuggestions[selectedSuggestionIndex]) {
      onNavigate(matchedSuggestions[selectedSuggestionIndex].url);
      setIsFocused(false);
      setSelectedSuggestionIndex(-1);
      omniboxRef?.current?.blur();
      return;
    }

    if (!trimmedInput) return;
    onNavigate(trimmedInput);
    setIsFocused(false);
    setSelectedSuggestionIndex(-1);
    omniboxRef?.current?.blur();
  };

  const handleOmniboxKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsFocused(false);
      setSelectedSuggestionIndex(-1);
      omniboxRef?.current?.blur();
      return;
    }
    if (!matchedSuggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) => (prev + 1) % matchedSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex(
        (prev) => (prev - 1 + matchedSuggestions.length) % matchedSuggestions.length
      );
    }
  };

  const renderSuggestionIcon = (kind: string) => {
    if (kind === 'Marcador') return <Star className="w-3.5 h-3.5 text-[var(--bn-accent)] shrink-0" />;
    if (kind === 'Historial') return <History className="w-3.5 h-3.5 text-[var(--bn-info-text)] shrink-0" />;
    if (kind === 'FabiNav') return <Compass className="w-3.5 h-3.5 text-[var(--bn-accent)] shrink-0" />;
    if (kind === 'Búsqueda') return <Search className="w-3.5 h-3.5 text-[var(--bn-text-muted)] shrink-0" />;
    return <Globe className="w-3.5 h-3.5 text-[var(--bn-text-muted)] shrink-0" />;
  };

  return (
    <header
      id="fabinav-toolbar"
      className="h-11 bg-[var(--bn-toolbar)] border-b border-[var(--bn-border)] flex items-center justify-between px-2.5 gap-2 select-none z-40 shrink-0 text-xs relative"
    >
      {/* Left: Navigation & Bookmark Actions */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={onGoBack}
          disabled={!currentTab?.canGoBack}
          title={t(lang, 'back')}
          className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--bn-text)] hover:bg-[var(--bn-hover)] active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent transition-all fabi-transition-xs"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onGoForward}
          disabled={!currentTab?.canGoForward}
          title={t(lang, 'forward')}
          className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--bn-text)] hover:bg-[var(--bn-hover)] active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent transition-all fabi-transition-xs"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onReload}
          title={t(lang, 'reload')}
          className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--bn-text)] hover:bg-[var(--bn-hover)] active:scale-90 transition-all fabi-transition-xs"
        >
          <RotateCw
            className={`w-3.5 h-3.5 ${
              currentTab?.isLoading ? 'animate-spin text-[var(--bn-accent)]' : ''
            }`}
          />
        </button>
        {settings.showHomeButton && (
          <button
            type="button"
            onClick={onGoHome}
            title={t(lang, 'home')}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--bn-text)] hover:bg-[var(--bn-hover)] active:scale-90 transition-all fabi-transition-xs"
          >
            <Home className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onToggleBookmark}
          title={
            currentTab?.isBookmarked
              ? t(lang, 'bookmarkRemove')
              : t(lang, 'bookmarkAdd')
          }
          className={`w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--bn-hover)] active:scale-90 transition-all fabi-transition-xs ${
            currentTab?.isBookmarked
              ? 'text-[var(--bn-accent)]'
              : 'text-[var(--bn-text)] hover:text-[var(--bn-text-strong)]'
          }`}
        >
          <BookmarkIcon className={`w-4 h-4 ${currentTab?.isBookmarked ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Center: FabiNav Omnibox with Integrated Shield & TLS Inspector */}
      <div className="flex-1 max-w-4xl mx-auto flex items-center relative" ref={securityRef}>
        <form
          onSubmit={handleSubmit}
          className={`flex-1 flex items-center h-[34px] pl-2 pr-1.5 rounded-full border transition-all fabi-transition-s ${
            isFocused
              ? 'bg-[var(--bn-omnibox-focus)] border-[var(--bn-interactive)] ring-2 ring-[var(--bn-interactive)]/30 shadow-sm'
              : 'bg-[var(--bn-omnibox)] border-transparent hover:border-[var(--bn-border-strong)]'
          }`}
        >
          <button
            type="button"
            onClick={openSecurityInspector}
            title="Ver información TLS, certificado y cookies del sitio"
            className="mr-1.5 p-1 rounded-full hover:bg-[var(--bn-hover)] transition-colors shrink-0 flex items-center justify-center"
          >
            {currentTab?.tabMode === 'private' ? (
              <EyeOff className="w-3.5 h-3.5 text-[var(--bn-private-text)]" />
            ) : currentTab?.url.startsWith('https://') ? (
              <Lock className="w-3.5 h-3.5 text-[var(--bn-success-text)]" />
            ) : currentTab?.url.startsWith('http://') ? (
              <ShieldAlert className="w-3.5 h-3.5 text-[var(--bn-warning-text)]" />
            ) : (
              <Search className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
            )}
          </button>

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
                if (currentTab.url.startsWith('fabinav://search?q=')) {
                  setInputUrl(decodeURIComponent(currentTab.url.replace('fabinav://search?q=', '')));
                } else {
                  setInputUrl(currentTab.url);
                }
              }
              setTimeout(() => e.target.select(), 0);
            }}
            onBlur={() => {
              setTimeout(() => {
                setIsFocused(false);
                if (currentTab) {
                  if (currentTab.url === 'fabinav://newtab') {
                    setInputUrl('');
                  } else if (currentTab.url.startsWith('fabinav://search?q=')) {
                    setInputUrl(decodeURIComponent(currentTab.url.replace('fabinav://search?q=', '')));
                  } else {
                    setInputUrl(currentTab.url);
                  }
                }
              }, 150);
            }}
            onKeyDown={handleOmniboxKeyDown}
            placeholder={t(lang, 'omniboxPlaceholder')}
            className="w-full bg-transparent border-none text-[13px] text-[var(--bn-text-strong)] placeholder-[var(--bn-text-muted)] focus:outline-none select-text"
            aria-label="Barra de direcciones y búsqueda"
          />

          <div className="flex items-center gap-1 shrink-0 ml-1.5">
            {isFocused && inputUrl.length > 0 && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setInputUrl('');
                }}
                title="Limpiar barra de direcciones"
                className="p-1 rounded-full text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)] transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}

            {settings.zoomLevel !== 100 && (
              <button
                type="button"
                onClick={onResetZoom}
                title="Restablecer zoom al 100%"
                className="text-[11px] font-mono text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] tabular-nums px-1.5 py-0.5 rounded-full bg-[var(--bn-hover)] transition-colors"
              >
                {settings.zoomLevel}%
              </button>
            )}

            {/* FabiNav Shield Button Inside Omnibox Right Edge */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={onToggleShieldsModal}
              title={`Escudos de FabiNav: ${isShieldActive ? 'Activos' : 'Desactivados'}`}
              className="relative w-7 h-7 rounded-full flex items-center justify-center hover:bg-[var(--bn-hover)] transition-colors shrink-0"
            >
              {isShieldActive ? (
                <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                  <defs>
                    <linearGradient id="fabiShieldGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#FA7250" />
                      <stop offset="100%" stopColor="#FB542B" />
                    </linearGradient>
                  </defs>
                  <path
                    fill="url(#fabiShieldGrad)"
                    d="M12 2L4 5.2v5.9c0 5.1 3.4 9.7 8 10.9 4.6-1.2 8-5.8 8-10.9V5.2L12 2z"
                  />
                  <path
                    fill="#ffffff"
                    fillOpacity="0.95"
                    d="M9.5 7.5h6v2h-3.8v1.8h3v2h-3v3.5h-2.2V7.5z"
                  />
                </svg>
              ) : (
                <ShieldOff className="w-4 h-4 text-[var(--bn-text-muted)]" />
              )}

              {isShieldActive && shieldCount > 0 && (
                <motion.span
                  key={shieldCount}
                  initial={{ scale: 1.3 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                  className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 rounded-full bg-[var(--bn-accent)] text-white text-[9px] font-semibold flex items-center justify-center tabular-nums shadow"
                >
                  {shieldCount}
                </motion.span>
              )}
            </motion.button>
          </div>
        </form>

        {/* Site TLS Certificate & Cookies Popover */}
        <AnimatePresence>
          {showSecurityPopover && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={{ duration: 0.14, ease: EASE_OUT }}
              className="absolute left-0 top-10 w-80 bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-2xl shadow-2xl z-50 overflow-hidden text-xs"
            >
              {!isExternalUrl ? (
                <div className="p-4 space-y-1.5">
                  <div className="flex items-center gap-2 text-[var(--bn-text-strong)] font-semibold">
                    <ShieldCheck className="w-4 h-4 text-[var(--bn-accent)]" />
                    <span>Página interna de FabiNav</span>
                  </div>
                  <p className="text-[11px] text-[var(--bn-text-muted)] leading-relaxed">
                    Esta vista se ejecuta localmente dentro del navegador sin conexiones externas.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--bn-border)]">
                  <div className="p-3.5 bg-[var(--bn-toolbar)]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--bn-text-strong)] truncate">
                        {currentHost}
                      </span>
                      <span
                        className={`text-[11px] font-medium shrink-0 ${
                          currentTab?.url.startsWith('https://')
                            ? 'text-[var(--bn-success-text)]'
                            : 'text-[var(--bn-warning-text)]'
                        }`}
                      >
                        {currentTab?.url.startsWith('https://') ? 'HTTPS / TLS' : 'HTTP sin TLS'}
                      </span>
                    </div>
                  </div>

                  {/* Real TLS Inspection Details */}
                  <div className="p-3.5 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-medium text-[var(--bn-text-strong)]">
                      <Lock className="w-3.5 h-3.5 text-[var(--bn-success-text)]" />
                      <span>Certificado y cifrado TLS</span>
                    </div>

                    {loadingSecurity ? (
                      <div className="text-[11px] text-[var(--bn-text-muted)]">
                        Inspeccionando conexión TLS...
                      </div>
                    ) : tlsInfo ? (
                      <div className="space-y-1 text-[11px] text-[var(--bn-text-muted)]">
                        <div>
                          Protocolo:{' '}
                          <span className="text-[var(--bn-text-strong)] font-mono">
                            {tlsInfo.protocol || 'No cifrado'}
                          </span>
                          {tlsInfo.cipher ? ` · ${tlsInfo.cipher}` : ''}
                        </div>
                        {tlsInfo.alpnProtocol && (
                          <div>
                            ALPN:{' '}
                            <span className="text-[var(--bn-text-strong)] font-mono">
                              {tlsInfo.alpnProtocol}
                            </span>
                          </div>
                        )}
                        {tlsInfo.issuerO || tlsInfo.issuerCN ? (
                          <div className="truncate">
                            Emisor:{' '}
                            <span className="text-[var(--bn-text-strong)]">
                              {tlsInfo.issuerO || tlsInfo.issuerCN}
                            </span>
                          </div>
                        ) : null}
                        {tlsInfo.validTo ? (
                          <div className="tabular-nums">
                            Expira:{' '}
                            <span className="text-[var(--bn-text-strong)]">
                              {new Date(tlsInfo.validTo).toLocaleDateString('es-ES')}
                            </span>
                          </div>
                        ) : null}
                        <div
                          className={
                            tlsInfo.authorized
                              ? 'text-[var(--bn-success-text)] font-medium'
                              : 'text-[var(--bn-warning-text)] font-medium'
                          }
                        >
                          {tlsInfo.authorized
                            ? 'Certificado verificado correctamente'
                            : tlsInfo.authorizationError || 'Certificado no verificado'}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-[var(--bn-text-muted)]">
                        Sin detalles TLS disponibles.
                      </div>
                    )}
                  </div>

                  {/* Real Site Cookies */}
                  <div className="p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-medium text-[var(--bn-text-strong)] tabular-nums">
                        <Cookie className="w-3.5 h-3.5 text-[var(--bn-accent)]" />
                        <span>Cookies del sitio ({siteCookies.length})</span>
                      </span>
                      {siteCookies.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearSiteCookies}
                          className="text-[11px] text-[var(--bn-danger-text)] hover:underline flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Limpiar</span>
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowSecurityPopover(false);
                          onNavigate('fabinav://shields');
                        }}
                        className="text-[var(--bn-accent)] hover:underline font-medium"
                      >
                        Administrar cookies y TLS
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Omnibox Autocomplete */}
        <AnimatePresence>
          {matchedSuggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.99 }}
              transition={{ duration: 0.12, ease: EASE_OUT }}
              className="absolute left-0 right-0 top-10 bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-2xl shadow-2xl z-50 overflow-hidden py-0"
            >
              {matchedSuggestions.map((item, idx) => (
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
                    {renderSuggestionIcon(item.kind)}
                    <span className="truncate font-medium">{item.title}</span>
                    {item.kind !== 'Búsqueda' && (
                      <span className="text-[11px] text-[var(--bn-text-muted)] truncate">
                        {item.url}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-[var(--bn-text-muted)] shrink-0">{item.kind}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right: Pinned Extensions, FabiNav Toolbar Actions, Google Avatar & Desktop Menu Panel */}
      <div className="flex items-center gap-0.5 shrink-0">
        {extensions
          .filter((ext) => ext.pinned)
          .slice(0, 4)
          .map((ext) => (
            <button
              key={ext.id}
              type="button"
              onClick={() => onToggleExtension?.(ext.id)}
              title={`${ext.name} (${ext.enabled ? 'Activa · clic para desactivar' : 'Inactiva · clic para activar'})`}
              className={`hidden md:flex w-7 h-7 rounded-full items-center justify-center text-[11px] font-bold transition-all fabi-transition-xs relative ${
                ext.enabled
                  ? 'bg-[var(--bn-hover)] text-[var(--bn-text-strong)] ring-1 ring-[var(--bn-accent)]/60'
                  : 'text-[var(--bn-text-muted)] hover:bg-[var(--bn-hover)] opacity-70 hover:opacity-100'
              }`}
            >
              <span
                className="w-4 h-4 rounded-md flex items-center justify-center text-white text-[10px] leading-none"
                style={{ backgroundColor: ext.enabled ? ext.accentColor : 'var(--bn-border-strong)' }}
              >
                {ext.name[0]?.toUpperCase() || 'E'}
              </span>
            </button>
          ))}

        <div className="relative" ref={extensionsRef}>
          {(() => {
            const activeExtCount = extensions.filter((e) => e.enabled).length;
            return (
              <button
                type="button"
                onClick={() => {
                  setShowExtensionsPopover((v) => !v);
                  setShowMainMenu(false);
                  setShowSecurityPopover(false);
                }}
                title={`${t(lang, 'secExtensions')}${activeExtCount > 0 ? ` (${activeExtCount} activas)` : ''}`}
                className={`relative w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-all fabi-transition-xs ${
                  showExtensionsPopover || currentTab?.url.startsWith('fabinav://extensions')
                    ? 'text-[var(--bn-accent)] bg-[var(--bn-accent-soft)]'
                    : 'text-[var(--bn-text)] hover:bg-[var(--bn-hover)]'
                }`}
              >
                <Puzzle className="w-4 h-4" />
                {activeExtCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 rounded-full bg-[var(--bn-accent)] text-white text-[9px] font-semibold flex items-center justify-center tabular-nums shadow">
                    {activeExtCount}
                  </span>
                )}
              </button>
            );
          })()}

          <AnimatePresence>
            {showExtensionsPopover && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.96 }}
                transition={{ duration: 0.14, ease: EASE_OUT }}
                className="absolute right-0 top-10 w-[320px] rounded-2xl overflow-hidden bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] shadow-2xl z-50 text-xs text-[var(--bn-text)] origin-top-right"
              >
                <div className="px-4 py-3 bg-[var(--bn-toolbar)] border-b border-[var(--bn-border)] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold text-[var(--bn-text-strong)]">
                    <Puzzle className="w-4 h-4 text-[var(--bn-accent)]" />
                    <span>{t(lang, 'secExtensions')}</span>
                  </div>
                  <span className="text-[11px] text-[var(--bn-text-muted)] tabular-nums">
                    {extensions.filter((e) => e.enabled).length} / {extensions.length} activas
                  </span>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-[var(--bn-border)]">
                  {extensions.length === 0 ? (
                    <div className="p-5 text-center text-[11px] text-[var(--bn-text-muted)]">
                      No hay extensiones instaladas.
                    </div>
                  ) : (
                    extensions.map((ext) => (
                      <div
                        key={ext.id}
                        className="px-3.5 py-2.5 flex items-center justify-between gap-2.5 hover:bg-[var(--bn-hover)]/50 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span
                            className="w-7 h-7 rounded-lg text-white font-bold text-xs flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor: ext.enabled
                                ? ext.accentColor
                                : 'var(--bn-border-strong)'
                            }}
                          >
                            {ext.name[0]?.toUpperCase() || 'E'}
                          </span>
                          <div className="min-w-0">
                            <div className="font-medium text-[var(--bn-text-strong)] truncate">
                              {ext.name}
                            </div>
                            <div className="text-[10px] text-[var(--bn-text-muted)] truncate">
                              {ext.enabled ? 'Activa en páginas' : 'Desactivada'} · v{ext.version}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {onUpdateExtension && (
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateExtension(ext.id, { pinned: !ext.pinned })
                              }
                              title={
                                ext.pinned
                                  ? 'Desfijar de la barra'
                                  : 'Fijar en la barra'
                              }
                              className={`p-1.5 rounded-full transition-colors ${
                                ext.pinned
                                  ? 'text-[var(--bn-accent)] bg-[var(--bn-accent-soft)]'
                                  : 'text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)]'
                              }`}
                            >
                              <Pin className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <FabiSwitch
                            size="sm"
                            checked={ext.enabled}
                            onChange={() => onToggleExtension?.(ext.id)}
                            ariaLabel={ext.name}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="px-3.5 py-2.5 bg-[var(--bn-toolbar)] border-t border-[var(--bn-border)] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowExtensionsPopover(false);
                      onNavigate('fabinav://extensions');
                    }}
                    className="text-[11px] font-medium text-[var(--bn-accent)] hover:underline flex items-center gap-1.5"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Administrar extensiones</span>
                  </button>
                  {extensions.some((e) => e.mode === 'stylus' || e.mode === 'custom-css') && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowExtensionsPopover(false);
                        onNavigate('fabinav://extensions');
                      }}
                      className="text-[11px] text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:underline"
                    >
                      Editar CSS
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="h-4 w-[1px] bg-[var(--bn-border)] mx-0.5 hidden sm:block" />

        <button
          type="button"
          onClick={onToggleSplitMode}
          title={t(lang, 'splitView')}
          className={`w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-all fabi-transition-xs ${
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
          title={settings.showSidebar ? t(lang, 'hideSidebarTooltip') : t(lang, 'showSidebarTooltip')}
          className={`w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-all fabi-transition-xs ${
            settings.showSidebar
              ? 'text-[var(--bn-text-strong)] bg-[var(--bn-hover)]/65'
              : 'text-[var(--bn-text)] hover:bg-[var(--bn-hover)]'
          }`}
        >
          <PanelRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onOpenBackupModal}
          title={
            googleUser
              ? `${googleUser.displayName} (${googleUser.email})`
              : 'Iniciar sesión con Google o respaldo local'
          }
          className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--bn-text)] hover:bg-[var(--bn-hover)] active:scale-90 transition-all fabi-transition-xs"
        >
          {googleUser?.photoUrl ? (
            <img
              src={googleUser.photoUrl}
              alt={googleUser.displayName}
              referrerPolicy="no-referrer"
              className="w-6.5 h-6.5 rounded-full object-cover border border-[var(--bn-border-strong)]"
            />
          ) : googleUser ? (
            <span className="w-6.5 h-6.5 rounded-full bg-[var(--bn-accent)] text-white text-[11px] font-semibold flex items-center justify-center">
              {googleUser.displayName[0]?.toUpperCase() || 'G'}
            </span>
          ) : (
            <User className="w-4 h-4" />
          )}
        </button>

        {/* FabiNav Main Desktop Menu Panel with Cascading Left Flyouts */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => {
              setShowMainMenu((v) => !v);
              setActiveSubmenu(null);
            }}
            title={t(lang, 'menuTooltip')}
            className={`w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-all fabi-transition-xs ${
              showMainMenu
                ? 'bg-[var(--bn-hover)] text-[var(--bn-text-strong)]'
                : 'text-[var(--bn-text)] hover:bg-[var(--bn-hover)]'
            }`}
          >
            <MenuIcon className="w-4 h-4" />
          </button>

          <AnimatePresence>
            {showMainMenu && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.96 }}
                transition={{ duration: 0.14, ease: EASE_OUT }}
                onMouseLeave={scheduleCloseSubmenu}
                className="absolute right-0 top-10 w-[316px] overflow-visible bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] shadow-2xl z-50 text-[12px] py-0 text-[var(--bn-text)] rounded-xl origin-top-right"
              >
                {/* Chrome-style Top Profile Header */}
                <button
                  type="button"
                  onMouseEnter={() => openSubmenu(null)}
                  onClick={() => {
                    setShowMainMenu(false);
                    onOpenBackupModal();
                  }}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-[var(--bn-hover)] border-b border-[var(--bn-border)] rounded-t-[11px] text-left transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {googleUser?.photoUrl ? (
                      <img
                        src={googleUser.photoUrl}
                        alt={googleUser.displayName}
                        referrerPolicy="no-referrer"
                        className="w-7 h-7 rounded-full object-cover border border-[var(--bn-border-strong)] shrink-0"
                      />
                    ) : (
                      <span className="w-7 h-7 rounded-full bg-[var(--bn-accent)] text-white text-[11px] font-semibold flex items-center justify-center shrink-0">
                        {googleUser?.displayName?.[0]?.toUpperCase() || <User className="w-3.5 h-3.5" />}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold text-[var(--bn-text-strong)] truncate">
                        {googleUser ? googleUser.displayName : 'FabiNav'}
                      </div>
                      <div className="text-[11px] text-[var(--bn-text-muted)] truncate">
                        {googleUser ? t(lang, 'menuProfileSignedIn') : t(lang, 'menuProfileSignIn')}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--bn-text-muted)] shrink-0" />
                </button>
                {/* Section 1: Tabs & Windows */}
                <button
                  type="button"
                  onMouseEnter={() => openSubmenu(null)}
                  onClick={() => {
                    onNewTab();
                    setShowMainMenu(false);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <Plus className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                    <span>{t(lang, 'newTab')}</span>
                  </span>
                  <span className="text-[11px] text-[var(--bn-text-muted)]">Ctrl+T</span>
                </button>

                <button
                  type="button"
                  onMouseEnter={() => openSubmenu(null)}
                  onClick={() => {
                    onNewWindow();
                    setShowMainMenu(false);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <AppWindow className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                    <span>{t(lang, 'menuNewWindow')}</span>
                  </span>
                  <span className="text-[11px] text-[var(--bn-text-muted)]">Ctrl+N</span>
                </button>

                <button
                  type="button"
                  onMouseEnter={() => openSubmenu(null)}
                  onClick={() => {
                    onNewPrivateTab();
                    setShowMainMenu(false);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <EyeOff className="w-3.5 h-3.5 text-[var(--bn-private-text)]" />
                    <span>{t(lang, 'menuNewPrivate')}</span>
                  </span>
                  <span className="text-[11px] text-[var(--bn-text-muted)]">Ctrl+Shift+N</span>
                </button>

                {canReopenClosedTab && (
                  <button
                    type="button"
                    onMouseEnter={() => openSubmenu(null)}
                    onClick={() => {
                      onReopenClosedTab();
                      setShowMainMenu(false);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <RotateCcw className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                      <span>{t(lang, 'menuReopenTab')}</span>
                    </span>
                    <span className="text-[11px] text-[var(--bn-text-muted)]">Ctrl+Shift+T</span>
                  </button>
                )}

                <div className="h-[1px] bg-[var(--bn-border)] my-1.5" />

                {/* Section 2: Segmented Sidebar Control */}
                <div
                  onMouseEnter={() => openSubmenu(null)}
                  className="px-3.5 py-1.5 flex items-center justify-between gap-2"
                >
                  <span className="flex items-center gap-2.5 text-[var(--bn-text)] shrink-0">
                    <PanelLeft className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                    <span>{t(lang, 'menuSidebar')}</span>
                  </span>

                  <div className="inline-flex items-center rounded-md border border-[var(--bn-border-strong)] overflow-hidden bg-[var(--bn-surface-alt)] text-[11px]">
                    {(
                      [
                        { id: 'on', label: t(lang, 'menuSidebarOn') },
                        { id: 'auto', label: t(lang, 'menuSidebarAuto') },
                        { id: 'off', label: t(lang, 'menuSidebarOff') }
                      ] as const
                    ).map((opt, idx) => {
                      const active = sidebarMode === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setSidebarMode(opt.id)}
                          className={`px-2 py-1 transition-colors whitespace-nowrap ${
                            idx > 0 ? 'border-l border-[var(--bn-border-strong)]' : ''
                          } ${
                            active
                              ? 'bg-[var(--bn-interactive)] text-white font-medium'
                              : 'text-[var(--bn-text)] hover:bg-[var(--bn-hover)]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="h-[1px] bg-[var(--bn-border)] my-1.5" />

                {/* Section 3: Shields, History >, Bookmarks >, Downloads, Clear Data */}
                <button
                  type="button"
                  onMouseEnter={() => openSubmenu(null)}
                  onClick={() => {
                    onNavigate('fabinav://shields');
                    setShowMainMenu(false);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <Cookie className="w-3.5 h-3.5 text-[var(--bn-accent)]" />
                    <span>{t(lang, 'menuShieldsManager')}</span>
                  </span>
                </button>

                {/* Cascading Row: Historial > */}
                <div
                  className="relative"
                  onMouseEnter={() => openSubmenu('history')}
                >
                  <button
                    type="button"
                    onClick={() => openSubmenu(activeSubmenu === 'history' ? null : 'history')}
                    className={`w-full text-left px-3.5 py-2 flex items-center justify-between transition-colors ${
                      activeSubmenu === 'history'
                        ? 'bg-[var(--bn-hover)] text-[var(--bn-text-strong)]'
                        : 'hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)]'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <History className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                      <span>{t(lang, 'menuHistory')}</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                  </button>

                  {activeSubmenu === 'history' && (
                    <div
                      onMouseEnter={() => openSubmenu('history')}
                      className="sm:right-[calc(100%+6px)] right-2 top-0 absolute w-[280px] bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-xl overflow-hidden shadow-2xl py-0 z-50 text-[12px]"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onNavigate('fabinav://history');
                          setShowMainMenu(false);
                          setActiveSubmenu(null);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
                      >
                        <span className="flex items-center gap-2.5">
                          <History className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                          <span>{t(lang, 'menuFullHistory')}</span>
                        </span>
                        <span className="text-[11px] text-[var(--bn-text-muted)]">Ctrl+H</span>
                      </button>

                      {closedTabs.length > 0 && (
                        <>
                          <div className="h-[1px] bg-[var(--bn-border)] my-1.5" />
                          <div className="px-3.5 py-1 text-[11px] font-semibold text-[var(--bn-text-muted)]">
                            Cerradas recientemente
                          </div>
                          {closedTabs.slice(0, 4).map((ct) => (
                            <button
                              key={ct.id}
                              type="button"
                              onClick={() => {
                                onReopenClosedTab(ct.id);
                                setShowMainMenu(false);
                                setActiveSubmenu(null);
                              }}
                              className="w-full text-left px-3.5 py-1.5 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center gap-2.5 transition-colors"
                            >
                              <RotateCcw className="w-3 h-3 text-[var(--bn-text-muted)] shrink-0" />
                              <span className="truncate">{ct.title}</span>
                            </button>
                          ))}
                        </>
                      )}

                      {historyEntries.length > 0 && (
                        <>
                          <div className="h-[1px] bg-[var(--bn-border)] my-1.5" />
                          <div className="px-3.5 py-1 text-[11px] font-semibold text-[var(--bn-text-muted)]">
                            Visitados recientemente
                          </div>
                          {historyEntries.slice(0, 5).map((entry) => (
                            <button
                              key={entry.id}
                              type="button"
                              onClick={() => {
                                onNavigate(entry.url);
                                setShowMainMenu(false);
                                setActiveSubmenu(null);
                              }}
                              className="w-full text-left px-3.5 py-1.5 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between gap-2 transition-colors"
                            >
                              <span className="flex items-center gap-2.5 min-w-0">
                                <Globe className="w-3 h-3 text-[var(--bn-text-muted)] shrink-0" />
                                <span className="truncate">{entry.title}</span>
                              </span>
                              <span className="text-[10px] text-[var(--bn-text-muted)] shrink-0 tabular-nums">
                                {entry.timeFormatted}
                              </span>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Cascading Row: Favoritos y listas > */}
                <div
                  className="relative"
                  onMouseEnter={() => openSubmenu('bookmarks')}
                >
                  <button
                    type="button"
                    onClick={() => openSubmenu(activeSubmenu === 'bookmarks' ? null : 'bookmarks')}
                    className={`w-full text-left px-3.5 py-2 flex items-center justify-between transition-colors ${
                      activeSubmenu === 'bookmarks'
                        ? 'bg-[var(--bn-hover)] text-[var(--bn-text-strong)]'
                        : 'hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)]'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <BookmarkIcon className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                      <span>{t(lang, 'menuBookmarks')}</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                  </button>

                  {activeSubmenu === 'bookmarks' && (
                    <div
                      onMouseEnter={() => openSubmenu('bookmarks')}
                      className="sm:right-[calc(100%+6px)] right-2 top-0 absolute w-[280px] bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-xl overflow-hidden shadow-2xl py-0 z-50 text-[12px]"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onNavigate('fabinav://bookmarks');
                          setShowMainMenu(false);
                          setActiveSubmenu(null);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center gap-2.5 transition-colors"
                      >
                        <BookmarkIcon className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                        <span>{t(lang, 'menuBookmarkManager')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onToggleBookmarksBar();
                          setShowMainMenu(false);
                          setActiveSubmenu(null);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
                      >
                        <span className="flex items-center gap-2.5">
                          <PanelTop className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                          <span>{t(lang, 'menuShowBookmarksBar')}</span>
                        </span>
                        {settings.showBookmarksBar && (
                          <Check className="w-3.5 h-3.5 text-[var(--bn-accent)]" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onToggleBookmark();
                          setShowMainMenu(false);
                          setActiveSubmenu(null);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center gap-2.5 transition-colors"
                      >
                        <Star className="w-3.5 h-3.5 text-[var(--bn-accent)]" />
                        <span>
                          {currentTab?.isBookmarked
                            ? t(lang, 'bookmarkRemove')
                            : t(lang, 'bookmarkAdd')}
                        </span>
                      </button>

                      {bookmarks.length > 0 && (
                        <>
                          <div className="h-[1px] bg-[var(--bn-border)] my-1.5" />
                          <div className="px-3.5 py-1 text-[11px] font-semibold text-[var(--bn-text-muted)]">
                            {t(lang, 'menuBookmarks')} ({bookmarks.length})
                          </div>
                          {bookmarks.slice(0, 6).map((bm) => (
                            <button
                              key={bm.id}
                              type="button"
                              onClick={() => {
                                onNavigate(bm.url);
                                setShowMainMenu(false);
                                setActiveSubmenu(null);
                              }}
                              className="w-full text-left px-3.5 py-1.5 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center gap-2.5 transition-colors"
                            >
                              <Globe className="w-3 h-3 text-[var(--bn-text-muted)] shrink-0" />
                              <span className="truncate">{bm.title}</span>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onMouseEnter={() => openSubmenu(null)}
                  onClick={() => {
                    onNavigate('fabinav://downloads');
                    setShowMainMenu(false);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <Download className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                    <span>{t(lang, 'menuDownloads')}</span>
                  </span>
                  <span className="text-[11px] text-[var(--bn-text-muted)]">Ctrl+J</span>
                </button>

                <button
                  type="button"
                  onMouseEnter={() => openSubmenu(null)}
                  onClick={() => {
                    onClearBrowsingData();
                    setShowMainMenu(false);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <Trash2 className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                    <span>{t(lang, 'menuClearData')}</span>
                  </span>
                  <span className="text-[11px] text-[var(--bn-text-muted)]">Ctrl+Shift+Supr</span>
                </button>

                <div className="h-[1px] bg-[var(--bn-border)] my-1.5" />

                {/* Section 4: Zoom [ - 100% + ] | Fullscreen */}
                <div
                  onMouseEnter={() => openSubmenu(null)}
                  className="px-3.5 py-1.5 flex items-center justify-between gap-2"
                >
                  <span className="flex items-center gap-3 text-[var(--bn-text)]">
                    <ZoomIn className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                    <span>Zoom</span>
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleStepZoom(-1)}
                      disabled={settings.zoomLevel <= ZOOM_STEPS[0]}
                      title="Alejar"
                      className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[var(--bn-hover)] disabled:opacity-35 text-[var(--bn-text)] transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={onResetZoom}
                      title="Restablecer al 100%"
                      className="min-w-[44px] text-center text-[12px] font-medium text-[var(--bn-text-strong)] tabular-nums hover:bg-[var(--bn-hover)] rounded-md py-1 px-1.5 transition-colors"
                    >
                      {settings.zoomLevel}%
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStepZoom(1)}
                      disabled={settings.zoomLevel >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
                      title="Acercar"
                      className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[var(--bn-hover)] disabled:opacity-35 text-[var(--bn-text)] transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>

                    <span className="h-4 w-[1px] bg-[var(--bn-border-strong)] mx-0.5" />

                    <button
                      type="button"
                      onClick={() => {
                        onToggleFullscreen();
                        setShowMainMenu(false);
                      }}
                      title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                      className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[var(--bn-hover)] text-[var(--bn-text)] transition-colors"
                    >
                      {isFullscreen ? (
                        <Minimize2 className="w-3.5 h-3.5" />
                      ) : (
                        <Maximize2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="h-[1px] bg-[var(--bn-border)] my-1.5" />

                {/* Section 5: Print, Translate, Find & Edit >, Save & Share >, More Tools > */}
                <button
                  type="button"
                  onMouseEnter={() => openSubmenu(null)}
                  onClick={() => {
                    setShowMainMenu(false);
                    window.print();
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <Printer className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                    <span>{t(lang, 'menuPrint')}</span>
                  </span>
                  <span className="text-[11px] text-[var(--bn-text-muted)]">Ctrl+P</span>
                </button>

                <button
                  type="button"
                  onMouseEnter={() => openSubmenu(null)}
                  onClick={() => {
                    setShowMainMenu(false);
                    onTranslatePage?.();
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <Languages className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                    <span>{t(lang, 'menuTranslate')}</span>
                  </span>
                  <span className="text-[10px] text-[var(--bn-text-muted)] uppercase">
                    {(settings.translateTargetLang || lang).toUpperCase()}
                  </span>
                </button>

                {/* Cascading Row: Buscar y editar > */}
                <div
                  className="relative"
                  onMouseEnter={() => openSubmenu('findEdit')}
                >
                  <button
                    type="button"
                    onClick={() => openSubmenu(activeSubmenu === 'findEdit' ? null : 'findEdit')}
                    className={`w-full text-left px-3.5 py-2 flex items-center justify-between transition-colors ${
                      activeSubmenu === 'findEdit'
                        ? 'bg-[var(--bn-hover)] text-[var(--bn-text-strong)]'
                        : 'hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)]'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Search className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                      <span>{t(lang, 'menuFindEdit')}</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                  </button>

                  {activeSubmenu === 'findEdit' && (
                    <div
                      onMouseEnter={() => openSubmenu('findEdit')}
                      className="sm:right-[calc(100%+6px)] right-2 bottom-0 absolute w-[250px] bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-xl overflow-hidden shadow-2xl py-0 z-50 text-[12px]"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onOpenFindInPage();
                          setShowMainMenu(false);
                          setActiveSubmenu(null);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
                      >
                        <span className="flex items-center gap-2.5">
                          <Search className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                          <span>{t(lang, 'menuFindInPage')}</span>
                        </span>
                        <span className="text-[11px] text-[var(--bn-text-muted)]">Ctrl+F</span>
                      </button>

                      <div className="h-[1px] bg-[var(--bn-border)] my-1.5" />

                      <button
                        type="button"
                        onClick={() => {
                          onEditAction('cut');
                          setShowMainMenu(false);
                          setActiveSubmenu(null);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
                      >
                        <span className="flex items-center gap-2.5">
                          <Scissors className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                          <span>{t(lang, 'menuCut')}</span>
                        </span>
                        <span className="text-[11px] text-[var(--bn-text-muted)]">Ctrl+X</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onEditAction('copy');
                          setShowMainMenu(false);
                          setActiveSubmenu(null);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
                      >
                        <span className="flex items-center gap-2.5">
                          <Copy className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                          <span>{t(lang, 'menuCopy')}</span>
                        </span>
                        <span className="text-[11px] text-[var(--bn-text-muted)]">Ctrl+C</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onEditAction('paste');
                          setShowMainMenu(false);
                          setActiveSubmenu(null);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
                      >
                        <span className="flex items-center gap-2.5">
                          <Clipboard className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                          <span>{t(lang, 'menuPaste')}</span>
                        </span>
                        <span className="text-[11px] text-[var(--bn-text-muted)]">Ctrl+V</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Cascading Row: Guardar y compartir > */}
                <div
                  className="relative"
                  onMouseEnter={() => openSubmenu('saveShare')}
                >
                  <button
                    type="button"
                    onClick={() => openSubmenu(activeSubmenu === 'saveShare' ? null : 'saveShare')}
                    className={`w-full text-left px-3.5 py-2 flex items-center justify-between transition-colors ${
                      activeSubmenu === 'saveShare'
                        ? 'bg-[var(--bn-hover)] text-[var(--bn-text-strong)]'
                        : 'hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)]'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <FileDown className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                      <span>{t(lang, 'menuSaveShare')}</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                  </button>

                  {activeSubmenu === 'saveShare' && (
                    <div
                      onMouseEnter={() => openSubmenu('saveShare')}
                      className="sm:right-[calc(100%+6px)] right-2 bottom-0 absolute w-[280px] bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-xl overflow-hidden shadow-2xl py-0 z-50 text-[12px]"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSavePageAs();
                          setShowMainMenu(false);
                          setActiveSubmenu(null);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
                      >
                        <span className="flex items-center gap-2.5">
                          <FileDown className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                          <span>{t(lang, 'menuSavePageAs')}</span>
                        </span>
                        <span className="text-[11px] text-[var(--bn-text-muted)]">Ctrl+S</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onCaptureView();
                          setShowMainMenu(false);
                          setActiveSubmenu(null);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
                      >
                        <span className="flex items-center gap-2.5">
                          <Camera className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                          <span>{t(lang, 'menuScreenshot')}</span>
                        </span>
                        <span className="text-[11px] text-[var(--bn-text-muted)]">Ctrl+Shift+S</span>
                      </button>

                      <div className="h-[1px] bg-[var(--bn-border)] my-1.5" />

                      <button
                        type="button"
                        onClick={() => {
                          onCopyLink();
                          setShowMainMenu(false);
                          setActiveSubmenu(null);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center gap-2.5 transition-colors"
                      >
                        <Link2 className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                        <span>{t(lang, 'menuCopyLink')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onOpenQrModal();
                          setShowMainMenu(false);
                          setActiveSubmenu(null);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center gap-2.5 transition-colors"
                      >
                        <QrCode className="w-3.5 h-3.5 text-[var(--bn-accent)]" />
                        <span>{t(lang, 'menuQrCode')}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Cascading Row: Más herramientas > */}
                <div
                  className="relative"
                  onMouseEnter={() => openSubmenu('moreTools')}
                >
                  <button
                    type="button"
                    onClick={() => openSubmenu(activeSubmenu === 'moreTools' ? null : 'moreTools')}
                    className={`w-full text-left px-3.5 py-2 flex items-center justify-between transition-colors ${
                      activeSubmenu === 'moreTools'
                        ? 'bg-[var(--bn-hover)] text-[var(--bn-text-strong)]'
                        : 'hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)]'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Wrench className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                      <span>{t(lang, 'menuMoreTools')}</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                  </button>

                  {activeSubmenu === 'moreTools' && (
                    <div
                      onMouseEnter={() => openSubmenu('moreTools')}
                      className="sm:right-[calc(100%+6px)] right-2 bottom-0 absolute w-[290px] bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-xl overflow-hidden shadow-2xl py-0 z-50 text-[12px]"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onOpenTabSearch();
                          setShowMainMenu(false);
                          setActiveSubmenu(null);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
                      >
                        <span className="flex items-center gap-2.5">
                          <Search className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                          <span>{t(lang, 'menuTabSearch')}</span>
                        </span>
                        <span className="text-[11px] text-[var(--bn-text-muted)]">Ctrl+Shift+A</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onOpenRenameWindow();
                          setShowMainMenu(false);
                          setActiveSubmenu(null);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center gap-2.5 transition-colors"
                      >
                        <Tag className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                        <span>{t(lang, 'menuRenameWindow')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onOpenCommandPalette();
                          setShowMainMenu(false);
                          setActiveSubmenu(null);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
                      >
                        <span className="flex items-center gap-2.5">
                          <Command className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                          <span>{t(lang, 'menuQuickCommands')}</span>
                        </span>
                        <span className="text-[11px] text-[var(--bn-text-muted)]">Ctrl+K</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onUpdateSettings({ useVerticalTabs: !settings.useVerticalTabs });
                          setShowMainMenu(false);
                          setActiveSubmenu(null);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
                      >
                        <span className="flex items-center gap-2.5">
                          <Columns className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                          <span>{t(lang, 'verticalTabsOff')}</span>
                        </span>
                        {settings.useVerticalTabs && (
                          <Check className="w-3.5 h-3.5 text-[var(--bn-accent)]" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onToggleSplitMode();
                          setShowMainMenu(false);
                          setActiveSubmenu(null);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
                      >
                        <span className="flex items-center gap-2.5">
                          <Columns className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                          <span>
                            {isSplitActive ? t(lang, 'tabRemoveSplit') : t(lang, 'tabAddSplit')}
                          </span>
                        </span>
                        <span className="text-[11px] text-[var(--bn-text-muted)]">Ctrl+\</span>
                      </button>

                      <div className="h-[1px] bg-[var(--bn-border)] my-1.5" />

                      <button
                        type="button"
                        onClick={() => {
                          onOpenDevTools();
                          setShowMainMenu(false);
                          setActiveSubmenu(null);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
                      >
                        <span className="flex items-center gap-2.5">
                          <Terminal className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                          <span>{t(lang, 'menuDevTools')}</span>
                        </span>
                        <span className="text-[11px] text-[var(--bn-text-muted)]">Ctrl+Shift+I</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onOpenElectronModal();
                          setShowMainMenu(false);
                          setActiveSubmenu(null);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center gap-2.5 transition-colors"
                      >
                        <Laptop className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                        <span>{t(lang, 'menuElectronRepo')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onOpenNotes();
                          setShowMainMenu(false);
                          setActiveSubmenu(null);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center gap-2.5 transition-colors"
                      >
                        <StickyNote className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                        <span>{t(lang, 'menuNotes')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onOpenTaskManager();
                          setShowMainMenu(false);
                          setActiveSubmenu(null);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
                      >
                        <span className="flex items-center gap-2.5">
                          <Activity className="w-3.5 h-3.5 text-[var(--bn-accent)]" />
                          <span>{t(lang, 'menuTaskManager')}</span>
                        </span>
                        <span className="text-[11px] text-[var(--bn-text-muted)]">Shift+Esc</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="h-[1px] bg-[var(--bn-border)] my-1.5" />

                {/* Section 6: Help >, Settings, Exit */}
                <div
                  className="relative"
                  onMouseEnter={() => openSubmenu('help')}
                >
                  <button
                    type="button"
                    onClick={() => openSubmenu(activeSubmenu === 'help' ? null : 'help')}
                    className={`w-full text-left px-3.5 py-2 flex items-center justify-between transition-colors ${
                      activeSubmenu === 'help'
                        ? 'bg-[var(--bn-hover)] text-[var(--bn-text-strong)]'
                        : 'hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)]'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <HelpCircle className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                      <span>{t(lang, 'menuHelp')}</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                  </button>

                  {activeSubmenu === 'help' && (
                    <div
                      onMouseEnter={() => openSubmenu('help')}
                      className="sm:right-[calc(100%+6px)] right-2 bottom-0 absolute w-[250px] bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-xl overflow-hidden shadow-2xl py-0 z-50 text-[12px]"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onNavigate('fabinav://about');
                          setShowMainMenu(false);
                          setActiveSubmenu(null);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center gap-2.5 transition-colors"
                      >
                        <Info className="w-3.5 h-3.5 text-[var(--bn-accent)]" />
                        <span>{t(lang, 'menuAbout')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onOpenCommandPalette();
                          setShowMainMenu(false);
                          setActiveSubmenu(null);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
                      >
                        <span className="flex items-center gap-2.5">
                          <Command className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                          <span>{t(lang, 'menuQuickCommands')}</span>
                        </span>
                        <span className="text-[11px] text-[var(--bn-text-muted)]">Ctrl+K</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onOpenNotes();
                          setShowMainMenu(false);
                          setActiveSubmenu(null);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center gap-2.5 transition-colors"
                      >
                        <StickyNote className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                        <span>{t(lang, 'menuNotes')}</span>
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onMouseEnter={() => openSubmenu(null)}
                  onClick={() => {
                    onNavigate('fabinav://extensions');
                    setShowMainMenu(false);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <Puzzle className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                    <span>{t(lang, 'menuManageExtensions')}</span>
                  </span>
                </button>

                <button
                  type="button"
                  onMouseEnter={() => openSubmenu(null)}
                  onClick={() => {
                    onNavigate('fabinav://settings');
                    setShowMainMenu(false);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <Settings className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                    <span>{t(lang, 'menuSettings')}</span>
                  </span>
                </button>

                <button
                  type="button"
                  onMouseEnter={() => openSubmenu(null)}
                  onClick={() => {
                    setShowMainMenu(false);
                    onCloseWindow();
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-danger-text)] flex items-center justify-between rounded-b-[11px] transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{t(lang, 'menuExit')}</span>
                  </span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
