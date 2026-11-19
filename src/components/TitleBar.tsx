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
  Command
} from 'lucide-react';
import {
  WebTab,
  Bookmark,
  HistoryEntry,
  ClosedTabRecord,
  BrowserSettings,
  GoogleUserProfile,
  TlsInspectionResult,
  StoredCookieItem
} from '../types';

interface TitleBarProps {
  currentTab?: WebTab;
  googleUser: GoogleUserProfile | null;
  bookmarks: Bookmark[];
  historyEntries: HistoryEntry[];
  closedTabs: ClosedTabRecord[];
  settings: BrowserSettings;
  omniboxRef?: React.RefObject<HTMLInputElement | null>;
  onNavigate: (url: string) => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onReload: () => void;
  onGoHome: () => void;
  onUpdateSettings: (updates: Partial<BrowserSettings>) => void;
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
  omniboxRef,
  onNavigate,
  onGoBack,
  onGoForward,
  onReload,
  onGoHome,
  onUpdateSettings,
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
  const [tlsInfo, setTlsInfo] = useState<TlsInspectionResult | null>(null);
  const [siteCookies, setSiteCookies] = useState<StoredCookieItem[]>([]);
  const [loadingSecurity, setLoadingSecurity] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const menuRef = useRef<HTMLDivElement>(null);
  const securityRef = useRef<HTMLDivElement>(null);
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
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowMainMenu(false);
        setActiveSubmenu(null);
        setShowSecurityPopover(false);
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
          title="Ir atrás (Alt+Izquierda)"
          className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--bn-text)] hover:bg-[var(--bn-hover)] active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent transition-all fabi-transition-xs"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onGoForward}
          disabled={!currentTab?.canGoForward}
          title="Ir adelante (Alt+Derecha)"
          className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--bn-text)] hover:bg-[var(--bn-hover)] active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent transition-all fabi-transition-xs"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onReload}
          title="Volver a cargar esta página (Ctrl+R)"
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
            title="Abrir página principal"
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
              ? 'Quitar de marcadores'
              : 'Añadir esta pestaña a marcadores'
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
            placeholder="Busca en la web o escribe una dirección URL (Ctrl+L)"
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
              className="absolute left-0 right-0 top-10 bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-2xl shadow-2xl z-50 overflow-hidden py-1.5"
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

      {/* Right: FabiNav Toolbar Actions, Google Avatar & Desktop Menu Panel */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={onToggleSplitMode}
          title="Vista dividida (Ctrl+\)"
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
          title={settings.showSidebar ? 'Ocultar barra lateral' : 'Mostrar barra lateral'}
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
            title="Personaliza y controla FabiNav"
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
                className="absolute right-0 top-10 w-[316px] overflow-visible bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] shadow-2xl z-50 text-[12px] py-1.5 text-[var(--bn-text)] rounded-xl origin-top-right"
              >
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
                    <span>Nueva pestaña</span>
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
                    <span>Nueva ventana</span>
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
                    <span>Nueva ventana privada</span>
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
                      <span>Reabrir pestaña cerrada</span>
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
                    <span>Barra lateral</span>
                  </span>

                  <div className="inline-flex items-center rounded-md border border-[var(--bn-border-strong)] overflow-hidden bg-[var(--bn-surface-alt)] text-[11px]">
                    {(
                      [
                        { id: 'on', label: 'Activada' },
                        { id: 'auto', label: 'Auto' },
                        { id: 'off', label: 'Desactivada' }
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
                    <span>Escudos, Cookies y TLS</span>
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
                      <span>Historial</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                  </button>

                  {activeSubmenu === 'history' && (
                    <div
                      onMouseEnter={() => openSubmenu('history')}
                      className="sm:right-[calc(100%+6px)] right-2 top-0 absolute w-[280px] bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-xl shadow-2xl py-1.5 z-50 text-[12px]"
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
                          <span>Historial completo</span>
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
                      <span>Favoritos y listas</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                  </button>

                  {activeSubmenu === 'bookmarks' && (
                    <div
                      onMouseEnter={() => openSubmenu('bookmarks')}
                      className="sm:right-[calc(100%+6px)] right-2 top-0 absolute w-[280px] bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-xl shadow-2xl py-1.5 z-50 text-[12px]"
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
                        <span>Administrador de marcadores</span>
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
                          <span>Mostrar barra de marcadores</span>
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
                            ? 'Quitar pestaña de marcadores'
                            : 'Añadir esta pestaña a marcadores'}
                        </span>
                      </button>

                      {bookmarks.length > 0 && (
                        <>
                          <div className="h-[1px] bg-[var(--bn-border)] my-1.5" />
                          <div className="px-3.5 py-1 text-[11px] font-semibold text-[var(--bn-text-muted)]">
                            Marcadores guardados ({bookmarks.length})
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
                    <span>Descargas</span>
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
                    <span>Borrar datos de navegación...</span>
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

                {/* Section 5: Print, Find & Edit >, Save & Share >, More Tools > */}
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
                    <span>Imprimir...</span>
                  </span>
                  <span className="text-[11px] text-[var(--bn-text-muted)]">Ctrl+P</span>
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
                      <span>Buscar y editar</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                  </button>

                  {activeSubmenu === 'findEdit' && (
                    <div
                      onMouseEnter={() => openSubmenu('findEdit')}
                      className="sm:right-[calc(100%+6px)] right-2 bottom-0 absolute w-[250px] bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-xl shadow-2xl py-1.5 z-50 text-[12px]"
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
                          <span>Buscar...</span>
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
                          <span>Cortar</span>
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
                          <span>Copiar</span>
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
                          <span>Pegar</span>
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
                      <span>Guardar y compartir</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                  </button>

                  {activeSubmenu === 'saveShare' && (
                    <div
                      onMouseEnter={() => openSubmenu('saveShare')}
                      className="sm:right-[calc(100%+6px)] right-2 bottom-0 absolute w-[280px] bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-xl shadow-2xl py-1.5 z-50 text-[12px]"
                    >
                      <div className="px-3.5 pt-1 pb-1 text-[11px] font-semibold text-[var(--bn-text-muted)]">
                        Guardar
                      </div>
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
                          <span>Guardar página como...</span>
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
                          <span>Captura de vista</span>
                        </span>
                        <span className="text-[11px] text-[var(--bn-text-muted)]">Ctrl+Shift+S</span>
                      </button>

                      <div className="h-[1px] bg-[var(--bn-border)] my-1.5" />

                      <div className="px-3.5 pt-1 pb-1 text-[11px] font-semibold text-[var(--bn-text-muted)]">
                        Compartir
                      </div>
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
                        <span>Copiar vínculo</span>
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
                        <span>Crear código QR</span>
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
                      <span>Más herramientas</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                  </button>

                  {activeSubmenu === 'moreTools' && (
                    <div
                      onMouseEnter={() => openSubmenu('moreTools')}
                      className="sm:right-[calc(100%+6px)] right-2 bottom-0 absolute w-[290px] bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-xl shadow-2xl py-1.5 z-50 text-[12px]"
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
                          <span>Búsqueda de pestañas</span>
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
                        <span>Nombrar la ventana...</span>
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
                          <span>Comandos rápidos</span>
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
                          <span>Mostrar pestañas verticalmente</span>
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
                          <span>{isSplitActive ? 'Cerrar vista dividida' : 'Vista dividida'}</span>
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
                          <span>Herramientas del desarrollador</span>
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
                        <span>Exportar proyecto Electron</span>
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
                        <span>Notas de sesión</span>
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
                          <span>Administrador de tareas</span>
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
                      <span>Ayuda</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--bn-text-muted)]" />
                  </button>

                  {activeSubmenu === 'help' && (
                    <div
                      onMouseEnter={() => openSubmenu('help')}
                      className="sm:right-[calc(100%+6px)] right-2 bottom-0 absolute w-[250px] bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-xl shadow-2xl py-1.5 z-50 text-[12px]"
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
                        <span>Acerca de FabiNav</span>
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
                          <span>Atajos y comandos</span>
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
                        <span>Notas de sesión</span>
                      </button>
                    </div>
                  )}
                </div>

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
                    <span>Configuración</span>
                  </span>
                </button>

                <button
                  type="button"
                  onMouseEnter={() => openSubmenu(null)}
                  onClick={() => {
                    setShowMainMenu(false);
                    onCloseWindow();
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-danger-text)] flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Salir</span>
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
