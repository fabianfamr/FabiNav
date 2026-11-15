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
  Compass
} from 'lucide-react';
import {
  WebTab,
  Bookmark,
  HistoryEntry,
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
  settings: BrowserSettings;
  omniboxRef?: React.RefObject<HTMLInputElement | null>;
  onNavigate: (url: string) => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onReload: () => void;
  onGoHome: () => void;
  onResetZoom: () => void;
  onToggleBookmark: () => void;
  onToggleSplitMode: () => void;
  onToggleShieldsModal: () => void;
  onToggleSidebar: () => void;
  onOpenBackupModal: () => void;
  onOpenElectronModal: () => void;
  onOpenDevTools: () => void;
  onNewTab: () => void;
  onNewPrivateTab: () => void;
  onReopenClosedTab: () => void;
  canReopenClosedTab: boolean;
  onToggleBookmarksBar: () => void;
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

const LEO_EASE_OUT: [number, number, number, number] = [0, 0, 0.58, 1];

export const TitleBar: React.FC<TitleBarProps> = ({
  currentTab,
  googleUser,
  bookmarks,
  historyEntries,
  settings,
  omniboxRef,
  onNavigate,
  onGoBack,
  onGoForward,
  onReload,
  onGoHome,
  onResetZoom,
  onToggleBookmark,
  onToggleSplitMode,
  onToggleShieldsModal,
  onToggleSidebar,
  onOpenBackupModal,
  onOpenElectronModal,
  onOpenDevTools,
  onNewTab,
  onNewPrivateTab,
  onReopenClosedTab,
  canReopenClosedTab,
  onToggleBookmarksBar,
  isSplitActive,
  shieldCount,
  isShieldActive
}) => {
  const [inputUrl, setInputUrl] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showBraveMenu, setShowBraveMenu] = useState(false);
  const [showSecurityPopover, setShowSecurityPopover] = useState(false);
  const [tlsInfo, setTlsInfo] = useState<TlsInspectionResult | null>(null);
  const [siteCookies, setSiteCookies] = useState<StoredCookieItem[]>([]);
  const [loadingSecurity, setLoadingSecurity] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const menuRef = useRef<HTMLDivElement>(null);
  const securityRef = useRef<HTMLDivElement>(null);

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
        setShowBraveMenu(false);
      }
      if (securityRef.current && !securityRef.current.contains(e.target as Node)) {
        setShowSecurityPopover(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowBraveMenu(false);
        setShowSecurityPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
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
      {/* Left: Classic Chromium/Brave Navigation Buttons */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={onGoBack}
          disabled={!currentTab?.canGoBack}
          title="Ir atrás (Alt+Izquierda)"
          className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--bn-text)] hover:bg-[var(--bn-hover)] active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent transition-all leo-transition-xs"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onGoForward}
          disabled={!currentTab?.canGoForward}
          title="Ir adelante (Alt+Derecha)"
          className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--bn-text)] hover:bg-[var(--bn-hover)] active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent transition-all leo-transition-xs"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onReload}
          title="Volver a cargar esta página (Ctrl+R)"
          className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--bn-text)] hover:bg-[var(--bn-hover)] active:scale-90 transition-all leo-transition-xs"
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
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--bn-text)] hover:bg-[var(--bn-hover)] active:scale-90 transition-all leo-transition-xs"
          >
            <Home className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Center: Brave Signature Full-Pill Omnibox + TLS Padlock Inspector */}
      <div className="flex-1 max-w-4xl mx-auto flex items-center relative" ref={securityRef}>
        <form
          onSubmit={handleSubmit}
          className={`flex-1 flex items-center h-8 px-2.5 rounded-full border transition-all leo-transition-s ${
            isFocused
              ? 'bg-[var(--bn-omnibox-focus)] border-[var(--bn-accent)] ring-2 ring-[var(--bn-accent)]/25 shadow-sm'
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

          <div className="flex items-center gap-1 shrink-0 ml-2">
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

            <button
              type="button"
              onClick={onToggleBookmark}
              title={
                currentTab?.isBookmarked
                  ? 'Quitar de marcadores'
                  : 'Añadir esta pestaña a marcadores'
              }
              className={`p-1 rounded-full hover:bg-[var(--bn-hover)] active:scale-90 transition-all leo-transition-xs ${
                currentTab?.isBookmarked
                  ? 'text-[var(--bn-accent)]'
                  : 'text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)]'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${currentTab?.isBookmarked ? 'fill-current' : ''}`} />
            </button>
          </div>
        </form>

        {/* Brave Shields Lion Emblem Attached Right Next to Omnibox */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={onToggleShieldsModal}
          title={`Escudos de FabiNav: ${isShieldActive ? 'Activos' : 'Desactivados'}`}
          className="ml-1.5 relative w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--bn-hover)] transition-colors shrink-0"
        >
          {isShieldActive ? (
            <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" aria-hidden="true">
              <defs>
                <linearGradient id="braveShieldGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#FA7250" />
                  <stop offset="100%" stopColor="#FB542B" />
                </linearGradient>
              </defs>
              <path
                fill="url(#braveShieldGrad)"
                d="M12 2L4 5.2v5.9c0 5.1 3.4 9.7 8 10.9 4.6-1.2 8-5.8 8-10.9V5.2L12 2z"
              />
              <path
                fill="#ffffff"
                fillOpacity="0.92"
                d="M12 6.4l3.6 1.8-.9 3.6 1.1 2-3.8 3-3.8-3 1.1-2-.9-3.6L12 6.4z"
              />
            </svg>
          ) : (
            <ShieldOff className="w-4.5 h-4.5 text-[var(--bn-text-muted)]" />
          )}

          {isShieldActive && shieldCount > 0 && (
            <motion.span
              key={shieldCount}
              initial={{ scale: 1.3 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.2, ease: LEO_EASE_OUT }}
              className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-[var(--bn-accent)] text-white text-[9px] font-semibold flex items-center justify-center tabular-nums shadow"
            >
              {shieldCount}
            </motion.span>
          )}
        </motion.button>

        {/* Site TLS Certificate & Cookies Popover */}
        <AnimatePresence>
          {showSecurityPopover && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={{ duration: 0.14, ease: LEO_EASE_OUT }}
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
              transition={{ duration: 0.12, ease: LEO_EASE_OUT }}
              className="absolute left-0 right-10 top-10 bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-2xl shadow-2xl z-50 overflow-hidden py-1.5"
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

      {/* Right: Brave Toolbar Actions, Real Google Avatar & Menu */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={onToggleSplitMode}
          title="Vista dividida (Ctrl+\)"
          className={`w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-all leo-transition-xs ${
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
          className={`w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-all leo-transition-xs ${
            settings.showSidebar
              ? 'text-[var(--bn-text-strong)] bg-[var(--bn-hover)]/65'
              : 'text-[var(--bn-text)] hover:bg-[var(--bn-hover)]'
          }`}
        >
          <PanelRight className="w-4 h-4" />
        </button>

        {/* Real Google Profile Avatar (only when authenticated) or Neutral Sign-In Icon */}
        <button
          type="button"
          onClick={onOpenBackupModal}
          title={
            googleUser
              ? `${googleUser.displayName} (${googleUser.email})`
              : 'Iniciar sesión con Google o respaldo local'
          }
          className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--bn-text)] hover:bg-[var(--bn-hover)] active:scale-90 transition-all leo-transition-xs"
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

        {/* Brave Main Hamburger Menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowBraveMenu(!showBraveMenu)}
            title="Personaliza y controla FabiNav"
            className={`w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-all leo-transition-xs ${
              showBraveMenu
                ? 'bg-[var(--bn-hover)] text-[var(--bn-text-strong)]'
                : 'text-[var(--bn-text)] hover:bg-[var(--bn-hover)]'
            }`}
          >
            <MenuIcon className="w-4 h-4" />
          </button>

          <AnimatePresence>
            {showBraveMenu && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.96 }}
                transition={{ duration: 0.14, ease: LEO_EASE_OUT }}
                className="absolute right-0 top-10 w-64 bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] shadow-2xl z-50 text-xs py-1.5 text-[var(--bn-text)] rounded-2xl origin-top-right"
              >
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
                    <EyeOff className="w-3.5 h-3.5 text-[var(--bn-private-text)]" />
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
                    onNavigate('fabinav://shields');
                    setShowBraveMenu(false);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <Cookie className="w-3.5 h-3.5 text-[var(--bn-accent)]" />
                    <span>Cookies, TLS y Escudos</span>
                  </span>
                </button>

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
                  <span className="text-[11px] font-medium text-[var(--bn-text-muted)]">
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
