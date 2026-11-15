import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  SlidersHorizontal,
  Plus,
  X,
  Image as ImageIcon,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import { FABI_WALLPAPERS } from '../constants/initialData';
import {
  BrowserSettings,
  FabiNewTabCustomization,
  FabiShieldState,
  TopSiteItem
} from '../types';

interface FabiNewTabViewProps {
  onNavigate: (url: string) => void;
  shieldState: FabiShieldState;
  settings: BrowserSettings;
  customization: FabiNewTabCustomization;
  topSites: TopSiteItem[];
  onAddTopSite: (title: string, url: string) => void;
  onRemoveTopSite: (id: string) => void;
  onUpdateCustomization: (updates: Partial<FabiNewTabCustomization>) => void;
  onOpenShieldModal: () => void;
}

const SEARCH_ENGINE_LABELS: Record<BrowserSettings['defaultSearchEngine'], string> = {
  brave: 'Brave Search',
  google: 'Google',
  duckduckgo: 'DuckDuckGo',
  bing: 'Bing',
  ecosia: 'Ecosia'
};

const LEO_EASE_OUT: [number, number, number, number] = [0, 0, 0.58, 1];

export const FabiNewTabView: React.FC<FabiNewTabViewProps> = ({
  onNavigate,
  shieldState,
  settings,
  customization,
  topSites,
  onAddTopSite,
  onRemoveTopSite,
  onUpdateCustomization,
  onOpenShieldModal
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [showAddSiteModal, setShowAddSiteModal] = useState(false);
  const [newSiteTitle, setNewSiteTitle] = useState('');
  const [newSiteUrl, setNewSiteUrl] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const currentWallpaper =
    FABI_WALLPAPERS.find((w) => w.id === customization.selectedWallpaperId) || FABI_WALLPAPERS[0];

  useEffect(() => {
    setImgError(false);
  }, [currentWallpaper.url]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    onNavigate(searchQuery.trim());
  };

  const handleAddSiteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteTitle.trim() || !newSiteUrl.trim()) return;
    onAddTopSite(newSiteTitle.trim(), newSiteUrl.trim());
    setNewSiteTitle('');
    setNewSiteUrl('');
    setShowAddSiteModal(false);
  };

  const nextWallpaper = () => {
    const currentIndex = FABI_WALLPAPERS.findIndex((w) => w.id === currentWallpaper.id);
    const nextIndex = (currentIndex + 1) % FABI_WALLPAPERS.length;
    onUpdateCustomization({ selectedWallpaperId: FABI_WALLPAPERS[nextIndex].id });
  };

  const timeFormatted = now.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const dateFormatted = now.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  const getSiteInitial = (title: string) => (title.trim()[0] || 'W').toUpperCase();

  return (
    <div
      id="fabinav-new-tab-page"
      className="relative w-full h-full flex flex-col justify-between p-6 sm:p-9 select-none overflow-y-auto no-scrollbar bg-[#111318] text-white"
    >
      {/* Background Wallpaper with Smooth Brave Crossfade */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 bg-gradient-to-br from-[#17181c] via-[#121318] to-[#0b0c0f]">
        <AnimatePresence mode="wait">
          {!imgError && (
            <motion.img
              key={currentWallpaper.id}
              src={currentWallpaper.url}
              alt={currentWallpaper.name}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: LEO_EASE_OUT }}
              className="w-full h-full object-cover brightness-[0.72]"
            />
          )}
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/25 to-black/65" />
      </div>

      {/* Top Row: Real Session Privacy Stats (Left) + Clock (Right) */}
      <div className="w-full flex items-start justify-between gap-6 z-10">
        {customization.showStats ? (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: LEO_EASE_OUT }}
            onClick={onOpenShieldModal}
            title="Ver configuración de Escudos de FabiNav"
            className="flex flex-wrap items-center gap-5 sm:gap-7 text-left px-4 py-3 rounded-2xl bg-black/35 hover:bg-black/50 backdrop-blur-md border border-white/10 transition-colors"
          >
            <div>
              <div className="text-2xl sm:text-3xl font-semibold text-[#ff6f4c] tabular-nums leading-none">
                {shieldState.httpsUpgradesCount}
              </div>
              <div className="text-[11px] text-white/75 mt-1.5 max-w-[105px] leading-tight">
                Conexiones mejoradas a HTTPS
              </div>
            </div>

            <div className="h-8 w-[1px] bg-white/15 hidden sm:block" />

            <div>
              <div className="text-2xl sm:text-3xl font-semibold text-white tabular-nums leading-none">
                {shieldState.searchesCount}
              </div>
              <div className="text-[11px] text-white/75 mt-1.5 max-w-[100px] leading-tight">
                Búsquedas privadas en sesión
              </div>
            </div>

            <div className="h-8 w-[1px] bg-white/15 hidden sm:block" />

            <div>
              <div
                className={`text-sm font-semibold leading-none ${
                  shieldState.enabled ? 'text-emerald-400' : 'text-white/60'
                }`}
              >
                {shieldState.enabled ? 'Activos' : 'En pausa'}
              </div>
              <div className="text-[11px] text-white/75 mt-1.5 leading-tight">
                Estado de Escudos
              </div>
            </div>
          </motion.button>
        ) : (
          <div />
        )}

        {customization.showClock && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: LEO_EASE_OUT }}
            className="text-right shrink-0"
          >
            <div className="text-4xl sm:text-5xl font-light tracking-tight text-white tabular-nums leading-none drop-shadow">
              {timeFormatted}
            </div>
            <div className="text-xs text-white/80 mt-1.5 capitalize">{dateFormatted}</div>
          </motion.div>
        )}
      </div>

      {/* Center: Brave Search Pill + Top Sites Grid */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl mx-auto my-8 z-10">
        <motion.form
          onSubmit={handleSearchSubmit}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: LEO_EASE_OUT }}
          className="w-full mb-8"
        >
          <div className="relative flex items-center h-12 rounded-full bg-[#1e2025]/90 hover:bg-[#24272d]/95 focus-within:bg-[#191b20] backdrop-blur-xl border border-white/15 focus-within:border-[var(--bn-accent)] shadow-2xl transition-all leo-transition-s px-4">
            <Search className="w-4 h-4 text-white/60 shrink-0 mr-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Buscar con ${SEARCH_ENGINE_LABELS[settings.defaultSearchEngine]} o escribir URL`}
              className="w-full bg-transparent text-sm text-white placeholder-white/55 focus:outline-none"
            />
            <span className="hidden sm:inline-block text-[11px] text-white/50 mr-2 shrink-0">
              {SEARCH_ENGINE_LABELS[settings.defaultSearchEngine]}
            </span>
            <button
              type="submit"
              title="Buscar"
              className="w-8 h-8 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] active:scale-90 text-white flex items-center justify-center transition-all shrink-0"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.form>

        {/* Brave Top Sites Grid */}
        {customization.showTopSites && (
          <div className="w-full flex flex-wrap items-start justify-center gap-3 sm:gap-4">
            {topSites.map((site, idx) => (
              <motion.div
                key={site.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.18), ease: LEO_EASE_OUT }}
                className="group relative flex flex-col items-center w-[76px]"
              >
                <button
                  type="button"
                  onClick={() => onNavigate(site.url)}
                  title={`${site.title} · ${site.url}`}
                  className="w-13 h-13 rounded-2xl bg-black/45 hover:bg-black/65 hover:-translate-y-0.5 active:scale-95 backdrop-blur-md border border-white/15 hover:border-white/30 flex items-center justify-center transition-all leo-transition-s shadow-lg"
                >
                  <span className="w-8 h-8 rounded-xl bg-white/10 text-white font-semibold text-sm flex items-center justify-center">
                    {getSiteInitial(site.title)}
                  </span>
                </button>
                <span className="mt-2 text-[11px] text-white/90 truncate w-full text-center font-medium drop-shadow-xs">
                  {site.title}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveTopSite(site.id);
                  }}
                  title="Quitar acceso directo"
                  className="absolute -top-1.5 right-1 w-5 h-5 rounded-full bg-[#1e2025] border border-white/20 text-white/75 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            ))}

            {/* Add Top Site Tile */}
            <div className="flex flex-col items-center w-[76px]">
              <button
                type="button"
                onClick={() => setShowAddSiteModal(true)}
                title="Añadir sitio"
                className="w-13 h-13 rounded-2xl bg-black/30 hover:bg-black/50 hover:-translate-y-0.5 active:scale-95 backdrop-blur-md border border-dashed border-white/25 hover:border-white/50 flex items-center justify-center text-white/75 hover:text-white transition-all leo-transition-s"
              >
                <Plus className="w-5 h-5" />
              </button>
              <span className="mt-2 text-[11px] text-white/75 truncate w-full text-center">
                Añadir sitio
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Row */}
      <div className="w-full flex items-center justify-between gap-4 z-10 text-xs">
        <button
          type="button"
          onClick={nextWallpaper}
          title="Cambiar imagen de fondo"
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/35 hover:bg-black/55 active:scale-95 backdrop-blur-md border border-white/10 text-white/80 hover:text-white transition-all"
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>{currentWallpaper.name}</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenShieldModal}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/35 hover:bg-black/55 active:scale-95 backdrop-blur-md border border-white/10 text-white/80 hover:text-white transition-all"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--bn-accent)]" />
            <span>{shieldState.enabled ? 'Escudos activos' : 'Escudos en pausa'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCustomizeModal(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/45 hover:bg-black/65 active:scale-95 backdrop-blur-md border border-white/15 text-white transition-all font-medium"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Personalizar</span>
          </button>
        </div>
      </div>

      {/* Add Site Modal */}
      <AnimatePresence>
        {showAddSiteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14, ease: LEO_EASE_OUT }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
            onClick={() => setShowAddSiteModal(false)}
          >
            <motion.form
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.16, ease: LEO_EASE_OUT }}
              onSubmit={handleAddSiteSubmit}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-2xl p-5 shadow-2xl text-[var(--bn-text)] space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--bn-text-strong)]">
                  Añadir acceso directo
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddSiteModal(false)}
                  className="p-1 text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] text-[var(--bn-text-muted)] mb-1">Nombre</label>
                  <input
                    type="text"
                    required
                    value={newSiteTitle}
                    onChange={(e) => setNewSiteTitle(e.target.value)}
                    placeholder="Ejemplo: YouTube"
                    className="w-full bg-[var(--bn-omnibox)] border border-[var(--bn-border-strong)] rounded-lg px-3 py-2 text-xs text-[var(--bn-text-strong)] focus:outline-none focus:border-[var(--bn-accent)]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--bn-text-muted)] mb-1">Dirección URL</label>
                  <input
                    type="text"
                    required
                    value={newSiteUrl}
                    onChange={(e) => setNewSiteUrl(e.target.value)}
                    placeholder="https://youtube.com"
                    className="w-full bg-[var(--bn-omnibox)] border border-[var(--bn-border-strong)] rounded-lg px-3 py-2 text-xs text-[var(--bn-text-strong)] focus:outline-none focus:border-[var(--bn-accent)]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddSiteModal(false)}
                  className="px-4 py-1.5 rounded-full border border-[var(--bn-border)] text-xs text-[var(--bn-text)] hover:bg-[var(--bn-hover)]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white text-xs font-medium"
                >
                  Guardar
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Customize Dashboard Modal */}
      <AnimatePresence>
        {showCustomizeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14, ease: LEO_EASE_OUT }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
            onClick={() => setShowCustomizeModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.16, ease: LEO_EASE_OUT }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-2xl p-5 shadow-2xl text-[var(--bn-text)] space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[var(--bn-border)] pb-3">
                <h3 className="font-semibold text-[var(--bn-text-strong)] text-sm">
                  Personalizar panel de nueva pestaña
                </h3>
                <button
                  type="button"
                  onClick={() => setShowCustomizeModal(false)}
                  className="text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] p-1 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <label className="flex items-center justify-between cursor-pointer py-1">
                  <span>Mostrar estadísticas de privacidad</span>
                  <input
                    type="checkbox"
                    checked={customization.showStats}
                    onChange={(e) => onUpdateCustomization({ showStats: e.target.checked })}
                    className="accent-[var(--bn-accent)] w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer py-1">
                  <span>Mostrar sitios principales</span>
                  <input
                    type="checkbox"
                    checked={customization.showTopSites}
                    onChange={(e) => onUpdateCustomization({ showTopSites: e.target.checked })}
                    className="accent-[var(--bn-accent)] w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer py-1">
                  <span>Mostrar reloj y fecha</span>
                  <input
                    type="checkbox"
                    checked={customization.showClock}
                    onChange={(e) => onUpdateCustomization({ showClock: e.target.checked })}
                    className="accent-[var(--bn-accent)] w-4 h-4"
                  />
                </label>

                <div className="pt-2 border-t border-[var(--bn-border)]">
                  <div className="text-xs font-medium text-[var(--bn-text-strong)] mb-2">
                    Imagen de fondo
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {FABI_WALLPAPERS.map((wp) => (
                      <button
                        key={wp.id}
                        type="button"
                        onClick={() => onUpdateCustomization({ selectedWallpaperId: wp.id })}
                        className={`rounded-xl overflow-hidden border text-left transition-colors ${
                          wp.id === currentWallpaper.id
                            ? 'border-[var(--bn-accent)] ring-1 ring-[var(--bn-accent)]'
                            : 'border-[var(--bn-border)] hover:border-[var(--bn-border-strong)]'
                        }`}
                      >
                        <img
                          src={wp.url}
                          alt={wp.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-14 object-cover"
                        />
                        <div className="p-1.5 text-[10px] truncate bg-[var(--bn-surface-alt)] text-[var(--bn-text)]">
                          {wp.name}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--bn-border)] flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowCustomizeModal(false)}
                  className="px-5 py-1.5 bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white rounded-full text-xs font-medium transition-colors"
                >
                  Listo
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
