import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  History,
  Check,
  Trash2,
  Search,
  Settings,
  Info,
  Bookmark as BookmarkIcon,
  Download,
  Palette,
  PanelLeft,
  HardDrive,
  Laptop,
  Plus,
  Upload,
  ExternalLink,
  Cookie,
  Lock,
  RotateCw,
  LogOut,
  User,
  ChevronRight,
  Power,
  RotateCcw,
  X,
  Compass,
  Languages,
  Filter
} from 'lucide-react';
import {
  FabiShieldState,
  BrowserSettings,
  HistoryEntry,
  BrowserTheme,
  Bookmark,
  DownloadItem,
  StoredCookieItem,
  GoogleUserProfile,
  TlsInspectionResult,
  CacheStatusInfo
} from '../types';
import { APP_VERSION } from '../constants/initialData';
import { FabiSwitch } from './FabiSwitch';
import { FABI_FILTER_LISTS, LANGUAGE_OPTIONS, getDateLocale, t } from '../i18n/translations';

interface FabiInternalsViewProps {
  url: string;
  googleUser?: GoogleUserProfile | null;
  onGoogleSignIn?: () => void;
  onGoogleSignOut?: () => void;
  shieldState: FabiShieldState;
  onUpdateShieldState: (updates: Partial<FabiShieldState>) => void;
  settings: BrowserSettings;
  onUpdateSettings: (updates: Partial<BrowserSettings>) => void;
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
  onNavigate: (url: string) => void;
}

type SettingsSection =
  | 'tu-google'
  | 'escudos'
  | 'apariencia'
  | 'idiomas'
  | 'buscador'
  | 'al-iniciar'
  | 'descargas'
  | 'datos'
  | 'restablecer'
  | 'acerca';

const FABI_EASE_OUT: [number, number, number, number] = [0, 0, 0.58, 1];

