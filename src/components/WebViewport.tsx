import React, { useEffect, useRef, useMemo } from 'react';
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
  GoogleUserProfile,
  BrowserExtension,
  AutofillEntry
} from '../types';
import { Columns, Gauge, RotateCw } from 'lucide-react';
import { FabiNewTabView } from './FabiNewTabView';
import { FabiInternalsView } from './FabiInternalsView';
import { FabiSearchView } from './FabiSearchView';

const FABI_EASE_OUT: [number, number, number, number] = [0, 0, 0.58, 1];

export interface PageSecurityReport {
  title?: string;
  url?: string;
  blockedTrackers?: number;
  blockedCookies?: number;
  blockedTrackerUrls?: string[];
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
  onClearBrowsingData?: () => void;
  onResetSettings?: () => void;
  onOpenElectronModal: () => void;
  googleUser?: GoogleUserProfile | null;
  onGoogleSignIn?: () => void;
  onGoogleSignOut?: () => void;
  extensions?: BrowserExtension[];
  onUpdateExtension?: (id: string, updates: Partial<BrowserExtension>) => void;
  onAddExtension?: (ext: Omit<BrowserExtension, 'id'>) => void;
  onRemoveExtension?: (id: string) => void;
  onResetExtensions?: () => void;
  autofillEntries?: AutofillEntry[];
  onAddAutofill?: (entry: Omit<AutofillEntry, 'id' | 'createdAt'>) => void;
  onRemoveAutofill?: (id: string) => void;
  onOpenNewTab?: (url?: string) => void;
  onWakeTab?: (tabId: string) => void;
  onTranslateStatus?: (msg: string) => void;
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
  onClearBrowsingData,
  onResetSettings,
  onOpenElectronModal,
  googleUser,
  onGoogleSignIn,
  onGoogleSignOut,
  extensions = [],
  onUpdateExtension,
  onAddExtension,
  onRemoveExtension,
  onResetExtensions,
  autofillEntries = [],
  onAddAutofill,
  onRemoveAutofill,
  onOpenNewTab,
  onWakeTab,
  onTranslateStatus
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
    onClearBrowsingData,
    onResetSettings,
    onOpenElectronModal,
    googleUser,
    onGoogleSignIn,
    onGoogleSignOut,
    extensions,
    onUpdateExtension,
    onAddExtension,
    onRemoveExtension,
    onResetExtensions,
    autofillEntries,
    onAddAutofill,
    onRemoveAutofill,
    onOpenNewTab,
    onWakeTab,
    onTranslateStatus
  };

  return (
    <main
      id="fabinav-viewport-container"
      className="flex-1 bg-[var(--bn-surface)] relative overflow-hidden flex"
    >
      <div
        className={`h-full overflow-hidden flex flex-col transition-all fabi-transition-m ${
          isSplit ? 'w-1/2 border-r border-[var(--bn-border)]' : 'w-full'
        }`}
      >
        <SingleTabFrame
          tab={primaryTab}
          isPrimary={true}
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
            transition={{ duration: 0.2, ease: FABI_EASE_OUT }}
            className="w-1/2 h-full overflow-hidden flex flex-col bg-[var(--bn-surface)]"
          >
            <SingleTabFrame
              tab={splitTab}
              isPrimary={false}
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
  isPrimary?: boolean;
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
  onClearBrowsingData?: () => void;
  onResetSettings?: () => void;
  onOpenElectronModal: () => void;
  googleUser?: GoogleUserProfile | null;
  onGoogleSignIn?: () => void;
  onGoogleSignOut?: () => void;
  extensions?: BrowserExtension[];
  onUpdateExtension?: (id: string, updates: Partial<BrowserExtension>) => void;
  onAddExtension?: (ext: Omit<BrowserExtension, 'id'>) => void;
  onRemoveExtension?: (id: string) => void;
  onResetExtensions?: () => void;
  autofillEntries?: AutofillEntry[];
  onAddAutofill?: (entry: Omit<AutofillEntry, 'id' | 'createdAt'>) => void;
  onRemoveAutofill?: (id: string) => void;
  onOpenNewTab?: (url?: string) => void;
  onWakeTab?: (tabId: string) => void;
  onTranslateStatus?: (msg: string) => void;
}

