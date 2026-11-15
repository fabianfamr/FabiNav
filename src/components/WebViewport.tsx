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
  AlertCircle,
  X,
  ArrowUpRight,
  Compass
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
        <div className="h-8 px-3.5 bg-[var(--bn-toolbar)] border-b border-[var(--bn-border)] flex items-center justify-between text-[11px] text-[var(--bn-text-muted)] shrink-0">
          <span className="font-medium text-[var(--bn-text-strong)] flex items-center gap-2 truncate">
            <Columns className="w-3.5 h-3.5 text-[var(--bn-accent)] shrink-0" />
            <span className="truncate">
              {label} · {tab.title}
            </span>
          </span>
          {onCloseSplit && (
            <button
              type="button"
              onClick={onCloseSplit}
              className="text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] px-2.5 py-0.5 rounded-full hover:bg-[var(--bn-hover)] whitespace-nowrap shrink-0 transition-colors leo-transition-xs"
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
          onUpdateSettings={onUpdateSettings}
          customization={customization}
          topSites={topSites}
          onAddTopSite={onAddTopSite}
          onRemoveTopSite={onRemoveTopSite}
          onUpdateCustomization={onUpdateCustomization}
          onOpenShieldModal={onOpenShieldModal}
        />
      ) : isSearchPage ? (
        <FabiSearchView
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
   FabiNav Search Live Results UI (powered by /api/search + Wikipedia Summary)
============================================================================ */
interface FabiSearchViewProps {
  query: string;
  defaultEngine: BrowserSettings['defaultSearchEngine'];
  onNavigate: (url: string) => void;
}

const DOMAIN_ACCENTS = [
  'bg-orange-500/15 text-orange-400',
  'bg-blue-500/15 text-blue-400',
  'bg-emerald-500/15 text-emerald-400',
  'bg-indigo-500/15 text-indigo-400',
  'bg-rose-500/15 text-rose-400',
  'bg-amber-500/15 text-amber-400'
];

function getDomainVisuals(rawUrl: string): { host: string; breadcrumb: string; colorClass: string; initial: string } {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.replace(/^www\./, '');
    const pathSegments = parsed.pathname
      .split('/')
      .filter(Boolean)
      .slice(0, 3)
      .map((s) => decodeURIComponent(s));
    const breadcrumb =
      pathSegments.length > 0 ? `${host} › ${pathSegments.join(' › ')}` : host;
    let hash = 0;
    for (let i = 0; i < host.length; i++) {
      hash = (hash * 31 + host.charCodeAt(i)) >>> 0;
    }
    return {
      host,
      breadcrumb,
      colorClass: DOMAIN_ACCENTS[hash % DOMAIN_ACCENTS.length],
      initial: (host[0] || 'W').toUpperCase()
    };
  } catch {
    return {
      host: rawUrl,
      breadcrumb: rawUrl,
      colorClass: DOMAIN_ACCENTS[0],
      initial: 'W'
    };
  }
}

const FabiSearchView: React.FC<FabiSearchViewProps> = ({
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
  const [wikiImgFailed, setWikiImgFailed] = useState(false);

  useEffect(() => {
    setInputVal(query);
    setWikiImgFailed(false);
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
    onNavigate(cleaned);
  };

  const webResults = data?.results || [];
  const wikiResults = data?.wikipedia || [];
  const mergedAll: SearchResultItem[] = [
    ...webResults,
    ...wikiResults.filter((w) => !webResults.some((r) => r.url === w.url))
  ];
  const visibleItems: SearchResultItem[] =
    activeFilter === 'wikipedia' ? wikiResults : mergedAll;

  const knowledge = data?.knowledge || null;
  const durationLabel =
    typeof data?.durationMs === 'number'
      ? `${(data.durationMs / 1000).toFixed(2)} s`
      : null;

  const externalEngines = [
    {
      id: 'google',
      name: 'Google',
      href: `https://www.google.com/search?q=${encodeURIComponent(query)}`
    },
    {
      id: 'duckduckgo',
      name: 'DuckDuckGo',
      href: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
    },
    {
      id: 'bing',
      name: 'Bing',
      href: `https://www.bing.com/search?q=${encodeURIComponent(query)}`
    },
    {
      id: 'ecosia',
      name: 'Ecosia',
      href: `https://www.ecosia.org/search?q=${encodeURIComponent(query)}`
    }
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bn-surface)] text-[var(--bn-text)]">
      {/* Top FabiNav Search Header */}
      <header className="sticky top-0 z-10 bg-[var(--bn-toolbar)]/95 backdrop-blur-md border-b border-[var(--bn-border)] px-5 sm:px-8 pt-3.5 pb-0">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 sm:gap-5">
            {/* Brand Wordmark */}
            <button
              type="button"
              onClick={() => onNavigate('fabinav://newtab')}
              title="Volver a Nueva pestaña"
              className="flex items-center gap-2.5 shrink-0 group whitespace-nowrap"
            >
              <span
                className="w-8 h-8 rounded-xl flex items-center justify-center shadow-xs transition-transform leo-transition-s group-hover:scale-105"
                style={{ background: 'var(--leo-gradient-brand)' }}
              >
                <Compass className="w-4 h-4 text-white" />
              </span>
              <span className="hidden sm:inline text-sm font-bold text-[var(--bn-text-strong)] tracking-tight">
                FabiNav Search
              </span>
            </button>

            {/* Live Search Bar */}
            <form onSubmit={handleSubmit} className="flex-1 max-w-2xl">
              <div className="h-10 rounded-full bg-[var(--bn-omnibox)] border border-[var(--bn-border)] focus-within:border-[var(--bn-accent)] focus-within:bg-[var(--bn-omnibox-focus)] flex items-center pl-3.5 pr-1.5 gap-2 transition-colors leo-transition-s shadow-xs">
                <Search className="w-4 h-4 text-[var(--bn-text-muted)] shrink-0" />
                <input
                  type="text"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  placeholder="Buscar en la web o escribir una URL..."
                  className="flex-1 bg-transparent outline-none text-[13px] text-[var(--bn-text-strong)] placeholder:text-[var(--bn-text-muted)] select-text"
                />
                {inputVal.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setInputVal('')}
                    title="Limpiar búsqueda"
                    className="p-1 rounded-full text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)] transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] active:scale-95 text-white text-xs font-medium transition-all leo-transition-xs shrink-0 whitespace-nowrap"
                >
                  Buscar
                </button>
              </div>
            </form>

            <button
              type="button"
              onClick={() => setReloadTick((n) => n + 1)}
              title="Actualizar resultados"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)] transition-colors leo-transition-xs shrink-0"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-[var(--bn-accent)]' : ''}`} />
            </button>
          </div>

          {/* Filter Tabs & Metrics Row */}
          <div className="flex items-center justify-between gap-4 mt-3 text-xs">
            <div className="flex items-center gap-6 font-medium">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-colors leo-transition-s whitespace-nowrap shrink-0 ${
                  activeFilter === 'all'
                    ? 'border-[var(--bn-accent)] text-[var(--bn-text-strong)]'
                    : 'border-transparent text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)]'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Todo</span>
                <span className="text-[11px] text-[var(--bn-text-muted)] tabular-nums">
                  ({mergedAll.length})
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('wikipedia')}
                className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-colors leo-transition-s whitespace-nowrap shrink-0 ${
                  activeFilter === 'wikipedia'
                    ? 'border-[var(--bn-accent)] text-[var(--bn-text-strong)]'
                    : 'border-transparent text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)]'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Wikipedia</span>
                <span className="text-[11px] text-[var(--bn-text-muted)] tabular-nums">
                  ({wikiResults.length})
                </span>
              </button>
            </div>

            {!loading && data && (
              <div className="hidden sm:flex items-center gap-2 pb-2.5 text-[11px] text-[var(--bn-text-muted)] tabular-nums">
                <span>{visibleItems.length} resultados</span>
                {durationLabel && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{durationLabel}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Results Body */}
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-6">
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-6">
              {[1, 2, 3, 4, 5].map((idx) => (
                <div key={idx} className="animate-pulse space-y-2 py-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-[var(--bn-hover)]" />
                    <div className="h-3 w-48 rounded bg-[var(--bn-hover)]" />
                  </div>
                  <div className="h-4 w-72 rounded bg-[var(--bn-active)]" />
                  <div className="h-3 w-full rounded bg-[var(--bn-hover)]" />
                  <div className="h-3 w-5/6 rounded bg-[var(--bn-hover)]" />
                </div>
              ))}
            </div>
            <div className="lg:col-span-4">
              <div className="h-56 rounded-2xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] animate-pulse" />
            </div>
          </div>
        ) : errorMsg ? (
          <div className="p-6 rounded-2xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] flex items-start gap-3.5 max-w-2xl">
            <AlertCircle className="w-5 h-5 text-[var(--bn-warning-text)] shrink-0 mt-0.5" />
            <div className="space-y-2.5">
              <div className="text-sm font-semibold text-[var(--bn-text-strong)]">{errorMsg}</div>
              <p className="text-xs text-[var(--bn-text-muted)] leading-relaxed">
                Puedes reintentar la consulta o abrirla directamente en un buscador externo.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setReloadTick((n) => n + 1)}
                  className="px-4 py-1.5 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white text-xs font-medium"
                >
                  Reintentar
                </button>
                {externalEngines.slice(0, 3).map((eng) => (
                  <a
                    key={eng.id}
                    href={eng.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 rounded-full bg-[var(--bn-toolbar)] border border-[var(--bn-border-strong)] hover:bg-[var(--bn-hover)] text-xs font-medium text-[var(--bn-text-strong)] inline-flex items-center gap-1.5"
                  >
                    <span>{eng.name}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left / Main Column: Clean FabiNav Organic Results */}
            <div className="lg:col-span-8">
              {data?.webError && webResults.length === 0 && (
                <div className="mb-5 p-3.5 rounded-xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] text-xs text-[var(--bn-text-muted)]">
                  La búsqueda web directa alcanzó un límite temporal; se muestran los resultados disponibles de Wikipedia y enlaces directos.
                </div>
              )}

              {visibleItems.length === 0 ? (
                <div className="p-8 rounded-2xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] text-center space-y-2.5">
                  <div className="text-sm font-semibold text-[var(--bn-text-strong)]">
                    No se encontraron resultados para «{query}»
                  </div>
                  <p className="text-xs text-[var(--bn-text-muted)]">
                    Prueba con otros términos o usa un motor de búsqueda externo en la columna derecha.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--bn-border)]/70">
                  {visibleItems.map((item, idx) => {
                    const visuals = getDomainVisuals(item.url);
                    return (
                      <motion.article
                        key={`${item.url}-${idx}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.14,
                          delay: Math.min(idx * 0.02, 0.16),
                          ease: LEO_EASE_OUT
                        }}
                        className="py-4 first:pt-0 group"
                      >
                        {/* Domain Favicon + Breadcrumb Row (Zero-Pill Clean Metadata) */}
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 ${visuals.colorClass}`}
                              aria-hidden="true"
                            >
                              {item.source === 'wikipedia' ? 'W' : visuals.initial}
                            </span>
                            <div className="min-w-0 flex items-center gap-1.5 text-xs text-[var(--bn-text-muted)]">
                              <span className="truncate font-medium text-[var(--bn-text)]">
                                {visuals.breadcrumb}
                              </span>
                              {item.source === 'wikipedia' && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="shrink-0">Wikipedia</span>
                                </>
                              )}
                            </div>
                          </div>

                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir en ventana externa"
                            className="p-1.5 rounded-full text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)] opacity-60 group-hover:opacity-100 shrink-0 transition-all leo-transition-xs"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>

                        {/* Clickable Result Title */}
                        <button
                          type="button"
                          onClick={() => onNavigate(item.url)}
                          className="text-left text-[17px] font-semibold text-[var(--bn-link)] hover:text-[var(--bn-link-hover)] hover:underline transition-colors leo-transition-xs leading-snug block"
                        >
                          {item.title}
                        </button>

                        {/* Clean Readable Snippet */}
                        {item.snippet && (
                          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--bn-text)]/90 line-clamp-3 max-w-[68ch] select-text">
                            {item.snippet}
                          </p>
                        )}
                      </motion.article>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Column: FabiNav Knowledge Panel + External Engine Launcher */}
            <aside className="lg:col-span-4 space-y-4 lg:sticky lg:top-28">
              {knowledge && (
                <div className="rounded-2xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] overflow-hidden">
                  {knowledge.thumbnailUrl && !wikiImgFailed && (
                    <div className="w-full h-36 bg-[var(--bn-omnibox)] overflow-hidden border-b border-[var(--bn-border)]">
                      <img
                        src={knowledge.thumbnailUrl}
                        alt={knowledge.title}
                        referrerPolicy="no-referrer"
                        onError={() => setWikiImgFailed(true)}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-4 space-y-2.5">
                    <div>
                      <div className="text-[11px] text-[var(--bn-text-muted)]">
                        Resumen · Wikipedia
                      </div>
                      <h2 className="text-base font-semibold text-[var(--bn-text-strong)] leading-snug mt-0.5">
                        {knowledge.title}
                      </h2>
                      {knowledge.description && (
                        <div className="text-xs text-[var(--bn-text-muted)] mt-0.5">
                          {knowledge.description}
                        </div>
                      )}
                    </div>

                    <p className="text-xs leading-relaxed text-[var(--bn-text)] line-clamp-5 select-text">
                      {knowledge.extract}
                    </p>

                    <div className="pt-1 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onNavigate(knowledge.url)}
                        className="px-3.5 py-1.5 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                      >
                        <span>Leer artículo</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>

                      <a
                        href={knowledge.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:underline whitespace-nowrap"
                      >
                        Fuente externa
                      </a>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 rounded-2xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] space-y-3">
                <div>
                  <h3 className="text-xs font-semibold text-[var(--bn-text-strong)]">
                    Buscar «{query}» en otro motor
                  </h3>
                  <p className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                    Abre esta misma consulta en una ventana externa.
                  </p>
                </div>

                <div className="space-y-1.5">
                  {externalEngines.map((eng) => {
                    const isDef = eng.id === defaultEngine;
                    return (
                      <a
                        key={eng.id}
                        href={eng.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`w-full px-3.5 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors leo-transition-xs ${
                          isDef
                            ? 'bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white'
                            : 'bg-[var(--bn-surface)] hover:bg-[var(--bn-hover)] text-[var(--bn-text-strong)] border border-[var(--bn-border)]'
                        }`}
                      >
                        <span className="truncate">
                          {eng.name}
                          {isDef ? ' · Predeterminado' : ''}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
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
