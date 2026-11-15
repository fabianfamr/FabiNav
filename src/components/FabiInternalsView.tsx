import React, { useState, useRef } from 'react';
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
  ExternalLink
} from 'lucide-react';
import {
  FabiShieldState,
  BrowserSettings,
  HistoryEntry,
  BrowserTheme,
  Bookmark,
  DownloadItem
} from '../types';
import { APP_VERSION } from '../constants/initialData';

interface FabiInternalsViewProps {
  url: string;
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

const LEO_EASE_OUT: [number, number, number, number] = [0, 0, 0.58, 1];

export const FabiInternalsView: React.FC<FabiInternalsViewProps> = ({
  url,
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanUrl = url.toLowerCase().trim();

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
                <p className="text-xs text-[var(--bn-text-muted)]">
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
                    className="p-1.5 text-[var(--bn-text-muted)] hover:text-[var(--bn-danger)] rounded-full"
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
                className="px-3.5 py-1.5 rounded-full border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] hover:bg-[var(--bn-hover)] text-xs text-[var(--bn-danger)] font-medium"
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
                    <div className="text-[11px] text-[var(--bn-text-muted)] font-mono mt-0.5">
                      {d.fileSize} · {new Date(d.timestamp).toLocaleTimeString('es-ES')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveDownload(d.id)}
                    className="p-1.5 text-[var(--bn-text-muted)] hover:text-[var(--bn-danger)] rounded-full"
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
                className="px-4 py-1.5 bg-[var(--bn-surface-alt)] hover:bg-[var(--bn-hover)] text-[var(--bn-danger)] text-xs font-medium rounded-full flex items-center gap-1.5 border border-[var(--bn-border)] shrink-0"
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
                    <div className="text-[11px] text-[var(--bn-text-muted)] truncate flex items-center gap-2 mt-0.5 font-mono">
                      <span className="truncate">{item.url}</span>
                      <span aria-hidden="true">·</span>
                      <span className="shrink-0">{item.timeFormatted}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteHistoryItem(item.id)}
                    title="Eliminar registro"
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-[var(--bn-text-muted)] hover:text-[var(--bn-danger)] rounded-full transition-opacity"
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

  // 4. ESCUDOS GLOBALES (fabinav://shields)
  if (cleanUrl.includes('shields')) {
    return (
      <div className="w-full h-full overflow-y-auto bg-[var(--bn-surface)] text-[var(--bn-text)] p-6 sm:p-10">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-4 pb-5 border-b border-[var(--bn-border)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--bn-accent-soft)] text-[var(--bn-accent)] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[var(--bn-text-strong)]">Escudos</h1>
                <p className="text-xs text-[var(--bn-text-muted)]">
                  Valores predeterminados de privacidad para todas tus pestañas
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onUpdateShieldState({ enabled: !shieldState.enabled })}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                shieldState.enabled
                  ? 'bg-[var(--bn-accent)] text-white'
                  : 'bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] text-[var(--bn-text-muted)]'
              }`}
            >
              {shieldState.enabled ? 'Escudos activados' : 'Escudos pausados'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl">
              <div className="text-xs text-[var(--bn-text-muted)]">Mejoras HTTPS aplicadas</div>
              <div className="text-2xl font-semibold text-[var(--bn-accent)] mt-1 tabular-nums font-mono">
                {shieldState.httpsUpgradesCount}
              </div>
            </div>
            <div className="p-4 bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl">
              <div className="text-xs text-[var(--bn-text-muted)]">Búsquedas privadas en sesión</div>
              <div className="text-2xl font-semibold text-[var(--bn-text-strong)] mt-1 tabular-nums font-mono">
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
                  Nivel de filtrado aplicado en el motor del navegador
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

            <label className="flex items-center justify-between p-4 gap-4 cursor-pointer">
              <div>
                <div className="text-xs font-medium text-[var(--bn-text-strong)]">
                  Actualizar conexiones a HTTPS
                </div>
                <div className="text-[11px] text-[var(--bn-text-muted)]">
                  Convierte automáticamente direcciones http:// a https:// al navegar
                </div>
              </div>
              <input
                type="checkbox"
                checked={shieldState.upgradeHttps}
                onChange={(e) => onUpdateShieldState({ upgradeHttps: e.target.checked })}
                className="accent-[var(--bn-accent)] w-4 h-4"
              />
            </label>

            <label className="flex items-center justify-between p-4 gap-4 cursor-pointer">
              <div>
                <div className="text-xs font-medium text-[var(--bn-text-strong)]">
                  Bloquear cookies entre sitios
                </div>
                <div className="text-[11px] text-[var(--bn-text-muted)]">
                  Evita que sitios externos rastreen tu sesión entre pestañas
                </div>
              </div>
              <input
                type="checkbox"
                checked={shieldState.blockCrossSiteCookies}
                onChange={(e) => onUpdateShieldState({ blockCrossSiteCookies: e.target.checked })}
                className="accent-[var(--bn-accent)] w-4 h-4"
              />
            </label>

            <div className="flex items-center justify-between p-4 gap-4">
              <div>
                <div className="text-xs font-medium text-[var(--bn-text-strong)]">
                  Bloquear huella digital
                </div>
                <div className="text-[11px] text-[var(--bn-text-muted)]">
                  Protección contra identificación del navegador por hardware o fuentes
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
                style={{ background: 'var(--leo-gradient-brand)' }}
              >
                F
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[var(--bn-text-strong)]">Acerca de FabiNav</h1>
                <p className="text-xs text-[var(--bn-text-muted)] font-mono tabular-nums">
                  Versión {APP_VERSION} · Diseño Brave Leo + Búsqueda Web Real
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

          <div className="p-5 bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--bn-text-strong)]">
              <Info className="w-4 h-4 text-[var(--bn-accent)]" />
              <span>Información general</span>
            </div>
            <p className="text-xs text-[var(--bn-text-muted)] leading-relaxed">
              FabiNav utiliza la estética y tokens de movimiento del sistema de diseño Brave Leo, con búsqueda web en vivo desde el servidor, almacenamiento 100% local sin inicios de sesión simulados ni cuentas falsas, barra lateral configurable y exportación a proyecto Electron.
            </p>
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

  // 6. CONFIGURACIÓN ESTILO BRAVE LEO (fabinav://settings)
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
    { id: 'brave-dark', label: 'Brave Oscuro', desc: 'Gris grafito clásico de Brave Desktop' },
    { id: 'brave-midnight', label: 'Noche Profunda', desc: 'Contraste oscuro intenso para baja luz' },
    { id: 'brave-light', label: 'Brave Claro', desc: 'Superficie clara luminosa para uso diurno' }
  ];

  return (
    <div className="w-full h-full overflow-hidden bg-[var(--bn-surface)] text-[var(--bn-text)] flex flex-col md:flex-row">
      {/* Left Brave Settings Rail */}
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

      {/* Main Single-Column Settings Content with Brave Leo transition */}
      <div className="flex-1 overflow-y-auto p-6 sm:p-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={settingsSection}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: LEO_EASE_OUT }}
            className="max-w-2xl mx-auto space-y-6"
          >
            {settingsSection === 'primeros-pasos' && (
              <>
                <h2 className="text-base font-semibold text-[var(--bn-text-strong)]">Inicio</h2>
                <div className="bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl divide-y divide-[var(--bn-border)] text-xs">
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium text-[var(--bn-text-strong)]">Modo de sesión</div>
                      <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                        Sesión local independiente sin cuentas vinculadas ni inicio de sesión
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-[var(--bn-accent-soft)] text-[var(--bn-accent)] text-[11px] font-medium">
                      Local
                    </span>
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
                  {themeOptions.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onUpdateSettings({ theme: t.id })}
                      className={`p-4 rounded-2xl border text-left transition-colors ${
                        settings.theme === t.id
                          ? 'bg-[var(--bn-surface-alt)] border-[var(--bn-accent)] text-[var(--bn-text-strong)]'
                          : 'bg-[var(--bn-surface-alt)] border-[var(--bn-border)] text-[var(--bn-text)] hover:border-[var(--bn-border-strong)]'
                      }`}
                    >
                      <div className="text-xs font-semibold flex items-center justify-between">
                        <span>{t.label}</span>
                        {settings.theme === t.id && <Check className="w-3.5 h-3.5 text-[var(--bn-accent)]" />}
                      </div>
                      <p className="text-[11px] text-[var(--bn-text-muted)] mt-1">{t.desc}</p>
                    </button>
                  ))}
                </div>

                <div className="bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl divide-y divide-[var(--bn-border)] text-xs">
                  <label className="p-4 flex items-center justify-between gap-4 cursor-pointer">
                    <div>
                      <div className="font-medium text-[var(--bn-text-strong)]">Mostrar botón de Inicio</div>
                      <div className="text-[11px] text-[var(--bn-text-muted)]">
                        Añade el acceso directo a la página principal en la barra superior
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.showHomeButton}
                      onChange={(e) => onUpdateSettings({ showHomeButton: e.target.checked })}
                      className="accent-[var(--bn-accent)] w-4 h-4"
                    />
                  </label>

                  <label className="p-4 flex items-center justify-between gap-4 cursor-pointer">
                    <div>
                      <div className="font-medium text-[var(--bn-text-strong)]">Mostrar barra de marcadores</div>
                      <div className="text-[11px] text-[var(--bn-text-muted)]">
                        Muestra tus marcadores debajo de la barra de direcciones
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.showBookmarksBar}
                      onChange={(e) => onUpdateSettings({ showBookmarksBar: e.target.checked })}
                      className="accent-[var(--bn-accent)] w-4 h-4"
                    />
                  </label>

                  <label className="p-4 flex items-center justify-between gap-4 cursor-pointer">
                    <div>
                      <div className="font-medium text-[var(--bn-text-strong)]">Usar pestañas verticales</div>
                      <div className="text-[11px] text-[var(--bn-text-muted)]">
                        Lista tus pestañas abiertas en una columna lateral como en Brave
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.useVerticalTabs}
                      onChange={(e) => onUpdateSettings({ useVerticalTabs: e.target.checked })}
                      className="accent-[var(--bn-accent)] w-4 h-4"
                    />
                  </label>

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
                      className="bg-[var(--bn-omnibox)] border border-[var(--bn-border-strong)] rounded-xl px-3 py-1.5 text-xs text-[var(--bn-text-strong)]"
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
                  <h2 className="text-base font-semibold text-[var(--bn-text-strong)]">Escudos</h2>
                  <button
                    type="button"
                    onClick={() => onNavigate('fabinav://shields')}
                    className="text-xs text-[var(--bn-accent)] hover:underline flex items-center gap-1"
                  >
                    <span>Abrir panel completo</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
                <div className="bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl divide-y divide-[var(--bn-border)] text-xs">
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium text-[var(--bn-text-strong)]">Bloqueo de rastreadores y anuncios</div>
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

                  <label className="p-4 flex items-center justify-between gap-4 cursor-pointer">
                    <span>Actualizar conexiones a HTTPS</span>
                    <input
                      type="checkbox"
                      checked={shieldState.upgradeHttps}
                      onChange={(e) => onUpdateShieldState({ upgradeHttps: e.target.checked })}
                      className="accent-[var(--bn-accent)] w-4 h-4"
                    />
                  </label>

                  <label className="p-4 flex items-center justify-between gap-4 cursor-pointer">
                    <span>Bloquear cookies entre sitios</span>
                    <input
                      type="checkbox"
                      checked={shieldState.blockCrossSiteCookies}
                      onChange={(e) => onUpdateShieldState({ blockCrossSiteCookies: e.target.checked })}
                      className="accent-[var(--bn-accent)] w-4 h-4"
                    />
                  </label>
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
                    value={settings.defaultSearchEngine}
                    onChange={(e) =>
                      onUpdateSettings({
                        defaultSearchEngine: e.target.value as BrowserSettings['defaultSearchEngine']
                      })
                    }
                    className="bg-[var(--bn-omnibox)] border border-[var(--bn-border-strong)] rounded-xl px-3 py-1.5 text-xs text-[var(--bn-text-strong)]"
                  >
                    <option value="brave">Brave Search</option>
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
                  <label className="p-4 flex items-center justify-between gap-4 cursor-pointer">
                    <div>
                      <div className="font-medium text-[var(--bn-text-strong)]">Mostrar barra lateral</div>
                      <div className="text-[11px] text-[var(--bn-text-muted)]">
                        Acceso rápido a marcadores, historial, notas y mensajería
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.showSidebar}
                      onChange={(e) => onUpdateSettings({ showSidebar: e.target.checked })}
                      className="accent-[var(--bn-accent)] w-4 h-4"
                    />
                  </label>

                  <div className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium text-[var(--bn-text-strong)]">Posición de la barra lateral</div>
                      <div className="text-[11px] text-[var(--bn-text-muted)]">
                        En Brave puedes mostrarla a la derecha o a la izquierda
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
                <h2 className="text-base font-semibold text-[var(--bn-text-strong)]">Datos y respaldo</h2>
                <div className="bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl divide-y divide-[var(--bn-border)] text-xs">
                  <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-[var(--bn-text-strong)]">Exportar respaldo local (.json)</div>
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
                      <div className="font-medium text-[var(--bn-text-strong)]">Importar respaldo (.json)</div>
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
                      <div className="font-medium text-[var(--bn-text-strong)]">Proyecto de escritorio Electron</div>
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
                <h2 className="text-base font-semibold text-[var(--bn-text-strong)]">Acerca de FabiNav</h2>
                <div className="bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl p-5 space-y-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl text-white flex items-center justify-center font-bold text-base"
                      style={{ background: 'var(--leo-gradient-brand)' }}
                    >
                      F
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[var(--bn-text-strong)]">
                        FabiNav v{APP_VERSION}
                      </div>
                      <div className="text-[11px] text-[var(--bn-text-muted)]">
                        Diseño Brave Leo · Búsqueda web en vivo · Almacenamiento local
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('fabinav://about')}
                    className="text-xs text-[var(--bn-accent)] hover:underline"
                  >
                    Ver atajos de teclado y detalles
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
