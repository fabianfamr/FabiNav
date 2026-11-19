import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  SidebarPanelView,
  Bookmark,
  HistoryEntry,
  DownloadItem,
  DevToolLog,
  DevToolNetworkReq
} from '../types';
import {
  Plus,
  X,
  Search,
  ExternalLink,
  Trash2,
  Download,
  History,
  Bookmark as BookmarkIcon,
  StickyNote,
  MessageCircle,
  MessageSquare,
  Send,
  Terminal,
  Copy,
  Check
} from 'lucide-react';

interface SidebarPanelProps {
  activeView: SidebarPanelView;
  position: 'left' | 'right';
  bookmarks: Bookmark[];
  historyEntries: HistoryEntry[];
  downloads: DownloadItem[];
  sessionNotes: string;
  devLogs: DevToolLog[];
  networkReqs: DevToolNetworkReq[];
  onClose: () => void;
  onNavigate: (url: string) => void;
  onNewTab: (url?: string) => void;
  onAddBookmark: (title: string, url: string, folder?: string) => void;
  onRemoveBookmark: (id: string) => void;
  onDeleteHistoryItem: (id: string) => void;
  onClearHistory: () => void;
  onRemoveDownload: (id: string) => void;
  onClearDownloads: () => void;
  onUpdateNotes: (notes: string) => void;
  onRecordDownload: (filename: string, size: string, url: string) => void;
  onClearLogs: () => void;
  onRunConsoleCommand: (cmd: string) => void;
}

const FABI_EASE_OUT: [number, number, number, number] = [0, 0, 0.58, 1];

