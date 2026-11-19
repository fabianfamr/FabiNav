import React, { useEffect, useRef } from 'react';
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
  GoogleUserProfile
} from '../types';
import { Columns } from 'lucide-react';
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
    onClearBrowsingData,
    onResetSettings,
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
        blockedTrackerUrls?: string[];
        upgradedHttps?: boolean;
        found?: boolean;
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
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [tab.id, isNewTab, isSearchPage, isFabiInternal, onNavigate, onPageSecurityReport]);

  // Sync mute state into proxied iframe
  useEffect(() => {
    if (isNewTab || isSearchPage || isFabiInternal) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'fabinav:set-muted', muted: !!tab.isMuted },
      '*'
    );
  }, [tab.isMuted, isNewTab, isSearchPage, isFabiInternal]);

  // Forward Find-in-Page commands into active external iframe
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

    window.addEventListener('fabinav:dispatch-find', handleDispatchFind);
    return () => window.removeEventListener('fabinav:dispatch-find', handleDispatchFind);
  }, [isPrimary, tab.id, isNewTab, isSearchPage, isFabiInternal]);

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
          onClearBrowsingData={onClearBrowsingData}
          onResetSettings={onResetSettings}
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
              onLoad={() => {
                iframeRef.current?.contentWindow?.postMessage(
                  { type: 'fabinav:set-muted', muted: !!tab.isMuted },
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
