import React, { useState, useEffect, useRef } from 'react';
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
  BrowserProfile,
  HistoryEntry,
  TopSiteItem
} from './types';
import {
  INITIAL_TABS,
  INITIAL_BOOKMARKS,
  INITIAL_TOP_SITES,
  DEFAULT_SETTINGS,
  INITIAL_SHIELD_STATE,
  INITIAL_NEWTAB_CUSTOMIZATION,
  INITIAL_PROFILE,
  APP_VERSION
} from './constants/initialData';
import { ActivityBar } from './components/ActivityBar';
import { SidebarPanel } from './components/SidebarPanel';
import { TitleBar } from './components/TitleBar';
import { TabBar } from './components/TabBar';
import { BookmarksBar } from './components/BookmarksBar';
import { WebViewport } from './components/WebViewport';
import { CommandPalette } from './components/CommandPalette';
import { ElectronExportModal } from './components/ElectronExportModal';
import { FabiShieldModal } from './components/BraveShieldModal';
import { GoogleSyncModal } from './components/GoogleSyncModal';
import { Plus, X, Pin, VolumeX, Columns, Lock, Globe } from 'lucide-react';

const STORAGE_KEY_PREFIX = 'fabinav_v1_5_';

function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${key}`);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
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

  // Profile, Bookmarks, History, Notes & Downloads (Real local state only)
  const [profile, setProfile] = useState<BrowserProfile>(() =>
    loadStored('profile', INITIAL_PROFILE)
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
      message: `FabiNav v${APP_VERSION} listo.`,
      source: 'Sistema',
      timestamp: new Date().toLocaleTimeString('es-ES', { hour12: false })
    }
  ]);
  const [networkReqs, setNetworkReqs] = useState<DevToolNetworkReq[]>([]);

  // Modals & Sidebar
  const [activeSidebarView, setActiveSidebarView] = useState<SidebarPanelView>(null);
  const [isShieldsModalOpen, setIsShieldsModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isElectronModalOpen, setIsElectronModalOpen] = useState(false);

  const omniboxRef = useRef<HTMLInputElement | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const splitTab = splitTabId ? tabs.find((t) => t.id === splitTabId) : null;

  // Persist workspace state to localStorage
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
      localStorage.setItem(`${STORAGE_KEY_PREFIX}profile`, JSON.stringify(profile));
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
    profile,
    sessionNotes
  ]);

  // Apply Brave theme class
  useEffect(() => {
    document.body.className = `theme-${settings.theme}`;
    if (settings.theme === 'brave-light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  }, [settings.theme]);

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
    if (targetUrl === 'fabinav://shields') return 'Escudos de FabiNav';
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
    setNetworkReqs((prev) => [
      {
        id: `req-${Date.now()}-${prev.length}`,
        url: finalUrl,
        method: 'GET',
        status: 200,
        type: isInternal ? 'internal' : 'document',
        timestamp: new Date().toLocaleTimeString('es-ES', { hour12: false })
      },
      ...prev.slice(0, 39)
    ]);

    if (upgradedHttps) {
      setShieldState((prev) => ({
        ...prev,
        httpsUpgradesCount: prev.httpsUpgradesCount + 1
      }));
      appendLog('info', `Conexión mejorada a HTTPS: ${finalUrl}`, 'Escudos');
    }
  };

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
      }, 350);
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

    if (activeTabId === tabId) {
      const nextIndex = Math.max(0, tabIndex - 1);
      setActiveTabId(newTabs[nextIndex].id);
    }
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
      }, 350);
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

  const handleReload = () => {
    if (!activeTab) return;
    setTabs((prev) => prev.map((t) => (t.id === activeTab.id ? { ...t, isLoading: true } : t)));
    setTimeout(() => {
      setTabs((prev) => prev.map((t) => (t.id === activeTab.id ? { ...t, isLoading: false } : t)));
    }, 350);
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
    const payload = {
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      profile,
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
    const filename = `fabinav-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    setProfile((prev) => ({ ...prev, lastExportTimestamp: Date.now() }));
    handleRecordDownload(filename, `${(jsonString.length / 1024).toFixed(1)} KB`, 'fabinav://backup');
    appendLog('info', `Respaldo local exportado: ${filename}`, 'Respaldo');
  };

  const handleImportBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || '{}'));
        if (data.profile) setProfile((prev) => ({ ...prev, ...data.profile }));
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
        `Escudos: ${shieldState.enabled ? 'activos' : 'pausados'} · ${shieldState.httpsUpgradesCount} mejoras HTTPS.`,
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
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleNewTab();
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
        handleUpdateSettings({ showSidebar: !settings.showSidebar });
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
        handleUpdateSettings({ showSidebar: true });
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
      subtitle: 'No guarda entradas en el historial local',
      category: 'Pestañas',
      action: () => handleNewTab('fabinav://newtab', 'private')
    },
    {
      id: 'cmd-vertical-tabs',
      title: settings.useVerticalTabs ? 'Cambiar a pestañas horizontales' : 'Activar pestañas verticales',
      subtitle: 'Alternar disposición clásica o lateral estilo Brave',
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
      id: 'cmd-shields',
      title: 'Escudos de privacidad',
      subtitle: 'Configurar HTTPS automático y reglas de filtrado',
      category: 'Privacidad',
      action: () => setIsShieldsModalOpen(true)
    },
    {
      id: 'cmd-profile-backup',
      title: 'Perfil local y respaldo JSON',
      subtitle: 'Exportar o importar copia de seguridad',
      category: 'Datos',
      action: () => setIsProfileModalOpen(true)
    },
    {
      id: 'cmd-devtools',
      title: 'Herramientas para desarrolladores',
      subtitle: 'Consola, navegaciones y entorno',
      shortcut: 'F12',
      category: 'Herramientas',
      action: () => {
        handleUpdateSettings({ showSidebar: true });
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
      title: 'Tema: Brave Oscuro',
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
      title: 'Tema: Brave Claro',
      category: 'Apariencia',
      action: () => handleUpdateSettings({ theme: 'brave-light' })
    }
  ];

  const renderSidebarStripAndPanel = () => {
    if (!settings.showSidebar) return null;

    const strip = (
      <ActivityBar
        activeView={activeSidebarView}
        onSelectView={setActiveSidebarView}
        onOpenSettings={() => handleNavigate(activeTab.id, 'fabinav://settings')}
        position={settings.sidebarPosition}
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

    if (settings.sidebarPosition === 'left') {
      return (
        <>
          {strip}
          {panel}
        </>
      );
    }

    return (
      <>
        {panel}
        {strip}
      </>
    );
  };

  return (
    <div
      id="fabinav-root-app"
      className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bn-tabstrip)] text-[var(--bn-text)]"
    >
      {/* 1. Brave Top Tab Strip */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        splitTabId={splitTabId}
        closedTabs={closedTabs}
        useVerticalTabs={settings.useVerticalTabs}
        onSelectTab={handleSelectTab}
        onCloseTab={handleCloseTab}
        onNewTab={() => handleNewTab()}
        onReopenClosedTab={handleReopenClosedTab}
        onTogglePinTab={handleTogglePinTab}
        onToggleMuteTab={handleToggleMuteTab}
        onToggleSplitTab={handleToggleSplitTab}
        onToggleVerticalTabs={() =>
          handleUpdateSettings({ useVerticalTabs: !settings.useVerticalTabs })
        }
      />

      {/* 2. Brave Main Toolbar + Pill Omnibox */}
      <TitleBar
        currentTab={activeTab}
        profile={profile}
        bookmarks={bookmarks}
        historyEntries={historyEntries}
        settings={settings}
        omniboxRef={omniboxRef}
        onNavigate={(url) => handleNavigate(activeTab.id, url)}
        onGoBack={handleGoBack}
        onGoForward={handleGoForward}
        onReload={handleReload}
        onGoHome={handleGoHome}
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
        onToggleSidebar={() => handleUpdateSettings({ showSidebar: !settings.showSidebar })}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
        onOpenElectronModal={() => setIsElectronModalOpen(true)}
        onOpenDevTools={() => {
          handleUpdateSettings({ showSidebar: true });
          setActiveSidebarView('devtools');
        }}
        onNewTab={() => handleNewTab()}
        onNewPrivateTab={() => handleNewTab('fabinav://newtab', 'private')}
        onReopenClosedTab={() => handleReopenClosedTab()}
        canReopenClosedTab={closedTabs.length > 0}
        onToggleBookmarksBar={() =>
          handleUpdateSettings({ showBookmarksBar: !settings.showBookmarksBar })
        }
        isSplitActive={!!splitTabId}
        adBlockCount={shieldState.trackersBlockedCount + shieldState.httpsUpgradesCount}
        isShieldActive={shieldState.enabled}
      />

      {/* 3. Brave Bookmarks Bar */}
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
        {/* Left Brave Sidebar if configured on left */}
        {settings.sidebarPosition === 'left' && renderSidebarStripAndPanel()}

        {/* Optional Brave Vertical Tabs Rail */}
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
                className="p-1 rounded-full hover:bg-[var(--bn-hover)] text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)]"
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
                    className={`group px-2.5 py-2 rounded-xl flex items-center justify-between gap-2 cursor-pointer transition-colors ${
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

                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100">
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
          onToggleSplitTab={handleToggleSplitTab}
          onUpdateCustomization={(updates) =>
            setNewTabCustomization((prev) => ({ ...prev, ...updates }))
          }
          onOpenShieldModal={() => setIsShieldsModalOpen(true)}
          profile={profile}
          onUpdateProfile={(updates) => setProfile((prev) => ({ ...prev, ...updates }))}
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
        />

        {/* Right Brave Sidebar (default in Brave) */}
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

      {/* Local Profile & JSON Backup Modal */}
      <GoogleSyncModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        profile={profile}
        onUpdateProfile={(updates) => setProfile((prev) => ({ ...prev, ...updates }))}
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
    </div>
  );
}