const SingleTabFrame: React.FC<SingleTabFrameProps> = ({
  tab,
  isPrimary = false,
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
  onClearBrowsingData,
  onResetSettings,
  onOpenElectronModal,
  googleUser,
  onGoogleSignIn,
  onGoogleSignOut,
  extensions = [],
  onUpdateExtension,
  onAddExtension,
  onRemoveExtension,
  onResetExtensions,
  autofillEntries = [],
  onAddAutofill,
  onRemoveAutofill,
  onOpenNewTab,
  onWakeTab,
  onTranslateStatus
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const isNewTab = tab.url === 'fabinav://newtab' || !tab.url;
  const isSearchPage = tab.url.startsWith('fabinav://search?q=');
  const isFabiInternal = tab.url.startsWith('fabinav://') && !isNewTab && !isSearchPage;

  const searchQuery = isSearchPage
    ? decodeURIComponent(tab.url.replace('fabinav://search?q=', ''))
    : '';

  const activeExtModes = useMemo(
    () =>
      extensions
        .filter((e) => e.enabled && (e.mode === 'dark-web' || e.mode === 'reader' || e.mode === 'ad-cosmetic'))
        .map((e) => e.mode),
    [extensions]
  );

  const activeCustomCss = useMemo(
    () =>
      extensions
        .filter((e) => e.enabled && (e.mode === 'stylus' || e.mode === 'custom-css') && e.customCss)
        .map((e) => e.customCss)
        .join('\n'),
    [extensions]
  );

  useEffect(() => {
    if (isNewTab || isSearchPage || isFabiInternal) return;

    const handleMessage = async (ev: MessageEvent) => {
      if (!iframeRef.current || ev.source !== iframeRef.current.contentWindow) return;
      const payload = ev.data as {
        type?: string;
        url?: string;
        title?: string;
        blockedTrackers?: number;
        blockedCookies?: number;
        blockedTrackerUrls?: string[];
        upgradedHttps?: boolean;
        found?: boolean;
        texts?: string[];
        targetLang?: string;
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
          blockedTrackerUrls: Array.isArray(payload.blockedTrackerUrls)
            ? payload.blockedTrackerUrls
            : [],
          upgradedHttps: payload.upgradedHttps
        });
      } else if (payload.type === 'fabinav:find-result') {
        window.dispatchEvent(
          new CustomEvent('fabinav:find-result', {
            detail: { tabId: tab.id, found: !!payload.found }
          })
        );
      } else if (payload.type === 'fabinav:translate-collected' && Array.isArray(payload.texts)) {
        if (payload.texts.length === 0) {
          onTranslateStatus?.('No se detectó texto traducible en la página');
          return;
        }
        onTranslateStatus?.(`Traduciendo página (${payload.texts.length} bloques)...`);
        try {
          const targetLang =
            payload.targetLang || settings.translateTargetLang || settings.language || 'es';
          const res = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texts: payload.texts, targetLang })
          });
          if (res.ok) {
            const json = (await res.json()) as { translatedTexts?: string[] };
            if (Array.isArray(json.translatedTexts)) {
              iframeRef.current?.contentWindow?.postMessage(
                { type: 'fabinav:translate-apply', translatedTexts: json.translatedTexts },
                '*'
              );
              onTranslateStatus?.(`Página traducida a ${targetLang.toUpperCase()}`);
            }
          } else {
            onTranslateStatus?.('Servicio de traducción no disponible');
          }
        } catch {
          onTranslateStatus?.('No se pudo traducir la página');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [
    tab.id,
    isNewTab,
    isSearchPage,
    isFabiInternal,
    onNavigate,
    onPageSecurityReport,
    settings.translateTargetLang,
    settings.language,
    onTranslateStatus
  ]);

  // Sync mute state into proxied iframe
  useEffect(() => {
    if (isNewTab || isSearchPage || isFabiInternal) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'fabinav:set-muted', muted: !!tab.isMuted },
      '*'
    );
  }, [tab.isMuted, isNewTab, isSearchPage, isFabiInternal]);

  // Sync active extensions live CSS into proxied iframe without reloading
  useEffect(() => {
    if (isNewTab || isSearchPage || isFabiInternal || tab.isDiscarded) return;
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: 'fabinav:apply-extensions',
        modes: activeExtModes,
        customCss: activeCustomCss
      },
      '*'
    );
  }, [activeExtModes, activeCustomCss, isNewTab, isSearchPage, isFabiInternal, tab.isDiscarded]);

  // Forward Find-in-Page and Translate commands into active external iframe
  useEffect(() => {
    if (!isPrimary || isNewTab || isSearchPage || isFabiInternal) return;

    const handleDispatchFind = (ev: Event) => {
      const customEv = ev as CustomEvent<{ tabId?: string; query?: string; backwards?: boolean }>;
      if (!customEv.detail || customEv.detail.tabId !== tab.id || !customEv.detail.query) return;
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: 'fabinav:find',
          query: customEv.detail.query,
          backwards: !!customEv.detail.backwards
        },
        '*'
      );
    };

    const handleDispatchTranslate = (ev: Event) => {
      const customEv = ev as CustomEvent<{ tabId?: string; targetLang?: string }>;
      if (!customEv.detail || customEv.detail.tabId !== tab.id) return;
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: 'fabinav:translate-request',
          targetLang:
            customEv.detail.targetLang || settings.translateTargetLang || settings.language || 'es'
        },
        '*'
      );
    };

    window.addEventListener('fabinav:dispatch-find', handleDispatchFind);
    window.addEventListener('fabinav:dispatch-translate', handleDispatchTranslate);
    return () => {
      window.removeEventListener('fabinav:dispatch-find', handleDispatchFind);
      window.removeEventListener('fabinav:dispatch-translate', handleDispatchTranslate);
    };
  }, [
    isPrimary,
    tab.id,
    isNewTab,
    isSearchPage,
    isFabiInternal,
    settings.translateTargetLang,
    settings.language
  ]);

  const activeLists = (
    shieldState.filterLists || ['core-trackers', 'cookie-notices', 'url-tracking']
  ).join(',');
  const activeCustomRules = (shieldState.customFilterRules || []).join(',');

  const proxySrc =
    !isNewTab && !isSearchPage && !isFabiInternal
      ? `/api/proxy?url=${encodeURIComponent(tab.url)}&partition=${
          tab.tabMode === 'private' ? 'private' : 'normal'
        }&shields=${shieldState.enabled ? '1' : '0'}&blockTrackers=${
          shieldState.blockTrackersAndAds
        }&blockScripts=${shieldState.blockScripts ? '1' : '0'}&blockCookies=${
          shieldState.blockCrossSiteCookies ? '1' : '0'
        }&fingerprint=${shieldState.blockFingerprinting}&upgradeHttps=${
          shieldState.upgradeHttps ? '1' : '0'
        }&strictTls=${shieldState.strictTls ? '1' : '0'}&lists=${encodeURIComponent(
          activeLists
        )}&customRules=${encodeURIComponent(activeCustomRules)}`
      : '';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-[var(--bn-surface)]">
      {/* FabiNav Loading Progress Bar */}
      <AnimatePresence>
        {tab.isLoading && (
          <motion.div
            initial={{ scaleX: 0, opacity: 1 }}
            animate={{ scaleX: 0.85, opacity: 1 }}
            exit={{ scaleX: 1, opacity: 0 }}
            transition={{ duration: 0.3, ease: FABI_EASE_OUT }}
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
              className="text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] px-2.5 py-0.5 rounded-full hover:bg-[var(--bn-hover)] whitespace-nowrap shrink-0 transition-colors fabi-transition-xs"
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
        <FabiSearchView
          query={searchQuery}
          defaultEngine={settings.defaultSearchEngine}
          googleUser={googleUser}
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
          onClearBrowsingData={onClearBrowsingData}
          onResetSettings={onResetSettings}
          onOpenElectronModal={onOpenElectronModal}
          onNavigate={onNavigate}
          extensions={extensions}
          onUpdateExtension={onUpdateExtension}
          onAddExtension={onAddExtension}
          onRemoveExtension={onRemoveExtension}
          onResetExtensions={onResetExtensions}
          autofillEntries={autofillEntries}
          onAddAutofill={onAddAutofill}
          onRemoveAutofill={onRemoveAutofill}
          onOpenNewTab={onOpenNewTab}
        />
      ) : tab.isDiscarded ? (
        <div className="flex-1 w-full h-full flex items-center justify-center bg-[var(--bn-surface)] p-6">
          <div className="max-w-md w-full rounded-2xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] p-6 text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-2xl mx-auto bg-[var(--bn-accent-soft)] text-[var(--bn-accent)] flex items-center justify-center">
              <Gauge className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-[var(--bn-text-strong)]">
                Pestaña suspendida por Ahorro de memoria
              </h2>
              <p className="text-xs text-[var(--bn-text-muted)] truncate">{tab.title}</p>
              <p className="text-[11px] font-mono text-[var(--bn-text-muted)] truncate">{tab.url}</p>
            </div>
            <button
              type="button"
              onClick={() => onWakeTab?.(tab.id)}
              className="px-5 py-2 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white text-xs font-medium inline-flex items-center gap-2 transition-colors"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Reactivar pestaña</span>
            </button>
          </div>
        </div>
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
              onLoad={() => {
                iframeRef.current?.contentWindow?.postMessage(
                  { type: 'fabinav:set-muted', muted: !!tab.isMuted },
                  '*'
                );
                iframeRef.current?.contentWindow?.postMessage(
                  {
                    type: 'fabinav:apply-extensions',
                    modes: activeExtModes,
                    customCss: activeCustomCss
                  },
                  '*'
                );
              }}
              className="w-full h-full border-none bg-white"
              sandbox="allow-scripts allow-forms allow-popups allow-downloads"
            />
          </div>
        </div>
      )}
    </div>
  );
};

