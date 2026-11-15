import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  WebTab,
  BrowserSettings,
  FabiShieldState,
  FabiNewTabCustomization,
  HistoryEntry,
  Bookmark,
  DownloadItem,
  TopSiteItem,
  SearchApiResponse,
  SearchResultItem,
  GoogleUserProfile
} from '../types';
import {
  Columns,
  ExternalLink,
  Search,
  Globe,
  BookOpen,
  RotateCw,
  AlertCircle
} from 'lucide-react';
import { FabiNewTabView } from './FabiNewTabView';
import { FabiInternalsView } from './FabiInternalsView';

const LEO_EASE_OUT: [number, number, number, number] = [0, 0, 0.58, 1];

export interface PageSecurityReport {
  title?: string;
  url?: string;
  blockedTrackers?: number;
  blockedCookies?: number;
  upgradedHttps?: boolean;
}

interface WebViewportProps {
  primaryTab: WebTab;
  splitTab?: WebTab | null;
  settings: BrowserSettings;
  shieldState: FabiShieldState;
  onUpdateShieldState: (updates: Partial<FabiShieldState>) => void;
  onUpdateSettings: (updates: Partial<BrowserSettings>) => void;
  customization: FabiNewTabCustomization;
  topSites: TopSiteItem[];
  onAddTopSite: (title: string, url: string) => void;
  onRemoveTopSite: (id: string) => void;
  onNavigate: (tabId: string, url: string) => void;
  onPageSecurityReport?: (tabId: string, report: PageSecurityReport) => void;
  onToggleSplitTab?: (tabId: string) => void;
  onUpdateCustomization: (updates: Partial<FabiNewTabCustomization>) => void;
  onOpenShieldModal: () => void;
  bookmarks: Bookmark[];
  onAddBookmark: (title: string, url: string, folder?: string) => void;
  onRemoveBookmark: (id: string) => void;
  historyEntries: HistoryEntry[];
  onClearHistory: () => void;
  onDeleteHistoryItem: (id: string) => void;
  downloads: DownloadItem[];
  onRemoveDownload: (id: string) => void;
  onClearDownloads: () => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onOpenElectronModal: () => void;
  googleUser?: GoogleUserProfile | null;
  onGoogleSignIn?: () => void;
  onGoogleSignOut?: () => void;
}

