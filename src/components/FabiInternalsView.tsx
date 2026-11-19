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
  LogOut
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
  TlsInspectionResult
} from '../types';
import { APP_VERSION } from '../constants/initialData';
import { FabiSwitch } from './FabiSwitch';

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
  onOpenElectronModal: () => void;
  onNavigate: (url: string) => void;
}

type SettingsSection =
  | 'primeros-pasos'
  | 'apariencia'
  | 'escudos'
  | 'buscador'
  | 'barra-lateral'
  | 'datos'
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
  onOpenElectronModal,
  onNavigate
}) => {
  const [historyFilter, setHistoryFilter] = useState('');
  const [bookmarkFilter, setBookmarkFilter] = useState('');
  const [newBmTitle, setNewBmTitle] = useState('');
  const [newBmUrl, setNewBmUrl] = useState('');
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('apariencia');
  const [cookiePartition, setCookiePartition] = useState<'normal' | 'private'>('normal');
  const [cookieFilter, setCookieFilter] = useState('');
  const [cookies, setCookies] = useState<StoredCookieItem[]>([]);
  const [loadingCookies, setLoadingCookies] = useState(false);

  const [tlsProbeHost, setTlsProbeHost] = useState('github.com');
  const [tlsProbeLoading, setTlsProbeLoading] = useState(false);
  const [tlsProbeResult, setTlsProbeResult] = useState<TlsInspectionResult | null>(null);
  const [desktopActionMsg, setDesktopActionMsg] = useState<string | null>(null);
  const [desktopUpdateReady, setDesktopUpdateReady] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleDesktopUninstall = async () => {
    const bridge = window.fabinavDesktop;
    if (!bridge?.isElectron) {
      setDesktopActionMsg(
        'En la app de escritorio instalada, este botón abre directamente el desinstalador de Windows ("Desinstalar FabiNav"), Finder o la carpeta del AppImage.'
      );
      return;
    }
    const res = await bridge.openUninstallSettings();
    if (res?.message) setDesktopActionMsg(res.message);
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
    }
  }, [cleanUrl, cookiePartition, fetchCookies]);

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
                      {d.fileSize} · {new Date(d.timestamp).toLocaleTimeString('es-ES')}
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
                  Escudos, Cookies y TLS
                </h1>
                <p className="text-xs text-[var(--bn-text-muted)]">
                  Protección contra rastreadores, verificación TLS 1.2/1.3 y almacén de cookies por partición
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
                      {new Date(tlsProbeResult.validTo).toLocaleDateString('es-ES')}
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
                  <span className="text-xs font-semibold text-[var(--bn-text-strong)] tabular-nums">
                    Almacén de Cookies ({filteredCookies.length})
                  </span>
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
                  Acerca de FabiNav
                </h1>
                <p className="text-xs text-[var(--bn-text-muted)] font-mono tabular-nums">
                  Versión {APP_VERSION} · Escudos FabiNav + TLS 1.2/1.3 + Búsqueda en vivo
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('fabinav://settings')}
              className="px-4 py-1.5 bg-[var(--bn-surface-alt)] hover:bg-[var(--bn-hover)] border border-[var(--bn-border)] rounded-full text-xs font-medium text-[var(--bn-text-strong)]"
            >
              Configuración
            </button>
          </div>

          <div className="p-5 bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--bn-text-strong)]">
              <Info className="w-4 h-4 text-[var(--bn-accent)]" />
              <span>Información general, actualizaciones y desinstalación</span>
            </div>
            <p className="text-xs text-[var(--bn-text-muted)] leading-relaxed">
              FabiNav es un navegador web moderno con búsqueda en vivo, proxy seguro con cookies particionadas e inspección TLS 1.2/1.3, perfil conectado con Google, empaquetado Electron multiplataforma con actualizaciones automáticas por GitHub Releases y desinstalador directo de un clic.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleDesktopCheckUpdates}
                className="px-4 py-1.5 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white text-xs font-medium inline-flex items-center gap-1.5"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Buscar actualizaciones</span>
              </button>
              {desktopUpdateReady && (
                <button
                  type="button"
                  onClick={() => window.fabinavDesktop?.installUpdate()}
                  className="px-4 py-1.5 rounded-full bg-[var(--bn-success)] text-white text-xs font-medium"
                >
                  Reiniciar e instalar
                </button>
              )}
              <button
                type="button"
                onClick={handleDesktopUninstall}
                className="px-4 py-1.5 rounded-full bg-[var(--bn-toolbar)] hover:bg-[var(--bn-hover)] border border-[var(--bn-border-strong)] text-[var(--bn-danger-text)] text-xs font-medium inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Desinstalar FabiNav</span>
              </button>
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

  // 6. CONFIGURACIÓN DE FABINAV (fabinav://settings)
  const navSections: Array<{
    id: SettingsSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'primeros-pasos', label: 'Inicio', icon: Settings },
    { id: 'apariencia', label: 'Apariencia', icon: Palette },
    { id: 'escudos', label: 'Escudos', icon: ShieldCheck },
    { id: 'buscador', label: 'Buscador', icon: Search },
    { id: 'barra-lateral', label: 'Barra lateral', icon: PanelLeft },
    { id: 'datos', label: 'Datos y respaldo', icon: HardDrive },
    { id: 'acerca', label: 'Acerca de FabiNav', icon: Info }
  ];

  const themeOptions: Array<{ id: BrowserTheme; label: string; desc: string }> = [
    { id: 'fabi-dark', label: 'FabiNav Oscuro', desc: 'Gris grafito clásico de escritorio' },
    { id: 'fabi-midnight', label: 'Noche Profunda', desc: 'Contraste oscuro intenso para baja luz' },
    { id: 'fabi-light', label: 'FabiNav Claro', desc: 'Superficie clara luminosa para uso diurno' }
  ];

  return (
    <div className="w-full h-full overflow-hidden bg-[var(--bn-surface)] text-[var(--bn-text)] flex flex-col md:flex-row">
      {/* Left Settings Rail */}
      <aside className="w-full md:w-64 bg-[var(--bn-toolbar)] border-b md:border-b-0 md:border-r border-[var(--bn-border)] p-4 flex md:flex-col gap-1 overflow-x-auto md:overflow-y-auto shrink-0">
        <div className="hidden md:flex items-center gap-2.5 px-3 pb-4 mb-2 border-b border-[var(--bn-border)]">
          <Settings className="w-4 h-4 text-[var(--bn-accent)]" />
          <span className="text-sm font-semibold text-[var(--bn-text-strong)]">Configuración</span>
        </div>

        {navSections.map((sec) => {
          const Icon = sec.icon;
          const active = settingsSection === sec.id;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => setSettingsSection(sec.id)}
              className={`relative flex items-center gap-2.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                active
                  ? 'text-[var(--bn-accent)] bg-[var(--bn-accent-soft)]'
                  : 'text-[var(--bn-text)] hover:bg-[var(--bn-hover)]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{sec.label}</span>
            </button>
          );
        })}
      </aside>

      {/* Main Single-Column Settings Content */}
      <div className="flex-1 overflow-y-auto p-6 sm:p-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={settingsSection}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: FABI_EASE_OUT }}
            className="max-w-2xl mx-auto space-y-6"
          >
            {settingsSection === 'primeros-pasos' && (
              <>
                <h2 className="text-base font-semibold text-[var(--bn-text-strong)]">Inicio</h2>
                <div className="bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl divide-y divide-[var(--bn-border)] text-xs">
                  <div className="p-4 flex items-center justify-between gap-4">
                    {googleUser ? (
                      <>
                        <div className="flex items-center gap-3 min-w-0">
                          {googleUser.photoUrl ? (
                            <img
                              src={googleUser.photoUrl}
                              alt={googleUser.displayName}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 rounded-full object-cover border border-[var(--bn-border-strong)] shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-[var(--bn-accent)] text-white flex items-center justify-center font-bold text-sm shrink-0">
                              {googleUser.displayName[0]?.toUpperCase() || 'G'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-[var(--bn-text-strong)] truncate">
                              {googleUser.displayName}
                            </div>
                            <div className="text-[11px] text-[var(--bn-text-muted)] truncate">
                              {googleUser.email}
                            </div>
                          </div>
                        </div>
                        {onGoogleSignOut && (
                          <button
                            type="button"
                            onClick={onGoogleSignOut}
                            className="px-3 py-1.5 rounded-full bg-[var(--bn-toolbar)] hover:bg-[var(--bn-hover)] border border-[var(--bn-border-strong)] text-xs font-medium text-[var(--bn-text-strong)] flex items-center gap-1.5 shrink-0"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Desconectar</span>
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <div>
                          <div className="font-medium text-[var(--bn-text-strong)]">
                            Cuenta de Google
                          </div>
                          <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                            Inicia sesión para mostrar tu foto oficial de Google en el navegador
                          </div>
                        </div>
                        {onGoogleSignIn && (
                          <button
                            type="button"
                            onClick={onGoogleSignIn}
                            className="px-3.5 py-1.5 rounded-full bg-white text-[#1f1f1f] hover:bg-[#f1f3f4] border border-[#dadce0] font-medium text-xs shrink-0"
                          >
                            Sign in with Google
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium text-[var(--bn-text-strong)]">Página de inicio</div>
                      <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                        Dirección que se abre al pulsar el botón Inicio
                      </div>
                    </div>
                    <input
                      type="text"
                      value={settings.homepage}
                      onChange={(e) => onUpdateSettings({ homepage: e.target.value })}
                      className="w-48 bg-[var(--bn-omnibox)] border border-[var(--bn-border-strong)] rounded-xl px-3 py-1.5 text-xs text-[var(--bn-text-strong)] focus:outline-none focus:border-[var(--bn-accent)]"
                    />
                  </div>
                </div>
              </>
            )}

            {settingsSection === 'apariencia' && (
              <>
                <h2 className="text-base font-semibold text-[var(--bn-text-strong)]">Apariencia</h2>

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
                        className={`p-4 rounded-2xl border text-left transition-colors ${
                          isSelected
                            ? 'bg-[var(--bn-surface-alt)] border-[var(--bn-accent)] text-[var(--bn-text-strong)]'
                            : 'bg-[var(--bn-surface-alt)] border-[var(--bn-border)] text-[var(--bn-text)] hover:border-[var(--bn-border-strong)]'
                        }`}
                      >
                        <div className="text-xs font-semibold flex items-center justify-between">
                          <span>{t.label}</span>
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-[var(--bn-accent)]" />
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--bn-text-muted)] mt-1">{t.desc}</p>
                      </button>
                    );
                  })}
                </div>

                <div className="bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl divide-y divide-[var(--bn-border)] text-xs">
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium text-[var(--bn-text-strong)]">
                        Mostrar botón de Inicio
                      </div>
                      <div className="text-[11px] text-[var(--bn-text-muted)]">
                        Añade el acceso directo a la página principal en la barra superior
                      </div>
                    </div>
                    <FabiSwitch
                      size="md"
                      checked={settings.showHomeButton}
                      onChange={(v) => onUpdateSettings({ showHomeButton: v })}
                      ariaLabel="Mostrar botón de Inicio"
                    />
                  </div>

                  <div className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium text-[var(--bn-text-strong)]">
                        Mostrar barra de marcadores
                      </div>
                      <div className="text-[11px] text-[var(--bn-text-muted)]">
                        Muestra tus marcadores debajo de la barra de direcciones
                      </div>
                    </div>
                    <FabiSwitch
                      size="md"
                      checked={settings.showBookmarksBar}
                      onChange={(v) => onUpdateSettings({ showBookmarksBar: v })}
                      ariaLabel="Mostrar barra de marcadores"
                    />
                  </div>

                  <div className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium text-[var(--bn-text-strong)]">
                        Usar pestañas verticales
                      </div>
                      <div className="text-[11px] text-[var(--bn-text-muted)]">
                        Lista tus pestañas abiertas en una columna lateral
                      </div>
                    </div>
                    <FabiSwitch
                      size="md"
                      checked={settings.useVerticalTabs}
                      onChange={(v) => onUpdateSettings({ useVerticalTabs: v })}
                      ariaLabel="Usar pestañas verticales"
                    />
                  </div>

                  <div className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium text-[var(--bn-text-strong)]">Zoom de página</div>
                      <div className="text-[11px] text-[var(--bn-text-muted)]">
                        Escala aplicada al contenido web incrustado
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
                </div>
              </>
            )}

            {settingsSection === 'escudos' && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-[var(--bn-text-strong)]">
                    Escudos, Cookies y TLS
                  </h2>
                  <button
                    type="button"
                    onClick={() => onNavigate('fabinav://shields')}
                    className="text-xs text-[var(--bn-accent)] hover:underline flex items-center gap-1"
                  >
                    <span>Administrar cookies y TLS</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
                <div className="bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl divide-y divide-[var(--bn-border)] text-xs">
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="font-medium text-[var(--bn-text-strong)]">
                      Bloqueo de rastreadores y anuncios
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

                  <div className="p-4 flex items-center justify-between gap-4">
                    <span>Verificación estricta TLS 1.2 / 1.3</span>
                    <FabiSwitch
                      size="md"
                      checked={shieldState.strictTls}
                      onChange={(v) => onUpdateShieldState({ strictTls: v })}
                      ariaLabel="Verificación estricta TLS"
                    />
                  </div>

                  <div className="p-4 flex items-center justify-between gap-4">
                    <span>Actualizar conexiones a HTTPS</span>
                    <FabiSwitch
                      size="md"
                      checked={shieldState.upgradeHttps}
                      onChange={(v) => onUpdateShieldState({ upgradeHttps: v })}
                      ariaLabel="Actualizar conexiones a HTTPS"
                    />
                  </div>

                  <div className="p-4 flex items-center justify-between gap-4">
                    <span>Bloquear cookies entre sitios</span>
                    <FabiSwitch
                      size="md"
                      checked={shieldState.blockCrossSiteCookies}
                      onChange={(v) => onUpdateShieldState({ blockCrossSiteCookies: v })}
                      ariaLabel="Bloquear cookies entre sitios"
                    />
                  </div>
                </div>
              </>
            )}

            {settingsSection === 'buscador' && (
              <>
                <h2 className="text-base font-semibold text-[var(--bn-text-strong)]">Buscador</h2>
                <div className="bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl p-4 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <div className="font-medium text-[var(--bn-text-strong)]">
                      Buscador usado en la barra de direcciones
                    </div>
                    <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                      También se aplica al buscador de Nueva pestaña
                    </div>
                  </div>
                  <select
                    value={settings.defaultSearchEngine === 'brave' ? 'fabinav' : settings.defaultSearchEngine}
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
              </>
            )}

            {settingsSection === 'barra-lateral' && (
              <>
                <h2 className="text-base font-semibold text-[var(--bn-text-strong)]">Barra lateral</h2>
                <div className="bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl divide-y divide-[var(--bn-border)] text-xs">
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium text-[var(--bn-text-strong)]">
                        Mostrar barra lateral
                      </div>
                      <div className="text-[11px] text-[var(--bn-text-muted)]">
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

                  <div className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium text-[var(--bn-text-strong)]">
                        Posición de la barra lateral
                      </div>
                      <div className="text-[11px] text-[var(--bn-text-muted)]">
                        Muestra la barra lateral a la derecha o a la izquierda en FabiNav
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
              </>
            )}

            {settingsSection === 'datos' && (
              <>
                <h2 className="text-base font-semibold text-[var(--bn-text-strong)]">
                  Datos y respaldo
                </h2>
                <div className="bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl divide-y divide-[var(--bn-border)] text-xs">
                  <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-[var(--bn-text-strong)]">
                        Exportar respaldo local (.json)
                      </div>
                      <div className="text-[11px] text-[var(--bn-text-muted)]">
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

                  <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-[var(--bn-text-strong)]">
                        Importar respaldo (.json)
                      </div>
                      <div className="text-[11px] text-[var(--bn-text-muted)]">
                        Restaura una copia exportada previamente
                      </div>
                    </div>
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
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-1.5 rounded-full bg-[var(--bn-toolbar)] hover:bg-[var(--bn-hover)] border border-[var(--bn-border-strong)] text-[var(--bn-text-strong)] font-medium flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Importar JSON</span>
                    </button>
                  </div>

                  <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-[var(--bn-text-strong)]">
                        Proyecto de escritorio Electron
                      </div>
                      <div className="text-[11px] text-[var(--bn-text-muted)]">
                        Ver y descargar los archivos main.js y preload.js
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
              </>
            )}

            {settingsSection === 'acerca' && (
              <>
                <h2 className="text-base font-semibold text-[var(--bn-text-strong)]">
                  Acerca de FabiNav
                </h2>
                <div className="bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl p-5 space-y-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl text-white flex items-center justify-center font-bold text-base"
                      style={{ background: 'var(--fabi-gradient-brand)' }}
                    >
                      F
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[var(--bn-text-strong)]">
                        FabiNav v{APP_VERSION}
                      </div>
                      <div className="text-[11px] text-[var(--bn-text-muted)]">
                        FabiNav Engine · TLS 1.2/1.3 · Búsqueda web en vivo
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleDesktopCheckUpdates}
                      className="px-4 py-1.5 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white text-xs font-medium inline-flex items-center gap-1.5"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Buscar actualizaciones</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDesktopUninstall}
                      className="px-4 py-1.5 rounded-full bg-[var(--bn-toolbar)] hover:bg-[var(--bn-hover)] border border-[var(--bn-border-strong)] text-[var(--bn-danger-text)] text-xs font-medium inline-flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Desinstalar FabiNav</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('fabinav://about')}
                      className="text-xs text-[var(--bn-accent)] hover:underline ml-auto"
                    >
                      Ver atajos de teclado y detalles
                    </button>
                  </div>
                  {desktopActionMsg && (
                    <p className="text-[11px] text-[var(--bn-text-strong)] bg-[var(--bn-surface)] border border-[var(--bn-border)] rounded-xl px-3 py-2">
                      {desktopActionMsg}
                    </p>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
