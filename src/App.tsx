import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  WebTab,
  ClosedTabRecord,
  Bookmark,
  DownloadItem,
  DevToolLog,
  DevToolNetworkReq,
  BrowserSettings,
  SidebarPanelView,
  CommandItem,
  FabiShieldState,
  FabiNewTabCustomization,
  LocalBackupMeta,
  HistoryEntry,
  TopSiteItem,
  GoogleUserProfile,
  AutofillEntry,
  PendingNotificationPermission,
  ShieldSessionEvent
} from './types';
import {
  INITIAL_TABS,
  INITIAL_BOOKMARKS,
  INITIAL_TOP_SITES,
  DEFAULT_SETTINGS,
  INITIAL_SHIELD_STATE,
  INITIAL_NEWTAB_CUSTOMIZATION,
  INITIAL_BACKUP_META,
  APP_VERSION
} from './constants/initialData';
import { initGoogleAuth, signInWithGoogle, signOutGoogle, setAuthLanguage } from './services/googleAuth';
import { ActivityBar } from './components/ActivityBar';
import { SidebarPanel } from './components/SidebarPanel';
import { TitleBar } from './components/TitleBar';
import { TabBar, TabFavicon } from './components/TabBar';
import { BookmarksBar } from './components/BookmarksBar';
import { WebViewport, PageSecurityReport } from './components/WebViewport';
import { CommandPalette } from './components/CommandPalette';
import { ElectronExportModal } from './components/ElectronExportModal';
import { FabiShieldModal } from './components/FabiShieldModal';
import { GoogleSyncModal } from './components/GoogleSyncModal';
import { QrCodeModal } from './components/QrCodeModal';
import { TaskManagerModal } from './components/TaskManagerModal';
import {
  NotificationPermissionPrompt,
  playNotificationChime
} from './components/NotificationCenter';
import {
  resolveEffectiveShield,
  applySiteShieldUpdate,
  resetSiteShieldOverride
} from './utils/shields';
import {
  Plus,
  X,
  Pin,
  VolumeX,
  Columns,
  Check,
  Compass,
  RotateCcw,
  Search,
  ChevronUp,
  ChevronDown,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const STORAGE_KEY_PREFIX = 'fabinav_v1_10_';
const LEGACY_STORAGE_PREFIXES = ['fabinav_v1_9_', 'fabinav_v1_8_', 'fabinav_v1_7_'];

function loadStored<T>(key: string, fallback: T): T {
  try {
    let raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${key}`);
    if (!raw) {
      for (const prefix of LEGACY_STORAGE_PREFIXES) {
        raw = localStorage.getItem(`${prefix}${key}`);
        if (raw) break;
      }
    }
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeLoadedSettings(raw: BrowserSettings): BrowserSettings {
  const themeMap: Record<string, BrowserSettings['theme']> = {
    'brave-dark': 'fabi-dark',
    'brave-midnight': 'fabi-midnight',
    'brave-light': 'fabi-light'
  };
  const nextTheme = themeMap[raw.theme] || raw.theme || DEFAULT_SETTINGS.theme;
  const nextEngine =
    (raw.defaultSearchEngine as string) === 'brave' ? 'fabinav' : raw.defaultSearchEngine;
  const nextLang =
    raw.language === 'en' || raw.language === 'ja' || raw.language === 'es'
      ? raw.language
      : DEFAULT_SETTINGS.language;
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    theme: nextTheme,
    language: nextLang,
    defaultSearchEngine: nextEngine || 'fabinav'
  };
}

export default function App() {
  // Google Auth State (obtained strictly from real Google OAuth / People API)
  const [googleUser, setGoogleUser] = useState<GoogleUserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Initial session hydration honoring startupMode ('newtab' | 'continue' | 'specific')
  const [initialSession] = useState(() => {
    const loadedSettings = normalizeLoadedSettings(loadStored('settings', DEFAULT_SETTINGS));
    const loadedBookmarks = loadStored<Bookmark[]>('bookmarks', INITIAL_BOOKMARKS);
    const now = Date.now();
    let startupTabs: WebTab[];

    if (loadedSettings.startupMode === 'newtab') {
      startupTabs = [
        {
          ...INITIAL_TABS[0],
          id: `tab-${now}`,
          createdAt: now,
          lastActiveAt: now,
          isDiscarded: false
        }
      ];
    } else if (loadedSettings.startupMode === 'specific') {
      const rawLines = (loadedSettings.startupUrls || '')
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const targets = rawLines.length > 0 ? rawLines : [loadedSettings.homepage || 'fabinav://newtab'];
      startupTabs = targets.map((raw, idx) => {
        const url =
          raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('fabinav://')
            ? raw
            : `https://${raw}`;
        const isInternal = url.startsWith('fabinav://');
        return {
          id: `tab-${now}-${idx}`,
          title: isInternal
            ? 'Nueva pestaña'
            : url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || url,
          url,
          displayUrl: url,
          isLoading: false,
          canGoBack: false,
          canGoForward: false,
          history: [url],
          historyIndex: 0,
          isPinned: false,
          isMuted: false,
          isBookmarked: loadedBookmarks.some((b) => b.url === url),
          createdAt: now,
          lastActiveAt: now,
          isDiscarded: false,
          tabMode: 'normal' as const
        };
      });
    } else {
      const stored = loadStored<WebTab[]>('tabs', INITIAL_TABS);
      startupTabs = (stored.length > 0 ? stored : INITIAL_TABS).map((tab) => ({
        ...tab,
        url: tab.url.startsWith('brave://') ? tab.url.replace(/^brave:\/\//, 'fabinav://') : tab.url,
        displayUrl: tab.displayUrl.startsWith('brave://')
          ? tab.displayUrl.replace(/^brave:\/\//, 'fabinav://')
          : tab.displayUrl,
        lastActiveAt: now,
        isDiscarded: false
      }));
    }

    return { loadedSettings, loadedBookmarks, startupTabs };
  });

  // Tabs & Navigation
  const [tabs, setTabs] = useState<WebTab[]>(initialSession.startupTabs);
  const [activeTabId, setActiveTabId] = useState<string>(
    initialSession.startupTabs[0]?.id || INITIAL_TABS[0].id
  );
  const [splitTabId, setSplitTabId] = useState<string | null>(null);
  const [closedTabs, setClosedTabs] = useState<ClosedTabRecord[]>([]);

  // Settings, Theme & Autofill
  const [settings, setSettings] = useState<BrowserSettings>(initialSession.loadedSettings);
  const [autofillEntries, setAutofillEntries] = useState<AutofillEntry[]>(() =>
    loadStored('autofill_entries', [])
  );
  const [shieldState, setShieldState] = useState<FabiShieldState>(() =>
    loadStored('shields', INITIAL_SHIELD_STATE)
  );
  const [newTabCustomization, setNewTabCustomization] = useState<FabiNewTabCustomization>(() =>
    loadStored('newtab', INITIAL_NEWTAB_CUSTOMIZATION)
  );
  const [topSites, setTopSites] = useState<TopSiteItem[]>(() =>
    loadStored('top_sites', INITIAL_TOP_SITES)
  );

  // Backup metadata, Bookmarks, History, Notes & Downloads (Real local state only)
  const [backupMeta, setBackupMeta] = useState<LocalBackupMeta>(() =>
    loadStored('backup_meta', INITIAL_BACKUP_META)
  );
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(initialSession.loadedBookmarks);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>(() =>
    loadStored('history', [])
  );
  const [downloads, setDownloads] = useState<DownloadItem[]>(() =>
    loadStored('downloads', [])
  );
  const [sessionNotes, setSessionNotes] = useState<string>(() =>
    loadStored('notes', '')
  );

  // DevTools Logs & Recorded Navigations
  const [devLogs, setDevLogs] = useState<DevToolLog[]>([
    {
      id: `log-init-${Date.now()}`,
      type: 'info',
      message: `FabiNav v${APP_VERSION} listo (TLS 1.2/1.3 + Cookies particionadas).`,
      source: 'Sistema',
      timestamp: new Date().toLocaleTimeString('es-ES', { hour12: false })
    }
  ]);
  const [networkReqs, setNetworkReqs] = useState<DevToolNetworkReq[]>([]);

  // Modals, Toast, Window Controls & Sidebar
  const [activeSidebarView, setActiveSidebarView] = useState<SidebarPanelView>(null);
  const [isSidebarAutoHovered, setIsSidebarAutoHovered] = useState(false);
  const [isSidebarIdleHidden, setIsSidebarIdleHidden] = useState(false);
  const [sidebarActivityTick, setSidebarActivityTick] = useState(0);
  const [isBookmarksZoneHovered, setIsBookmarksZoneHovered] = useState(false);
  const [isBookmarksBarIdleHidden, setIsBookmarksBarIdleHidden] = useState(false);
  const [bookmarksActivityTick, setBookmarksActivityTick] = useState(0);
  const [isShieldsModalOpen, setIsShieldsModalOpen] = useState(false);
  const [blockedUrlsByTab, setBlockedUrlsByTab] = useState<Record<string, string[]>>({});
  const blockedUrlsByTabRef = useRef<Record<string, string[]>>({});
  const [shieldSessionHistory, setShieldSessionHistory] = useState<ShieldSessionEvent[]>([]);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isElectronModalOpen, setIsElectronModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isTaskManagerOpen, setIsTaskManagerOpen] = useState(false);
  const [isFindBarOpen, setIsFindBarOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findMatchStatus, setFindMatchStatus] = useState<string | null>(null);
  const [customWindowTitle, setCustomWindowTitle] = useState<string>(() =>
    loadStored('window_title', '')
  );
  const [isRenameWindowOpen, setIsRenameWindowOpen] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [tabSearchSignal, setTabSearchSignal] = useState(0);
  const [windowMode, setWindowMode] = useState<'maximized' | 'restored' | 'minimized' | 'closed'>('maximized');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [permissionQueue, setPermissionQueue] = useState<PendingNotificationPermission[]>([]);
  const pendingNotifPermission = permissionQueue[0] || null;

  const omniboxRef = useRef<HTMLInputElement | null>(null);
  const findInputRef = useRef<HTMLInputElement | null>(null);
  const reportedPageKeysRef = useRef<Set<string>>(new Set());
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMsg(null);
    }, 2400);
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const splitTab = splitTabId ? tabs.find((t) => t.id === splitTabId) : null;

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  // Listen to Firebase/Google Auth state
  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (profile) => {
        setGoogleUser(profile);
        setAuthError(null);
      },
      () => {
        setGoogleUser(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleNewTabRef = useRef<(url?: string, mode?: 'normal' | 'private') => void>(() => {});

  // Listen to native Electron window state & auto-updater events (if running in desktop app)
  useEffect(() => {
    const bridge = window.fabinavDesktop;
    if (!bridge?.isElectron) return;

    const unsubWin = bridge.onWindowState?.((st) => {
      setWindowMode(st.isMaximized ? 'maximized' : 'restored');
    });

    const unsubUpd = bridge.onUpdateStatus?.((status) => {
      if (status.state === 'downloaded') {
        showToast(
          status.version
            ? `FabiNav v${status.version} listo. Se instalará al cerrar.`
            : 'Actualización lista para instalar al cerrar.'
        );
      }
    });

    const unsubOpenTab = bridge.onOpenUrlInTab?.((targetUrl) => {
      if (targetUrl) {
        handleNewTabRef.current(targetUrl);
      }
    });

    const unsubNotifPerm = bridge.onNotificationPermissionRequest?.((req) => {
      let origin = req.origin || req.url || '';
      try {
        origin = new URL(origin).origin;
      } catch {
        // keep raw
      }
      const cur = settingsRef.current;
      const sitePerm = cur.notificationPermissions?.[origin] || 'default';

      if (cur.notificationsEnabled === false || sitePerm === 'block') {
        bridge.respondNotificationPermission?.(req.requestId, false);
        return;
      }
      if (sitePerm === 'allow') {
        bridge.respondNotificationPermission?.(req.requestId, true);
        return;
      }
      if (cur.notificationDefaultPolicy === 'block') {
        bridge.respondNotificationPermission?.(req.requestId, false);
        return;
      }

      const matchedTab =
        tabsRef.current.find((t) => origin && t.url.startsWith(origin)) || activeTabRef.current;

      setPermissionQueue((prev) => {
        if (prev.some((p) => p.source === 'webview' && p.origin === origin)) {
          return prev;
        }
        return [
          ...prev,
          {
            id: req.requestId,
            tabId: matchedTab?.id || '',
            origin,
            url: req.url,
            source: 'webview',
            requestId: req.requestId
          }
        ];
      });
    });

    const unsubNotifClick = bridge.onNotificationClicked?.((payload) => {
      if (payload.tabId && tabsRef.current.some((t) => t.id === payload.tabId)) {
        setActiveTabId(payload.tabId);
        return;
      }
      if (payload.url && (payload.url.startsWith('http://') || payload.url.startsWith('https://'))) {
        handleNewTabRef.current(payload.url);
      }
    });

    const unsubShieldBlocked = bridge.onShieldBlocked?.((ev) => {
      if (!ev || !ev.blockedUrl) return;
      let origin = ev.pageOrigin || '';
      try {
        origin = new URL(origin).origin;
      } catch {
        // keep raw
      }
      const matchedTab =
        tabsRef.current.find((t) => origin && t.url.startsWith(origin)) || activeTabRef.current;
      if (!matchedTab) return;

      const existing = blockedUrlsByTabRef.current[matchedTab.id] || [];
      if (existing.includes(ev.blockedUrl) || existing.length >= 60) {
        return;
      }
      const nextUrls = [...existing, ev.blockedUrl];
      blockedUrlsByTabRef.current = {
        ...blockedUrlsByTabRef.current,
        [matchedTab.id]: nextUrls
      };
      setBlockedUrlsByTab(blockedUrlsByTabRef.current);
      setShieldState((prev) => ({
        ...prev,
        trackersBlockedCount: prev.trackersBlockedCount + 1
      }));

      const targetRaw = ev.pageOrigin || matchedTab.url || '';
      let domain = 'web';
      try {
        domain = new URL(targetRaw).hostname.replace(/^www\./, '') || 'web';
      } catch {
        domain = targetRaw.replace(/^https?:\/\//, '').split('/')[0] || 'web';
      }
      const now = Date.now();
      const timeLabel = new Date(now).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      setShieldSessionHistory((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.domain === domain && now - last.timestamp < 15000) {
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              timestamp: now,
              timeLabel,
              trackers: last.trackers + 1
            }
          ];
        }
        return [
          ...prev.slice(-23),
          {
            id: `sh-${now}-${Math.random().toString(36).slice(2, 6)}`,
            domain,
            timestamp: now,
            timeLabel,
            trackers: 1,
            cookies: 0,
            httpsUpgrades: 0
          }
        ];
      });
    });

    return () => {
      unsubWin?.();
      unsubUpd?.();
      unsubOpenTab?.();
      unsubNotifPerm?.();
      unsubNotifClick?.();
      unsubShieldBlocked?.();
    };
  }, [showToast]);

  // Keep Electron main process webRequest Shields synchronized with renderer state
  useEffect(() => {
    window.fabinavDesktop?.syncShields?.(shieldState);
  }, [shieldState]);

  const handleMinimizeBrowserWindow = useCallback(() => {
    if (window.fabinavDesktop?.isElectron) {
      window.fabinavDesktop.minimizeWindow();
      return;
    }
    setWindowMode('minimized');
  }, []);

  const handleToggleMaximizeBrowserWindow = useCallback(() => {
    if (window.fabinavDesktop?.isElectron) {
      window.fabinavDesktop.toggleMaximizeWindow();
      return;
    }
    setWindowMode((prev) => (prev === 'maximized' ? 'restored' : 'maximized'));
  }, []);

  const handleCloseBrowserWindow = useCallback(() => {
    if (window.fabinavDesktop?.isElectron) {
      window.fabinavDesktop.closeWindow();
      return;
    }
    setWindowMode('closed');
  }, []);

  const handleGoogleSignIn = async () => {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      const profile = await signInWithGoogle();
      setGoogleUser(profile);
      appendLog('info', `Sesión de Google conectada: ${profile.email || profile.displayName}`, 'Google');
      showToast(`Conectado como ${profile.displayName}`);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo completar el inicio de sesión con Google';
      setAuthError(msg);
      appendLog('error', msg, 'Google');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await signOutGoogle();
      setGoogleUser(null);
      appendLog('info', 'Sesión de Google desconectada', 'Google');
      showToast('Sesión de Google desconectada');
    } catch {
      // Ignore sign out errors
    }
  };

  // Sync HTML lang attribute, spellcheck, reduceMotion & Firebase Auth language
  useEffect(() => {
    const lang = settings.language || 'es';
    document.documentElement.lang = lang;
    setAuthLanguage(lang);
  }, [settings.language]);

  useEffect(() => {
    document.documentElement.spellcheck = settings.spellCheck !== false;
    document.documentElement.classList.toggle('fabi-reduce-motion', !!settings.reduceMotion);
  }, [settings.spellCheck, settings.reduceMotion]);

  // Persist workspace state to localStorage (never persisting OAuth tokens)
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}tabs`, JSON.stringify(tabs));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}bookmarks`, JSON.stringify(bookmarks));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}history`, JSON.stringify(historyEntries.slice(0, 100)));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}downloads`, JSON.stringify(downloads.slice(0, 50)));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}settings`, JSON.stringify(settings));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}autofill_entries`, JSON.stringify(autofillEntries));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}shields`, JSON.stringify(shieldState));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}newtab`, JSON.stringify(newTabCustomization));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}top_sites`, JSON.stringify(topSites));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}backup_meta`, JSON.stringify(backupMeta));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}notes`, JSON.stringify(sessionNotes));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}window_title`, JSON.stringify(customWindowTitle));
    } catch {
      // Ignore quota errors
    }
  }, [
    tabs,
    bookmarks,
    historyEntries,
    downloads,
    settings,
    autofillEntries,
    shieldState,
    newTabCustomization,
    topSites,
    backupMeta,
    sessionNotes,
    customWindowTitle
  ]);

  // Apply FabiNav theme class & document title
  useEffect(() => {
    document.body.className = `theme-${settings.theme}`;
    if (settings.theme === 'fabi-light' || (settings.theme as string) === 'brave-light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  }, [settings.theme]);

  useEffect(() => {
    document.title = customWindowTitle.trim()
      ? `${customWindowTitle.trim()} — FabiNav`
      : 'FabiNav — Navegador de Privacidad y Velocidad';
  }, [customWindowTitle]);

  // Sync browser Fullscreen state
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Capture real browser runtime errors into DevTools Console
  useEffect(() => {
    const onRuntimeError = (ev: ErrorEvent) => {
      appendLog('error', ev.message || 'Error en tiempo de ejecución', 'Window');
    };
    window.addEventListener('error', onRuntimeError);
    return () => window.removeEventListener('error', onRuntimeError);
  }, []);

  const appendLog = (type: DevToolLog['type'], message: string, source: string) => {
    setDevLogs((prev) => [
      {
        id: `log-${Date.now()}-${prev.length}`,
        type,
        message,
        source,
        timestamp: new Date().toLocaleTimeString('es-ES', { hour12: false })
      },
      ...prev.slice(0, 59)
    ]);
  };

  const resolveInternalTitle = (targetUrl: string): string => {
    const baseUrl = targetUrl.split('#')[0];
    if (baseUrl === 'fabinav://newtab') return 'Nueva pestaña';
    if (baseUrl === 'fabinav://bookmarks') return 'Marcadores';
    if (baseUrl === 'fabinav://history') return 'Historial';
    if (baseUrl === 'fabinav://downloads') return 'Descargas';
    if (baseUrl === 'fabinav://shields') return 'Escudos, Cookies y TLS';
    if (baseUrl === 'fabinav://settings') return 'Configuración';
    if (baseUrl === 'fabinav://about') return 'Acerca de FabiNav';
    if (baseUrl.startsWith('fabinav://search?q=')) {
      const q = decodeURIComponent(baseUrl.replace('fabinav://search?q=', ''));
      return `Buscar: ${q}`;
    }
    try {
      const urlObj = new URL(targetUrl);
      return urlObj.hostname.replace(/^www\./, '');
    } catch {
      return targetUrl;
    }
  };

  const normalizeTargetUrl = (rawInput: string): { url: string; upgradedHttps: boolean } => {
    let target = rawInput.trim();
    let upgradedHttps = false;

    if (target.startsWith('fabinav://') === false && target.includes('://')) {
      const colonIdx = target.indexOf('://');
      const scheme = target.slice(0, colonIdx).toLowerCase();
      if (scheme !== 'http' && scheme !== 'https') {
        target = `fabinav://${target.slice(colonIdx + 3)}`;
      }
    }

    if (
      !target.startsWith('http://') &&
      !target.startsWith('https://') &&
      !target.startsWith('fabinav://')
    ) {
      const isLocalHostTarget = /^localhost(:\d+)?(\/.*)?$/i.test(target);
      if ((target.includes('.') || isLocalHostTarget) && !target.includes(' ')) {
        const eff = resolveEffectiveShield(shieldState, `https://${target}`).effective;
        const useHttps = !isLocalHostTarget && eff.upgradeHttps && eff.enabled;
        target = `${useHttps ? 'https' : 'http'}://${target}`;
        if (useHttps) upgradedHttps = true;
      } else {
        target = `fabinav://search?q=${encodeURIComponent(target)}`;
      }
    } else if (target.startsWith('http://')) {
      const eff = resolveEffectiveShield(shieldState, target).effective;
      if (eff.upgradeHttps && eff.enabled) {
        target = target.replace('http://', 'https://');
        upgradedHttps = true;
      }
    }

    return { url: target, upgradedHttps };
  };

  const recordNavigationTelemetry = (finalUrl: string, upgradedHttps: boolean) => {
    const isInternal = finalUrl.startsWith('fabinav://');
    const isSearch = finalUrl.startsWith('fabinav://search?q=');

    setNetworkReqs((prev) => [
      {
        id: `req-${Date.now()}-${prev.length}`,
        url: finalUrl,
        method: 'GET',
        status: 200,
        type: isSearch ? 'search' : isInternal ? 'internal' : 'document',
        timestamp: new Date().toLocaleTimeString('es-ES', { hour12: false })
      },
      ...prev.slice(0, 39)
    ]);

    if (upgradedHttps || isSearch) {
      setShieldState((prev) => ({
        ...prev,
        httpsUpgradesCount: prev.httpsUpgradesCount + (upgradedHttps ? 1 : 0),
        searchesCount: prev.searchesCount + (isSearch ? 1 : 0)
      }));
      if (upgradedHttps) {
        appendLog('info', `Conexión mejorada a HTTPS/TLS: ${finalUrl}`, 'Escudos');
        let domain = 'web';
        try {
          domain = new URL(finalUrl).hostname.replace(/^www\./, '') || 'web';
        } catch {
          domain = finalUrl.replace(/^https?:\/\//, '').split('/')[0] || 'web';
        }
        const now = Date.now();
        const timeLabel = new Date(now).toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
        setShieldSessionHistory((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.domain === domain && now - last.timestamp < 15000) {
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                timestamp: now,
                timeLabel,
                httpsUpgrades: last.httpsUpgrades + 1
              }
            ];
          }
          return [
            ...prev.slice(-23),
            {
              id: `sh-${now}-${Math.random().toString(36).slice(2, 6)}`,
              domain,
              timestamp: now,
              timeLabel,
              trackers: 0,
              cookies: 0,
              httpsUpgrades: 1
            }
          ];
        });
      }
    }
  };

  const handlePageSecurityReport = useCallback((tabId: string, report: PageSecurityReport) => {
    if (report.title || report.favicon) {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? {
                ...t,
                title: report.title || t.title,
                favicon: report.favicon || t.favicon,
                isLoading: report.title ? false : t.isLoading
              }
            : t
        )
      );
    }

    if (Array.isArray(report.blockedTrackerUrls)) {
      const nextList = report.blockedTrackerUrls;
      blockedUrlsByTabRef.current = {
        ...blockedUrlsByTabRef.current,
        [tabId]: nextList
      };
      setBlockedUrlsByTab(blockedUrlsByTabRef.current);
    }

    const dedupeKey = `${tabId}:${report.url || ''}`;
    if (reportedPageKeysRef.current.has(dedupeKey)) return;
    reportedPageKeysRef.current.add(dedupeKey);
    if (reportedPageKeysRef.current.size > 120) {
      reportedPageKeysRef.current.clear();
    }

    const trackers = report.blockedTrackers || 0;
    const cookies = report.blockedCookies || 0;
    const httpsUp = report.upgradedHttps ? 1 : 0;

    if (trackers > 0 || cookies > 0 || httpsUp > 0) {
      setShieldState((prev) => ({
        ...prev,
        trackersBlockedCount: prev.trackersBlockedCount + trackers,
        cookiesBlockedCount: prev.cookiesBlockedCount + cookies,
        httpsUpgradesCount: prev.httpsUpgradesCount + httpsUp
      }));
      let domain = 'web';
      const rawSite = report.url || '';
      try {
        domain = new URL(rawSite).hostname.replace(/^www\./, '') || 'web';
      } catch {
        domain = rawSite.replace(/^https?:\/\//, '').split('/')[0] || 'web';
      }
      const now = Date.now();
      const timeLabel = new Date(now).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      setShieldSessionHistory((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.domain === domain && now - last.timestamp < 15000) {
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              timestamp: now,
              timeLabel,
              trackers: last.trackers + trackers,
              cookies: last.cookies + cookies,
              httpsUpgrades: last.httpsUpgrades + httpsUp
            }
          ];
        }
        return [
          ...prev.slice(-23),
          {
            id: `sh-${now}-${Math.random().toString(36).slice(2, 6)}`,
            domain,
            timestamp: now,
            timeLabel,
            trackers,
            cookies,
            httpsUpgrades: httpsUp
          }
        ];
      });
      appendLog(
        'info',
        `Escudos en ${report.url || 'página'}: ${trackers} rastreadores y ${cookies} cookies bloqueadas.`,
        'Escudos'
      );
    }
  }, []);

  const handleSelectTab = (tabId: string) => {
    const now = Date.now();
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === tabId) return { ...t, lastActiveAt: now, isDiscarded: false };
        if (t.id === activeTabId) return { ...t, lastActiveAt: now };
        return t;
      })
    );
    setActiveTabId(tabId);
    setIsShieldsModalOpen(false);
  };

  const handleWakeTab = (tabId: string) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tabId ? { ...t, isDiscarded: false, lastActiveAt: Date.now() } : t
      )
    );
  };

  const handleNewTab = (
    url: string = 'fabinav://newtab',
    mode: 'normal' | 'private' = 'normal',
    afterTabId?: string
  ) => {
    const { url: finalUrl, upgradedHttps } = normalizeTargetUrl(url);
    const newId = `tab-${Date.now()}`;
    const isInternal = finalUrl.startsWith('fabinav://');
    const displayTitle = resolveInternalTitle(finalUrl);

    const newTab: WebTab = {
      id: newId,
      title: displayTitle,
      url: finalUrl,
      displayUrl: finalUrl,
      isLoading: !isInternal,
      canGoBack: false,
      canGoForward: false,
      history: [finalUrl],
      historyIndex: 0,
      isPinned: false,
      isMuted: false,
      isBookmarked: bookmarks.some((b) => b.url === finalUrl),
      tabMode: mode,
      createdAt: Date.now()
    };

    setTabs((prev) => {
      if (!afterTabId) return [...prev, newTab];
      const idx = prev.findIndex((t) => t.id === afterTabId);
      if (idx === -1) return [...prev, newTab];
      return [...prev.slice(0, idx + 1), newTab, ...prev.slice(idx + 1)];
    });
    setActiveTabId(newId);

    if (!isInternal && mode !== 'private') {
      const now = new Date();
      setHistoryEntries((prev) => [
        {
          id: `h-${Date.now()}`,
          title: displayTitle,
          url: finalUrl,
          timestamp: now.getTime(),
          timeFormatted: now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
        },
        ...prev
      ]);
    }

    recordNavigationTelemetry(finalUrl, upgradedHttps);

    if (!isInternal) {
      setTimeout(() => {
        setTabs((prev) => prev.map((t) => (t.id === newId ? { ...t, isLoading: false } : t)));
      }, 650);
    }

    return newId;
  };
  handleNewTabRef.current = handleNewTab;

  const extractHost = (rawUrl: string): string | null => {
    if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) return null;
    try {
      return new URL(rawUrl).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return null;
    }
  };

  // Memory Saver auto-discard timer for inactive external tabs
  useEffect(() => {
    if (!settings.memorySaver) return;
    const mode = settings.memorySaverMode || 'balanced';
    const thresholdMs = mode === 'maximum' ? 45_000 : mode === 'moderate' ? 300_000 : 120_000;
    const alwaysDomains = (settings.alwaysActiveDomains || []).map((d) => d.toLowerCase());

    const timer = window.setInterval(() => {
      const now = Date.now();
      setTabs((prev) => {
        let changed = false;
        const next = prev.map((t) => {
          if (
            t.id === activeTabId ||
            t.id === splitTabId ||
            t.isPinned ||
            t.isDiscarded ||
            t.url.startsWith('fabinav://')
          ) {
            return t;
          }
          const host = extractHost(t.url);
          if (host && alwaysDomains.some((d) => host === d || host.endsWith(`.${d}`))) {
            return t;
          }
          const lastActive = t.lastActiveAt || t.createdAt;
          if (now - lastActive >= thresholdMs) {
            changed = true;
            return { ...t, isDiscarded: true };
          }
          return t;
        });
        return changed ? next : prev;
      });
    }, 15_000);

    return () => window.clearInterval(timer);
  }, [
    settings.memorySaver,
    settings.memorySaverMode,
    settings.alwaysActiveDomains,
    activeTabId,
    splitTabId
  ]);

  const autoHideDelayMs = (settings.barsAutoHideDelaySec || 15) * 1000;

  // Auto-hide Bookmarks Bar after inactivity
  useEffect(() => {
    if (!settings.showBookmarksBar || !settings.autoHideBookmarksBar) {
      setIsBookmarksBarIdleHidden(false);
      return;
    }
    if (isBookmarksZoneHovered) {
      setIsBookmarksBarIdleHidden(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setIsBookmarksBarIdleHidden(true);
    }, autoHideDelayMs);
    return () => window.clearTimeout(timer);
  }, [
    settings.showBookmarksBar,
    settings.autoHideBookmarksBar,
    isBookmarksZoneHovered,
    bookmarksActivityTick,
    autoHideDelayMs
  ]);

  // Auto-hide Sidebar after inactivity
  useEffect(() => {
    const mode = settings.sidebarMode || (settings.showSidebar ? 'on' : 'off');
    if (mode === 'off' || !settings.autoHideSidebarIdle) {
      setIsSidebarIdleHidden(false);
      return;
    }
    if (isSidebarAutoHovered || activeSidebarView !== null) {
      setIsSidebarIdleHidden(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setIsSidebarIdleHidden(true);
    }, autoHideDelayMs);
    return () => window.clearTimeout(timer);
  }, [
    settings.sidebarMode,
    settings.showSidebar,
    settings.autoHideSidebarIdle,
    isSidebarAutoHovered,
    activeSidebarView,
    sidebarActivityTick,
    autoHideDelayMs
  ]);

  const forgetDomainsIfClosed = (closedList: WebTab[], remainingTabs: WebTab[]) => {
    const forgetSet = new Set(
      (shieldState.forgetOnCloseDomains || []).map((d) => d.toLowerCase())
    );
    if (forgetSet.size === 0) return;

    const remainingHosts = new Set(
      remainingTabs.map((t) => extractHost(t.url)).filter((h): h is string => !!h)
    );
    const hostsToForget = Array.from(
      new Set(
        closedList
          .map((t) => extractHost(t.url))
          .filter((h): h is string => !!h && forgetSet.has(h) && !remainingHosts.has(h))
      )
    );

    if (hostsToForget.length === 0) return;

    for (const host of hostsToForget) {
      fetch(`/api/cookies?partition=normal&domain=${encodeURIComponent(host)}`, {
        method: 'DELETE'
      }).catch(() => {});
    }
    setHistoryEntries((prev) =>
      prev.filter((entry) => {
        const h = extractHost(entry.url);
        return !h || !hostsToForget.includes(h);
      })
    );
  };

  const handleCloseTab = (tabId: string) => {
    const target = tabs.find((t) => t.id === tabId);

    // Si es la última pestaña abierta, cerramos el navegador completo (y preparamos nueva pestaña limpia por si se reabre)
    if (tabs.length <= 1) {
      if (target) forgetDomainsIfClosed([target], []);
      if (target?.tabMode === 'private') {
        fetch('/api/cookies?partition=private', { method: 'DELETE' }).catch(() => {});
      }
      const freshId = `tab-${Date.now()}`;
      setSplitTabId(null);
      setTabs([
        {
          ...INITIAL_TABS[0],
          id: freshId,
          createdAt: Date.now()
        }
      ]);
      setActiveTabId(freshId);
      handleCloseBrowserWindow();
      return;
    }

    if (target && target.tabMode !== 'private') {
      setClosedTabs((prev) => [
        {
          id: `closed-${Date.now()}`,
          title: target.title,
          url: target.url,
          closedAt: Date.now(),
          tabMode: target.tabMode
        },
        ...prev.slice(0, 14)
      ]);
    }

    if (splitTabId === tabId) {
      setSplitTabId(null);
    }

    const tabIndex = tabs.findIndex((t) => t.id === tabId);
    const newTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(newTabs);
    setBlockedUrlsByTab((prev) => {
      if (!(tabId in prev)) return prev;
      const copy = { ...prev };
      delete copy[tabId];
      return copy;
    });
    if (target) forgetDomainsIfClosed([target], newTabs);

    // Si se cierra la última pestaña privada, limpiar partición privada de cookies
    if (target?.tabMode === 'private' && !newTabs.some((t) => t.tabMode === 'private')) {
      fetch('/api/cookies?partition=private', { method: 'DELETE' }).catch(() => {});
    }

    if (activeTabId === tabId) {
      const nextIndex = Math.max(0, tabIndex - 1);
      setActiveTabId(newTabs[nextIndex].id);
    }
  };

  const handleCloseOtherTabs = (keepTabId: string) => {
    const kept = tabs.filter((t) => t.id === keepTabId || t.isPinned);
    if (kept.length === tabs.length) return;
    const closed = tabs.filter((t) => t.id !== keepTabId && !t.isPinned);
    if (splitTabId && !kept.some((t) => t.id === splitTabId)) {
      setSplitTabId(null);
    }
    setTabs(kept);
    setActiveTabId(keepTabId);
    forgetDomainsIfClosed(closed, kept);
    if (!kept.some((t) => t.tabMode === 'private')) {
      fetch('/api/cookies?partition=private', { method: 'DELETE' }).catch(() => {});
    }
    showToast('Otras pestañas cerradas');
  };

  const handleCloseTabsToRight = (tabId: string) => {
    const idx = tabs.findIndex((t) => t.id === tabId);
    if (idx === -1 || idx >= tabs.length - 1) return;
    const kept = tabs.filter((t, i) => i <= idx || t.isPinned);
    if (kept.length === tabs.length) return;
    const closed = tabs.filter((t, i) => i > idx && !t.isPinned);
    if (splitTabId && !kept.some((t) => t.id === splitTabId)) {
      setSplitTabId(null);
    }
    if (!kept.some((t) => t.id === activeTabId)) {
      setActiveTabId(tabId);
    }
    setTabs(kept);
    forgetDomainsIfClosed(closed, kept);
    if (!kept.some((t) => t.tabMode === 'private')) {
      fetch('/api/cookies?partition=private', { method: 'DELETE' }).catch(() => {});
    }
    showToast('Pestañas a la derecha cerradas');
  };

  const handleDuplicateTab = (tabId: string) => {
    const target = tabs.find((t) => t.id === tabId);
    if (!target) return;
    handleNewTab(target.url, target.tabMode || 'normal');
    showToast('Pestaña duplicada');
  };

  const handleReopenClosedTab = (recordId?: string) => {
    if (closedTabs.length === 0) return;
    const target = recordId ? closedTabs.find((c) => c.id === recordId) : closedTabs[0];
    if (!target) return;
    setClosedTabs((prev) => prev.filter((c) => c.id !== target.id));
    handleNewTab(target.url, target.tabMode || 'normal');
  };

  const handleNavigate = (tabId: string, rawUrl: string) => {
    const { url: finalUrl, upgradedHttps } = normalizeTargetUrl(rawUrl);
    const parsedTitle = resolveInternalTitle(finalUrl);
    const isInternal = finalUrl.startsWith('fabinav://');
    const currentTab = tabs.find((t) => t.id === tabId);

    reportedPageKeysRef.current.delete(`${tabId}:${finalUrl}`);
    setBlockedUrlsByTab((prev) => {
      if (!(tabId in prev)) return prev;
      const copy = { ...prev };
      delete copy[tabId];
      return copy;
    });

    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === tabId) {
          const newHistory = [...t.history.slice(0, t.historyIndex + 1), finalUrl];
          return {
            ...t,
            url: finalUrl,
            displayUrl: finalUrl,
            title: parsedTitle,
            favicon: undefined,
            isLoading: !isInternal,
            isBookmarked: bookmarks.some((b) => b.url === finalUrl),
            history: newHistory,
            historyIndex: newHistory.length - 1,
            canGoBack: newHistory.length > 1,
            canGoForward: false
          };
        }
        return t;
      })
    );

    if (!isInternal && currentTab?.tabMode !== 'private') {
      const now = new Date();
      setHistoryEntries((prev) => [
        {
          id: `h-${Date.now()}`,
          title: parsedTitle,
          url: finalUrl,
          timestamp: now.getTime(),
          timeFormatted: now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
        },
        ...prev
      ]);
    }

    recordNavigationTelemetry(finalUrl, upgradedHttps);

    if (!isInternal) {
      setTimeout(() => {
        setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, isLoading: false } : t)));
      }, 650);
    }
  };

  const handleGoBack = () => {
    if (!activeTab || !activeTab.canGoBack || activeTab.historyIndex <= 0) return;
    const newIndex = activeTab.historyIndex - 1;
    const prevUrl = activeTab.history[newIndex];

    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id
          ? {
              ...t,
              url: prevUrl,
              displayUrl: prevUrl,
              title: resolveInternalTitle(prevUrl),
              favicon: undefined,
              isBookmarked: bookmarks.some((b) => b.url === prevUrl),
              historyIndex: newIndex,
              canGoBack: newIndex > 0,
              canGoForward: true
            }
          : t
      )
    );
  };

  const handleGoForward = () => {
    if (!activeTab || !activeTab.canGoForward || activeTab.historyIndex >= activeTab.history.length - 1) {
      return;
    }
    const newIndex = activeTab.historyIndex + 1;
    const nextUrl = activeTab.history[newIndex];

    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id
          ? {
              ...t,
              url: nextUrl,
              displayUrl: nextUrl,
              title: resolveInternalTitle(nextUrl),
              favicon: undefined,
              isBookmarked: bookmarks.some((b) => b.url === nextUrl),
              historyIndex: newIndex,
              canGoBack: true,
              canGoForward: newIndex < t.history.length - 1
            }
          : t
      )
    );
  };

  const handleReloadTab = (tabId: string) => {
    const target = tabs.find((t) => t.id === tabId);
    if (!target) return;
    reportedPageKeysRef.current.delete(`${target.id}:${target.url}`);
    window.dispatchEvent(new CustomEvent('fabinav:dispatch-reload', { detail: { tabId } }));
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, isLoading: true } : t)));
    setTimeout(() => {
      setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, isLoading: false } : t)));
    }, 450);
  };

  const handleReload = () => {
    if (!activeTab) return;
    handleReloadTab(activeTab.id);
  };

  const handleGoHome = () => {
    if (!activeTab) return;
    handleNavigate(activeTab.id, settings.homepage || 'fabinav://newtab');
  };

  const handleTogglePinTab = (tabId: string) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, isPinned: !t.isPinned } : t)));
  };

  const handleToggleMuteTab = (tabId: string) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, isMuted: !t.isMuted } : t)));
  };

  const handleToggleSplitTab = (tabId: string) => {
    if (splitTabId === tabId) {
      setSplitTabId(null);
    } else if (tabId !== activeTabId) {
      setSplitTabId(tabId);
    } else {
      const candidate = tabs.find((t) => t.id !== activeTabId);
      if (candidate) {
        setSplitTabId(candidate.id);
      } else {
        const rightTabId = handleNewTab('fabinav://newtab', activeTab?.tabMode || 'normal', tabId);
        setActiveTabId(tabId);
        setSplitTabId(rightTabId);
      }
    }
  };

  const handleToggleBookmark = () => {
    if (!activeTab) return;
    const existing = bookmarks.find((b) => b.url === activeTab.url);
    if (existing) {
      setBookmarks((prev) => prev.filter((b) => b.id !== existing.id));
      setTabs((prev) => prev.map((t) => (t.id === activeTab.id ? { ...t, isBookmarked: false } : t)));
      showToast('Eliminado de marcadores');
    } else {
      const newBm: Bookmark = {
        id: `bm-${Date.now()}`,
        title: activeTab.title,
        url: activeTab.url,
        folder: 'Barra de marcadores',
        createdAt: Date.now()
      };
      setBookmarks((prev) => [...prev, newBm]);
      setTabs((prev) => prev.map((t) => (t.id === activeTab.id ? { ...t, isBookmarked: true } : t)));
      showToast('Guardado en marcadores');
    }
  };

  const handleAddBookmark = (title: string, url: string, folder = 'Barra de marcadores') => {
    const { url: finalUrl } = normalizeTargetUrl(url);
    const newBm: Bookmark = {
      id: `bm-${Date.now()}`,
      title,
      url: finalUrl,
      folder,
      createdAt: Date.now()
    };
    setBookmarks((prev) => [...prev, newBm]);
  };

  const handleRemoveBookmark = (id: string) => {
    const removed = bookmarks.find((b) => b.id === id);
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
    if (removed) {
      setTabs((prev) => prev.map((t) => (t.url === removed.url ? { ...t, isBookmarked: false } : t)));
    }
  };

  const handleAddTopSite = (title: string, url: string) => {
    const { url: finalUrl } = normalizeTargetUrl(url);
    setTopSites((prev) => [
      ...prev,
      { id: `ts-${Date.now()}`, title, url: finalUrl }
    ]);
  };

  const handleRemoveTopSite = (id: string) => {
    setTopSites((prev) => prev.filter((site) => site.id !== id));
  };

  const handleRecordDownload = (filename: string, fileSize: string, url: string) => {
    setDownloads((prev) => [
      {
        id: `dl-${Date.now()}`,
        filename,
        fileSize,
        status: 'completed',
        url,
        timestamp: Date.now()
      },
      ...prev
    ]);
  };

  const handleExportBackup = () => {
    const now = Date.now();
    const payload = {
      version: APP_VERSION,
      exportedAt: new Date(now).toISOString(),
      settings,
      shieldState,
      newTabCustomization,
      topSites,
      bookmarks,
      historyEntries,
      sessionNotes
    };
    const jsonString = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const filename = `fabinav-respaldo-${new Date(now).toISOString().slice(0, 10)}.json`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    setBackupMeta({ lastExportTimestamp: now });
    handleRecordDownload(filename, `${(jsonString.length / 1024).toFixed(1)} KB`, 'fabinav://backup');
    appendLog('info', `Respaldo local exportado: ${filename}`, 'Respaldo');
  };

  const handleImportBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || '{}'));
        if (data.settings) setSettings((prev) => ({ ...prev, ...data.settings }));
        if (data.shieldState) setShieldState((prev) => ({ ...prev, ...data.shieldState }));
        if (data.newTabCustomization) setNewTabCustomization((prev) => ({ ...prev, ...data.newTabCustomization }));
        if (Array.isArray(data.topSites)) setTopSites(data.topSites);
        if (Array.isArray(data.bookmarks)) setBookmarks(data.bookmarks);
        if (Array.isArray(data.historyEntries)) setHistoryEntries(data.historyEntries);
        if (typeof data.sessionNotes === 'string') setSessionNotes(data.sessionNotes);
        appendLog('info', `Respaldo importado desde ${file.name}`, 'Respaldo');
      } catch {
        appendLog('error', `No se pudo leer el archivo JSON "${file.name}".`, 'Respaldo');
      }
    };
    reader.readAsText(file);
  };

  const handleUpdateSettings = (newSettings: Partial<BrowserSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const handleResetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    setShieldState((prev) => ({
      ...INITIAL_SHIELD_STATE,
      httpsUpgradesCount: prev.httpsUpgradesCount,
      trackersBlockedCount: prev.trackersBlockedCount,
      cookiesBlockedCount: prev.cookiesBlockedCount,
      searchesCount: prev.searchesCount
    }));
    appendLog('info', 'Configuración y escudos restablecidos a valores predeterminados.', 'Ajustes');
    showToast('Configuración restablecida');
  };

  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      setWindowMode((prev) => (prev === 'maximized' ? 'restored' : 'maximized'));
    }
  };

  const handleClearBrowsingData = async () => {
    setHistoryEntries([]);
    setClosedTabs([]);
    try {
      await Promise.all([
        fetch('/api/cookies?partition=normal', { method: 'DELETE' }),
        fetch('/api/cookies?partition=private', { method: 'DELETE' }),
        fetch('/api/cache', { method: 'DELETE' })
      ]);
      if ('caches' in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((k) => window.caches.delete(k)));
      }
    } catch {
      // Ignore offline errors
    }
    appendLog('info', 'Historial, caché y cookies eliminados por el usuario.', 'Privacidad');
    showToast('Historial, caché y cookies borrados');
  };

  const handleNewWindow = () => {
    setWindowMode('maximized');
    handleNewTab('fabinav://newtab');
    showToast('Nueva sesión lista en FabiNav');
  };

  // Autofill management handlers
  const handleAddAutofill = (entry: Omit<AutofillEntry, 'id' | 'createdAt'>) => {
    setAutofillEntries((prev) => [
      { ...entry, id: `af-${Date.now()}`, createdAt: Date.now() },
      ...prev
    ]);
    showToast('Perfil de autocompletado guardado');
  };

  const handleRemoveAutofill = (id: string) => {
    setAutofillEntries((prev) => prev.filter((item) => item.id !== id));
  };

  // Live Page Translation trigger
  const handleTranslatePage = () => {
    if (!activeTab) return;
    if (activeTab.url.startsWith('http://') || activeTab.url.startsWith('https://')) {
      window.dispatchEvent(
        new CustomEvent('fabinav:dispatch-translate', {
          detail: {
            tabId: activeTab.id,
            targetLang: settings.translateTargetLang || settings.language || 'es'
          }
        })
      );
      showToast('Traduciendo página...');
    } else {
      showToast('Abre una página web externa para traducirla');
    }
  };

  // Windows Notification Service
  const normalizeNotificationOrigin = (rawUrl: string): string => {
    try {
      return new URL(rawUrl).origin;
    } catch {
      return rawUrl || 'https://fabinav.local';
    }
  };

  const dispatchWindowsNotification = useCallback(
    async (payload: {
      id: string;
      tabId: string;
      origin: string;
      title: string;
      body: string;
      icon?: string;
      tag?: string;
      url?: string;
      silent: boolean;
    }) => {
      if (window.fabinavDesktop?.showDesktopNotification) {
        await window.fabinavDesktop.showDesktopNotification({
          id: payload.id,
          title: payload.title,
          body: payload.body,
          origin: payload.origin,
          url: payload.url,
          tabId: payload.tabId,
          silent: payload.silent
        });
        return true;
      }

      if (typeof window.Notification !== 'function') return false;

      let hostPerm = window.Notification.permission;
      if (hostPerm === 'default') {
        try {
          hostPerm = await window.Notification.requestPermission();
        } catch {
          hostPerm = 'denied';
        }
      }

      if (hostPerm !== 'granted') return false;

      let originHost = payload.origin;
      try {
        originHost = new URL(payload.origin).hostname.replace(/^www\./, '') || payload.origin;
      } catch {
        // keep raw
      }

      try {
        const osNotif = new window.Notification(payload.title, {
          body: payload.body ? `${originHost} — ${payload.body}` : originHost,
          icon: payload.icon,
          tag: payload.tag,
          silent: payload.silent
        });
        osNotif.onclick = () => {
          window.focus();
          if (payload.tabId && tabsRef.current.some((t) => t.id === payload.tabId)) {
            setActiveTabId(payload.tabId);
          }
          osNotif.close();
        };
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  const handlePageNotification = useCallback(
    (
      tabId: string,
      notif: { origin: string; title: string; body: string; icon?: string; tag?: string; url?: string }
    ) => {
      const cur = settingsRef.current;
      if (cur.notificationsEnabled === false || cur.notificationDoNotDisturb) return;

      const origin = normalizeNotificationOrigin(notif.origin || notif.url || '');
      const sitePerm = cur.notificationPermissions?.[origin] || 'default';
      if (sitePerm === 'block') return;
      if (sitePerm === 'default' && cur.notificationDefaultPolicy === 'block') return;

      const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const title = (notif.title || 'Notificación').slice(0, 140);
      const body = (notif.body || '').slice(0, 320);

      appendLog('info', `Notificación enviada a Windows desde ${origin}: ${title}`, 'Notificaciones');

      if (cur.notificationSound !== false) {
        playNotificationChime();
      }

      void dispatchWindowsNotification({
        id,
        tabId,
        origin,
        title,
        body,
        icon: notif.icon,
        tag: notif.tag,
        url: notif.url || origin,
        silent: cur.notificationSound === false
      });
    },
    [dispatchWindowsNotification]
  );

  const handleRequestNotificationPermission = useCallback(
    (req: {
      tabId: string;
      origin: string;
      url?: string;
      source: 'iframe' | 'webview';
      requestId?: string;
    }) => {
      const origin = normalizeNotificationOrigin(req.origin || req.url || '');
      const cur = settingsRef.current;
      const sitePerm = cur.notificationPermissions?.[origin] || 'default';

      const replyIframe = (permission: 'granted' | 'denied') => {
        window.dispatchEvent(
          new CustomEvent('fabinav:notif-permission-reply', {
            detail: { tabId: req.tabId, requestId: req.requestId, permission }
          })
        );
      };

      if (cur.notificationsEnabled === false || sitePerm === 'block') {
        replyIframe('denied');
        return;
      }
      if (sitePerm === 'allow') {
        replyIframe('granted');
        return;
      }
      if (cur.notificationDefaultPolicy === 'block') {
        replyIframe('denied');
        return;
      }

      setPermissionQueue((prev) => {
        if (prev.some((p) => p.source === req.source && p.origin === origin && p.tabId === req.tabId)) {
          return prev;
        }
        return [
          ...prev,
          {
            id: req.requestId || `perm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            tabId: req.tabId,
            origin,
            url: req.url,
            source: req.source,
            requestId: req.requestId
          }
        ];
      });
    },
    []
  );

  const handleRespondNotificationPermission = (granted: boolean) => {
    const current = permissionQueue[0];
    if (!current) return;

    setSettings((prev) => ({
      ...prev,
      notificationPermissions: {
        ...(prev.notificationPermissions || {}),
        [current.origin]: granted ? 'allow' : 'block'
      }
    }));

    if (current.source === 'webview') {
      window.fabinavDesktop?.respondNotificationPermission?.(current.id, granted);
    } else {
      if (
        granted &&
        typeof window.Notification === 'function' &&
        window.Notification.permission === 'default'
      ) {
        window.Notification.requestPermission().catch(() => {});
      }
      window.dispatchEvent(
        new CustomEvent('fabinav:notif-permission-reply', {
          detail: {
            tabId: current.tabId,
            requestId: current.requestId,
            permission: granted ? 'granted' : 'denied'
          }
        })
      );
    }

    setPermissionQueue((prev) => prev.slice(1));
    let host = current.origin;
    try {
      host = new URL(current.origin).hostname.replace(/^www\./, '') || current.origin;
    } catch {
      // keep raw
    }
    showToast(
      granted
        ? `Notificaciones de Windows permitidas para ${host}`
        : `Notificaciones bloqueadas para ${host}`
    );
  };

  const handleDismissNotificationPermission = () => {
    const current = permissionQueue[0];
    if (!current) return;
    if (current.source === 'webview') {
      window.fabinavDesktop?.respondNotificationPermission?.(current.id, false);
    } else {
      window.dispatchEvent(
        new CustomEvent('fabinav:notif-permission-reply', {
          detail: {
            tabId: current.tabId,
            requestId: current.requestId,
            permission: 'denied'
          }
        })
      );
    }
    setPermissionQueue((prev) => prev.slice(1));
  };

  const handleSendTestNotification = async () => {
    if (settings.notificationsEnabled === false) {
      showToast('Activa primero el envío de notificaciones a Windows');
      return;
    }
    if (settings.notificationDoNotDisturb) {
      showToast('Desactiva el modo No molestar para enviar la prueba a Windows');
      return;
    }
    if (settings.notificationSound !== false) {
      playNotificationChime();
    }
    const ok = await dispatchWindowsNotification({
      id: `test-${Date.now()}`,
      tabId: activeTab?.id || '',
      origin: 'https://fabinav.local',
      title: 'FabiNav',
      body: 'Las notificaciones web se enviarán directamente al centro de notificaciones de Windows.',
      url: activeTab?.url || 'fabinav://settings#notificaciones',
      silent: settings.notificationSound === false
    });
    if (!ok) {
      showToast('Autoriza las notificaciones en tu navegador para enviarlas a Windows');
    }
  };

  // Safe DevTools Console Evaluator
  const handleRunConsoleCommand = (cmd: string) => {
    const normalized = cmd.trim().toLowerCase();
    appendLog('info', `> ${cmd}`, 'Consola');

    if (normalized === 'clear') {
      setDevLogs([]);
      return;
    }
    if (normalized === 'help') {
      appendLog('log', 'Comandos: help, version, tabs, shields, ua, clear', 'Consola');
      return;
    }
    if (normalized === 'version') {
      appendLog('log', `FabiNav v${APP_VERSION} · Tema: ${settings.theme}`, 'Consola');
      return;
    }
    if (normalized === 'tabs') {
      appendLog('log', `${tabs.length} pestaña(s) abierta(s) en la sesión actual.`, 'Consola');
      return;
    }
    if (normalized === 'shields') {
      appendLog(
        'log',
        `Escudos: ${shieldState.enabled ? 'activos' : 'pausados'} · TLS estricto: ${
          shieldState.strictTls ? 'sí' : 'no'
        } · ${shieldState.trackersBlockedCount} rastreadores · ${shieldState.cookiesBlockedCount} cookies · ${
          shieldState.httpsUpgradesCount
        } mejoras HTTPS.`,
        'Consola'
      );
      return;
    }
    if (normalized === 'ua') {
      appendLog('log', navigator.userAgent, 'Consola');
      return;
    }

    appendLog('warn', `Comando no reconocido: "${cmd}". Escribe "help" para ver opciones.`, 'Consola');
  };

  useEffect(() => {
    const onFindResult = (ev: Event) => {
      const customEv = ev as CustomEvent<{ tabId?: string; found?: boolean }>;
      if (!customEv.detail || customEv.detail.tabId !== activeTabId) return;
      setFindMatchStatus(
        customEv.detail.found ? 'Coincidencia encontrada' : 'Sin coincidencias en la página'
      );
    };
    window.addEventListener('fabinav:find-result', onFindResult);
    return () => window.removeEventListener('fabinav:find-result', onFindResult);
  }, [activeTabId]);

  const handleOpenFindInPage = useCallback(() => {
    setIsFindBarOpen(true);
    setFindMatchStatus(null);
    setTimeout(() => {
      findInputRef.current?.focus();
      findInputRef.current?.select();
    }, 30);
  }, []);

  const handleRunFind = (direction: 'next' | 'prev' = 'next') => {
    const q = findQuery.trim();
    if (!q) {
      setFindMatchStatus(null);
      return;
    }
    if (activeTab && (activeTab.url.startsWith('http://') || activeTab.url.startsWith('https://'))) {
      setFindMatchStatus('Buscando...');
      window.dispatchEvent(
        new CustomEvent('fabinav:dispatch-find', {
          detail: { tabId: activeTab.id, query: q, backwards: direction === 'prev' }
        })
      );
      return;
    }

    const winWithFind = window as unknown as {
      find?: (
        str: string,
        caseSensitive?: boolean,
        backwards?: boolean,
        wrapAround?: boolean
      ) => boolean;
    };
    if (typeof winWithFind.find === 'function') {
      const found = winWithFind.find(q, false, direction === 'prev', true);
      setFindMatchStatus(found ? 'Coincidencia encontrada' : 'Sin coincidencias en la vista');
    } else {
      setFindMatchStatus('Búsqueda no compatible en este visor');
    }
  };

  const handleEditAction = async (action: 'cut' | 'copy' | 'paste') => {
    if (action === 'copy') {
      const selected = window.getSelection()?.toString() || '';
      const textToCopy = selected || activeTab?.url || '';
      if (textToCopy) {
        try {
          await navigator.clipboard.writeText(textToCopy);
          showToast(selected ? 'Texto copiado al portapapeles' : 'Vínculo copiado al portapapeles');
          return;
        } catch {
          document.execCommand('copy');
        }
      }
      showToast('Nada seleccionado para copiar');
      return;
    }

    if (action === 'cut') {
      const ok = document.execCommand('cut');
      showToast(ok ? 'Selección cortada' : 'Selecciona texto editable para cortar');
      return;
    }

    if (action === 'paste') {
      try {
        const clip = await navigator.clipboard.readText();
        if (!clip) {
          showToast('El portapapeles está vacío');
          return;
        }
        const activeEl = document.activeElement;
        if (
          activeEl instanceof HTMLInputElement ||
          activeEl instanceof HTMLTextAreaElement
        ) {
          const start = activeEl.selectionStart ?? activeEl.value.length;
          const end = activeEl.selectionEnd ?? activeEl.value.length;
          const nextVal =
            activeEl.value.slice(0, start) + clip + activeEl.value.slice(end);
          activeEl.value = nextVal;
          activeEl.dispatchEvent(new Event('input', { bubbles: true }));
          showToast('Pegado desde el portapapeles');
        } else if (omniboxRef.current) {
          omniboxRef.current.focus();
          omniboxRef.current.value = clip;
          showToast('Pegado en la barra de direcciones');
        }
      } catch {
        showToast('Usa Ctrl+V para pegar desde el portapapeles');
      }
    }
  };

  const handleCopyLink = async () => {
    if (!activeTab?.url) return;
    try {
      await navigator.clipboard.writeText(activeTab.url);
      showToast('Vínculo copiado al portapapeles');
    } catch {
      showToast('No se pudo acceder al portapapeles');
    }
  };

  const handleSavePageAs = async () => {
    if (!activeTab) return;
    const safeSlug =
      (activeTab.title || 'pagina')
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40) || 'pagina';
    const filename = `fabinav-${safeSlug}.html`;
    let htmlContent = '';

    if (activeTab.url.startsWith('http://') || activeTab.url.startsWith('https://')) {
      try {
        const res = await fetch(
          `/api/proxy?url=${encodeURIComponent(activeTab.url)}&raw=1&partition=${
            activeTab.tabMode === 'private' ? 'private' : 'normal'
          }`
        );
        if (res.ok) {
          htmlContent = await res.text();
        }
      } catch {
        // Fallback below if offline or unreachable
      }
    }

    if (!htmlContent) {
      htmlContent = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${activeTab.title}</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #14161b; color: #f1f3f5; padding: 32px; line-height: 1.6; }
    .card { max-width: 720px; margin: 0 auto; background: #1d2027; border: 1px solid #303440; border-radius: 16px; padding: 24px; }
    a { color: #ff6f4c; }
    .meta { font-size: 13px; color: #9ea4b0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${activeTab.title}</h1>
    <p class="meta">Guardado desde FabiNav v${APP_VERSION} · ${new Date().toLocaleString('es-ES')}</p>
    <p>URL original: <a href="${activeTab.url}">${activeTab.url}</a></p>
    <p class="meta">Escudos: ${shieldState.enabled ? 'Activos' : 'En pausa'} · Modo: ${
        activeTab.tabMode === 'private' ? 'Privado' : 'Normal'
      }</p>
  </div>
</body>
</html>`;
    }

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    handleRecordDownload(filename, `${(blob.size / 1024).toFixed(1)} KB`, activeTab.url);
    showToast(`Página guardada: ${filename}`);
  };

  const handleCaptureView = async () => {
    if (!activeTab) return;
    const filename = `fabinav-captura-${Date.now()}.png`;

    if (window.fabinavDesktop?.capturePage) {
      try {
        const realPng = await window.fabinavDesktop.capturePage();
        if (realPng) {
          const a = document.createElement('a');
          a.href = realPng;
          a.download = filename;
          a.click();
          const approxKb = Math.max(1, (realPng.length * 0.75) / 1024).toFixed(1);
          handleRecordDownload(filename, `${approxKb} KB`, activeTab.url);
          showToast('Captura real de pantalla guardada como PNG');
          return;
        }
      } catch {
        // Fallback cleanly to visual card
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, 1280, 720);
    grad.addColorStop(0, '#14161b');
    grad.addColorStop(1, '#1e222b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1280, 720);

    // Header chrome preview
    ctx.fillStyle = '#242731';
    ctx.fillRect(48, 48, 1184, 64);
    ctx.fillStyle = '#fb542b';
    ctx.beginPath();
    ctx.arc(84, 80, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('FabiNav — Captura de vista', 112, 87);

    // Card body
    ctx.fillStyle = '#181a20';
    ctx.fillRect(48, 136, 1184, 536);
    ctx.strokeStyle = '#333845';
    ctx.lineWidth = 2;
    ctx.strokeRect(48, 136, 1184, 536);

    ctx.fillStyle = '#f5f6f8';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText((activeTab.title || 'Pestaña de FabiNav').slice(0, 56), 92, 230);

    ctx.fillStyle = '#ff7d5c';
    ctx.font = '20px monospace';
    ctx.fillText(activeTab.url.slice(0, 82), 92, 280);

    ctx.fillStyle = '#9fa6b4';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText(
      `Fecha: ${new Date().toLocaleString('es-ES')}   ·   Escudos: ${
        shieldState.enabled ? 'Activos' : 'En pausa'
      }   ·   Tema: ${settings.theme}`,
      92,
      344
    );
    ctx.fillText(
      `Bloqueos de sesión: ${shieldState.trackersBlockedCount} rastreadores · ${shieldState.cookiesBlockedCount} cookies · ${shieldState.httpsUpgradesCount} HTTPS`,
      92,
      386
    );

    const pngUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = filename;
    a.click();

    handleRecordDownload(filename, '42.0 KB', activeTab.url);
    showToast('Captura guardada como PNG');
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleReopenClosedTab();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewTab('fabinav://newtab', 'private');
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setTabSearchSignal((n) => n + 1);
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleCaptureView();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Delete') {
        e.preventDefault();
        handleClearBrowsingData();
      } else if (e.shiftKey && e.key === 'Escape') {
        e.preventDefault();
        setIsTaskManagerOpen((v) => !v);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        handleOpenFindInPage();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSavePageAs();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleNewTab();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewWindow();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        handleNavigate(activeTab.id, 'fabinav://downloads');
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (activeTab) handleCloseTab(activeTab.id);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        omniboxRef.current?.focus();
        omniboxRef.current?.select();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        const nextShow = !settings.showSidebar;
        handleUpdateSettings({ showSidebar: nextShow, sidebarMode: nextShow ? 'on' : 'off' });
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        handleNavigate(activeTab.id, 'fabinav://history');
      } else if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        if (splitTabId) {
          setSplitTabId(null);
        } else if (tabs.length > 1) {
          const nextTab = tabs.find((t) => t.id !== activeTabId);
          if (nextTab) setSplitTabId(nextTab.id);
        }
      } else if (e.key === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'i')) {
        e.preventDefault();
        handleUpdateSettings({ showSidebar: true, sidebarMode: 'on' });
        setActiveSidebarView('devtools');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tabs, activeTabId, splitTabId, activeTab, closedTabs, settings.showSidebar, settings.theme, shieldState]);

  // Command Palette Items
  const commands: CommandItem[] = [
    {
      id: 'cmd-new-tab',
      title: 'Nueva pestaña',
      subtitle: 'Abrir página principal de FabiNav',
      shortcut: 'Ctrl+T',
      category: 'Pestañas',
      action: () => handleNewTab('fabinav://newtab')
    },
    {
      id: 'cmd-private-tab',
      title: 'Nueva pestaña privada',
      subtitle: 'No guarda entradas en el historial ni cookies al cerrar',
      category: 'Pestañas',
      action: () => handleNewTab('fabinav://newtab', 'private')
    },
    {
      id: 'cmd-vertical-tabs',
      title: settings.useVerticalTabs ? 'Cambiar a pestañas horizontales' : 'Activar pestañas verticales',
      subtitle: 'Alternar disposición horizontal o columna lateral',
      category: 'Pestañas',
      action: () => handleUpdateSettings({ useVerticalTabs: !settings.useVerticalTabs })
    },
    {
      id: 'cmd-bookmarks',
      title: 'Administrador de marcadores',
      subtitle: 'Ver y organizar sitios guardados',
      category: 'Navegación',
      action: () => handleNavigate(activeTab.id, 'fabinav://bookmarks')
    },
    {
      id: 'cmd-history',
      title: 'Historial de navegación',
      subtitle: 'Consultar páginas visitadas en el navegador',
      shortcut: 'Ctrl+H',
      category: 'Navegación',
      action: () => handleNavigate(activeTab.id, 'fabinav://history')
    },
    {
      id: 'cmd-cookies-tls',
      title: 'Escudos, Cookies y TLS',
      subtitle: 'Gestionar cookies por partición, certificados y protección',
      category: 'Privacidad',
      action: () => handleNavigate(activeTab.id, 'fabinav://shields')
    },
    {
      id: 'cmd-google-account',
      title: 'Cuenta de Google y respaldo JSON',
      subtitle: 'Obtener avatar real desde Google o exportar datos locales',
      category: 'Datos',
      action: () => setIsBackupModalOpen(true)
    },
    {
      id: 'cmd-devtools',
      title: 'Herramientas para desarrolladores',
      subtitle: 'Consola, navegaciones y entorno',
      shortcut: 'F12',
      category: 'Herramientas',
      action: () => {
        handleUpdateSettings({ showSidebar: true, sidebarMode: 'on' });
        setActiveSidebarView('devtools');
      }
    },
    {
      id: 'cmd-electron',
      title: 'Exportar proyecto Electron',
      subtitle: 'Generar archivos main.js y preload.js',
      category: 'Herramientas',
      action: () => setIsElectronModalOpen(true)
    },
    {
      id: 'cmd-find-page',
      title: 'Buscar en la página actual',
      subtitle: 'Localizar texto dentro de la pestaña activa',
      shortcut: 'Ctrl+F',
      category: 'Herramientas',
      action: handleOpenFindInPage
    },
    {
      id: 'cmd-qr-code',
      title: 'Generar código QR de esta pestaña',
      subtitle: 'Compartir URL activa mediante código QR escaneable',
      category: 'Compartir',
      action: () => setIsQrModalOpen(true)
    },
    {
      id: 'cmd-task-manager',
      title: 'Administrador de tareas',
      subtitle: 'Pestañas activas, memoria JS y conexiones de sesión',
      shortcut: 'Shift+Esc',
      category: 'Herramientas',
      action: () => setIsTaskManagerOpen(true)
    },
    {
      id: 'cmd-translate',
      title: 'Traducir página actual',
      subtitle: 'Traduce el contenido web externo al idioma elegido',
      category: 'Herramientas',
      action: handleTranslatePage
    },
    {
      id: 'cmd-settings',
      title: 'Configuración de FabiNav',
      subtitle: 'Apariencia, rendimiento, autocompletar y buscador',
      category: 'Ajustes',
      action: () => handleNavigate(activeTab.id, 'fabinav://settings')
    },
    {
      id: 'cmd-notifications-settings',
      title: 'Notificaciones de páginas',
      subtitle: 'Configurar alertas, sonido, modo No molestar y permisos por sitio',
      category: 'Ajustes',
      action: () => handleNavigate(activeTab.id, 'fabinav://settings#notificaciones')
    },
    {
      id: 'cmd-notifications-dnd',
      title: settings.notificationDoNotDisturb
        ? 'Desactivar No molestar en notificaciones'
        : 'Activar No molestar en notificaciones',
      subtitle: 'Silenciar tarjetas flotantes y sonido temporalmente',
      category: 'Ajustes',
      action: () =>
        handleUpdateSettings({ notificationDoNotDisturb: !settings.notificationDoNotDisturb })
    },
    {
      id: 'cmd-performance',
      title: 'Rendimiento y ahorro de memoria',
      subtitle: 'Configurar suspensión de pestañas inactivas',
      category: 'Ajustes',
      action: () => handleNavigate(activeTab.id, 'fabinav://settings#rendimiento')
    },
    {
      id: 'cmd-autofill',
      title: 'Autocompletar y contraseñas',
      subtitle: 'Gestionar perfiles locales de autocompletado',
      category: 'Ajustes',
      action: () => handleNavigate(activeTab.id, 'fabinav://settings#autocompletar')
    },
    {
      id: 'cmd-theme-dark',
      title: 'Tema: FabiNav Oscuro',
      category: 'Apariencia',
      action: () => handleUpdateSettings({ theme: 'fabi-dark' })
    },
    {
      id: 'cmd-theme-midnight',
      title: 'Tema: Noche Profunda',
      category: 'Apariencia',
      action: () => handleUpdateSettings({ theme: 'fabi-midnight' })
    },
    {
      id: 'cmd-theme-light',
      title: 'Tema: FabiNav Claro',
      category: 'Apariencia',
      action: () => handleUpdateSettings({ theme: 'fabi-light' })
    }
  ];

  const renderSidebarStripAndPanel = () => {
    const mode = settings.sidebarMode || (settings.showSidebar ? 'on' : 'off');
    if (mode === 'off') return null;

    const hiddenByIdle = !!settings.autoHideSidebarIdle && isSidebarIdleHidden;
    const stripVisible =
      (mode === 'on' && !hiddenByIdle) || isSidebarAutoHovered || activeSidebarView !== null;

    const strip = stripVisible ? (
      <ActivityBar
        activeView={activeSidebarView}
        onSelectView={setActiveSidebarView}
        onOpenSettings={() => handleNavigate(activeTab.id, 'fabinav://settings')}
        position={settings.sidebarPosition}
      />
    ) : (
      <div
        className={`w-1.5 h-full bg-transparent hover:bg-[var(--bn-accent)]/30 transition-colors shrink-0 ${
          settings.sidebarPosition === 'right' ? 'border-l' : 'border-r'
        } border-transparent hover:border-[var(--bn-accent)]/40`}
        title="Pasa el ratón para mostrar la barra lateral"
      />
    );

    const panel = (
      <SidebarPanel
        activeView={activeSidebarView}
        position={settings.sidebarPosition}
        bookmarks={bookmarks}
        historyEntries={historyEntries}
        downloads={downloads}
        sessionNotes={sessionNotes}
        devLogs={devLogs}
        networkReqs={networkReqs}
        onClose={() => setActiveSidebarView(null)}
        onNavigate={(url) => handleNavigate(activeTab.id, url)}
        onNewTab={(url) => handleNewTab(url)}
        onAddBookmark={handleAddBookmark}
        onRemoveBookmark={handleRemoveBookmark}
        onDeleteHistoryItem={(id) =>
          setHistoryEntries((prev) => prev.filter((h) => h.id !== id))
        }
        onClearHistory={() => setHistoryEntries([])}
        onRemoveDownload={(id) => setDownloads((prev) => prev.filter((d) => d.id !== id))}
        onClearDownloads={() => setDownloads([])}
        onUpdateNotes={setSessionNotes}
        onRecordDownload={handleRecordDownload}
        onClearLogs={() => setDevLogs([])}
        onRunConsoleCommand={handleRunConsoleCommand}
      />
    );

    const content =
      settings.sidebarPosition === 'left' ? (
        <>
          {strip}
          {panel}
        </>
      ) : (
        <>
          {panel}
          {strip}
        </>
      );

    if (mode === 'auto' || settings.autoHideSidebarIdle) {
      return (
        <div
          className="flex h-full shrink-0"
          onMouseEnter={() => {
            setIsSidebarAutoHovered(true);
            setIsSidebarIdleHidden(false);
            setSidebarActivityTick((n) => n + 1);
          }}
          onMouseLeave={() => setIsSidebarAutoHovered(false)}
          onPointerMove={() => setSidebarActivityTick((n) => n + 1)}
          onPointerDown={() => {
            setIsSidebarIdleHidden(false);
            setSidebarActivityTick((n) => n + 1);
          }}
        >
          {content}
        </div>
      );
    }

    return content;
  };

  if (windowMode === 'minimized') {
    return (
      <div className="h-screen w-screen bg-[#0c0d10] flex items-end justify-center pb-8 px-4 select-none">
        <button
          type="button"
          onClick={() => setWindowMode('maximized')}
          className="px-5 py-3 rounded-2xl bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] shadow-2xl flex items-center gap-3 hover:bg-[var(--bn-hover)] transition-colors text-xs text-[var(--bn-text-strong)]"
        >
          <span
            className="w-7 h-7 rounded-xl flex items-center justify-center text-white"
            style={{ background: 'var(--fabi-gradient-brand)' }}
          >
            <Compass className="w-4 h-4" />
          </span>
          <div className="text-left">
            <div className="font-semibold">FabiNav minimizado</div>
            <div className="text-[11px] text-[var(--bn-text-muted)]">
              {tabs.length} pestaña(s) abierta(s) · Clic para restaurar ventana
            </div>
          </div>
        </button>
      </div>
    );
  }

  if (windowMode === 'closed') {
    return (
      <div className="h-screen w-screen bg-[#0c0d10] flex items-center justify-center p-6 select-none">
        <div className="max-w-sm w-full p-6 rounded-2xl bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] shadow-2xl text-center space-y-4">
          <div
            className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center text-white shadow"
            style={{ background: 'var(--fabi-gradient-brand)' }}
          >
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-[var(--bn-text-strong)]">
              Ventana de FabiNav cerrada
            </h1>
            <p className="text-xs text-[var(--bn-text-muted)] mt-1">
              Tus pestañas y configuración permanecen guardadas localmente.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setWindowMode('maximized')}
            className="w-full py-2 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white text-xs font-medium inline-flex items-center justify-center gap-2 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Abrir FabiNav</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`h-screen w-screen overflow-hidden flex items-center justify-center ${
        windowMode === 'restored' ? 'bg-[#0b0c10] p-3 sm:p-5' : 'bg-[var(--bn-tabstrip)]'
      }`}
    >
      <div
        id="fabinav-root-app"
        className={`flex flex-col overflow-hidden bg-[var(--bn-tabstrip)] text-[var(--bn-text)] transition-all duration-200 ${
          windowMode === 'restored'
            ? 'w-full h-full max-w-[1440px] rounded-xl border border-[var(--bn-border-strong)] shadow-2xl'
            : 'w-full h-full'
        }`}
      >
      {/* 1. FabiNav Top Tab Strip + Desktop Window Controls */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        splitTabId={splitTabId}
        closedTabs={closedTabs}
        useVerticalTabs={settings.useVerticalTabs}
        isMaximized={windowMode === 'maximized'}
        windowTitle={customWindowTitle}
        language={settings.language || 'es'}
        openTabSearchSignal={tabSearchSignal}
        onSelectTab={handleSelectTab}
        onCloseTab={handleCloseTab}
        onCloseOtherTabs={handleCloseOtherTabs}
        onCloseTabsToRight={handleCloseTabsToRight}
        onDuplicateTab={handleDuplicateTab}
        onReloadTab={handleReloadTab}
        onNewTab={() => handleNewTab()}
        onNewTabToRight={(afterId) => handleNewTab('fabinav://newtab', 'normal', afterId)}
        onReopenClosedTab={handleReopenClosedTab}
        onTogglePinTab={handleTogglePinTab}
        onToggleMuteTab={handleToggleMuteTab}
        onToggleSplitTab={handleToggleSplitTab}
        onToggleVerticalTabs={() =>
          handleUpdateSettings({ useVerticalTabs: !settings.useVerticalTabs })
        }
        onMinimizeWindow={handleMinimizeBrowserWindow}
        onToggleMaximizeWindow={handleToggleMaximizeBrowserWindow}
        onCloseWindow={handleCloseBrowserWindow}
      />

      {/* 2 & 3. FabiNav Main Toolbar + Bookmarks Bar (supports auto-hide after inactivity) */}
      <div
        className="flex flex-col shrink-0 relative z-40"
        onMouseEnter={() => {
          setIsBookmarksZoneHovered(true);
          setIsBookmarksBarIdleHidden(false);
          setBookmarksActivityTick((n) => n + 1);
        }}
        onMouseLeave={() => setIsBookmarksZoneHovered(false)}
        onPointerMove={() => setBookmarksActivityTick((n) => n + 1)}
        onPointerDown={() => {
          setIsBookmarksBarIdleHidden(false);
          setBookmarksActivityTick((n) => n + 1);
        }}
      >
        <TitleBar
          currentTab={activeTab}
          googleUser={googleUser}
          bookmarks={bookmarks}
          historyEntries={historyEntries}
          closedTabs={closedTabs}
          settings={settings}
          omniboxRef={omniboxRef}
          onNavigate={(url) => handleNavigate(activeTab.id, url)}
          onGoBack={handleGoBack}
          onGoForward={handleGoForward}
          onReload={handleReload}
          onGoHome={handleGoHome}
          onUpdateSettings={handleUpdateSettings}
          onTranslatePage={handleTranslatePage}
          onResetZoom={() => {
            handleUpdateSettings({ zoomLevel: 100 });
            showToast('Zoom restablecido al 100%');
          }}
          onToggleBookmark={handleToggleBookmark}
          onToggleSplitMode={() => {
            if (splitTabId) {
              setSplitTabId(null);
            } else if (tabs.length > 1) {
              const nextT = tabs.find((t) => t.id !== activeTabId);
              if (nextT) setSplitTabId(nextT.id);
            } else {
              handleNewTab('https://es.wikipedia.org/wiki/Wikipedia:Portada');
            }
          }}
          onToggleShieldsModal={() => setIsShieldsModalOpen((prev) => !prev)}
          onToggleSidebar={() => {
            const nextShow = !settings.showSidebar;
            handleUpdateSettings({ showSidebar: nextShow, sidebarMode: nextShow ? 'on' : 'off' });
            if (nextShow) {
              setIsSidebarIdleHidden(false);
              setSidebarActivityTick((n) => n + 1);
            }
          }}
          onOpenBackupModal={() => setIsBackupModalOpen(true)}
          onOpenElectronModal={() => setIsElectronModalOpen(true)}
          onOpenDevTools={() => {
            handleUpdateSettings({ showSidebar: true, sidebarMode: 'on' });
            setActiveSidebarView('devtools');
          }}
          onOpenNotes={() => {
            handleUpdateSettings({ showSidebar: true, sidebarMode: 'on' });
            setActiveSidebarView('notes');
          }}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onNewTab={() => handleNewTab()}
          onNewWindow={handleNewWindow}
          onNewPrivateTab={() => handleNewTab('fabinav://newtab', 'private')}
          onReopenClosedTab={handleReopenClosedTab}
          canReopenClosedTab={closedTabs.length > 0}
          onToggleBookmarksBar={() => {
            const next = !settings.showBookmarksBar;
            handleUpdateSettings({ showBookmarksBar: next });
            if (next) {
              setIsBookmarksBarIdleHidden(false);
              setBookmarksActivityTick((n) => n + 1);
            }
          }}
          onClearBrowsingData={handleClearBrowsingData}
          onOpenFindInPage={handleOpenFindInPage}
          onEditAction={handleEditAction}
          onSavePageAs={handleSavePageAs}
          onCaptureView={handleCaptureView}
          onCopyLink={handleCopyLink}
          onOpenQrModal={() => setIsQrModalOpen(true)}
          onOpenTabSearch={() => setTabSearchSignal((n) => n + 1)}
          onOpenRenameWindow={() => {
            setRenameInput(customWindowTitle);
            setIsRenameWindowOpen(true);
          }}
          onOpenTaskManager={() => setIsTaskManagerOpen(true)}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
          onCloseWindow={handleCloseBrowserWindow}
          isSplitActive={!!splitTabId}
          shieldCount={
            activeTab.url.startsWith('http://') || activeTab.url.startsWith('https://')
              ? (blockedUrlsByTab[activeTab.id] || []).length
              : 0
          }
          isShieldActive={resolveEffectiveShield(shieldState, activeTab.url).effective.enabled}
        />

        {settings.showBookmarksBar &&
          (!settings.autoHideBookmarksBar || !isBookmarksBarIdleHidden || isBookmarksZoneHovered) && (
            <BookmarksBar
              bookmarks={bookmarks}
              onNavigate={(url) => handleNavigate(activeTab.id, url)}
              onAddBookmark={handleToggleBookmark}
              onOpenBookmarksPage={() => handleNavigate(activeTab.id, 'fabinav://bookmarks')}
            />
          )}

        {settings.showBookmarksBar &&
          settings.autoHideBookmarksBar &&
          isBookmarksBarIdleHidden &&
          !isBookmarksZoneHovered && (
            <div
              className="h-1.5 w-full bg-transparent hover:bg-[var(--bn-accent)]/35 border-b border-transparent hover:border-[var(--bn-accent)]/40 transition-colors shrink-0"
              title="Pasa el ratón para mostrar la barra de favoritos"
            />
          )}
      </div>

      {/* 4. Main Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Floating Find-in-Page Bar (Ctrl+F) */}
        <AnimatePresence>
          {isFindBarOpen && (
            <motion.form
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.14, ease: [0, 0, 0.58, 1] }}
              onSubmit={(e) => {
                e.preventDefault();
                handleRunFind('next');
              }}
              className="absolute top-2.5 right-4 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] shadow-2xl text-xs"
            >
              <Search className="w-3.5 h-3.5 text-[var(--bn-text-muted)] shrink-0" />
              <input
                ref={findInputRef}
                type="text"
                value={findQuery}
                onChange={(e) => {
                  setFindQuery(e.target.value);
                  setFindMatchStatus(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsFindBarOpen(false);
                  }
                }}
                placeholder="Buscar en la página..."
                className="w-44 bg-transparent text-[var(--bn-text-strong)] placeholder-[var(--bn-text-muted)] focus:outline-none text-xs select-text"
              />
              {findMatchStatus && (
                <span className="text-[10px] text-[var(--bn-text-muted)] whitespace-nowrap px-1">
                  {findMatchStatus}
                </span>
              )}
              <button
                type="button"
                onClick={() => handleRunFind('prev')}
                title="Anterior"
                className="p-1 rounded-full hover:bg-[var(--bn-hover)] text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)]"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleRunFind('next')}
                title="Siguiente"
                className="p-1 rounded-full hover:bg-[var(--bn-hover)] text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)]"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsFindBarOpen(false)}
                title="Cerrar búsqueda (Esc)"
                className="p-1 rounded-full hover:bg-[var(--bn-hover)] text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Left FabiNav Sidebar if configured on left */}
        {settings.sidebarPosition === 'left' && renderSidebarStripAndPanel()}

        {/* Optional FabiNav Vertical Tabs Rail */}
        {settings.useVerticalTabs && (
          <aside className="w-56 bg-[var(--bn-tabstrip)] border-r border-[var(--bn-border)] flex flex-col shrink-0 select-none text-xs">
            <div className="h-10 px-3 border-b border-[var(--bn-border)] flex items-center justify-between">
              <span className="font-semibold text-[var(--bn-text-strong)]">
                Pestañas ({tabs.length})
              </span>
              <button
                type="button"
                onClick={() => handleNewTab()}
                title="Nueva pestaña (Ctrl+T)"
                className="p-1 rounded-full hover:bg-[var(--bn-hover)] text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] transition-colors fabi-transition-xs"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
              {tabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                return (
                  <div
                    key={tab.id}
                    onClick={() => handleSelectTab(tab.id)}
                    className={`group px-2.5 py-2 rounded-xl flex items-center justify-between gap-2 cursor-pointer transition-colors fabi-transition-s ${
                      isActive
                        ? 'bg-[var(--bn-toolbar)] text-[var(--bn-text-strong)] font-medium shadow-xs'
                        : 'text-[var(--bn-text-muted)] hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <TabFavicon tab={tab} isActive={isActive} />
                      <span className="truncate">{tab.title || 'Nueva pestaña'}</span>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity fabi-transition-xs">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTogglePinTab(tab.id);
                        }}
                        title={tab.isPinned ? 'Desanclar' : 'Anclar'}
                        className="p-0.5 rounded hover:text-[var(--bn-accent)]"
                      >
                        <Pin className={`w-3 h-3 ${tab.isPinned ? 'text-[var(--bn-accent)]' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleMuteTab(tab.id);
                        }}
                        title={tab.isMuted ? 'Activar audio' : 'Silenciar'}
                        className="p-0.5 rounded"
                      >
                        <VolumeX className={`w-3 h-3 ${tab.isMuted ? 'text-[var(--bn-danger)]' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSplitTab(tab.id);
                        }}
                        title="Vista dividida"
                        className="p-0.5 rounded"
                      >
                        <Columns className="w-3 h-3" />
                      </button>
                      {(!tab.isPinned || tabs.length === 1) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCloseTab(tab.id);
                          }}
                          title={tabs.length === 1 ? 'Cerrar pestaña y salir' : 'Cerrar'}
                          className="p-0.5 rounded hover:text-[var(--bn-danger)]"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        )}

        {/* Viewport */}
        <WebViewport
          primaryTab={activeTab}
          splitTab={splitTab}
          settings={settings}
          shieldState={shieldState}
          shieldSessionHistory={shieldSessionHistory}
          onUpdateShieldState={(updates) => setShieldState((prev) => ({ ...prev, ...updates }))}
          onUpdateSettings={handleUpdateSettings}
          customization={newTabCustomization}
          topSites={topSites}
          onAddTopSite={handleAddTopSite}
          onRemoveTopSite={handleRemoveTopSite}
          onNavigate={handleNavigate}
          onPageSecurityReport={handlePageSecurityReport}
          onToggleSplitTab={handleToggleSplitTab}
          onUpdateCustomization={(updates) =>
            setNewTabCustomization((prev) => ({ ...prev, ...updates }))
          }
          onOpenShieldModal={() => setIsShieldsModalOpen(true)}
          bookmarks={bookmarks}
          onAddBookmark={handleAddBookmark}
          onRemoveBookmark={handleRemoveBookmark}
          historyEntries={historyEntries}
          onClearHistory={() => setHistoryEntries([])}
          onDeleteHistoryItem={(id) =>
            setHistoryEntries((prev) => prev.filter((h) => h.id !== id))
          }
          downloads={downloads}
          onRemoveDownload={(id) => setDownloads((prev) => prev.filter((d) => d.id !== id))}
          onClearDownloads={() => setDownloads([])}
          onExportBackup={handleExportBackup}
          onImportBackup={handleImportBackup}
          onClearBrowsingData={handleClearBrowsingData}
          onResetSettings={handleResetSettings}
          onOpenElectronModal={() => setIsElectronModalOpen(true)}
          googleUser={googleUser}
          onGoogleSignIn={handleGoogleSignIn}
          onGoogleSignOut={handleGoogleSignOut}
          autofillEntries={autofillEntries}
          onAddAutofill={handleAddAutofill}
          onRemoveAutofill={handleRemoveAutofill}
          onOpenNewTab={(url) => handleNewTab(url)}
          onWakeTab={handleWakeTab}
          onTranslateStatus={(msg) => showToast(msg)}
          onPageNotification={handlePageNotification}
          onRequestNotificationPermission={handleRequestNotificationPermission}
          onSendTestNotification={handleSendTestNotification}
        />

        {/* Right FabiNav Sidebar */}
        {settings.sidebarPosition === 'right' && renderSidebarStripAndPanel()}

        {/* Shields Popover */}
        <FabiShieldModal
          isOpen={isShieldsModalOpen}
          onClose={() => setIsShieldsModalOpen(false)}
          currentUrl={activeTab.url}
          language={settings.language || 'es'}
          blockedTrackerUrls={blockedUrlsByTab[activeTab.id] || []}
          sessionHistory={shieldSessionHistory}
          shieldState={shieldState}
          onUpdateShieldState={(updates, siteUrl) => {
            setShieldState((prev) => {
              const next = siteUrl
                ? applySiteShieldUpdate(prev, siteUrl, updates)
                : { ...prev, ...updates };
              window.fabinavDesktop?.syncShields?.(next);
              return next;
            });
            if (siteUrl && (siteUrl.startsWith('http://') || siteUrl.startsWith('https://'))) {
              const copy = { ...blockedUrlsByTabRef.current };
              delete copy[activeTab.id];
              blockedUrlsByTabRef.current = copy;
              setBlockedUrlsByTab(copy);
              window.setTimeout(() => handleReloadTab(activeTab.id), 40);
            }
          }}
          onResetSiteOverride={(siteUrl) => {
            setShieldState((prev) => {
              const next = resetSiteShieldOverride(prev, siteUrl);
              window.fabinavDesktop?.syncShields?.(next);
              return next;
            });
            if (siteUrl.startsWith('http://') || siteUrl.startsWith('https://')) {
              setBlockedUrlsByTab((prev) => {
                const copy = { ...prev };
                delete copy[activeTab.id];
                return copy;
              });
              window.setTimeout(() => handleReloadTab(activeTab.id), 40);
            }
            showToast('Ajustes de escudos restablecidos para este sitio');
          }}
          onNavigate={(url) => handleNavigate(activeTab.id, url)}
        />
      </div>

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        commands={commands}
      />

      {/* Google Account & Local JSON Backup Modal */}
      <GoogleSyncModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        googleUser={googleUser}
        isAuthLoading={isAuthLoading}
        authError={authError}
        onGoogleSignIn={handleGoogleSignIn}
        onGoogleSignOut={handleGoogleSignOut}
        backupMeta={backupMeta}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        historyCount={historyEntries.length}
        bookmarksCount={bookmarks.length}
        openTabsCount={tabs.length}
        topSitesCount={topSites.length}
      />

      {/* Electron Export Modal */}
      <ElectronExportModal
        isOpen={isElectronModalOpen}
        onClose={() => setIsElectronModalOpen(false)}
        onRecordDownload={handleRecordDownload}
      />

      {/* QR Code Share Modal */}
      <QrCodeModal
        isOpen={isQrModalOpen}
        url={activeTab?.url || 'fabinav://newtab'}
        title={activeTab?.title || 'FabiNav'}
        onClose={() => setIsQrModalOpen(false)}
        onRecordDownload={handleRecordDownload}
      />

      {/* Task Manager Modal */}
      <TaskManagerModal
        isOpen={isTaskManagerOpen}
        tabs={tabs}
        activeTabId={activeTabId}
        shieldState={shieldState}
        networkCount={networkReqs.length}
        onSelectTab={(id) => {
          handleSelectTab(id);
          setIsTaskManagerOpen(false);
        }}
        onCloseTab={handleCloseTab}
        onClose={() => setIsTaskManagerOpen(false)}
      />

      {/* Rename Window Modal */}
      <AnimatePresence>
        {isRenameWindowOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14, ease: [0, 0, 0.58, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4"
            onClick={() => setIsRenameWindowOpen(false)}
          >
            <motion.form
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ duration: 0.16, ease: [0, 0, 0.58, 1] }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={(e) => {
                e.preventDefault();
                setCustomWindowTitle(renameInput.trim());
                setIsRenameWindowOpen(false);
                showToast(
                  renameInput.trim()
                    ? `Ventana renombrada a "${renameInput.trim()}"`
                    : 'Nombre personalizado de ventana eliminado'
                );
              }}
              className="w-full max-w-sm bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-2xl shadow-2xl p-5 space-y-4 text-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-sm text-[var(--bn-text-strong)]">
                  <Tag className="w-4 h-4 text-[var(--bn-accent)]" />
                  <span>Nombrar la ventana</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRenameWindowOpen(false)}
                  className="p-1 rounded-full text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input
                type="text"
                autoFocus
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                placeholder="Ej. Trabajo, Investigación, Personal..."
                maxLength={32}
                className="w-full px-3.5 py-2 rounded-xl bg-[var(--bn-omnibox)] border border-[var(--bn-border-strong)] text-[var(--bn-text-strong)] placeholder-[var(--bn-text-muted)] focus:outline-none focus:border-[var(--bn-accent)] select-text"
              />
              <div className="flex items-center justify-end gap-2">
                {customWindowTitle && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomWindowTitle('');
                      setIsRenameWindowOpen(false);
                      showToast('Nombre personalizado eliminado');
                    }}
                    className="px-3.5 py-1.5 rounded-full text-[var(--bn-text-muted)] hover:bg-[var(--bn-hover)] transition-colors"
                  >
                    Restablecer
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsRenameWindowOpen(false)}
                  className="px-4 py-1.5 rounded-full border border-[var(--bn-border)] hover:bg-[var(--bn-hover)] text-[var(--bn-text)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white font-medium transition-colors"
                >
                  Guardar
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Non-intrusive Toast Feedback */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.16, ease: [0, 0, 0.58, 1] }}
            className="fixed bottom-5 right-5 z-50 px-4 py-2 rounded-full bg-[var(--bn-surface-alt)] border border-[var(--bn-border-strong)] shadow-2xl text-xs font-medium text-[var(--bn-text-strong)] flex items-center gap-2 pointer-events-none"
          >
            <Check className="w-3.5 h-3.5 text-[var(--bn-success-text)] shrink-0" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notification Permission Prompt */}
      <NotificationPermissionPrompt
        pending={pendingNotifPermission}
        onRespond={handleRespondNotificationPermission}
        onDismiss={handleDismissNotificationPermission}
      />
      </div>
    </div>
  );
}