export const WebViewport: React.FC<WebViewportProps> = ({
  primaryTab,
  splitTab,
  settings,
  shieldState,
  onUpdateShieldState,
  onUpdateSettings,
  customization,
  topSites,
  onAddTopSite,
  onRemoveTopSite,
  onNavigate,
  onPageSecurityReport,
  onToggleSplitTab,
  onUpdateCustomization,
  onOpenShieldModal,
  bookmarks,
  onAddBookmark,
  onRemoveBookmark,
  historyEntries,
  onClearHistory,
  onDeleteHistoryItem,
  downloads,
  onRemoveDownload,
  onClearDownloads,
  onExportBackup,
  onImportBackup,
  onOpenElectronModal,
  googleUser,
  onGoogleSignIn,
  onGoogleSignOut
}) => {
  const isSplit = !!splitTab;

  const sharedProps = {
    settings,
    shieldState,
    onUpdateShieldState,
    onUpdateSettings,
    customization,
    topSites,
    onAddTopSite,
    onRemoveTopSite,
    onUpdateCustomization,
    onOpenShieldModal,
    bookmarks,
    onAddBookmark,
    onRemoveBookmark,
    historyEntries,
    onClearHistory,
    onDeleteHistoryItem,
    downloads,
    onRemoveDownload,
    onClearDownloads,
    onExportBackup,
    onImportBackup,
    onOpenElectronModal,
    googleUser,
    onGoogleSignIn,
    onGoogleSignOut
  };

  return (
    <main
      id="fabinav-viewport-container"
      className="flex-1 bg-[var(--bn-surface)] relative overflow-hidden flex"
    >
      <div
        className={`h-full overflow-hidden flex flex-col transition-all leo-transition-m ${
          isSplit ? 'w-1/2 border-r border-[var(--bn-border)]' : 'w-full'
        }`}
      >
        <SingleTabFrame
          tab={primaryTab}
          onNavigate={(url) => onNavigate(primaryTab.id, url)}
          onPageSecurityReport={(report) => onPageSecurityReport?.(primaryTab.id, report)}
          onCloseSplit={isSplit && splitTab ? () => onToggleSplitTab?.(splitTab.id) : undefined}
          isSplit={isSplit}
          label="Panel izquierdo"
          {...sharedProps}
        />
      </div>

      <AnimatePresence>
        {isSplit && splitTab && (
          <motion.div
            key={splitTab.id}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.2, ease: LEO_EASE_OUT }}
            className="w-1/2 h-full overflow-hidden flex flex-col bg-[var(--bn-surface)]"
          >
            <SingleTabFrame
              tab={splitTab}
              onNavigate={(url) => onNavigate(splitTab.id, url)}
              onPageSecurityReport={(report) => onPageSecurityReport?.(splitTab.id, report)}
              onCloseSplit={() => onToggleSplitTab?.(splitTab.id)}
              isSplit={true}
              label="Panel derecho"
              {...sharedProps}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
};

interface SingleTabFrameProps {
  tab: WebTab;
  settings: BrowserSettings;
  shieldState: FabiShieldState;
  onUpdateShieldState: (updates: Partial<FabiShieldState>) => void;
  onUpdateSettings: (updates: Partial<BrowserSettings>) => void;
  customization: FabiNewTabCustomization;
  topSites: TopSiteItem[];
  onAddTopSite: (title: string, url: string) => void;
  onRemoveTopSite: (id: string) => void;
  onNavigate: (url: string) => void;
  onPageSecurityReport?: (report: PageSecurityReport) => void;
  onCloseSplit?: () => void;
  isSplit?: boolean;
  label?: string;
  onUpdateCustomization: (updates: Partial<FabiNewTabCustomization>) => void;
  onOpenShieldModal: () => void;
  bookmarks: Bookmark[];
  onAddBookmark: (title: string, url: string, folder?: string) => void;
  onRemoveBookmark: (id: string) => void;
  historyEntries: HistoryEntry[];
  onClearHistory: () => void;
  onDeleteHistoryItem: (id: string) => void;
  downloads: DownloadItem[];
  onRemoveDownload: (id: string) => void;
  onClearDownloads: () => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onOpenElectronModal: () => void;
  googleUser?: GoogleUserProfile | null;
  onGoogleSignIn?: () => void;
  onGoogleSignOut?: () => void;
}

const SingleTabFrame: React.FC<SingleTabFrameProps> = ({
  tab,
  settings,
  shieldState,
  onUpdateShieldState,
  onUpdateSettings,
  customization,
  topSites,
  onAddTopSite,
  onRemoveTopSite,
  onNavigate,
  onPageSecurityReport,
  onCloseSplit,
  isSplit,
  label,
  onUpdateCustomization,
  onOpenShieldModal,
  bookmarks,
  onAddBookmark,
  onRemoveBookmark,
  historyEntries,
  onClearHistory,
  onDeleteHistoryItem,
  downloads,
  onRemoveDownload,
  onClearDownloads,
  onExportBackup,
  onImportBackup,
  onOpenElectronModal,
  googleUser,
  onGoogleSignIn,
  onGoogleSignOut
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const isNewTab = tab.url === 'fabinav://newtab' || !tab.url;
  const isSearchPage = tab.url.startsWith('fabinav://search?q=');
  const isFabiInternal = tab.url.startsWith('fabinav://') && !isNewTab && !isSearchPage;

  const searchQuery = isSearchPage
    ? decodeURIComponent(tab.url.replace('fabinav://search?q=', ''))
    : '';

  useEffect(() => {
    if (isNewTab || isSearchPage || isFabiInternal) return;

    const handleMessage = (ev: MessageEvent) => {
      if (!iframeRef.current || ev.source !== iframeRef.current.contentWindow) return;
      const payload = ev.data as {
        type?: string;
        url?: string;
        title?: string;
        blockedTrackers?: number;
        blockedCookies?: number;
        upgradedHttps?: boolean;
      };
      if (!payload || typeof payload !== 'object') return;

      if (payload.type === 'fabinav:navigate' && typeof payload.url === 'string') {
        onNavigate(payload.url);
      } else if (payload.type === 'fabinav:page-info') {
        onPageSecurityReport?.({
          title: payload.title,
          url: payload.url,
          blockedTrackers: payload.blockedTrackers,
          blockedCookies: payload.blockedCookies,
          upgradedHttps: payload.upgradedHttps
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isNewTab, isSearchPage, isFabiInternal, onNavigate, onPageSecurityReport]);

  const proxySrc =
    !isNewTab && !isSearchPage && !isFabiInternal
      ? `/api/proxy?url=${encodeURIComponent(tab.url)}&partition=${
          tab.tabMode === 'private' ? 'private' : 'normal'
        }&shields=${shieldState.enabled ? '1' : '0'}&blockTrackers=${
          shieldState.blockTrackersAndAds
        }&blockScripts=${shieldState.blockScripts ? '1' : '0'}&blockCookies=${
          shieldState.blockCrossSiteCookies ? '1' : '0'
        }&upgradeHttps=${shieldState.upgradeHttps ? '1' : '0'}&strictTls=${
          shieldState.strictTls ? '1' : '0'
        }`
      : '';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-[var(--bn-surface)]">
      {/* Brave Leo Loading Progress Bar */}
      <AnimatePresence>
        {tab.isLoading && (
          <motion.div
            initial={{ scaleX: 0, opacity: 1 }}
            animate={{ scaleX: 0.85, opacity: 1 }}
            exit={{ scaleX: 1, opacity: 0 }}
            transition={{ duration: 0.3, ease: LEO_EASE_OUT }}
            style={{ transformOrigin: 'left' }}
            className="absolute top-0 left-0 right-0 h-[2px] bg-[var(--bn-accent)] z-30"
          />
        )}
      </AnimatePresence>

      {/* Split header strip */}
      {isSplit && (
        <div className="h-7 px-3 bg-[var(--bn-toolbar)] border-b border-[var(--bn-border)] flex items-center justify-between text-[11px] text-[var(--bn-text-muted)] shrink-0">
          <span className="font-medium text-[var(--bn-text-strong)] flex items-center gap-1.5 truncate">
            <Columns className="w-3.5 h-3.5 text-[var(--bn-accent)] shrink-0" />
            <span className="truncate">
              {label}: {tab.title}
            </span>
          </span>
          {onCloseSplit && (
            <button
              type="button"
              onClick={onCloseSplit}
              className="text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] px-2 py-0.5 rounded-full hover:bg-[var(--bn-hover)] whitespace-nowrap shrink-0 transition-colors leo-transition-xs"
            >
              Cerrar vista dividida
            </button>
          )}
        </div>
      )}

      {isNewTab ? (
        <FabiNewTabView
          onNavigate={onNavigate}
          shieldState={shieldState}
          settings={settings}
          customization={customization}
          topSites={topSites}
          onAddTopSite={onAddTopSite}
          onRemoveTopSite={onRemoveTopSite}
          onUpdateCustomization={onUpdateCustomization}
          onOpenShieldModal={onOpenShieldModal}
        />
      ) : isSearchPage ? (
        <BraveSearchView
          query={searchQuery}
          defaultEngine={settings.defaultSearchEngine}
          onNavigate={onNavigate}
        />
      ) : isFabiInternal ? (
        <FabiInternalsView
          url={tab.url}
          googleUser={googleUser}
          onGoogleSignIn={onGoogleSignIn}
          onGoogleSignOut={onGoogleSignOut}
          shieldState={shieldState}
          onUpdateShieldState={onUpdateShieldState}
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          bookmarks={bookmarks}
          onAddBookmark={onAddBookmark}
          onRemoveBookmark={onRemoveBookmark}
          historyEntries={historyEntries}
          onClearHistory={onClearHistory}
          onDeleteHistoryItem={onDeleteHistoryItem}
          downloads={downloads}
          onRemoveDownload={onRemoveDownload}
          onClearDownloads={onClearDownloads}
          onExportBackup={onExportBackup}
          onImportBackup={onImportBackup}
          onOpenElectronModal={onOpenElectronModal}
          onNavigate={onNavigate}
        />
      ) : (
        <div className="flex-1 w-full h-full relative bg-white flex flex-col">
          <div
            className="flex-1 w-full h-full relative"
            style={{
              zoom: settings.zoomLevel / 100
            }}
          >
            <iframe
              ref={iframeRef}
              key={`${tab.id}-${proxySrc}`}
              src={proxySrc}
              title={tab.title}
              className="w-full h-full border-none bg-white"
              sandbox="allow-scripts allow-forms allow-popups allow-downloads"
            />
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
   Brave Search Live Results UI (powered by /api/search)
============================================================================ */
interface BraveSearchViewProps {
  query: string;
  defaultEngine: BrowserSettings['defaultSearchEngine'];
  onNavigate: (url: string) => void;
}

const BraveSearchView: React.FC<BraveSearchViewProps> = ({
  query,
  defaultEngine,
  onNavigate
}) => {
  const [inputVal, setInputVal] = useState(query);
  const [activeFilter, setActiveFilter] = useState<'all' | 'wikipedia'>('all');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [data, setData] = useState<SearchApiResponse | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    setInputVal(query);
  }, [query]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setData(null);
      setErrorMsg(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setErrorMsg(null);

    fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
      signal: controller.signal
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return (await res.json()) as SearchApiResponse;
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setErrorMsg('No se pudo conectar con el servicio de búsqueda.');
        setLoading(false);
      });

    return () => controller.abort();
  }, [query, reloadTick]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = inputVal.trim();
    if (!cleaned) return;
    onNavigate(`fabinav://search?q=${encodeURIComponent(cleaned)}`);
  };

  const webResults = data?.results || [];
  const wikiResults = data?.wikipedia || [];
  const visibleItems: SearchResultItem[] =
    activeFilter === 'wikipedia'
      ? wikiResults
      : [...webResults, ...wikiResults.filter((w) => !webResults.some((r) => r.url === w.url))];

  const externalEngines = [
    {
      id: 'brave',
      name: 'Brave Search',
      href: `https://search.brave.com/search?q=${encodeURIComponent(query)}`
    },
    {
      id: 'google',
      name: 'Google',
      href: `https://www.google.com/search?q=${encodeURIComponent(query)}`
    },
    {
      id: 'duckduckgo',
      name: 'DuckDuckGo',
      href: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
    }
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bn-surface)] text-[var(--bn-text)]">
      {/* Top Brave Search Header */}
      <div className="sticky top-0 z-10 bg-[var(--bn-toolbar)]/95 backdrop-blur-md border-b border-[var(--bn-border)] px-6 pt-4 pb-0">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            {/* Brave Lion Emblem */}
            <button
              type="button"
              onClick={() => onNavigate('fabinav://newtab')}
              title="Volver a Nueva pestaña"
              className="flex items-center gap-2 shrink-0 group"
            >
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center shadow-xs transition-transform leo-transition-s group-hover:scale-105"
                style={{ background: 'var(--leo-gradient-brand)' }}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-white fill-current">
                  <path d="M12 2L4.5 5.3v5.9c0 5.1 3.2 9.8 7.5 10.8 4.3-1 7.5-5.7 7.5-10.8V5.3L12 2zm0 3.2l4.4 2-.8 2.4-3.6-1.3-3.6 1.3-.8-2.4 4.4-2zm-3.2 6l3.2 1.2 3.2-1.2-.5 3.1-2.7 1.6-2.7-1.6-.5-3.1z" />
                </svg>
              </span>
              <span className="hidden sm:inline text-sm font-bold text-[var(--bn-text-strong)] tracking-tight">
                FabiNav Search
              </span>
            </button>

            {/* Live Search Bar */}
            <form onSubmit={handleSubmit} className="flex-1 max-w-2xl">
              <div className="h-10 rounded-full bg-[var(--bn-omnibox)] border border-[var(--bn-border)] focus-within:border-[var(--bn-accent)] focus-within:bg-[var(--bn-omnibox-focus)] flex items-center px-3.5 gap-2 transition-colors leo-transition-s">
                <Search className="w-4 h-4 text-[var(--bn-text-muted)] shrink-0" />
                <input
                  type="text"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  placeholder="Buscar en la web..."
                  className="flex-1 bg-transparent outline-none text-sm text-[var(--bn-text-strong)] placeholder:text-[var(--bn-text-muted)]"
                />
                <button
                  type="submit"
                  className="px-3 py-1 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white text-xs font-medium transition-colors leo-transition-xs shrink-0"
                >
                  Buscar
                </button>
              </div>
            </form>

            <button
              type="button"
              onClick={() => setReloadTick((n) => n + 1)}
              title="Actualizar resultados"
              className="p-2 rounded-full text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)] transition-colors leo-transition-xs shrink-0"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-5 mt-3 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-colors leo-transition-s ${
                activeFilter === 'all'
                  ? 'border-[var(--bn-accent)] text-[var(--bn-accent)]'
                  : 'border-transparent text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)]'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Todo ({webResults.length + wikiResults.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('wikipedia')}
              className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-colors leo-transition-s ${
                activeFilter === 'wikipedia'
                  ? 'border-[var(--bn-accent)] text-[var(--bn-accent)]'
                  : 'border-transparent text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Wikipedia ({wikiResults.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Results Container */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] animate-pulse space-y-2.5"
              >
                <div className="h-3 w-48 rounded bg-[var(--bn-hover)]" />
                <div className="h-4 w-80 rounded bg-[var(--bn-active)]" />
                <div className="h-3 w-full rounded bg-[var(--bn-hover)]" />
              </div>
            ))}
          </div>
        ) : errorMsg ? (
          <div className="p-5 rounded-2xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[var(--bn-warning)] shrink-0 mt-0.5" />
            <div className="space-y-2">
              <div className="text-sm font-semibold text-[var(--bn-text-strong)]">{errorMsg}</div>
              <p className="text-xs text-[var(--bn-text-muted)]">
                Puedes reintentar o abrir la consulta directamente en un buscador externo.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setReloadTick((n) => n + 1)}
                  className="px-3 py-1.5 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white text-xs font-medium"
                >
                  Reintentar
                </button>
                {externalEngines.map((eng) => (
                  <a
                    key={eng.id}
                    href={eng.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-full bg-[var(--bn-toolbar)] border border-[var(--bn-border-strong)] hover:bg-[var(--bn-hover)] text-xs font-medium text-[var(--bn-text-strong)] inline-flex items-center gap-1"
                  >
                    <span>{eng.name}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Main Organic Results */}
            <div className="lg:col-span-8 space-y-3.5">
              {data?.webError && webResults.length === 0 && (
                <div className="p-3.5 rounded-xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] text-xs text-[var(--bn-text-muted)] flex items-center justify-between gap-3">
                  <span>
                    La búsqueda web directa devolvió límite temporal; mostrando resultados disponibles de Wikipedia y enlaces directos.
                  </span>
                </div>
              )}

              {visibleItems.length === 0 ? (
                <div className="p-6 rounded-2xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] text-center space-y-2">
                  <div className="text-sm font-semibold text-[var(--bn-text-strong)]">
                    No se encontraron resultados para "{query}"
                  </div>
                  <p className="text-xs text-[var(--bn-text-muted)]">
                    Prueba con otros términos o abre la búsqueda en un motor externo.
                  </p>
                </div>
              ) : (
                visibleItems.map((item, idx) => (
                  <motion.article
                    key={`${item.url}-${idx}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.15,
                      delay: Math.min(idx * 0.025, 0.2),
                      ease: LEO_EASE_OUT
                    }}
                    className="p-4 rounded-2xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] hover:border-[var(--bn-border-strong)] transition-colors leo-transition-s group"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[11px] font-mono text-[var(--bn-text-muted)] truncate">
                        {item.displayUrl}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 font-medium ${
                          item.source === 'wikipedia'
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-[var(--bn-hover)] text-[var(--bn-text-muted)]'
                        }`}
                      >
                        {item.source === 'wikipedia' ? 'Wikipedia' : 'Web'}
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => onNavigate(item.url)}
                        className="text-left text-base font-semibold text-[#8ab4f8] hover:underline group-hover:text-[var(--bn-accent)] transition-colors leo-transition-xs leading-snug"
                      >
                        {item.title}
                      </button>

                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir en ventana externa"
                        className="p-1.5 rounded-lg text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)] shrink-0 transition-colors leo-transition-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    {item.snippet && (
                      <p className="mt-1.5 text-xs leading-relaxed text-[var(--bn-text)] line-clamp-3">
                        {item.snippet}
                      </p>
                    )}
                  </motion.article>
                ))
              )}
            </div>

            {/* Right Column: External Search Engines Fallback Card */}
            <aside className="lg:col-span-4 space-y-4">
              <div className="p-4 rounded-2xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] space-y-3">
                <div className="text-xs font-semibold text-[var(--bn-text-strong)]">
                  Abrir "{query}" en motor externo
                </div>
                <p className="text-[11px] text-[var(--bn-text-muted)] leading-relaxed">
                  Si necesitas abrir la consulta directamente fuera de FabiNav, elige un buscador:
                </p>
                <div className="space-y-1.5">
                  {externalEngines.map((eng) => {
                    const isDef = eng.id === defaultEngine;
                    return (
                      <a
                        key={eng.id}
                        href={eng.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors leo-transition-xs ${
                          isDef
                            ? 'bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white'
                            : 'bg-[var(--bn-toolbar)] hover:bg-[var(--bn-hover)] text-[var(--bn-text-strong)] border border-[var(--bn-border)]'
                        }`}
                      >
                        <span>
                          {eng.name}
                          {isDef ? ' (Predeterminado)' : ''}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    );
                  })}
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
};
