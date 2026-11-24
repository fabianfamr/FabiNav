import React, { useEffect, useRef, useMemo, useState } from 'react';
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
  autofillEntries?: AutofillEntry[];
  onAddAutofill?: (entry: Omit<AutofillEntry, 'id' | 'createdAt'>) => void;
  onRemoveAutofill?: (id: string) => void;
  onOpenNewTab?: (url?: string) => void;
  onWakeTab?: (tabId: string) => void;
  onTranslateStatus?: (msg: string) => void;
  onPageNotification?: (
    tabId: string,
    notif: { origin: string; title: string; body: string; icon?: string; tag?: string; url?: string }
  ) => void;
  onRequestNotificationPermission?: (req: {
    tabId: string;
    origin: string;
    url?: string;
    source: 'iframe' | 'webview';
    requestId?: string;
  }) => void;
  onSendTestNotification?: () => void;
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
  autofillEntries = [],
  onAddAutofill,
  onRemoveAutofill,
  onOpenNewTab,
  onWakeTab,
  onTranslateStatus,
  onPageNotification,
  onRequestNotificationPermission,
  onSendTestNotification
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
    autofillEntries,
    onAddAutofill,
    onRemoveAutofill,
    onOpenNewTab,
    onWakeTab,
    onTranslateStatus,
    onPageNotification,
    onRequestNotificationPermission,
    onSendTestNotification
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
  autofillEntries?: AutofillEntry[];
  onAddAutofill?: (entry: Omit<AutofillEntry, 'id' | 'createdAt'>) => void;
  onRemoveAutofill?: (id: string) => void;
  onOpenNewTab?: (url?: string) => void;
  onWakeTab?: (tabId: string) => void;
  onTranslateStatus?: (msg: string) => void;
  onPageNotification?: (
    tabId: string,
    notif: { origin: string; title: string; body: string; icon?: string; tag?: string; url?: string }
  ) => void;
  onRequestNotificationPermission?: (req: {
    tabId: string;
    origin: string;
    url?: string;
    source: 'iframe' | 'webview';
    requestId?: string;
  }) => void;
  onSendTestNotification?: () => void;
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
  autofillEntries = [],
  onAddAutofill,
  onRemoveAutofill,
  onOpenNewTab,
  onWakeTab,
  onTranslateStatus,
  onPageNotification,
  onRequestNotificationPermission,
  onSendTestNotification
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const webviewRef = useRef<
    | (HTMLElement & {
        loadURL?: (url: string) => Promise<void>;
        getURL?: () => string;
        getTitle?: () => string;
        reload?: () => void;
        setAudioMuted?: (muted: boolean) => void;
        setZoomFactor?: (factor: number) => void;
        insertCSS?: (css: string) => Promise<string>;
        executeJavaScript?: (code: string) => Promise<unknown>;
        findInPage?: (text: string, opts?: { forward?: boolean }) => number;
      })
    | null
  >(null);
  const lastWebviewUrlRef = useRef<string>('');
  const [webviewError, setWebviewError] = useState<string | null>(null);
  const [relaxedRetryUrl, setRelaxedRetryUrl] = useState<string | null>(null);
  const isElectron = typeof window !== 'undefined' && !!window.fabinavDesktop?.isElectron;
  const isNewTab = tab.url === 'fabinav://newtab' || !tab.url;
  const isSearchPage = tab.url.startsWith('fabinav://search?q=');
  const isFabiInternal = tab.url.startsWith('fabinav://') && !isNewTab && !isSearchPage;

  const searchQuery = isSearchPage
    ? decodeURIComponent(tab.url.replace('fabinav://search?q=', ''))
    : '';

  const isMutedRef = useRef(!!tab.isMuted);
  useEffect(() => {
    isMutedRef.current = !!tab.isMuted;
  }, [tab.isMuted]);

  const resolveOriginNotifPerm = (rawUrl: string): 'default' | 'granted' | 'denied' => {
    if (settings.notificationsEnabled === false) return 'denied';
    let origin = rawUrl;
    try {
      origin = new URL(rawUrl).origin;
    } catch {
      // keep raw
    }
    const saved = settings.notificationPermissions?.[origin];
    if (saved === 'allow') return 'granted';
    if (saved === 'block') return 'denied';
    return settings.notificationDefaultPolicy === 'block' ? 'denied' : 'default';
  };

  const resolveNotifPermRef = useRef(resolveOriginNotifPerm);
  resolveNotifPermRef.current = resolveOriginNotifPerm;

  const onPageNotificationRef = useRef(onPageNotification);
  onPageNotificationRef.current = onPageNotification;

  const onRequestNotifPermissionRef = useRef(onRequestNotificationPermission);
  onRequestNotifPermissionRef.current = onRequestNotificationPermission;

  // Reset relaxed retry flag when navigating to a different URL
  useEffect(() => {
    setRelaxedRetryUrl(null);
    setWebviewError(null);
  }, [tab.url]);

  // Native Chromium <webview> lifecycle for Electron desktop (.exe)
  useEffect(() => {
    if (!isElectron || isNewTab || isSearchPage || isFabiInternal || tab.isDiscarded) return;
    const wv = webviewRef.current;
    if (!wv) return;

    const onStartLoading = () => {
      setWebviewError(null);
    };
    const onStopLoading = () => {
      const currentTitle = wv.getTitle?.() || tab.title;
      const currentWvUrl = wv.getURL?.() || tab.url;
      onPageSecurityReport?.({
        title: currentTitle,
        url: currentWvUrl
      });
    };
    const onTitleUpdated = (ev: Event) => {
      const title = (ev as Event & { title?: string }).title;
      if (title) {
        onPageSecurityReport?.({ title, url: wv.getURL?.() || tab.url });
      }
    };
    const onDidNavigate = (ev: Event) => {
      const nextUrl = (ev as Event & { url?: string }).url;
      if (nextUrl && /^https?:\/\//i.test(nextUrl) && nextUrl !== lastWebviewUrlRef.current) {
        lastWebviewUrlRef.current = nextUrl;
        onNavigate(nextUrl);
      }
    };
    const onDidFailLoad = (ev: Event) => {
      const failEv = ev as Event & {
        errorCode?: number;
        errorDescription?: string;
        isMainFrame?: boolean;
      };
      if (failEv.isMainFrame !== false && failEv.errorCode && failEv.errorCode !== -3) {
        setWebviewError(failEv.errorDescription || `Error de red (${failEv.errorCode})`);
      }
    };
    const onDomReady = () => {
      try {
        wv.setAudioMuted?.(!!tab.isMuted);
        wv.setZoomFactor?.(settings.zoomLevel / 100);
        void wv.executeJavaScript?.(`
          (function () {
            if (window.__fabinavNotifHooked) return;
            window.__fabinavNotifHooked = true;
            var relay = function (title, opts) {
              try {
                console.debug('__FABINAV_NOTIF__' + JSON.stringify({
                  origin: location.origin || location.href,
                  url: location.href,
                  title: String(title || ''),
                  body: String((opts && opts.body) || ''),
                  icon: opts && typeof opts.icon === 'string' ? opts.icon : '',
                  tag: opts && typeof opts.tag === 'string' ? opts.tag : ''
                }));
              } catch (e) {}
            };
            try {
              var OrigNotif = window.Notification;
              if (OrigNotif) {
                var WrappedNotif = function (title, opts) {
                  relay(title, opts || {});
                  return new OrigNotif(title, opts);
                };
                WrappedNotif.prototype = OrigNotif.prototype;
                Object.defineProperty(WrappedNotif, 'permission', {
                  get: function () { return OrigNotif.permission; },
                  configurable: true
                });
                WrappedNotif.requestPermission = function (cb) {
                  return OrigNotif.requestPermission(cb);
                };
                if ('maxActions' in OrigNotif) WrappedNotif.maxActions = OrigNotif.maxActions;
                window.Notification = WrappedNotif;
              }
            } catch (e) {}
            try {
              if (window.ServiceWorkerRegistration && ServiceWorkerRegistration.prototype && ServiceWorkerRegistration.prototype.showNotification) {
                var origShow = ServiceWorkerRegistration.prototype.showNotification;
                ServiceWorkerRegistration.prototype.showNotification = function (title, opts) {
                  relay(title, opts || {});
                  return origShow.apply(this, arguments);
                };
              }
            } catch (e) {}
          })();
        `);
      } catch {
        // ignore webview readiness race
      }
    };
    const onConsoleMessage = (ev: Event) => {
      const msg = (ev as Event & { message?: string }).message;
      if (typeof msg !== 'string' || !msg.startsWith('__FABINAV_NOTIF__')) return;
      try {
        const parsed = JSON.parse(msg.slice('__FABINAV_NOTIF__'.length)) as {
          origin?: string;
          url?: string;
          title?: string;
          body?: string;
          icon?: string;
          tag?: string;
        };
        if (parsed.title || parsed.body) {
          onPageNotificationRef.current?.(tab.id, {
            origin: parsed.origin || tab.url,
            title: parsed.title || 'Notificación',
            body: parsed.body || '',
            icon: parsed.icon,
            tag: parsed.tag,
            url: parsed.url || tab.url
          });
        }
      } catch {
        // ignore malformed notification JSON
      }
    };

    wv.addEventListener('did-start-loading', onStartLoading);
    wv.addEventListener('did-stop-loading', onStopLoading);
    wv.addEventListener('page-title-updated', onTitleUpdated);
    wv.addEventListener('did-navigate', onDidNavigate);
    wv.addEventListener('did-navigate-in-page', onDidNavigate);
    wv.addEventListener('did-fail-load', onDidFailLoad);
    wv.addEventListener('dom-ready', onDomReady);
    wv.addEventListener('console-message', onConsoleMessage);

    return () => {
      wv.removeEventListener('did-start-loading', onStartLoading);
      wv.removeEventListener('did-stop-loading', onStopLoading);
      wv.removeEventListener('page-title-updated', onTitleUpdated);
      wv.removeEventListener('did-navigate', onDidNavigate);
      wv.removeEventListener('did-navigate-in-page', onDidNavigate);
      wv.removeEventListener('did-fail-load', onDidFailLoad);
      wv.removeEventListener('dom-ready', onDomReady);
      wv.removeEventListener('console-message', onConsoleMessage);
    };
  }, [isElectron, tab.id, isNewTab, isSearchPage, isFabiInternal, tab.isDiscarded]);

  // Navigate Electron <webview> only when tab.url changes externally (omnibox / bookmarks / back / forward)
  useEffect(() => {
    if (!isElectron || isNewTab || isSearchPage || isFabiInternal || tab.isDiscarded) return;
    if (lastWebviewUrlRef.current && lastWebviewUrlRef.current !== tab.url) {
      lastWebviewUrlRef.current = tab.url;
      try {
        void webviewRef.current?.loadURL?.(tab.url);
      } catch {
        // ignore
      }
    } else if (!lastWebviewUrlRef.current) {
      lastWebviewUrlRef.current = tab.url;
    }
  }, [isElectron, tab.url, isNewTab, isSearchPage, isFabiInternal, tab.isDiscarded]);

  // Sync Zoom on Electron <webview>
  useEffect(() => {
    if (!isElectron || isNewTab || isSearchPage || isFabiInternal) return;
    try {
      webviewRef.current?.setZoomFactor?.(settings.zoomLevel / 100);
    } catch {
      // ignore
    }
  }, [isElectron, settings.zoomLevel, isNewTab, isSearchPage, isFabiInternal]);

  useEffect(() => {
    if (isElectron || isNewTab || isSearchPage || isFabiInternal) return;

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
        origin?: string;
        body?: string;
        icon?: string;
        tag?: string;
        requestId?: string;
      };
      if (!payload || typeof payload !== 'object') return;

      if (payload.type === 'fabinav:navigate' && typeof payload.url === 'string') {
        onNavigate(payload.url);
      } else if (payload.type === 'fabinav:open-url-new-tab' && typeof payload.url === 'string') {
        onOpenNewTab?.(payload.url);
      } else if (payload.type === 'fabinav:retry-relaxed') {
        setRelaxedRetryUrl(payload.url || tab.url);
      } else if (payload.type === 'fabinav:navigate-state' && typeof payload.url === 'string') {
        onPageSecurityReport?.({ url: payload.url });
      } else if (payload.type === 'fabinav:bridge-ready') {
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'fabinav:set-muted', muted: isMutedRef.current },
          '*'
        );
        iframeRef.current?.contentWindow?.postMessage(
          {
            type: 'fabinav:notif-permission-sync',
            permission: resolveNotifPermRef.current(payload.url || tab.url)
          },
          '*'
        );
      } else if (payload.type === 'fabinav:page-notification') {
        onPageNotificationRef.current?.(tab.id, {
          origin: payload.origin || tab.url,
          title: payload.title || 'Notificación',
          body: payload.body || '',
          icon: payload.icon,
          tag: payload.tag,
          url: payload.url || tab.url
        });
      } else if (payload.type === 'fabinav:notif-request-permission' && payload.requestId) {
        const perm = resolveNotifPermRef.current(payload.url || payload.origin || tab.url);
        if (perm !== 'default') {
          iframeRef.current?.contentWindow?.postMessage(
            {
              type: 'fabinav:notif-permission-result',
              requestId: payload.requestId,
              permission: perm
            },
            '*'
          );
        } else {
          onRequestNotifPermissionRef.current?.({
            tabId: tab.id,
            origin: payload.origin || tab.url,
            url: payload.url || tab.url,
            source: 'iframe',
            requestId: payload.requestId
          });
        }
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

    const handlePermissionReply = (ev: Event) => {
      const detail = (ev as CustomEvent<{ tabId?: string; requestId?: string; permission?: string }>).detail;
      if (!detail || (detail.tabId && detail.tabId !== tab.id)) return;
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: 'fabinav:notif-permission-result',
          requestId: detail.requestId,
          permission: detail.permission || 'denied'
        },
        '*'
      );
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('fabinav:notif-permission-reply', handlePermissionReply);
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('fabinav:notif-permission-reply', handlePermissionReply);
    };
  }, [
    isElectron,
    tab.id,
    tab.url,
    isNewTab,
    isSearchPage,
    isFabiInternal,
    onNavigate,
    onOpenNewTab,
    onPageSecurityReport,
    settings.translateTargetLang,
    settings.language,
    onTranslateStatus
  ]);

  // Sync mute state into proxied iframe or Electron webview
  useEffect(() => {
    if (isNewTab || isSearchPage || isFabiInternal) return;
    if (isElectron) {
      try {
        webviewRef.current?.setAudioMuted?.(!!tab.isMuted);
      } catch {
        // ignore
      }
      return;
    }
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'fabinav:set-muted', muted: !!tab.isMuted },
      '*'
    );
  }, [isElectron, tab.isMuted, isNewTab, isSearchPage, isFabiInternal]);

  // Keep proxied iframe Notification.permission synced when user updates permissions
  useEffect(() => {
    if (isElectron || isNewTab || isSearchPage || isFabiInternal) return;
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: 'fabinav:notif-permission-sync',
        permission: resolveOriginNotifPerm(tab.url)
      },
      '*'
    );
  }, [
    isElectron,
    isNewTab,
    isSearchPage,
    isFabiInternal,
    tab.url,
    settings.notificationsEnabled,
    settings.notificationDefaultPolicy,
    settings.notificationPermissions
  ]);

  const activeLists = (
    shieldState.filterLists || ['core-trackers', 'cookie-notices', 'url-tracking']
  ).join(',');
  const activeCustomRules = (shieldState.customFilterRules || []).join(',');

  const isRelaxedRetry = relaxedRetryUrl === tab.url;

  const proxySrc =
    !isElectron && !isNewTab && !isSearchPage && !isFabiInternal
      ? `/api/proxy?url=${encodeURIComponent(tab.url)}&partition=${
          tab.tabMode === 'private' ? 'private' : 'normal'
        }&shields=${shieldState.enabled ? '1' : '0'}&blockTrackers=${
          shieldState.blockTrackersAndAds
        }&blockScripts=${shieldState.blockScripts ? '1' : '0'}&blockCookies=${
          shieldState.blockCrossSiteCookies ? '1' : '0'
        }&fingerprint=${shieldState.blockFingerprinting}&upgradeHttps=${
          shieldState.upgradeHttps ? '1' : '0'
        }&strictTls=${shieldState.strictTls ? '1' : '0'}${
          isRelaxedRetry ? '&relaxedTls=1&refresh=1' : ''
        }&lists=${encodeURIComponent(activeLists)}&customRules=${encodeURIComponent(
          activeCustomRules
        )}`
      : '';

  // Forward Find-in-Page, Reload, and Translate commands into active external frame
  useEffect(() => {
    if (!isPrimary || isNewTab || isSearchPage || isFabiInternal) return;

    const handleDispatchFind = (ev: Event) => {
      const customEv = ev as CustomEvent<{ tabId?: string; query?: string; backwards?: boolean }>;
      if (!customEv.detail || customEv.detail.tabId !== tab.id || !customEv.detail.query) return;
      if (isElectron) {
        try {
          webviewRef.current?.findInPage?.(customEv.detail.query, {
            forward: !customEv.detail.backwards
          });
        } catch {
          // ignore
        }
        return;
      }
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: 'fabinav:find',
          query: customEv.detail.query,
          backwards: !!customEv.detail.backwards
        },
        '*'
      );
    };

    const handleDispatchReload = (ev: Event) => {
      const customEv = ev as CustomEvent<{ tabId?: string }>;
      if (!customEv.detail || customEv.detail.tabId !== tab.id) return;
      if (isElectron) {
        try {
          webviewRef.current?.reload?.();
        } catch {
          // ignore
        }
        return;
      }
      if (iframeRef.current && proxySrc) {
        iframeRef.current.src = `${proxySrc}&refresh=1&t=${Date.now()}`;
      }
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
    window.addEventListener('fabinav:dispatch-reload', handleDispatchReload);
    window.addEventListener('fabinav:dispatch-translate', handleDispatchTranslate);
    return () => {
      window.removeEventListener('fabinav:dispatch-find', handleDispatchFind);
      window.removeEventListener('fabinav:dispatch-reload', handleDispatchReload);
      window.removeEventListener('fabinav:dispatch-translate', handleDispatchTranslate);
    };
  }, [
    isPrimary,
    isElectron,
    tab.id,
    proxySrc,
    isNewTab,
    isSearchPage,
    isFabiInternal,
    settings.translateTargetLang,
    settings.language
  ]);

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
        <div className="flex-1 flex flex-col overflow-hidden h-full">
          <FabiSearchView
            query={searchQuery}
            defaultEngine={settings.defaultSearchEngine}
            googleUser={googleUser}
            onNavigate={onNavigate}
          />
        </div>
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
          autofillEntries={autofillEntries}
          onAddAutofill={onAddAutofill}
          onRemoveAutofill={onRemoveAutofill}
          onSendTestNotification={onSendTestNotification}
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
      ) : isElectron ? (
        <div className="flex-1 w-full h-full relative bg-white flex flex-col">
          {webviewError && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--bn-surface)] p-6">
              <div className="max-w-md w-full rounded-2xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] p-6 text-center space-y-4 shadow-xl">
                <h2 className="text-sm font-semibold text-[var(--bn-text-strong)]">
                  No se pudo cargar este sitio
                </h2>
                <p className="text-xs font-mono text-[var(--bn-danger-text)] break-words">
                  {webviewError}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setWebviewError(null);
                    webviewRef.current?.reload?.();
                  }}
                  className="px-5 py-2 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white text-xs font-medium inline-flex items-center gap-2 transition-colors"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Reintentar</span>
                </button>
              </div>
            </div>
          )}
          {React.createElement('webview', {
            ref: webviewRef,
            key: tab.id,
            src: tab.url,
            partition: tab.tabMode === 'private' ? 'private' : 'persist:normal',
            allowpopups: 'true',
            className: 'w-full h-full border-none bg-white flex-1'
          })}
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
                    type: 'fabinav:notif-permission-sync',
                    permission: resolveOriginNotifPerm(tab.url)
                  },
                  '*'
                );
              }}
              className="w-full h-full border-none bg-white"
              sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals allow-presentation"
            />
          </div>
        </div>
      )}
    </div>
  );
};

