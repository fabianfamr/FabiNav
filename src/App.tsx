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
  GoogleUserProfile
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
import { initGoogleAuth, signInWithGoogle, signOutGoogle } from './services/googleAuth';
import { ActivityBar } from './components/ActivityBar';
import { SidebarPanel } from './components/SidebarPanel';
import { TitleBar } from './components/TitleBar';
import { TabBar } from './components/TabBar';
import { BookmarksBar } from './components/BookmarksBar';
import { WebViewport, PageSecurityReport } from './components/WebViewport';
import { CommandPalette } from './components/CommandPalette';
import { ElectronExportModal } from './components/ElectronExportModal';
import { FabiShieldModal } from './components/BraveShieldModal';
import { GoogleSyncModal } from './components/GoogleSyncModal';
import { Plus, X, Pin, VolumeX, Columns, Lock, Globe, Check, Compass, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const STORAGE_KEY_PREFIX = 'fabinav_v1_9_';
const LEGACY_STORAGE_PREFIXES = ['fabinav_v1_8_', 'fabinav_v1_7_'];

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

export default function App() {
  // Google Auth State (obtained strictly from real Google OAuth / People API)
  const [googleUser, setGoogleUser] = useState<GoogleUserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Tabs & Navigation
  const [tabs, setTabs] = useState<WebTab[]>(() => loadStored('tabs', INITIAL_TABS));
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    const storedTabs = loadStored('tabs', INITIAL_TABS);
    return storedTabs[0]?.id || INITIAL_TABS[0].id;
  });
  const [splitTabId, setSplitTabId] = useState<string | null>(null);
  const [closedTabs, setClosedTabs] = useState<ClosedTabRecord[]>([]);

  // Settings, Theme & Customization
  const [settings, setSettings] = useState<BrowserSettings>(() =>
    loadStored('settings', DEFAULT_SETTINGS)
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
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() =>
    loadStored('bookmarks', INITIAL_BOOKMARKS)
  );
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
  const [isShieldsModalOpen, setIsShieldsModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isElectronModalOpen, setIsElectronModalOpen] = useState(false);
  const [windowMode, setWindowMode] = useState<'maximized' | 'restored' | 'minimized' | 'closed'>('maximized');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const omniboxRef = useRef<HTMLInputElement | null>(null);
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

  // Persist workspace state to localStorage (never persisting OAuth tokens)
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}tabs`, JSON.stringify(tabs));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}bookmarks`, JSON.stringify(bookmarks));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}history`, JSON.stringify(historyEntries.slice(0, 100)));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}downloads`, JSON.stringify(downloads.slice(0, 50)));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}settings`, JSON.stringify(settings));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}shields`, JSON.stringify(shieldState));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}newtab`, JSON.stringify(newTabCustomization));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}top_sites`, JSON.stringify(topSites));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}backup_meta`, JSON.stringify(backupMeta));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}notes`, JSON.stringify(sessionNotes));
    } catch {
      // Ignore quota errors
    }
  }, [
    tabs,
    bookmarks,
    historyEntries,
    downloads,
    settings,
    shieldState,
    newTabCustomization,
    topSites,
    backupMeta,
    sessionNotes
  ]);

  // Apply FabiNav theme class
  useEffect(() => {
    document.body.className = `theme-${settings.theme}`;
    if (settings.theme === 'brave-light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  }, [settings.theme]);

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
    if (targetUrl === 'fabinav://newtab') return 'Nueva pestaña';
    if (targetUrl === 'fabinav://bookmarks') return 'Marcadores';
    if (targetUrl === 'fabinav://history') return 'Historial';
    if (targetUrl === 'fabinav://downloads') return 'Descargas';
    if (targetUrl === 'fabinav://shields') return 'Escudos, Cookies y TLS';
    if (targetUrl === 'fabinav://settings') return 'Configuración';
    if (targetUrl === 'fabinav://about') return 'Acerca de FabiNav';
    if (targetUrl.startsWith('fabinav://search?q=')) {
      const q = decodeURIComponent(targetUrl.replace('fabinav://search?q=', ''));
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

    if (target.startsWith('brave://')) {
      target = target.replace('brave://', 'fabinav://');
    }

    if (
      !target.startsWith('http://') &&
      !target.startsWith('https://') &&
      !target.startsWith('fabinav://')
    ) {
      if (target.includes('.') && !target.includes(' ')) {
        const useHttps = shieldState.upgradeHttps && shieldState.enabled;
        target = `${useHttps ? 'https' : 'http'}://${target}`;
        if (useHttps) upgradedHttps = true;
      } else {
        target = `fabinav://search?q=${encodeURIComponent(target)}`;
      }
    } else if (target.startsWith('http://') && shieldState.upgradeHttps && shieldState.enabled) {
      target = target.replace('http://', 'https://');
      upgradedHttps = true;
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
      }
    }
  };

  const handlePageSecurityReport = useCallback((tabId: string, report: PageSecurityReport) => {
    if (report.title) {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? {
                ...t,
                title: report.title || t.title,
                isLoading: false
              }
            : t
        )
      );
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
      appendLog(
        'info',
        `Escudos en ${report.url || 'página'}: ${trackers} rastreadores y ${cookies} cookies bloqueadas.`,
        'Escudos'
      );
    }
  }, []);

  const handleSelectTab = (tabId: string) => {
    setActiveTabId(tabId);
    setIsShieldsModalOpen(false);
  };

  const handleNewTab = (url: string = 'fabinav://newtab', mode: 'normal' | 'private' = 'normal') => {
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

    setTabs((prev) => [...prev, newTab]);
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
  };

  const handleCloseTab = (tabId: string) => {
    if (tabs.length <= 1) return;

    const target = tabs.find((t) => t.id === tabId);
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
    if (splitTabId && !kept.some((t) => t.id === splitTabId)) {
      setSplitTabId(null);
    }
    setTabs(kept);
    setActiveTabId(keepTabId);
    if (!kept.some((t) => t.tabMode === 'private')) {
      fetch('/api/cookies?partition=private', { method: 'DELETE' }).catch(() => {});
    }
    showToast('Otras pestañas cerradas');
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

    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === tabId) {
          const newHistory = [...t.history.slice(0, t.historyIndex + 1), finalUrl];
          return {
            ...t,
            url: finalUrl,
            displayUrl: finalUrl,
            title: parsedTitle,
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
      if (candidate) setSplitTabId(candidate.id);
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
        fetch('/api/cookies?partition=private', { method: 'DELETE' })
      ]);
    } catch {
      // Ignore offline errors
    }
    appendLog('info', 'Historial y cookies eliminados por el usuario.', 'Privacidad');
    showToast('Historial y cookies borrados');
  };

  const handleNewWindow = () => {
    setWindowMode('maximized');
    handleNewTab('fabinav://newtab');
    showToast('Nueva sesión lista en FabiNav');
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

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleReopenClosedTab();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewTab('fabinav://newtab', 'private');
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Delete') {
        e.preventDefault();
        handleClearBrowsingData();
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
  }, [tabs, activeTabId, splitTabId, activeTab, closedTabs, settings.showSidebar]);

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
      id: 'cmd-settings',
      title: 'Configuración de FabiNav',
      subtitle: 'Apariencia, barra lateral y buscador',
      category: 'Ajustes',
      action: () => handleNavigate(activeTab.id, 'fabinav://settings')
    },
    {
      id: 'cmd-theme-dark',
      title: 'Tema: FabiNav Oscuro',
      category: 'Apariencia',
      action: () => handleUpdateSettings({ theme: 'brave-dark' })
    },
    {
      id: 'cmd-theme-midnight',
      title: 'Tema: Noche Profunda',
      category: 'Apariencia',
      action: () => handleUpdateSettings({ theme: 'brave-midnight' })
    },
    {
      id: 'cmd-theme-light',
      title: 'Tema: FabiNav Claro',
      category: 'Apariencia',
      action: () => handleUpdateSettings({ theme: 'brave-light' })
    }
  ];

  const renderSidebarStripAndPanel = () => {
    const mode = settings.sidebarMode || (settings.showSidebar ? 'on' : 'off');
    if (mode === 'off') return null;

    const stripVisible = mode === 'on' || isSidebarAutoHovered || activeSidebarView !== null;

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

    if (mode === 'auto') {
      return (
        <div
          className="flex h-full shrink-0"
          onMouseEnter={() => setIsSidebarAutoHovered(true)}
          onMouseLeave={() => setIsSidebarAutoHovered(false)}
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
            style={{ background: 'var(--leo-gradient-brand)' }}
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
            style={{ background: 'var(--leo-gradient-brand)' }}
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
        onSelectTab={handleSelectTab}
        onCloseTab={handleCloseTab}
        onCloseOtherTabs={handleCloseOtherTabs}
        onDuplicateTab={handleDuplicateTab}
        onReloadTab={handleReloadTab}
        onNewTab={() => handleNewTab()}
        onReopenClosedTab={handleReopenClosedTab}
        onTogglePinTab={handleTogglePinTab}
        onToggleMuteTab={handleToggleMuteTab}
        onToggleSplitTab={handleToggleSplitTab}
        onToggleVerticalTabs={() =>
          handleUpdateSettings({ useVerticalTabs: !settings.useVerticalTabs })
        }
        onMinimizeWindow={() => setWindowMode('minimized')}
        onToggleMaximizeWindow={() =>
          setWindowMode((prev) => (prev === 'maximized' ? 'restored' : 'maximized'))
        }
        onCloseWindow={() => setWindowMode('closed')}
      />

      {/* 2. FabiNav Main Toolbar + Omnibox + Menu Panel */}
      <TitleBar
        currentTab={activeTab}
        googleUser={googleUser}
        bookmarks={bookmarks}
        historyEntries={historyEntries}
        settings={settings}
        omniboxRef={omniboxRef}
        onNavigate={(url) => handleNavigate(activeTab.id, url)}
        onGoBack={handleGoBack}
        onGoForward={handleGoForward}
        onReload={handleReload}
        onGoHome={handleGoHome}
        onUpdateSettings={handleUpdateSettings}
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
        onReopenClosedTab={() => handleReopenClosedTab()}
        canReopenClosedTab={closedTabs.length > 0}
        onToggleBookmarksBar={() =>
          handleUpdateSettings({ showBookmarksBar: !settings.showBookmarksBar })
        }
        onClearBrowsingData={handleClearBrowsingData}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        onCloseWindow={() => setWindowMode('closed')}
        isSplitActive={!!splitTabId}
        shieldCount={
          shieldState.trackersBlockedCount +
          shieldState.cookiesBlockedCount +
          shieldState.httpsUpgradesCount
        }
        isShieldActive={shieldState.enabled}
      />

      {/* 3. FabiNav Bookmarks Bar */}
      {settings.showBookmarksBar && (
        <BookmarksBar
          bookmarks={bookmarks}
          onNavigate={(url) => handleNavigate(activeTab.id, url)}
          onAddBookmark={handleToggleBookmark}
          onOpenBookmarksPage={() => handleNavigate(activeTab.id, 'fabinav://bookmarks')}
        />
      )}

      {/* 4. Main Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
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
                className="p-1 rounded-full hover:bg-[var(--bn-hover)] text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] transition-colors leo-transition-xs"
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
                    className={`group px-2.5 py-2 rounded-xl flex items-center justify-between gap-2 cursor-pointer transition-colors leo-transition-s ${
                      isActive
                        ? 'bg-[var(--bn-toolbar)] text-[var(--bn-text-strong)] font-medium shadow-xs'
                        : 'text-[var(--bn-text-muted)] hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {tab.tabMode === 'private' ? (
                        <Lock className="w-3.5 h-3.5 text-[#a78bfa] shrink-0" />
                      ) : (
                        <Globe className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span className="truncate">{tab.title || 'Nueva pestaña'}</span>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity leo-transition-xs">
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
                      {!tab.isPinned && tabs.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCloseTab(tab.id);
                          }}
                          title="Cerrar"
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
          onOpenElectronModal={() => setIsElectronModalOpen(true)}
          googleUser={googleUser}
          onGoogleSignIn={handleGoogleSignIn}
          onGoogleSignOut={handleGoogleSignOut}
        />

        {/* Right FabiNav Sidebar */}
        {settings.sidebarPosition === 'right' && renderSidebarStripAndPanel()}

        {/* Shields Popover */}
        <FabiShieldModal
          isOpen={isShieldsModalOpen}
          onClose={() => setIsShieldsModalOpen(false)}
          currentUrl={activeTab.url}
          shieldState={shieldState}
          onUpdateShieldState={(updates) => setShieldState((prev) => ({ ...prev, ...updates }))}
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
      </div>
    </div>
  );
}