export const FabiInternalsView: React.FC<FabiInternalsViewProps> = ({
  url,
  googleUser,
  onGoogleSignIn,
  onGoogleSignOut,
  shieldState,
  onUpdateShieldState,
  settings,
  onUpdateSettings,
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
  onNavigate
}) => {
  const [historyFilter, setHistoryFilter] = useState('');
  const [bookmarkFilter, setBookmarkFilter] = useState('');
  const [newBmTitle, setNewBmTitle] = useState('');
  const [newBmUrl, setNewBmUrl] = useState('');
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('tu-google');
  const [settingsSearch, setSettingsSearch] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [cookiePartition, setCookiePartition] = useState<'normal' | 'private'>('normal');
  const [cookieFilter, setCookieFilter] = useState('');
  const [cookies, setCookies] = useState<StoredCookieItem[]>([]);
  const [loadingCookies, setLoadingCookies] = useState(false);

  const [tlsProbeHost, setTlsProbeHost] = useState('github.com');
  const [tlsProbeLoading, setTlsProbeLoading] = useState(false);
  const [tlsProbeResult, setTlsProbeResult] = useState<TlsInspectionResult | null>(null);
  const [desktopActionMsg, setDesktopActionMsg] = useState<string | null>(null);
  const [desktopUpdateReady, setDesktopUpdateReady] = useState(false);

  const [cacheInfo, setCacheInfo] = useState<CacheStatusInfo | null>(null);
  const [loadingCache, setLoadingCache] = useState(false);
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);
  const [customRuleInput, setCustomRuleInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const filtersSectionRef = useRef<HTMLDivElement>(null);
  const lang = settings.language || 'es';
  const dateLocale = getDateLocale(lang);

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const fetchCacheStatus = useCallback(async () => {
    setLoadingCache(true);
    try {
      const res = await fetch('/api/cache');
      if (res.ok) {
        const data = (await res.json()) as CacheStatusInfo;
        setCacheInfo(data);
      }
    } catch {
      // Ignore network errors
    } finally {
      setLoadingCache(false);
    }
  }, []);

  const handleClearCache = async () => {
    setLoadingCache(true);
    setCacheNotice(null);
    try {
      const res = await fetch('/api/cache', { method: 'DELETE' });
      let cleared = 0;
      let freed = 0;
      if (res.ok) {
        const data = (await res.json()) as { clearedEntries?: number; freedBytes?: number };
        cleared = data.clearedEntries || 0;
        freed = data.freedBytes || 0;
      }
      if ('caches' in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((k) => window.caches.delete(k)));
      }
      setCacheInfo({ proxyCount: 0, searchCount: 0, totalBytes: 0, entries: [] });
      setCacheNotice(
        cleared > 0
          ? `Caché vaciada (${cleared} elemento(s), ${formatBytes(freed)} liberados).`
          : 'La caché ya estaba vacía.'
      );
    } catch {
      setCacheNotice('No se pudo vaciar la caché en este momento.');
    } finally {
      setLoadingCache(false);
    }
  };

  const handleDesktopCheckUpdates = async () => {
    const bridge = window.fabinavDesktop;
    if (!bridge?.isElectron) {
      setDesktopActionMsg(
        `FabiNav Web v${APP_VERSION}: en la versión de escritorio (Electron) comprueba e instala nuevas versiones desde GitHub Releases automáticamente.`
      );
      return;
    }
    setDesktopActionMsg('Buscando actualizaciones en GitHub Releases...');
    try {
      const res = await bridge.checkForUpdates();
      if (res.state === 'downloaded') {
        setDesktopUpdateReady(true);
      }
      setDesktopActionMsg(res.message || `Estado: ${res.state}`);
    } catch {
      setDesktopActionMsg('No se pudo comprobar actualizaciones en este momento.');
    }
  };

  const cleanUrl = url.toLowerCase().trim();

  const fetchCookies = useCallback(async (partition: 'normal' | 'private') => {
    setLoadingCookies(true);
    try {
      const res = await fetch(`/api/cookies?partition=${partition}`);
      if (res.ok) {
        const data = (await res.json()) as { cookies?: StoredCookieItem[] };
        setCookies(data.cookies || []);
      }
    } catch {
      // Ignore network errors
    } finally {
      setLoadingCookies(false);
    }
  }, []);

  useEffect(() => {
    if (cleanUrl.includes('shields')) {
      fetchCookies(cookiePartition);
      fetchCacheStatus();
      if (cleanUrl.endsWith('#filtros')) {
        setTimeout(() => {
          filtersSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
      }
    } else if (cleanUrl.includes('settings')) {
      fetchCacheStatus();
      const hashPart = cleanUrl.split('#')[1] || '';
      const validSections: SettingsSection[] = [
        'tu-google',
        'escudos',
        'apariencia',
        'idiomas',
        'buscador',
        'al-iniciar',
        'descargas',
        'datos',
        'restablecer',
        'acerca'
      ];
      if (validSections.includes(hashPart as SettingsSection)) {
        setSettingsSection(hashPart as SettingsSection);
      }
    }
  }, [cleanUrl, cookiePartition, fetchCookies, fetchCacheStatus]);

  const handleDeleteCookie = async (id: string) => {
    await fetch(`/api/cookies?partition=${cookiePartition}&id=${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    setCookies((prev) => prev.filter((c) => c.id !== id));
  };

  const handleClearCookies = async () => {
    await fetch(`/api/cookies?partition=${cookiePartition}`, { method: 'DELETE' });
    setCookies([]);
  };

  const handleInspectTls = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = tlsProbeHost.trim();
    if (!cleaned) return;
    setTlsProbeLoading(true);
    try {
      const res = await fetch(`/api/tls?url=${encodeURIComponent(cleaned)}`);
      if (res.ok) {
        setTlsProbeResult((await res.json()) as TlsInspectionResult);
      }
    } catch {
      // Ignore network errors
    } finally {
      setTlsProbeLoading(false);
    }
  };

  // 1. MARCADORES (fabinav://bookmarks)
  if (cleanUrl.includes('bookmarks')) {
    const filteredBookmarks = bookmarks.filter(
      (b) =>
        b.title.toLowerCase().includes(bookmarkFilter.toLowerCase()) ||
        b.url.toLowerCase().includes(bookmarkFilter.toLowerCase())
    );

    const handleAddBm = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newBmTitle.trim() || !newBmUrl.trim()) return;
      onAddBookmark(newBmTitle.trim(), newBmUrl.trim(), 'Barra de marcadores');
      setNewBmTitle('');
      setNewBmUrl('');
    };

    return (
      <div className="w-full h-full overflow-y-auto bg-[var(--bn-surface)] text-[var(--bn-text)] p-6 sm:p-10">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[var(--bn-border)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--bn-accent-soft)] text-[var(--bn-accent)] flex items-center justify-center">
                <BookmarkIcon className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[var(--bn-text-strong)]">Marcadores</h1>
                <p className="text-xs text-[var(--bn-text-muted)] tabular-nums">
                  {bookmarks.length} marcadores guardados en este dispositivo
                </p>
              </div>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-[var(--bn-text-muted)] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar marcadores..."
                value={bookmarkFilter}
                onChange={(e) => setBookmarkFilter(e.target.value)}
                className="w-full bg-[var(--bn-omnibox)] border border-[var(--bn-border)] rounded-full pl-9 pr-4 py-2 text-xs text-[var(--bn-text-strong)] placeholder-[var(--bn-text-muted)] focus:outline-none focus:border-[var(--bn-accent)]"
              />
            </div>
          </div>

          <form
            onSubmit={handleAddBm}
            className="p-4 bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl flex flex-col sm:flex-row gap-2.5"
          >
            <input
              type="text"
              placeholder="Título del sitio"
              value={newBmTitle}
              onChange={(e) => setNewBmTitle(e.target.value)}
              className="flex-1 bg-[var(--bn-omnibox)] border border-[var(--bn-border-strong)] rounded-xl px-3 py-2 text-xs text-[var(--bn-text-strong)] focus:outline-none focus:border-[var(--bn-accent)]"
            />
            <input
              type="text"
              placeholder="https://sitio.com"
              value={newBmUrl}
              onChange={(e) => setNewBmUrl(e.target.value)}
              className="flex-1 bg-[var(--bn-omnibox)] border border-[var(--bn-border-strong)] rounded-xl px-3 py-2 text-xs text-[var(--bn-text-strong)] focus:outline-none focus:border-[var(--bn-accent)]"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white text-xs font-medium flex items-center justify-center gap-1.5 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir</span>
            </button>
          </form>

          {filteredBookmarks.length === 0 ? (
            <div className="p-10 text-center bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl text-xs text-[var(--bn-text-muted)]">
              No hay marcadores para mostrar.
            </div>
          ) : (
            <div className="divide-y divide-[var(--bn-border)] border border-[var(--bn-border)] rounded-2xl bg-[var(--bn-surface-alt)] overflow-hidden">
              {filteredBookmarks.map((b) => (
                <div
                  key={b.id}
                  className="px-4 py-3 hover:bg-[var(--bn-hover)] flex items-center justify-between gap-4 group transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => onNavigate(b.url)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="text-xs font-medium text-[var(--bn-text-strong)] truncate group-hover:text-[var(--bn-accent)]">
                      {b.title}
                    </div>
                    <div className="text-[11px] text-[var(--bn-text-muted)] truncate font-mono mt-0.5">
                      {b.url}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveBookmark(b.id)}
                    title="Eliminar marcador"
                    className="p-1.5 text-[var(--bn-text-muted)] hover:text-[var(--bn-danger-text)] rounded-full"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. DESCARGAS (fabinav://downloads)
  if (cleanUrl.includes('downloads')) {
    return (
      <div className="w-full h-full overflow-y-auto bg-[var(--bn-surface)] text-[var(--bn-text)] p-6 sm:p-10">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-4 pb-5 border-b border-[var(--bn-border)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--bn-accent-soft)] text-[var(--bn-accent)] flex items-center justify-center">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[var(--bn-text-strong)]">Descargas</h1>
                <p className="text-xs text-[var(--bn-text-muted)]">
                  Archivos generados y exportados en la sesión actual
                </p>
              </div>
            </div>

            {downloads.length > 0 && (
              <button
                type="button"
                onClick={onClearDownloads}
                className="px-3.5 py-1.5 rounded-full border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] hover:bg-[var(--bn-hover)] text-xs text-[var(--bn-danger-text)] font-medium"
              >
                Limpiar lista
              </button>
            )}
          </div>

          {downloads.length === 0 ? (
            <div className="p-12 text-center bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl text-xs text-[var(--bn-text-muted)] space-y-2">
              <Download className="w-6 h-6 mx-auto text-[var(--bn-text-muted)] opacity-60" />
              <p>Aún no has descargado ni exportado archivos en esta sesión.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--bn-border)] border border-[var(--bn-border)] rounded-2xl bg-[var(--bn-surface-alt)] overflow-hidden">
              {downloads.map((d) => (
                <div key={d.id} className="px-4 py-3.5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[var(--bn-text-strong)] truncate">
                      {d.filename}
                    </div>
                    <div className="text-[11px] text-[var(--bn-text-muted)] font-mono mt-0.5 tabular-nums">
                      {d.fileSize} · {new Date(d.timestamp).toLocaleTimeString(dateLocale)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveDownload(d.id)}
                    className="p-1.5 text-[var(--bn-text-muted)] hover:text-[var(--bn-danger-text)] rounded-full"
                    title="Quitar de la lista"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. HISTORIAL REAL (fabinav://history)
  if (cleanUrl.includes('history')) {
    const filteredHistory = historyEntries.filter(
      (h) =>
        h.title.toLowerCase().includes(historyFilter.toLowerCase()) ||
        h.url.toLowerCase().includes(historyFilter.toLowerCase())
    );

    return (
      <div className="w-full h-full overflow-y-auto bg-[var(--bn-surface)] text-[var(--bn-text)] p-6 sm:p-10">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[var(--bn-border)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--bn-accent-soft)] text-[var(--bn-accent)] flex items-center justify-center">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[var(--bn-text-strong)]">Historial</h1>
                <p className="text-xs text-[var(--bn-text-muted)]">
                  Registro local de páginas visitadas en tus pestañas normales
                </p>
              </div>
            </div>

            {historyEntries.length > 0 && (
              <button
                type="button"
                onClick={onClearHistory}
                className="px-4 py-1.5 bg-[var(--bn-surface-alt)] hover:bg-[var(--bn-hover)] text-[var(--bn-danger-text)] text-xs font-medium rounded-full flex items-center gap-1.5 border border-[var(--bn-border)] shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Borrar datos de navegación</span>
              </button>
            )}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-[var(--bn-text-muted)] absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder="Buscar en el historial..."
              value={historyFilter}
              onChange={(e) => setHistoryFilter(e.target.value)}
              className="w-full bg-[var(--bn-omnibox)] border border-[var(--bn-border)] rounded-full pl-10 pr-4 py-2 text-xs text-[var(--bn-text-strong)] placeholder-[var(--bn-text-muted)] focus:outline-none focus:border-[var(--bn-accent)]"
            />
          </div>

          {filteredHistory.length === 0 ? (
            <div className="p-12 text-center bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl text-xs text-[var(--bn-text-muted)]">
              Tu historial está vacío. Las páginas que visites aparecerán aquí.
            </div>
          ) : (
            <div className="divide-y divide-[var(--bn-border)] border border-[var(--bn-border)] rounded-2xl bg-[var(--bn-surface-alt)] overflow-hidden">
              {filteredHistory.map((item) => (
                <div
                  key={item.id}
                  className="px-4 py-3 hover:bg-[var(--bn-hover)] flex items-center justify-between group transition-colors"
                >
                  <div onClick={() => onNavigate(item.url)} className="flex-1 min-w-0 cursor-pointer pr-4">
                    <div className="text-xs font-medium text-[var(--bn-text-strong)] truncate group-hover:text-[var(--bn-accent)]">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-[var(--bn-text-muted)] truncate flex items-center gap-2 mt-0.5 font-mono tabular-nums">
                      <span className="truncate">{item.url}</span>
                      <span aria-hidden="true">·</span>
                      <span className="shrink-0">{item.timeFormatted}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteHistoryItem(item.id)}
                    title="Eliminar registro"
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-[var(--bn-text-muted)] hover:text-[var(--bn-danger-text)] rounded-full transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4. ESCUDOS, COOKIES Y PROTECCIÓN TLS (fabinav://shields)
  if (cleanUrl.includes('shields')) {
    const filteredCookies = cookies.filter(
      (c) =>
        c.domain.toLowerCase().includes(cookieFilter.toLowerCase()) ||
        c.name.toLowerCase().includes(cookieFilter.toLowerCase())
    );

    return (
      <div className="w-full h-full overflow-y-auto bg-[var(--bn-surface)] text-[var(--bn-text)] p-6 sm:p-10">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[var(--bn-border)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--bn-accent-soft)] text-[var(--bn-accent)] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[var(--bn-text-strong)]">
                  Escudos, Cookies, Caché y TLS
                </h1>
                <p className="text-xs text-[var(--bn-text-muted)]">
                  Protección contra rastreadores, verificación TLS 1.2/1.3, caché web y cookies persistentes (normal) o efímeras (privada)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onUpdateShieldState({ enabled: !shieldState.enabled })}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                shieldState.enabled
                  ? 'bg-[var(--bn-accent)] text-white'
                  : 'bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] text-[var(--bn-text-muted)]'
              }`}
            >
              {shieldState.enabled ? 'Protección activada' : 'Protección pausada'}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl">
              <div className="text-[11px] text-[var(--bn-text-muted)]">Rastreadores bloq.</div>
              <div className="text-xl font-semibold text-[var(--bn-accent)] mt-1 tabular-nums font-mono">
                {shieldState.trackersBlockedCount}
              </div>
            </div>
            <div className="p-4 bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl">
              <div className="text-[11px] text-[var(--bn-text-muted)]">Cookies bloqueadas</div>
              <div className="text-xl font-semibold text-[var(--bn-text-strong)] mt-1 tabular-nums font-mono">
                {shieldState.cookiesBlockedCount}
              </div>
            </div>
            <div className="p-4 bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl">
              <div className="text-[11px] text-[var(--bn-text-muted)]">Mejoras HTTPS/TLS</div>
              <div className="text-xl font-semibold text-[var(--bn-success-text)] mt-1 tabular-nums font-mono">
                {shieldState.httpsUpgradesCount}
              </div>
            </div>
            <div className="p-4 bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl">
              <div className="text-[11px] text-[var(--bn-text-muted)]">Búsquedas privadas</div>
              <div className="text-xl font-semibold text-[var(--bn-text-strong)] mt-1 tabular-nums font-mono">
                {shieldState.searchesCount}
              </div>
            </div>
          </div>

          <div className="bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl divide-y divide-[var(--bn-border)]">
            <div className="flex items-center justify-between p-4 gap-4">
              <div>
                <div className="text-xs font-medium text-[var(--bn-text-strong)]">
                  Bloqueo de rastreadores y anuncios
                </div>
                <div className="text-[11px] text-[var(--bn-text-muted)]">
                  Filtra scripts y píxeles de seguimiento antes de renderizar cada página
                </div>
              </div>
              <select
                value={shieldState.blockTrackersAndAds}
                onChange={(e) =>
                  onUpdateShieldState({
                    blockTrackersAndAds: e.target.value as FabiShieldState['blockTrackersAndAds']
                  })
                }
                className="bg-[var(--bn-omnibox)] border border-[var(--bn-border-strong)] rounded-xl px-3 py-1.5 text-xs text-[var(--bn-text-strong)]"
              >
                <option value="standard">Estándar</option>
                <option value="aggressive">Agresivo</option>
                <option value="disabled">Desactivado</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-4 gap-4">
              <div>
                <div className="text-xs font-medium text-[var(--bn-text-strong)] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[var(--bn-success-text)]" />
                  <span>Verificación estricta TLS 1.2 / 1.3</span>
                </div>
                <div className="text-[11px] text-[var(--bn-text-muted)]">
                  Rechaza certificados inválidos o cifrados obsoletos al abrir páginas HTTPS
                </div>
              </div>
              <FabiSwitch
                size="md"
                checked={shieldState.strictTls}
                onChange={(v) => onUpdateShieldState({ strictTls: v })}
                ariaLabel="Verificación estricta TLS"
              />
            </div>

            <div className="flex items-center justify-between p-4 gap-4">
              <div>
                <div className="text-xs font-medium text-[var(--bn-text-strong)]">
                  Actualizar conexiones a HTTPS
                </div>
                <div className="text-[11px] text-[var(--bn-text-muted)]">
                  Convierte automáticamente direcciones http:// a https:// al navegar
                </div>
              </div>
              <FabiSwitch
                size="md"
                checked={shieldState.upgradeHttps}
                onChange={(v) => onUpdateShieldState({ upgradeHttps: v })}
                ariaLabel="Actualizar conexiones a HTTPS"
              />
            </div>

            <div className="flex items-center justify-between p-4 gap-4">
              <div>
                <div className="text-xs font-medium text-[var(--bn-text-strong)]">
                  Bloquear cookies entre sitios y de rastreo
                </div>
                <div className="text-[11px] text-[var(--bn-text-muted)]">
                  Impide que cookies de terceros o analíticas se guarden en tu sesión
                </div>
              </div>
              <FabiSwitch
                size="md"
                checked={shieldState.blockCrossSiteCookies}
                onChange={(v) => onUpdateShieldState({ blockCrossSiteCookies: v })}
                ariaLabel="Bloquear cookies entre sitios"
              />
            </div>
          </div>

          {/* Brave-style Content Filter Lists & Custom Rules */}
          {(() => {
            const activeLists = shieldState.filterLists ?? ['core-trackers', 'cookie-notices', 'url-tracking'];
            const activeCustomRules = shieldState.customFilterRules ?? [];
            const isFiltersHighlighted = cleanUrl.endsWith('#filtros');

            const handleToggleList = (listId: string) => {
              const exists = activeLists.includes(listId);
              const next = exists
                ? activeLists.filter((id) => id !== listId)
                : [...activeLists, listId];
              onUpdateShieldState({ filterLists: next });
            };

            const handleAddCustomRule = (e: React.FormEvent) => {
              e.preventDefault();
              const trimmed = customRuleInput.trim();
              if (!trimmed) return;
              if (!activeCustomRules.includes(trimmed)) {
                onUpdateShieldState({ customFilterRules: [...activeCustomRules, trimmed] });
              }
              setCustomRuleInput('');
            };

            const handleRemoveCustomRule = (rule: string) => {
              onUpdateShieldState({
                customFilterRules: activeCustomRules.filter((r) => r !== rule)
              });
            };

            return (
              <div
                ref={filtersSectionRef}
                className={`bg-[var(--bn-surface-alt)] rounded-2xl overflow-hidden border transition-colors ${
                  isFiltersHighlighted ? 'border-[var(--bn-accent)]' : 'border-[var(--bn-border)]'
                }`}
              >
                <div className="p-4 border-b border-[var(--bn-border)] flex items-start gap-2.5">
                  <Filter className="w-4 h-4 text-[var(--bn-accent)] mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-[var(--bn-text-strong)]">
                      {t(lang, 'manageFiltersTitle')}
                    </div>
                    <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                      {t(lang, 'manageFiltersDesc')}
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-[var(--bn-border)]">
                  {FABI_FILTER_LISTS.map((item) => {
                    const enabled = activeLists.includes(item.id);
                    return (
                      <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-[var(--bn-text-strong)] flex items-center gap-2">
                            <span className="truncate">{item.name[lang]}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bn-toolbar)] border border-[var(--bn-border)] text-[var(--bn-text-muted)] shrink-0">
                              {item.sourceTag}
                            </span>
                          </div>
                          <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                            {item.desc[lang]}
                          </div>
                        </div>
                        <FabiSwitch
                          size="md"
                          checked={enabled}
                          onChange={() => handleToggleList(item.id)}
                          ariaLabel={item.name[lang]}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 border-t border-[var(--bn-border)] bg-[var(--bn-surface)]/45 space-y-3">
                  <form onSubmit={handleAddCustomRule} className="flex gap-2">
                    <input
                      type="text"
                      value={customRuleInput}
                      onChange={(e) => setCustomRuleInput(e.target.value)}
                      placeholder={t(lang, 'customRulesPlaceholder')}
                      className="flex-1 bg-[var(--bn-omnibox)] border border-[var(--bn-border-strong)] rounded-xl px-3 py-1.5 text-xs text-[var(--bn-text-strong)] placeholder-[var(--bn-text-muted)] focus:outline-none focus:border-[var(--bn-accent)]"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white text-xs font-medium flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t(lang, 'addRuleBtn')}</span>
                    </button>
                  </form>

                  {activeCustomRules.length > 0 && (
                    <div className="divide-y divide-[var(--bn-border)] border border-[var(--bn-border)] rounded-xl bg-[var(--bn-surface-alt)] overflow-hidden">
                      {activeCustomRules.map((rule) => (
                        <div
                          key={rule}
                          className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="font-mono text-[11px] text-[var(--bn-text-strong)] truncate">
                            {rule}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomRule(rule)}
                            className="p-1 text-[var(--bn-text-muted)] hover:text-[var(--bn-danger-text)] rounded-full shrink-0"
                            title={t(lang, 'tabClose')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Live TLS Certificate Inspector Tool */}
          <div className="bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-[var(--bn-success-text)]" />
              <span className="text-xs font-semibold text-[var(--bn-text-strong)]">
                Inspector TLS en vivo
              </span>
            </div>

            <form onSubmit={handleInspectTls} className="flex gap-2">
              <input
                type="text"
                value={tlsProbeHost}
                onChange={(e) => setTlsProbeHost(e.target.value)}
                placeholder="Dominio o URL HTTPS (ej. github.com)"
                className="flex-1 bg-[var(--bn-omnibox)] border border-[var(--bn-border-strong)] rounded-xl px-3 py-1.5 text-xs text-[var(--bn-text-strong)] focus:outline-none focus:border-[var(--bn-accent)]"
              />
              <button
                type="submit"
                disabled={tlsProbeLoading}
                className="px-4 py-1.5 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] disabled:opacity-60 text-white text-xs font-medium whitespace-nowrap"
              >
                {tlsProbeLoading ? 'Analizando...' : 'Inspeccionar TLS'}
              </button>
            </form>

            {tlsProbeResult && (
              <div className="pt-2 border-t border-[var(--bn-border)] grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div>
                  <span className="text-[var(--bn-text-muted)]">Host: </span>
                  <span className="font-mono text-[var(--bn-text-strong)]">{tlsProbeResult.host}</span>
                </div>
                <div>
                  <span className="text-[var(--bn-text-muted)]">Estado: </span>
                  <span
                    className={
                      tlsProbeResult.authorized
                        ? 'text-[var(--bn-success-text)] font-medium'
                        : 'text-[var(--bn-warning-text)] font-medium'
                    }
                  >
                    {tlsProbeResult.authorized
                      ? 'Certificado válido'
                      : tlsProbeResult.authorizationError || 'No verificado'}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--bn-text-muted)]">Protocolo: </span>
                  <span className="font-mono text-[var(--bn-text-strong)]">
                    {tlsProbeResult.protocol || 'N/A'}
                  </span>
                  {tlsProbeResult.alpnProtocol ? ` (${tlsProbeResult.alpnProtocol})` : ''}
                </div>
                <div className="truncate">
                  <span className="text-[var(--bn-text-muted)]">Cifrado: </span>
                  <span className="font-mono text-[var(--bn-text-strong)]">
                    {tlsProbeResult.cipher || 'N/A'}
                  </span>
                </div>
                <div className="truncate">
                  <span className="text-[var(--bn-text-muted)]">Emisor: </span>
                  <span className="text-[var(--bn-text-strong)]">
                    {tlsProbeResult.issuerO || tlsProbeResult.issuerCN || 'N/A'}
                  </span>
                </div>
                {tlsProbeResult.validTo && (
                  <div className="tabular-nums">
                    <span className="text-[var(--bn-text-muted)]">Expira: </span>
                    <span className="text-[var(--bn-text-strong)]">
                      {new Date(tlsProbeResult.validTo).toLocaleDateString(dateLocale)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Real Partitioned Cookie Jar Manager */}
          <div className="bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-[var(--bn-border)] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Cookie className="w-4 h-4 text-[var(--bn-accent)]" />
                  <div>
                    <span className="text-xs font-semibold text-[var(--bn-text-strong)] tabular-nums">
                      Almacén de Cookies ({filteredCookies.length})
                    </span>
                    <div className="text-[10px] text-[var(--bn-text-muted)]">
                      {cookiePartition === 'normal'
                        ? 'Partición normal · Guardado persistente en disco'
                        : 'Partición privada · Solo en RAM (se destruye al cerrar)'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex rounded-full bg-[var(--bn-omnibox)] p-0.5 border border-[var(--bn-border)] text-[11px]">
                    <button
                      type="button"
                      onClick={() => setCookiePartition('normal')}
                      className={`px-3 py-1 rounded-full font-medium transition-colors ${
                        cookiePartition === 'normal'
                          ? 'bg-[var(--bn-accent)] text-white'
                          : 'text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)]'
                      }`}
                    >
                      Sesión normal
                    </button>
                    <button
                      type="button"
                      onClick={() => setCookiePartition('private')}
                      className={`px-3 py-1 rounded-full font-medium transition-colors ${
                        cookiePartition === 'private'
                          ? 'bg-[var(--bn-private)] text-white'
                          : 'text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)]'
                      }`}
                    >
                      Privada
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => fetchCookies(cookiePartition)}
                    title="Actualizar cookies"
                    className="p-1.5 rounded-full hover:bg-[var(--bn-hover)] text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)]"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${loadingCookies ? 'animate-spin' : ''}`} />
                  </button>

                  {cookies.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearCookies}
                      className="px-3 py-1 rounded-full bg-[var(--bn-toolbar)] hover:bg-[var(--bn-hover)] border border-[var(--bn-border)] text-[11px] text-[var(--bn-danger-text)] font-medium"
                    >
                      Borrar todas
                    </button>
                  )}
                </div>
              </div>

              {cookies.length > 0 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[var(--bn-text-muted)] absolute left-3 top-2" />
                  <input
                    type="text"
                    placeholder="Filtrar cookies por dominio o nombre..."
                    value={cookieFilter}
                    onChange={(e) => setCookieFilter(e.target.value)}
                    className="w-full bg-[var(--bn-omnibox)] border border-[var(--bn-border)] rounded-full pl-8 pr-3 py-1.5 text-xs text-[var(--bn-text-strong)] placeholder-[var(--bn-text-muted)] focus:outline-none focus:border-[var(--bn-accent)]"
                  />
                </div>
              )}
            </div>

            {filteredCookies.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--bn-text-muted)]">
                {cookies.length === 0
                  ? `No hay cookies almacenadas en la partición ${
                      cookiePartition === 'private' ? 'privada' : 'normal'
                    }.`
                  : 'Ninguna cookie coincide con tu filtro.'}
              </div>
            ) : (
              <div className="divide-y divide-[var(--bn-border)] max-h-80 overflow-y-auto">
                {filteredCookies.map((cookie) => (
                  <div
                    key={cookie.id}
                    className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-[var(--bn-hover)]/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[var(--bn-text-strong)] truncate">
                          {cookie.domain}
                        </span>
                        <span aria-hidden="true" className="text-[var(--bn-text-muted)]">
                          ·
                        </span>
                        <span className="font-mono text-[11px] text-[var(--bn-accent)] truncate">
                          {cookie.name}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-[var(--bn-text-muted)] font-mono">
                        <span>Path: {cookie.path}</span>
                        {cookie.secure && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-[var(--bn-success-text)]">Secure</span>
                          </>
                        )}
                        {cookie.httpOnly && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-[var(--bn-info-text)]">HttpOnly</span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span>SameSite={cookie.sameSite}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteCookie(cookie.id)}
                      title="Eliminar cookie"
                      className="p-1.5 text-[var(--bn-text-muted)] hover:text-[var(--bn-danger-text)] rounded-full shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Real Proxy & Search Cache Manager */}
          <div className="bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-[var(--bn-border)] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-[var(--bn-accent)]" />
                <div>
                  <div className="text-xs font-semibold text-[var(--bn-text-strong)] tabular-nums">
                    Caché de navegación y búsquedas ({(cacheInfo?.proxyCount || 0) + (cacheInfo?.searchCount || 0)})
                  </div>
                  <div className="text-[10px] text-[var(--bn-text-muted)] tabular-nums">
                    {cacheInfo?.proxyCount || 0} página(s) web · {cacheInfo?.searchCount || 0} búsqueda(s) ·{' '}
                    {formatBytes(cacheInfo?.totalBytes || 0)} en memoria
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchCacheStatus}
                  title="Actualizar caché"
                  className="p-1.5 rounded-full hover:bg-[var(--bn-hover)] text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)]"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${loadingCache ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={handleClearCache}
                  disabled={loadingCache}
                  className="px-3 py-1 rounded-full bg-[var(--bn-toolbar)] hover:bg-[var(--bn-hover)] border border-[var(--bn-border)] text-[11px] text-[var(--bn-danger-text)] font-medium disabled:opacity-60"
                >
                  Vaciar caché
                </button>
              </div>
            </div>

            {cacheNotice && (
              <div className="px-4 py-2 text-[11px] text-[var(--bn-text-strong)] bg-[var(--bn-surface)] border-b border-[var(--bn-border)]">
                {cacheNotice}
              </div>
            )}

            {!cacheInfo || cacheInfo.entries.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--bn-text-muted)]">
                La caché está vacía. Las páginas normales y búsquedas recientes se guardan temporalmente para acelerar recargas.
              </div>
            ) : (
              <div className="divide-y divide-[var(--bn-border)] max-h-60 overflow-y-auto">
                {cacheInfo.entries.map((entry, idx) => (
                  <div
                    key={`${entry.kind}-${entry.cachedAt}-${idx}`}
                    className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                            entry.kind === 'page'
                              ? 'bg-[var(--bn-accent-soft)] text-[var(--bn-accent)]'
                              : 'bg-[var(--bn-toolbar)] text-[var(--bn-text-muted)]'
                          }`}
                        >
                          {entry.kind === 'page' ? 'Web' : 'Búsqueda'}
                        </span>
                        <span className="font-mono text-[11px] text-[var(--bn-text-strong)] truncate">
                          {entry.label}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] text-[var(--bn-text-muted)] font-mono tabular-nums shrink-0">
                      {formatBytes(entry.sizeBytes)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 5. ACERCA DE FABINAV (fabinav://about)
  if (cleanUrl.includes('about')) {
    const shortcuts = [
      { keys: 'Ctrl + T', desc: 'Nueva pestaña' },
      { keys: 'Ctrl + W', desc: 'Cerrar pestaña actual' },
      { keys: 'Ctrl + Shift + T', desc: 'Reabrir última pestaña cerrada' },
      { keys: 'Ctrl + L', desc: 'Enfocar barra de direcciones' },
      { keys: 'Ctrl + K', desc: 'Abrir paleta de comandos' },
      { keys: 'Ctrl + B', desc: 'Mostrar u ocultar barra lateral' },
      { keys: 'Ctrl + \\', desc: 'Alternar vista dividida' },
      { keys: 'Ctrl + H', desc: 'Abrir historial' },
      { keys: 'F12', desc: 'Herramientas para desarrolladores' }
    ];

    return (
      <div className="w-full h-full overflow-y-auto bg-[var(--bn-surface)] text-[var(--bn-text)] p-6 sm:p-10">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between pb-5 border-b border-[var(--bn-border)]">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-2xl text-white flex items-center justify-center font-bold text-lg shadow"
                style={{ background: 'var(--fabi-gradient-brand)' }}
              >
                F
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[var(--bn-text-strong)]">
                  {t(lang, 'secAbout')}
                </h1>
                <p className="text-xs text-[var(--bn-text-muted)] font-mono tabular-nums">
                  v{APP_VERSION} · Escudos FabiNav + TLS 1.2/1.3 + Search
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('fabinav://settings')}
              className="px-4 py-1.5 bg-[var(--bn-surface-alt)] hover:bg-[var(--bn-hover)] border border-[var(--bn-border)] rounded-full text-xs font-medium text-[var(--bn-text-strong)]"
            >
              {t(lang, 'menuSettings')}
            </button>
          </div>

          <div className="p-5 bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--bn-text-strong)]">
              <Info className="w-4 h-4 text-[var(--bn-accent)]" />
              <span>FabiNav v{APP_VERSION}</span>
            </div>
            <p className="text-xs text-[var(--bn-text-muted)] leading-relaxed">
              FabiNav es un navegador web moderno con búsqueda en vivo, proxy seguro con cookies particionadas e inspección TLS 1.2/1.3, listas de filtros personalizables, perfil conectado con Google y empaquetado Electron con actualizaciones automáticas por GitHub Releases.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleDesktopCheckUpdates}
                className="px-4 py-1.5 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white text-xs font-medium inline-flex items-center gap-1.5"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>{t(lang, 'checkUpdatesBtn')}</span>
              </button>
              {desktopUpdateReady && (
                <button
                  type="button"
                  onClick={() => window.fabinavDesktop?.installUpdate()}
                  className="px-4 py-1.5 rounded-full bg-[var(--bn-success)] text-white text-xs font-medium"
                >
                  {t(lang, 'restartInstallBtn')}
                </button>
              )}
            </div>
            {desktopActionMsg && (
              <p className="text-[11px] text-[var(--bn-text-strong)] bg-[var(--bn-surface)] border border-[var(--bn-border)] rounded-xl px-3 py-2">
                {desktopActionMsg}
              </p>
            )}
          </div>

          <div className="p-5 bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl space-y-3">
            <h2 className="text-sm font-semibold text-[var(--bn-text-strong)]">Atajos de teclado</h2>
            <div className="divide-y divide-[var(--bn-border)] border border-[var(--bn-border)] rounded-xl bg-[var(--bn-surface)] overflow-hidden">
              {shortcuts.map((s) => (
                <div key={s.keys} className="px-4 py-2.5 flex items-center justify-between text-xs">
                  <span className="text-[var(--bn-text)]">{s.desc}</span>
                  <kbd className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-[var(--bn-surface-alt)] border border-[var(--bn-border-strong)] text-[var(--bn-text-strong)]">
                    {s.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 6. CONFIGURACIÓN DE FABINAV (fabinav://settings — estilo escritorio Chrome)
  const navGroups: Array<
    Array<{
      id: SettingsSection;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
    }>
  > = [
    [
      { id: 'tu-google', label: t(lang, 'secYouAndGoogle'), icon: User },
      { id: 'escudos', label: t(lang, 'secPrivacy'), icon: ShieldCheck },
      { id: 'apariencia', label: t(lang, 'secDesign'), icon: Palette },
      { id: 'idiomas', label: t(lang, 'secLanguages'), icon: Languages },
      { id: 'buscador', label: t(lang, 'secSearchEngine'), icon: Search },
      { id: 'al-iniciar', label: t(lang, 'secOnStartup'), icon: Power }
    ],
    [
      { id: 'descargas', label: t(lang, 'secDownloads'), icon: Download },
      { id: 'datos', label: t(lang, 'secSystemCache'), icon: HardDrive },
      { id: 'restablecer', label: t(lang, 'secReset'), icon: RotateCcw }
    ],
    [{ id: 'acerca', label: t(lang, 'secAbout'), icon: Info }]
  ];

  const themeOptions: Array<{ id: BrowserTheme; label: string; desc: string }> = [
    { id: 'fabi-dark', label: 'FabiNav Oscuro', desc: 'Gris grafito clásico de escritorio' },
    { id: 'fabi-midnight', label: 'Noche Profunda', desc: 'Contraste oscuro intenso para baja luz' },
    { id: 'fabi-light', label: 'FabiNav Claro', desc: 'Superficie clara luminosa para uso diurno' }
  ];

  const queryNorm = settingsSearch.trim().toLowerCase();
  const matchesQuery = (...keywords: string[]) =>
    !queryNorm || keywords.some((k) => k.toLowerCase().includes(queryNorm));

  const showSection = (sec: SettingsSection, ...keywords: string[]) =>
    queryNorm ? matchesQuery(...keywords) : settingsSection === sec;

  const hasAnySearchMatch =
    !queryNorm ||
    matchesQuery(
      'google',
      'perfil',
      'cuenta',
      'sincronizacion',
      'importar',
      'favoritos',
      'escudos',
      'privacidad',
      'seguridad',
      'rastreadores',
      'tls',
      'https',
      'cookies',
      'huellas',
      'borrar',
      'diseño',
      'apariencia',
      'tema',
      'inicio',
      'marcadores',
      'pestañas',
      'verticales',
      'zoom',
      'barra lateral',
      'idioma',
      'idiomas',
      'language',
      'languages',
      'español',
      'english',
      'japanese',
      '日本語',
      '言語',
      'buscador',
      'motor',
      'al iniciar',
      'homepage',
      'descargas',
      'respaldo',
      'json',
      'electron',
      'sistema',
      'cache',
      'caché',
      'restablecer',
      'acerca',
      'actualizaciones',
      'atajos'
    );

  return (
    <div className="w-full h-full overflow-hidden bg-[var(--bn-surface)] text-[var(--bn-text)] flex flex-col">
      {/* Hidden Backup File Picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImportBackup(file);
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* Chrome-style Settings Top Header Bar with Search */}
      <div className="h-14 px-4 sm:px-6 border-b border-[var(--bn-border)] bg-[var(--bn-toolbar)]/75 flex items-center gap-4 shrink-0">
        <div className="md:w-60 flex items-center gap-3 shrink-0">
          <div
            className="w-7 h-7 rounded-full text-white flex items-center justify-center shadow-xs shrink-0"
            style={{ background: 'var(--fabi-gradient-brand)' }}
          >
            <Compass className="w-4 h-4" />
          </div>
          <h1 className="text-[16px] font-semibold text-[var(--bn-text-strong)] tracking-tight">
            {t(lang, 'settingsTitle')}
          </h1>
        </div>

        <div className="flex-1 flex justify-center">
          <div className="relative w-full max-w-xl">
            <Search className="w-4 h-4 text-[var(--bn-text-muted)] absolute left-4 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={settingsSearch}
              onChange={(e) => setSettingsSearch(e.target.value)}
              placeholder={t(lang, 'settingsSearchPlaceholder')}
              aria-label={t(lang, 'settingsSearchPlaceholder')}
              className="w-full h-9 bg-[var(--bn-omnibox)] border border-[var(--bn-border-strong)] rounded-full pl-11 pr-9 text-xs text-[var(--bn-text-strong)] placeholder-[var(--bn-text-muted)] focus:outline-none focus:border-[var(--bn-accent)] transition-colors"
            />
            {settingsSearch && (
              <button
                type="button"
                onClick={() => setSettingsSearch('')}
                title="Limpiar búsqueda"
                className="absolute right-2.5 top-2 p-0.5 rounded-full text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="hidden lg:block md:w-28 shrink-0" />
      </div>

      {/* Body: Left Rail + Main Single-Column Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <aside className="w-full md:w-64 bg-[var(--bn-surface)] border-b md:border-b-0 md:border-r border-[var(--bn-border)] px-3 py-3 flex md:flex-col gap-1 overflow-x-auto md:overflow-y-auto shrink-0">
          {navGroups.map((group, gIdx) => (
            <React.Fragment key={gIdx}>
              {gIdx > 0 && (
                <div className="hidden md:block h-[1px] bg-[var(--bn-border)] my-1.5 mx-2" />
              )}
              {group.map((sec) => {
                const Icon = sec.icon;
                const active = !queryNorm && settingsSection === sec.id;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => {
                      setSettingsSearch('');
                      setConfirmReset(false);
                      setSettingsSection(sec.id);
                    }}
                    className={`relative flex items-center gap-3 px-3.5 py-2 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors ${
                      active
                        ? 'text-[var(--bn-accent)] bg-[var(--bn-accent-soft)]'
                        : 'text-[var(--bn-text)] hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{sec.label}</span>
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </aside>

        <div className="flex-1 overflow-y-auto p-5 sm:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={queryNorm ? `search-${queryNorm}` : settingsSection}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15, ease: FABI_EASE_OUT }}
              className="max-w-2xl mx-auto space-y-6 pb-10"
            >
              {queryNorm && (
                <div className="text-xs text-[var(--bn-text-muted)]">
                  {t(lang, 'settingsSearchResultsFor')}{' '}
                  <span className="text-[var(--bn-text-strong)] font-medium">
                    «{settingsSearch.trim()}»
                  </span>
                </div>
              )}

              {!hasAnySearchMatch && (
                <div className="p-10 text-center bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl text-xs text-[var(--bn-text-muted)]">
                  {t(lang, 'settingsNoResults')} «{settingsSearch.trim()}».
                </div>
              )}

              {/* 1. TÚ Y GOOGLE */}
              {showSection(
                'tu-google',
                'google',
                'perfil',
                'cuenta',
                'sincronizacion',
                'importar',
                'favoritos',
                'respaldo'
              ) && (
                <section className="space-y-2.5">
                  <h2 className="text-[14px] font-semibold text-[var(--bn-text-strong)] px-1">
                    Tú y Google
                  </h2>

                  <div className="bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-xl divide-y divide-[var(--bn-border)] text-xs overflow-hidden">
                    {/* Profile Row */}
                    <div className="px-5 py-4 flex items-center justify-between gap-4">
                      {googleUser ? (
                        <>
                          <div className="flex items-center gap-3.5 min-w-0">
                            {googleUser.photoUrl ? (
                              <img
                                src={googleUser.photoUrl}
                                alt={googleUser.displayName}
                                referrerPolicy="no-referrer"
                                className="w-11 h-11 rounded-full object-cover border border-[var(--bn-border-strong)] shrink-0"
                              />
                            ) : (
                              <div className="w-11 h-11 rounded-full bg-[var(--bn-accent)] text-white flex items-center justify-center font-bold text-sm shrink-0">
                                {googleUser.displayName[0]?.toUpperCase() || 'G'}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-[13px] font-semibold text-[var(--bn-text-strong)] truncate">
                                {googleUser.displayName}
                              </div>
                              <div className="text-[11px] text-[var(--bn-text-muted)] truncate mt-0.5">
                                Conectado con {googleUser.email}
                              </div>
                            </div>
                          </div>
                          {onGoogleSignOut && (
                            <button
                              type="button"
                              onClick={onGoogleSignOut}
                              className="px-4 py-1.5 rounded-full border border-[var(--bn-border-strong)] hover:bg-[var(--bn-hover)] text-xs font-medium text-[var(--bn-accent)] shrink-0 transition-colors"
                            >
                              Desactivar
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-11 h-11 rounded-full bg-[var(--bn-toolbar)] border border-[var(--bn-border-strong)] flex items-center justify-center text-[var(--bn-text-muted)] shrink-0">
                              <User className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[13px] font-semibold text-[var(--bn-text-strong)]">
                                Conectar cuenta de Google
                              </div>
                              <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                                Obtén tu foto y nombre oficial directamente desde Google
                              </div>
                            </div>
                          </div>
                          {onGoogleSignIn && (
                            <button
                              type="button"
                              onClick={onGoogleSignIn}
                              className="px-4 py-1.5 rounded-full bg-white text-[#1f1f1f] hover:bg-[#f1f3f4] border border-[#dadce0] font-medium text-xs shrink-0 transition-colors"
                            >
                              Iniciar sesión
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {/* Manage Google Account Row */}
                    <button
                      type="button"
                      onClick={() => onNavigate('https://myaccount.google.com')}
                      className="w-full px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-[var(--bn-hover)] text-left transition-colors"
                    >
                      <div>
                        <div className="font-medium text-[var(--bn-text-strong)]">
                          Administrar tu Cuenta de Google
                        </div>
                        <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                          Seguridad, privacidad y datos de tu cuenta en google.com
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-[var(--bn-text-muted)] shrink-0" />
                    </button>

                    {/* Import Bookmarks & Config */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-[var(--bn-hover)] text-left transition-colors"
                    >
                      <div>
                        <div className="font-medium text-[var(--bn-text-strong)]">
                          Importar favoritos y configuración
                        </div>
                        <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                          Restaura un respaldo local .json de FabiNav
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[var(--bn-text-muted)] shrink-0" />
                    </button>

                    {/* Export Backup */}
                    <button
                      type="button"
                      onClick={onExportBackup}
                      className="w-full px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-[var(--bn-hover)] text-left transition-colors"
                    >
                      <div>
                        <div className="font-medium text-[var(--bn-text-strong)]">
                          Exportar marcadores y ajustes (.json)
                        </div>
                        <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                          Guarda una copia completa de tus datos en este dispositivo
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[var(--bn-text-muted)] shrink-0" />
                    </button>
                  </div>
                </section>
              )}

              {/* 2. PRIVACIDAD Y SEGURIDAD (ESCUDOS) */}
              {showSection(
                'escudos',
                'escudos',
                'privacidad',
                'seguridad',
                'rastreadores',
                'tls',
                'https',
                'cookies',
                'huellas',
                'borrar'
              ) && (
                <section className="space-y-2.5">
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-[14px] font-semibold text-[var(--bn-text-strong)]">
                      Privacidad y seguridad
                    </h2>
                    <button
                      type="button"
                      onClick={() => onNavigate('fabinav://shields')}
                      className="text-xs text-[var(--bn-accent)] hover:underline flex items-center gap-1"
                    >
                      <span>Administrar cookies, caché y TLS</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-xl divide-y divide-[var(--bn-border)] text-xs overflow-hidden">
                    <div className="px-5 py-3.5 flex items-center justify-between gap-4">
                      <div>
                        <div className="font-medium text-[var(--bn-text-strong)]">
                          Bloqueo de rastreadores y anuncios
                        </div>
                        <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                          Filtra scripts y píxeles publicitarios antes de cargar cada sitio
                        </div>
                      </div>
                      <select
                        value={shieldState.blockTrackersAndAds}
                        onChange={(e) =>
                          onUpdateShieldState({
                            blockTrackersAndAds: e.target.value as FabiShieldState['blockTrackersAndAds']
                          })
                        }
                        className="bg-[var(--bn-omnibox)] border border-[var(--bn-border-strong)] rounded-xl px-3 py-1.5 text-xs text-[var(--bn-text-strong)]"
                      >
                        <option value="standard">Estándar</option>
                        <option value="aggressive">Agresivo</option>
                        <option value="disabled">Desactivado</option>
                      </select>
                    </div>

                    <div className="px-5 py-3.5 flex items-center justify-between gap-4">
                      <div>
                        <div className="font-medium text-[var(--bn-text-strong)]">
                          Verificación estricta TLS 1.2 / 1.3
                        </div>
                        <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                          Rechaza certificados inválidos o cifrados débiles al abrir páginas HTTPS
                        </div>
                      </div>
                      <FabiSwitch
                        size="md"
                        checked={shieldState.strictTls}
                        onChange={(v) => onUpdateShieldState({ strictTls: v })}
                        ariaLabel="Verificación estricta TLS"
                      />
                    </div>

                    <div className="px-5 py-3.5 flex items-center justify-between gap-4">
                      <div>
                        <div className="font-medium text-[var(--bn-text-strong)]">
                          Actualizar conexiones a HTTPS
                        </div>
                        <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                          Convierte direcciones http:// a https:// de forma automática
                        </div>
                      </div>
                      <FabiSwitch
                        size="md"
                        checked={shieldState.upgradeHttps}
                        onChange={(v) => onUpdateShieldState({ upgradeHttps: v })}
                        ariaLabel="Actualizar conexiones a HTTPS"
                      />
                    </div>

                    <div className="px-5 py-3.5 flex items-center justify-between gap-4">
                      <div>
                        <div className="font-medium text-[var(--bn-text-strong)]">
                          Protección contra huellas digitales (Fingerprinting)
                        </div>
                        <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                          Enmascara hardware, Canvas, WebGL y Audio en páginas externas
                        </div>
                      </div>
                      <select
                        value={shieldState.blockFingerprinting}
                        onChange={(e) =>
                          onUpdateShieldState({
                            blockFingerprinting: e.target.value as FabiShieldState['blockFingerprinting']
                          })
                        }
                        className="bg-[var(--bn-omnibox)] border border-[var(--bn-border-strong)] rounded-xl px-3 py-1.5 text-xs text-[var(--bn-text-strong)]"
                      >
                        <option value="standard">Estándar</option>
                        <option value="strict">Estricto</option>
                        <option value="disabled">Desactivado</option>
                      </select>
                    </div>

                    <div className="px-5 py-3.5 flex items-center justify-between gap-4">
                      <div>
                        <div className="font-medium text-[var(--bn-text-strong)]">
                          Bloquear cookies entre sitios
                        </div>
                        <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                          Impide el almacenamiento de cookies de terceros y de seguimiento
                        </div>
                      </div>
                      <FabiSwitch
                        size="md"
                        checked={shieldState.blockCrossSiteCookies}
                        onChange={(v) => onUpdateShieldState({ blockCrossSiteCookies: v })}
                        ariaLabel="Bloquear cookies entre sitios"
                      />
                    </div>

                    {onClearBrowsingData && (
                      <button
                        type="button"
                        onClick={onClearBrowsingData}
                        className="w-full px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-[var(--bn-hover)] text-left transition-colors"
                      >
                        <div>
                          <div className="font-medium text-[var(--bn-danger-text)]">
                            Borrar datos de navegación
                          </div>
                          <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                            Elimina historial, caché web/búsquedas y todas las cookies guardadas
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[var(--bn-text-muted)] shrink-0" />
                      </button>
                    )}
                  </div>
                </section>
              )}

              {/* 3. DISEÑO Y APARIENCIA */}
              {showSection(
                'apariencia',
                'diseño',
                'apariencia',
                'tema',
                'oscuro',
                'claro',
                'inicio',
                'marcadores',
                'pestañas',
                'verticales',
                'zoom',
                'barra lateral'
              ) && (
                <section className="space-y-3">
                  <h2 className="text-[14px] font-semibold text-[var(--bn-text-strong)] px-1">
                    Diseño
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {themeOptions.map((t) => {
                      const isSelected =
                        settings.theme === t.id ||
                        (t.id === 'fabi-dark' && settings.theme === 'brave-dark') ||
                        (t.id === 'fabi-midnight' && settings.theme === 'brave-midnight') ||
                        (t.id === 'fabi-light' && settings.theme === 'brave-light');
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => onUpdateSettings({ theme: t.id })}
                          className={`p-4 rounded-xl border text-left transition-colors ${
                            isSelected
                              ? 'bg-[var(--bn-surface-alt)] border-[var(--bn-accent)] text-[var(--bn-text-strong)]'
                              : 'bg-[var(--bn-surface-alt)] border-[var(--bn-border)] text-[var(--bn-text)] hover:border-[var(--bn-border-strong)]'
                          }`}
                        >
                          <div className="text-xs font-semibold flex items-center justify-between">
                            <span>{t.label}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-[var(--bn-accent)]" />}
                          </div>
                          <p className="text-[11px] text-[var(--bn-text-muted)] mt-1">{t.desc}</p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-xl divide-y divide-[var(--bn-border)] text-xs overflow-hidden">
                    <div className="px-5 py-3.5 flex items-center justify-between gap-4">
                      <div>
                        <div className="font-medium text-[var(--bn-text-strong)]">
                          Mostrar botón de página principal
                        </div>
                        <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                          Muestra el icono de Inicio junto a la barra de direcciones
                        </div>
                      </div>
                      <FabiSwitch
                        size="md"
                        checked={settings.showHomeButton}
                        onChange={(v) => onUpdateSettings({ showHomeButton: v })}
                        ariaLabel="Mostrar botón de Inicio"
                      />
                    </div>

                    <div className="px-5 py-3.5 flex items-center justify-between gap-4">
                      <div>
                        <div className="font-medium text-[var(--bn-text-strong)]">
                          Mostrar barra de marcadores
                        </div>
                        <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                          Acceso rápido a tus sitios favoritos debajo de la barra superior
                        </div>
                      </div>
                      <FabiSwitch
                        size="md"
                        checked={settings.showBookmarksBar}
                        onChange={(v) => onUpdateSettings({ showBookmarksBar: v })}
                        ariaLabel="Mostrar barra de marcadores"
                      />
                    </div>

                    <div className="px-5 py-3.5 flex items-center justify-between gap-4">
                      <div>
                        <div className="font-medium text-[var(--bn-text-strong)]">
                          Usar pestañas verticales
                        </div>
                        <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                          Organiza tus pestañas abiertas en una columna lateral
                        </div>
                      </div>
                      <FabiSwitch
                        size="md"
                        checked={settings.useVerticalTabs}
                        onChange={(v) => onUpdateSettings({ useVerticalTabs: v })}
                        ariaLabel="Usar pestañas verticales"
                      />
                    </div>

                    <div className="px-5 py-3.5 flex items-center justify-between gap-4">
                      <div>
                        <div className="font-medium text-[var(--bn-text-strong)]">
                          Zoom de la página
                        </div>
                        <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                          Escala aplicada al visor web incrustado
                        </div>
                      </div>
                      <select
                        value={settings.zoomLevel}
                        onChange={(e) => onUpdateSettings({ zoomLevel: Number(e.target.value) })}
                        className="bg-[var(--bn-omnibox)] border border-[var(--bn-border-strong)] rounded-xl px-3 py-1.5 text-xs text-[var(--bn-text-strong)] tabular-nums"
                      >
                        {[75, 90, 100, 110, 125, 150].map((z) => (
                          <option key={z} value={z}>
                            {z}%
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="px-5 py-3.5 flex items-center justify-between gap-4">
                      <div>
                        <div className="font-medium text-[var(--bn-text-strong)]">
                          Mostrar barra lateral
                        </div>
                        <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                          Acceso rápido a marcadores, historial, notas y mensajería
                        </div>
                      </div>
                      <FabiSwitch
                        size="md"
                        checked={settings.showSidebar}
                        onChange={(v) =>
                          onUpdateSettings({ showSidebar: v, sidebarMode: v ? 'on' : 'off' })
                        }
                        ariaLabel="Mostrar barra lateral"
                      />
                    </div>

                    <div className="px-5 py-3.5 flex items-center justify-between gap-4">
                      <div>
                        <div className="font-medium text-[var(--bn-text-strong)]">
                          Posición de la barra lateral
                        </div>
                        <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                          Elige si se muestra a la derecha o a la izquierda de la ventana
                        </div>
                      </div>
                      <select
                        value={settings.sidebarPosition}
                        onChange={(e) =>
                          onUpdateSettings({
                            sidebarPosition: e.target.value as BrowserSettings['sidebarPosition']
                          })
                        }
                        className="bg-[var(--bn-omnibox)] border border-[var(--bn-border-strong)] rounded-xl px-3 py-1.5 text-xs text-[var(--bn-text-strong)]"
                      >
                        <option value="right">A la derecha</option>
                        <option value="left">A la izquierda</option>
                      </select>
                    </div>
                  </div>
                </section>
              )}

              {/* 3B. IDIOMAS (ES / EN / JA) */}
              {showSection(
                'idiomas',
                'idioma',
                'idiomas',
                'language',
                'languages',
                'español',
                'english',
                'japanese',
                '日本語',
                '言語'
              ) && (
                <section className="space-y-2.5">
                  <h2 className="text-[14px] font-semibold text-[var(--bn-text-strong)] px-1">
                    {t(lang, 'secLanguages')}
                  </h2>

                  <div className="bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-xl divide-y divide-[var(--bn-border)] text-xs overflow-hidden">
                    <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="font-medium text-[var(--bn-text-strong)]">
                          {t(lang, 'languageCardTitle')}
                        </div>
                        <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                          {t(lang, 'languageCardDesc')}
                        </div>
                      </div>
                      <select
                        value={lang}
                        onChange={(e) =>
                          onUpdateSettings({
                            language: e.target.value as BrowserSettings['language']
                          })
                        }
                        aria-label={t(lang, 'languageSelectLabel')}
                        className="bg-[var(--bn-omnibox)] border border-[var(--bn-border-strong)] rounded-xl px-3 py-1.5 text-xs text-[var(--bn-text-strong)]"
                      >
                        {LANGUAGE_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.nativeName} ({opt.englishName})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {LANGUAGE_OPTIONS.map((opt) => {
                        const selected = lang === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => onUpdateSettings({ language: opt.id })}
                            className={`p-3.5 rounded-xl border text-left transition-colors ${
                              selected
                                ? 'bg-[var(--bn-surface)] border-[var(--bn-accent)] text-[var(--bn-text-strong)]'
                                : 'bg-[var(--bn-surface)]/40 border-[var(--bn-border)] text-[var(--bn-text)] hover:border-[var(--bn-border-strong)]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 font-semibold text-xs">
                              <span>{opt.nativeName}</span>
                              {selected && <Check className="w-3.5 h-3.5 text-[var(--bn-accent)] shrink-0" />}
                            </div>
                            <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                              {opt.englishName} · {opt.id.toUpperCase()}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </section>
              )}

              {/* 4. MOTOR DE BÚSQUEDA */}
              {showSection('buscador', 'buscador', 'motor', 'search', 'google', 'duckduckgo', 'bing') && (
                <section className="space-y-2.5">
                  <h2 className="text-[14px] font-semibold text-[var(--bn-text-strong)] px-1">
                    Motor de búsqueda
                  </h2>
                  <div className="bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-xl px-5 py-4 flex items-center justify-between gap-4 text-xs">
                    <div>
                      <div className="font-medium text-[var(--bn-text-strong)]">
                        Buscador utilizado en la barra de direcciones
                      </div>
                      <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                        Se usa también en la barra de búsqueda de Nueva pestaña
                      </div>
                    </div>
                    <select
                      value={
                        settings.defaultSearchEngine === 'brave'
                          ? 'fabinav'
                          : settings.defaultSearchEngine
                      }
                      onChange={(e) =>
                        onUpdateSettings({
                          defaultSearchEngine: e.target.value as BrowserSettings['defaultSearchEngine']
                        })
                      }
                      className="bg-[var(--bn-omnibox)] border border-[var(--bn-border-strong)] rounded-xl px-3 py-1.5 text-xs text-[var(--bn-text-strong)]"
                    >
                      <option value="fabinav">FabiNav Search</option>
                      <option value="google">Google</option>
                      <option value="duckduckgo">DuckDuckGo</option>
                      <option value="bing">Bing</option>
                      <option value="ecosia">Ecosia</option>
                    </select>
                  </div>
                </section>
              )}

              {/* 5. AL INICIAR */}
              {showSection('al-iniciar', 'al iniciar', 'inicio', 'homepage', 'nueva pestaña') && (
                <section className="space-y-2.5">
                  <h2 className="text-[14px] font-semibold text-[var(--bn-text-strong)] px-1">
                    Al iniciar
                  </h2>
                  <div className="bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-xl divide-y divide-[var(--bn-border)] text-xs overflow-hidden">
                    <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="font-medium text-[var(--bn-text-strong)]">
                          Página de inicio
                        </div>
                        <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                          Dirección que se abre al pulsar el botón Inicio o abrir una nueva sesión
                        </div>
                      </div>
                      <input
                        type="text"
                        value={settings.homepage}
                        onChange={(e) => onUpdateSettings({ homepage: e.target.value })}
                        className="w-56 bg-[var(--bn-omnibox)] border border-[var(--bn-border-strong)] rounded-xl px-3 py-1.5 text-xs text-[var(--bn-text-strong)] focus:outline-none focus:border-[var(--bn-accent)]"
                      />
                    </div>
                  </div>
                </section>
              )}

              {/* 6. DESCARGAS Y RESPALDO */}
              {showSection('descargas', 'descargas', 'respaldo', 'json', 'electron', 'exportar', 'importar') && (
                <section className="space-y-2.5">
                  <h2 className="text-[14px] font-semibold text-[var(--bn-text-strong)] px-1">
                    Descargas y respaldo
                  </h2>
                  <div className="bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-xl divide-y divide-[var(--bn-border)] text-xs overflow-hidden">
                    <button
                      type="button"
                      onClick={() => onNavigate('fabinav://downloads')}
                      className="w-full px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-[var(--bn-hover)] text-left transition-colors"
                    >
                      <div>
                        <div className="font-medium text-[var(--bn-text-strong)]">
                          Historial de descargas ({downloads.length})
                        </div>
                        <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                          Ver páginas guardadas, capturas de vista y respaldos exportados
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[var(--bn-text-muted)] shrink-0" />
                    </button>

                    <div className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-[var(--bn-text-strong)]">
                          Exportar respaldo local (.json)
                        </div>
                        <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                          Guarda tus marcadores, sitios principales, notas y configuración
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onExportBackup}
                        className="px-4 py-1.5 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white font-medium flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Exportar JSON</span>
                      </button>
                    </div>

                    <div className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-[var(--bn-text-strong)]">
                          Importar respaldo (.json)
                        </div>
                        <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                          Restaura una copia exportada previamente
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-1.5 rounded-full bg-[var(--bn-toolbar)] hover:bg-[var(--bn-hover)] border border-[var(--bn-border-strong)] text-[var(--bn-text-strong)] font-medium flex items-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Importar JSON</span>
                      </button>
                    </div>

                    <div className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-[var(--bn-text-strong)]">
                          Proyecto de escritorio Electron
                        </div>
                        <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                          Ver y descargar la configuración de empaquetado nativo
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onOpenElectronModal}
                        className="px-4 py-1.5 rounded-full bg-[var(--bn-toolbar)] hover:bg-[var(--bn-hover)] border border-[var(--bn-border-strong)] text-[var(--bn-text-strong)] font-medium flex items-center gap-1.5"
                      >
                        <Laptop className="w-3.5 h-3.5" />
                        <span>Abrir exportador</span>
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {/* 7. SISTEMA Y CACHÉ */}
              {showSection('datos', 'sistema', 'cache', 'caché', 'memoria', 'almacenamiento') && (
                <section className="space-y-2.5">
                  <h2 className="text-[14px] font-semibold text-[var(--bn-text-strong)] px-1">
                    Sistema y caché
                  </h2>
                  <div className="bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-xl divide-y divide-[var(--bn-border)] text-xs overflow-hidden">
                    <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-[var(--bn-text-strong)]">
                          Caché web y de búsquedas
                        </div>
                        <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5 tabular-nums">
                          {(cacheInfo?.proxyCount || 0) + (cacheInfo?.searchCount || 0)} elemento(s) en caché ·{' '}
                          {formatBytes(cacheInfo?.totalBytes || 0)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={fetchCacheStatus}
                          title="Actualizar estado de caché"
                          className="p-2 rounded-full hover:bg-[var(--bn-hover)] text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)]"
                        >
                          <RotateCw className={`w-3.5 h-3.5 ${loadingCache ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={handleClearCache}
                          disabled={loadingCache}
                          className="px-4 py-1.5 rounded-full bg-[var(--bn-toolbar)] hover:bg-[var(--bn-hover)] border border-[var(--bn-border-strong)] text-[var(--bn-danger-text)] font-medium flex items-center gap-1.5 disabled:opacity-60"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{t(lang, 'clearCacheBtn')}</span>
                        </button>
                      </div>
                    </div>
                    {cacheNotice && (
                      <div className="px-5 py-2.5 text-[11px] text-[var(--bn-text-strong)] bg-[var(--bn-surface)]">
                        {cacheNotice}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* 8. RESTABLECER CONFIGURACIÓN */}
              {showSection('restablecer', 'restablecer', 'reiniciar', 'valores predeterminados', 'reset') && (
                <section className="space-y-2.5">
                  <h2 className="text-[14px] font-semibold text-[var(--bn-text-strong)] px-1">
                    {t(lang, 'secReset')}
                  </h2>
                  <div className="bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-xl px-5 py-4 flex flex-wrap items-center justify-between gap-4 text-xs">
                    <div>
                      <div className="font-medium text-[var(--bn-text-strong)]">
                        Restaurar valores predeterminados originales
                      </div>
                      <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                        Devuelve tema, idioma, barra lateral, buscador y escudos a su estado inicial (conserva marcadores e historial)
                      </div>
                    </div>
                    {onResetSettings && (
                      confirmReset ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setConfirmReset(false)}
                            className="px-3 py-1.5 rounded-full border border-[var(--bn-border-strong)] hover:bg-[var(--bn-hover)] text-[var(--bn-text)]"
                          >
                            {t(lang, 'cancel')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onResetSettings();
                              setConfirmReset(false);
                            }}
                            className="px-3.5 py-1.5 rounded-full bg-[var(--bn-danger)] text-white font-medium"
                          >
                            {t(lang, 'confirmResetBtn')}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmReset(true)}
                          className="px-4 py-1.5 rounded-full border border-[var(--bn-border-strong)] hover:bg-[var(--bn-hover)] text-[var(--bn-text-strong)] font-medium flex items-center gap-1.5 shrink-0"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>{t(lang, 'resetBtn')}</span>
                        </button>
                      )
                    )}
                  </div>
                </section>
              )}

              {/* 9. ACERCA DE FABINAV */}
              {showSection('acerca', 'acerca', 'about', 'version', 'actualizaciones', 'updates', 'atajos') && (
                <section className="space-y-2.5">
                  <h2 className="text-[14px] font-semibold text-[var(--bn-text-strong)] px-1">
                    {t(lang, 'secAbout')}
                  </h2>
                  <div className="bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-xl p-5 space-y-4 text-xs">
                    <div className="flex items-center gap-3.5">
                      <div
                        className="w-11 h-11 rounded-2xl text-white flex items-center justify-center font-bold text-base shrink-0"
                        style={{ background: 'var(--fabi-gradient-brand)' }}
                      >
                        F
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[var(--bn-text-strong)]">
                          FabiNav v{APP_VERSION}
                        </div>
                        <div className="text-[11px] text-[var(--bn-text-muted)]">
                          FabiNav Engine · TLS 1.2/1.3 · github.com/fabianfamr/FabiNav
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDesktopCheckUpdates}
                        className="px-4 py-1.5 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white text-xs font-medium inline-flex items-center gap-1.5"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        <span>{t(lang, 'checkUpdatesBtn')}</span>
                      </button>
                      {desktopUpdateReady && (
                        <button
                          type="button"
                          onClick={() => window.fabinavDesktop?.installUpdate()}
                          className="px-4 py-1.5 rounded-full bg-[var(--bn-success)] text-white text-xs font-medium"
                        >
                          {t(lang, 'restartInstallBtn')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onNavigate('fabinav://about')}
                        className="text-xs text-[var(--bn-accent)] hover:underline ml-auto"
                      >
                        {t(lang, 'viewShortcutsLink')}
                      </button>
                    </div>
                    {desktopActionMsg && (
                      <p className="text-[11px] text-[var(--bn-text-strong)] bg-[var(--bn-surface)] border border-[var(--bn-border)] rounded-xl px-3 py-2">
                        {desktopActionMsg}
                      </p>
                    )}
                  </div>
                </section>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