export const SidebarPanel: React.FC<SidebarPanelProps> = ({
  activeView,
  position,
  bookmarks,
  historyEntries,
  downloads,
  sessionNotes,
  devLogs,
  networkReqs,
  onClose,
  onNavigate,
  onNewTab,
  onAddBookmark,
  onRemoveBookmark,
  onDeleteHistoryItem,
  onClearHistory,
  onRemoveDownload,
  onClearDownloads,
  onUpdateNotes,
  onRecordDownload,
  onClearLogs,
  onRunConsoleCommand
}) => {
  const [bookmarkSearch, setBookmarkSearch] = useState('');
  const [showAddBookmark, setShowAddBookmark] = useState(false);
  const [newBmTitle, setNewBmTitle] = useState('');
  const [newBmUrl, setNewBmUrl] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [copiedNotes, setCopiedNotes] = useState(false);

  const [devTab, setDevTab] = useState<'console' | 'network' | 'system'>('console');
  const [consoleFilter, setConsoleFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [consoleInput, setConsoleInput] = useState('');

  const filteredBookmarks = bookmarks.filter(
    (b) =>
      b.title.toLowerCase().includes(bookmarkSearch.toLowerCase()) ||
      b.url.toLowerCase().includes(bookmarkSearch.toLowerCase())
  );

  const filteredHistory = historyEntries.filter(
    (h) =>
      h.title.toLowerCase().includes(historySearch.toLowerCase()) ||
      h.url.toLowerCase().includes(historySearch.toLowerCase())
  );

  const filteredLogs = devLogs.filter((l) =>
    consoleFilter === 'all' ? true : l.type === consoleFilter
  );

  const handleAddBookmarkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBmTitle.trim() || !newBmUrl.trim()) return;
    onAddBookmark(newBmTitle.trim(), newBmUrl.trim(), 'Barra de marcadores');
    setNewBmTitle('');
    setNewBmUrl('');
    setShowAddBookmark(false);
  };

  const handleCopyNotes = () => {
    navigator.clipboard.writeText(sessionNotes);
    setCopiedNotes(true);
    setTimeout(() => setCopiedNotes(false), 1800);
  };

  const handleDownloadNotes = () => {
    const blob = new Blob([sessionNotes], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const filename = `fabinav-notas-${new Date().toISOString().slice(0, 10)}.txt`;
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    onRecordDownload(filename, `${(blob.size / 1024).toFixed(1)} KB`, 'fabinav://notes/export');
  };

  const handleConsoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consoleInput.trim()) return;
    onRunConsoleCommand(consoleInput.trim());
    setConsoleInput('');
  };

  const perfMem = (performance as unknown as {
    memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
  }).memory;

  const renderMessagingLauncher = (
    title: string,
    webUrl: string,
    icon: React.ReactNode,
    description: string
  ) => (
    <div className="flex flex-col h-full">
      <div className="h-11 px-3.5 border-b border-[var(--bn-border)] bg-[var(--bn-toolbar)] flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-[var(--bn-text-strong)]">
          {icon}
          <span>{title}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Cerrar panel"
          className="p-1 text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)] rounded-full"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 p-6 flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] flex items-center justify-center">
          {icon}
        </div>
        <div className="space-y-1.5">
          <h4 className="text-sm font-semibold text-[var(--bn-text-strong)]">{title}</h4>
          <p className="text-xs text-[var(--bn-text-muted)] leading-relaxed">{description}</p>
        </div>

        <div className="w-full space-y-2 pt-2">
          <button
            type="button"
            onClick={() => onNewTab(webUrl)}
            className="w-full py-2 px-4 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white text-xs font-medium transition-colors"
          >
            Abrir en nueva pestaña de FabiNav
          </button>

          <a
            href={webUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2 px-4 rounded-full bg-[var(--bn-surface-alt)] hover:bg-[var(--bn-hover)] border border-[var(--bn-border)] text-[var(--bn-text-strong)] text-xs font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <span>Abrir en ventana externa</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );

  const slideX = position === 'right' ? 20 : -20;

  return (
    <AnimatePresence>
      {activeView && (
        <motion.aside
          key={activeView}
          id="fabinav-sidebar-panel"
          initial={{ opacity: 0, x: slideX }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: slideX }}
          transition={{ duration: 0.18, ease: FABI_EASE_OUT }}
          className={`w-80 bg-[var(--bn-surface)] ${
            position === 'right' ? 'border-l' : 'border-r'
          } border-[var(--bn-border)] flex flex-col h-full select-none z-20 text-[var(--bn-text)] text-xs shrink-0`}
        >
          {/* 1. MARCADORES */}
          {activeView === 'bookmarks' && (
            <div className="flex flex-col h-full">
              <div className="h-11 px-3.5 border-b border-[var(--bn-border)] bg-[var(--bn-toolbar)] flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-[var(--bn-text-strong)] tabular-nums">
                  <BookmarkIcon className="w-4 h-4 text-[var(--bn-accent)]" />
                  <span>Marcadores ({bookmarks.length})</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowAddBookmark(!showAddBookmark)}
                    title="Añadir marcador"
                    className="p-1 text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)] rounded-full"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    title="Cerrar panel"
                    className="p-1 text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)] rounded-full"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-2.5 border-b border-[var(--bn-border)]">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[var(--bn-text-muted)] absolute left-3 top-2" />
                  <input
                    type="text"
                    placeholder="Buscar marcadores..."
                    value={bookmarkSearch}
                    onChange={(e) => setBookmarkSearch(e.target.value)}
                    className="w-full bg-[var(--bn-omnibox)] border border-[var(--bn-border)] rounded-full pl-8 pr-3 py-1.5 text-xs text-[var(--bn-text-strong)] placeholder-[var(--bn-text-muted)] focus:outline-none focus:border-[var(--bn-accent)]"
                  />
                </div>
              </div>

              {showAddBookmark && (
                <form
                  onSubmit={handleAddBookmarkSubmit}
                  className="p-3 bg-[var(--bn-surface-alt)] border-b border-[var(--bn-border)] space-y-2"
                >
                  <input
                    type="text"
                    placeholder="Título"
                    value={newBmTitle}
                    onChange={(e) => setNewBmTitle(e.target.value)}
                    className="w-full bg-[var(--bn-omnibox)] border border-[var(--bn-border-strong)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--bn-text-strong)] focus:outline-none focus:border-[var(--bn-accent)]"
                  />
                  <input
                    type="text"
                    placeholder="https://ejemplo.com"
                    value={newBmUrl}
                    onChange={(e) => setNewBmUrl(e.target.value)}
                    className="w-full bg-[var(--bn-omnibox)] border border-[var(--bn-border-strong)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--bn-text-strong)] focus:outline-none focus:border-[var(--bn-accent)]"
                  />
                  <button
                    type="submit"
                    className="w-full py-1.5 bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white rounded-full text-xs font-medium"
                  >
                    Guardar marcador
                  </button>
                </form>
              )}

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredBookmarks.length === 0 ? (
                  <div className="p-6 text-center text-[var(--bn-text-muted)]">
                    No hay marcadores coincidentes
                  </div>
                ) : (
                  filteredBookmarks.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => onNavigate(b.url)}
                      className="p-2.5 rounded-xl bg-[var(--bn-surface-alt)] hover:bg-[var(--bn-hover)] border border-[var(--bn-border)] flex items-center justify-between group cursor-pointer transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-medium text-[var(--bn-text-strong)] truncate">
                          {b.title}
                        </div>
                        <div className="text-[10px] text-[var(--bn-text-muted)] truncate font-mono">
                          {b.url}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveBookmark(b.id);
                        }}
                        title="Eliminar marcador"
                        className="opacity-0 group-hover:opacity-100 p-1 text-[var(--bn-text-muted)] hover:text-[var(--bn-danger-text)] rounded-full"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 2. HISTORIAL REAL */}
          {activeView === 'history' && (
            <div className="flex flex-col h-full">
              <div className="h-11 px-3.5 border-b border-[var(--bn-border)] bg-[var(--bn-toolbar)] flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-[var(--bn-text-strong)] tabular-nums">
                  <History className="w-4 h-4 text-[var(--bn-info-text)]" />
                  <span>Historial ({historyEntries.length})</span>
                </div>
                <div className="flex items-center gap-1">
                  {historyEntries.length > 0 && (
                    <button
                      type="button"
                      onClick={onClearHistory}
                      title="Limpiar historial"
                      className="p-1 text-[var(--bn-text-muted)] hover:text-[var(--bn-danger-text)] hover:bg-[var(--bn-hover)] rounded-full"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    title="Cerrar panel"
                    className="p-1 text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)] rounded-full"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-2.5 border-b border-[var(--bn-border)]">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[var(--bn-text-muted)] absolute left-3 top-2" />
                  <input
                    type="text"
                    placeholder="Filtrar historial..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="w-full bg-[var(--bn-omnibox)] border border-[var(--bn-border)] rounded-full pl-8 pr-3 py-1.5 text-xs text-[var(--bn-text-strong)] placeholder-[var(--bn-text-muted)] focus:outline-none focus:border-[var(--bn-accent)]"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredHistory.length === 0 ? (
                  <div className="p-6 text-center text-[var(--bn-text-muted)] leading-relaxed">
                    Tu historial está vacío. Al visitar sitios en pestañas normales se registrarán aquí.
                  </div>
                ) : (
                  filteredHistory.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => onNavigate(item.url)}
                      className="p-2.5 rounded-xl bg-[var(--bn-surface-alt)] hover:bg-[var(--bn-hover)] border border-[var(--bn-border)] flex items-center justify-between group cursor-pointer transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-medium text-[var(--bn-text-strong)] truncate">
                          {item.title}
                        </div>
                        <div className="text-[10px] text-[var(--bn-text-muted)] truncate font-mono mt-0.5 tabular-nums">
                          {item.url} · {item.timeFormatted}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteHistoryItem(item.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-[var(--bn-text-muted)] hover:text-[var(--bn-danger-text)] rounded-full"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 3. DESCARGAS REALES */}
          {activeView === 'downloads' && (
            <div className="flex flex-col h-full">
              <div className="h-11 px-3.5 border-b border-[var(--bn-border)] bg-[var(--bn-toolbar)] flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-[var(--bn-text-strong)] tabular-nums">
                  <Download className="w-4 h-4 text-[var(--bn-accent)]" />
                  <span>Descargas ({downloads.length})</span>
                </div>
                <div className="flex items-center gap-1">
                  {downloads.length > 0 && (
                    <button
                      type="button"
                      onClick={onClearDownloads}
                      title="Limpiar lista"
                      className="p-1 text-[var(--bn-text-muted)] hover:text-[var(--bn-danger-text)] hover:bg-[var(--bn-hover)] rounded-full"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    title="Cerrar panel"
                    className="p-1 text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)] rounded-full"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
                {downloads.length === 0 ? (
                  <div className="p-6 text-center text-[var(--bn-text-muted)] leading-relaxed">
                    No hay archivos descargados todavía. Cuando exportes un respaldo JSON, notas o el proyecto Electron aparecerán aquí.
                  </div>
                ) : (
                  downloads.map((d) => (
                    <div
                      key={d.id}
                      className="p-2.5 rounded-xl bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-[var(--bn-text-strong)] truncate">
                          {d.filename}
                        </div>
                        <div className="text-[10px] text-[var(--bn-text-muted)] font-mono mt-0.5 tabular-nums">
                          {d.fileSize} · {new Date(d.timestamp).toLocaleTimeString('es-ES')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveDownload(d.id)}
                        className="p-1 text-[var(--bn-text-muted)] hover:text-[var(--bn-danger-text)] rounded-full shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 4. NOTAS DE SESIÓN LOCALES */}
          {activeView === 'notes' && (
            <div className="flex flex-col h-full">
              <div className="h-11 px-3.5 border-b border-[var(--bn-border)] bg-[var(--bn-toolbar)] flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-[var(--bn-text-strong)]">
                  <StickyNote className="w-4 h-4 text-[var(--bn-warning-text)]" />
                  <span>Notas de sesión</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleCopyNotes}
                    disabled={!sessionNotes}
                    title="Copiar notas"
                    className="p-1 text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] disabled:opacity-40 rounded-full"
                  >
                    {copiedNotes ? (
                      <Check className="w-3.5 h-3.5 text-[var(--bn-success-text)]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadNotes}
                    disabled={!sessionNotes}
                    title="Descargar como archivo .txt"
                    className="p-1 text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] disabled:opacity-40 rounded-full"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    title="Cerrar panel"
                    className="p-1 text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] rounded-full"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 p-3 flex flex-col">
                <textarea
                  value={sessionNotes}
                  onChange={(e) => onUpdateNotes(e.target.value)}
                  placeholder="Escribe tus apuntes, enlaces o recordatorios aquí. Se guardan automáticamente en este equipo..."
                  className="flex-1 w-full bg-[var(--bn-omnibox)] border border-[var(--bn-border)] focus:border-[var(--bn-accent)] rounded-xl p-3 text-xs text-[var(--bn-text-strong)] placeholder-[var(--bn-text-muted)] resize-none focus:outline-none leading-relaxed select-text"
                />
                <div className="pt-2 flex items-center justify-between text-[11px] text-[var(--bn-text-muted)]">
                  <span className="tabular-nums">{sessionNotes.length} caracteres</span>
                  {sessionNotes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onUpdateNotes('')}
                      className="hover:text-[var(--bn-danger-text)]"
                    >
                      Vaciar notas
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 5. MENSAJERÍA WEB REAL */}
          {activeView === 'whatsapp' &&
            renderMessagingLauncher(
              'WhatsApp Web',
              'https://web.whatsapp.com',
              <MessageCircle className="w-5 h-5 text-[#25D366]" />,
              'Accede a tu cuenta real de WhatsApp Web directamente desde el navegador.'
            )}

          {activeView === 'discord' &&
            renderMessagingLauncher(
              'Discord',
              'https://discord.com/app',
              <MessageSquare className="w-5 h-5 text-[#5865F2]" />,
              'Abre el cliente web oficial de Discord con tus servidores y canales reales.'
            )}

          {activeView === 'telegram' &&
            renderMessagingLauncher(
              'Telegram Web',
              'https://web.telegram.org',
              <Send className="w-5 h-5 text-[#229ED9]" />,
              'Conéctate a tu sesión oficial de Telegram Web.'
            )}

          {/* 6. DEVTOOLS REALES */}
          {activeView === 'devtools' && (
            <div className="flex flex-col h-full font-mono text-[11px]">
              <div className="h-11 px-3.5 border-b border-[var(--bn-border)] bg-[var(--bn-toolbar)] flex items-center justify-between font-sans">
                <div className="flex items-center gap-2 font-semibold text-[var(--bn-text-strong)] text-xs">
                  <Terminal className="w-4 h-4 text-[var(--bn-accent)]" />
                  <span>DevTools</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={onClearLogs}
                    title="Limpiar consola"
                    className="p-1 text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] rounded-full"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    title="Cerrar panel"
                    className="p-1 text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] rounded-full"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex border-b border-[var(--bn-border)] bg-[var(--bn-toolbar)] font-sans text-xs">
                {[
                  { id: 'console' as const, label: 'Consola' },
                  { id: 'network' as const, label: 'Navegación' },
                  { id: 'system' as const, label: 'Entorno' }
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setDevTab(t.id)}
                    className={`flex-1 py-2 text-center border-b-2 transition-colors ${
                      devTab === t.id
                        ? 'border-[var(--bn-accent)] text-[var(--bn-text-strong)] font-medium'
                        : 'border-transparent text-[var(--bn-text-muted)] hover:text-[var(--bn-text)]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {devTab === 'console' && (
                <>
                  <div className="px-2.5 py-1.5 border-b border-[var(--bn-border)] bg-[var(--bn-surface-alt)] flex items-center gap-1 font-sans">
                    {(['all', 'info', 'warn', 'error'] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setConsoleFilter(level)}
                        className={`px-2 py-0.5 rounded-full text-[10px] ${
                          consoleFilter === level
                            ? 'bg-[var(--bn-active)] text-[var(--bn-text-strong)] font-medium'
                            : 'text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)]'
                        }`}
                      >
                        {level === 'all'
                          ? 'Todos'
                          : level === 'info'
                          ? 'Info'
                          : level === 'warn'
                          ? 'Aviso'
                          : 'Error'}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1.5 select-text">
                    {filteredLogs.length === 0 ? (
                      <div className="p-4 text-center text-[var(--bn-text-muted)] font-sans">
                        Sin eventos registrados
                      </div>
                    ) : (
                      filteredLogs.map((l) => (
                        <div
                          key={l.id}
                          className="p-2 rounded-lg bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] text-[var(--bn-text)]"
                        >
                          <div className="flex items-center justify-between text-[10px] text-[var(--bn-text-muted)] mb-0.5 tabular-nums">
                            <span className="text-[var(--bn-accent)]">{l.source}</span>
                            <span>{l.timestamp}</span>
                          </div>
                          <div className="text-[var(--bn-text-strong)] break-words">{l.message}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <form
                    onSubmit={handleConsoleSubmit}
                    className="p-2 border-t border-[var(--bn-border)] bg-[var(--bn-toolbar)] flex items-center gap-1.5"
                  >
                    <span className="text-[var(--bn-accent)]">&gt;</span>
                    <input
                      type="text"
                      value={consoleInput}
                      onChange={(e) => setConsoleInput(e.target.value)}
                      placeholder='Comando ("help", "tabs", "clear")'
                      className="flex-1 bg-transparent text-[var(--bn-text-strong)] placeholder-[var(--bn-text-muted)] focus:outline-none text-[11px]"
                    />
                  </form>
                </>
              )}

              {devTab === 'network' && (
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5 select-text">
                  {networkReqs.length === 0 ? (
                    <div className="p-4 text-center text-[var(--bn-text-muted)] font-sans">
                      Aún no hay navegaciones registradas en esta sesión
                    </div>
                  ) : (
                    networkReqs.map((req) => (
                      <div
                        key={req.id}
                        className="p-2 rounded-lg bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] space-y-0.5"
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-[var(--bn-success-text)] font-semibold">
                            {req.method} · {req.status}
                          </span>
                          <span className="text-[var(--bn-text-muted)] tabular-nums">
                            {req.timestamp}
                          </span>
                        </div>
                        <div className="text-[var(--bn-text-strong)] truncate">{req.url}</div>
                        <div className="text-[10px] text-[var(--bn-text-muted)]">{req.type}</div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {devTab === 'system' && (
                <div className="flex-1 overflow-y-auto p-3 space-y-2.5 font-sans text-xs select-text">
                  <div className="p-3 rounded-xl bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] space-y-1">
                    <div className="text-[11px] text-[var(--bn-text-muted)]">
                      Resolución del viewport
                    </div>
                    <div className="font-mono text-[var(--bn-text-strong)] tabular-nums">
                      {window.innerWidth} × {window.innerHeight} px
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] space-y-1">
                    <div className="text-[11px] text-[var(--bn-text-muted)]">
                      Plataforma del navegador
                    </div>
                    <div className="font-mono text-[11px] text-[var(--bn-text-strong)] break-all">
                      {navigator.userAgent}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] space-y-1">
                    <div className="text-[11px] text-[var(--bn-text-muted)]">Memoria JS real (V8)</div>
                    <div className="font-mono text-[var(--bn-text-strong)] tabular-nums">
                      {perfMem
                        ? `${(perfMem.usedJSHeapSize / (1024 * 1024)).toFixed(1)} MB / ${(
                            perfMem.jsHeapSizeLimit /
                            (1024 * 1024)
                          ).toFixed(0)} MB`
                        : 'No expuesta por este navegador'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
