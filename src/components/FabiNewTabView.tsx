import React, { useState, useEffect, useRef } from 'react';
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
import { FabiSwitch } from './FabiSwitch';
import { FabiNavLogo } from './FabiNavLogo';
import { t, getDateLocale } from '../i18n/translations';

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

const SEARCH_ENGINES: Array<{
  id: BrowserSettings['defaultSearchEngine'];
  label: string;
}> = [
  { id: 'fabinav', label: 'FabiNav Search' },
  { id: 'google', label: 'Google' },
  { id: 'duckduckgo', label: 'DuckDuckGo' },
  { id: 'bing', label: 'Bing' },
  { id: 'ecosia', label: 'Ecosia' }
];

const SITE_TILE_TINTS = [
  'bg-orange-500/20 text-orange-200 border-orange-400/25',
  'bg-sky-500/20 text-sky-200 border-sky-400/25',
  'bg-emerald-500/20 text-emerald-200 border-emerald-400/25',
  'bg-indigo-500/20 text-indigo-200 border-indigo-400/25',
  'bg-amber-500/20 text-amber-200 border-amber-400/25',
  'bg-rose-500/20 text-rose-200 border-rose-400/25'
];

function getTileTint(title: string): string {
  let h = 0;
  for (let i = 0; i < title.length; i++) {
    h = (h * 31 + title.charCodeAt(i)) >>> 0;
  }
  return SITE_TILE_TINTS[h % SITE_TILE_TINTS.length];
}

const FABI_EASE_OUT: [number, number, number, number] = [0, 0, 0.58, 1];

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

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCustomizeModal(false);
        setShowAddSiteModal(false);
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const currentWallpaper =
    FABI_WALLPAPERS.find((w) => w.id === customization.selectedWallpaperId) || FABI_WALLPAPERS[0];

  useEffect(() => {
    setImgError(false);
  }, [currentWallpaper.url]);

  const normalizedEngine =
    (settings.defaultSearchEngine as string) === 'brave'
      ? 'fabinav'
      : settings.defaultSearchEngine;
  const currentEngineLabel =
    SEARCH_ENGINES.find((e) => e.id === normalizedEngine)?.label || 'FabiNav Search';

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

  const lang = settings.language || 'es';
  const dateLocale = getDateLocale(lang);

  const timeFormatted = now.toLocaleTimeString(dateLocale, {
    hour: '2-digit',
    minute: '2-digit'
  });

  const dateFormatted = now.toLocaleDateString(dateLocale, {
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
      {/* Background Wallpaper with Smooth Crossfade */}
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
              transition={{ duration: 0.35, ease: FABI_EASE_OUT }}
              className="w-full h-full object-cover brightness-[0.74]"
            />
          )}
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/25 to-black/70" />
      </div>

      {/* Top Row: Real Session Privacy Stats (Left) + Clock (Right) */}
      <div className="w-full flex items-start justify-between gap-6 z-10">
        {customization.showStats ? (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: FABI_EASE_OUT }}
            onClick={onOpenShieldModal}
            title="Ver configuración de Escudos de FabiNav"
            className="flex flex-wrap items-center gap-5 sm:gap-7 text-left px-4 py-3 rounded-2xl bg-black/40 hover:bg-black/55 backdrop-blur-md border border-white/12 transition-colors"
          >
            <div>
              <div className="text-2xl sm:text-3xl font-semibold text-[#ff6f4c] tabular-nums leading-none">
                {shieldState.trackersBlockedCount + shieldState.cookiesBlockedCount}
              </div>
              <div className="text-[11px] text-white/80 mt-1.5 max-w-[120px] leading-tight">
                {t(lang, 'statTrackersBlocked')}
              </div>
            </div>

            <div className="h-8 w-[1px] bg-white/15 hidden sm:block" />

            <div>
              <div className="text-2xl sm:text-3xl font-semibold text-white tabular-nums leading-none">
                {shieldState.httpsUpgradesCount}
              </div>
              <div className="text-[11px] text-white/80 mt-1.5 max-w-[100px] leading-tight">
                {t(lang, 'statHttpsConn')}
              </div>
            </div>

            <div className="h-8 w-[1px] bg-white/15 hidden sm:block" />

            <div>
              <div
                className={`text-sm font-semibold leading-none ${
                  shieldState.enabled ? 'text-emerald-400' : 'text-white/60'
                }`}
              >
                {shieldState.enabled ? t(lang, 'shieldsActiveShort') : t(lang, 'shieldsPausedShort')}
              </div>
              <div className="text-[11px] text-white/80 mt-1.5 leading-tight">
                {t(lang, 'statShieldsTls')}
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
            transition={{ duration: 0.2, ease: FABI_EASE_OUT }}
            className="text-right shrink-0"
          >
            <div className="text-4xl sm:text-5xl font-light tracking-tight text-white tabular-nums leading-none drop-shadow">
              {timeFormatted}
            </div>
            <div className="text-xs text-white/85 mt-1.5 capitalize">{dateFormatted}</div>
          </motion.div>
        )}
      </div>

      {/* Center: FabiNav Emblem + Search Pill + Top Sites Grid */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl mx-auto my-8 z-20">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: FABI_EASE_OUT }}
          className="flex items-center gap-3 mb-5"
        >
          <FabiNavLogo className="w-11 h-11 rounded-2xl shadow-xl" />
          <span className="text-2xl font-bold tracking-tight text-white drop-shadow">
            FabiNav
          </span>
        </motion.div>

        <motion.form
          onSubmit={handleSearchSubmit}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: FABI_EASE_OUT }}
          className="w-full mb-8 relative"
        >
          <div className="relative flex items-center h-12 rounded-full bg-[#1b1d23]/90 hover:bg-[#22252c]/95 focus-within:bg-[#17191e] backdrop-blur-xl border border-white/15 focus-within:border-[var(--bn-accent)] shadow-2xl transition-all fabi-transition-s pl-4 pr-1.5 gap-2">
            <Search className="w-4 h-4 text-white/65 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t(lang, 'searchWithOrUrl', { engine: currentEngineLabel })}
              className="w-full bg-transparent text-sm text-white placeholder-white/55 focus:outline-none select-text"
            />

            {searchQuery.length > 0 && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                title="Limpiar texto"
                className="p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="submit"
              title="Buscar"
              className="w-9 h-9 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] active:scale-90 text-white flex items-center justify-center transition-all shrink-0"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.form>

        {/* FabiNav Top Sites Grid */}
        {customization.showTopSites && (
          <div className="w-full flex flex-wrap items-start justify-center gap-3.5 sm:gap-5">
            {topSites.map((site, idx) => (
              <motion.div
                key={site.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.18), ease: FABI_EASE_OUT }}
                className="group relative flex flex-col items-center w-[76px]"
              >
                <button
                  type="button"
                  onClick={() => onNavigate(site.url)}
                  title={`${site.title} · ${site.url}`}
                  className="w-13 h-13 rounded-2xl bg-black/45 hover:bg-black/65 hover:-translate-y-0.5 active:scale-95 backdrop-blur-md border border-white/15 hover:border-white/30 flex items-center justify-center transition-all fabi-transition-s shadow-lg"
                >
                  <span
                    className={`w-8 h-8 rounded-xl border font-semibold text-sm flex items-center justify-center ${getTileTint(
                      site.title
                    )}`}
                  >
                    {getSiteInitial(site.title)}
                  </span>
                </button>
                <span className="mt-2 text-[11px] text-white/95 truncate w-full text-center font-medium drop-shadow-xs">
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
                title={t(lang, 'addSite')}
                className="w-13 h-13 rounded-2xl bg-black/30 hover:bg-black/50 hover:-translate-y-0.5 active:scale-95 backdrop-blur-md border border-dashed border-white/30 hover:border-white/55 flex items-center justify-center text-white/80 hover:text-white transition-all fabi-transition-s"
              >
                <Plus className="w-5 h-5" />
              </button>
              <span className="mt-2 text-[11px] text-white/80 truncate w-full text-center">
                {t(lang, 'addSite')}
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
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/40 hover:bg-black/60 active:scale-95 backdrop-blur-md border border-white/12 text-white/85 hover:text-white transition-all whitespace-nowrap"
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>{currentWallpaper.name}</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenShieldModal}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black/40 hover:bg-black/60 active:scale-95 backdrop-blur-md border border-white/12 text-white/85 hover:text-white transition-all whitespace-nowrap"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--bn-accent)]" />
            <span>{shieldState.enabled ? t(lang, 'shieldsActiveLong') : t(lang, 'shieldsPausedLong')}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCustomizeModal(true)}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/50 hover:bg-black/70 active:scale-95 backdrop-blur-md border border-white/15 text-white transition-all font-medium whitespace-nowrap"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{t(lang, 'customize')}</span>
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
            transition={{ duration: 0.14, ease: FABI_EASE_OUT }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
            onClick={() => setShowAddSiteModal(false)}
          >
            <motion.form
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.16, ease: FABI_EASE_OUT }}
              onSubmit={handleAddSiteSubmit}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-2xl p-5 shadow-2xl text-[var(--bn-text)] space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--bn-text-strong)]">
                  {t(lang, 'addShortcutTitle')}
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
                  <label className="block text-[11px] text-[var(--bn-text-muted)] mb-1">
                    {t(lang, 'nameLabel')}
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={newSiteTitle}
                    onChange={(e) => setNewSiteTitle(e.target.value)}
                    placeholder="YouTube"
                    className="w-full bg-[var(--bn-omnibox)] border border-[var(--bn-border-strong)] rounded-xl px-3 py-2 text-xs text-[var(--bn-text-strong)] focus:outline-none focus:border-[var(--bn-accent)]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--bn-text-muted)] mb-1">
                    {t(lang, 'urlLabel')}
                  </label>
                  <input
                    type="text"
                    required
                    value={newSiteUrl}
                    onChange={(e) => setNewSiteUrl(e.target.value)}
                    placeholder="https://youtube.com"
                    className="w-full bg-[var(--bn-omnibox)] border border-[var(--bn-border-strong)] rounded-xl px-3 py-2 text-xs text-[var(--bn-text-strong)] focus:outline-none focus:border-[var(--bn-accent)]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddSiteModal(false)}
                  className="px-4 py-1.5 rounded-full border border-[var(--bn-border)] text-xs text-[var(--bn-text)] hover:bg-[var(--bn-hover)]"
                >
                  {t(lang, 'cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white text-xs font-medium"
                >
                  {t(lang, 'save')}
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
            transition={{ duration: 0.14, ease: FABI_EASE_OUT }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
            onClick={() => setShowCustomizeModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.16, ease: FABI_EASE_OUT }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-2xl p-5 shadow-2xl text-[var(--bn-text)] space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[var(--bn-border)] pb-3">
                <h3 className="font-semibold text-[var(--bn-text-strong)] text-sm">
                  {t(lang, 'customizeTitle')}
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
                <div className="flex items-center justify-between py-1">
                  <span>{t(lang, 'showPrivacyStats')}</span>
                  <FabiSwitch
                    checked={customization.showStats}
                    onChange={(v) => onUpdateCustomization({ showStats: v })}
                    ariaLabel={t(lang, 'showPrivacyStats')}
                  />
                </div>

                <div className="flex items-center justify-between py-1">
                  <span>{t(lang, 'showTopSites')}</span>
                  <FabiSwitch
                    checked={customization.showTopSites}
                    onChange={(v) => onUpdateCustomization({ showTopSites: v })}
                    ariaLabel={t(lang, 'showTopSites')}
                  />
                </div>

                <div className="flex items-center justify-between py-1">
                  <span>{t(lang, 'showClockDate')}</span>
                  <FabiSwitch
                    checked={customization.showClock}
                    onChange={(v) => onUpdateCustomization({ showClock: v })}
                    ariaLabel={t(lang, 'showClockDate')}
                  />
                </div>

                <div className="pt-3 border-t border-[var(--bn-border)]">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-medium text-[var(--bn-text-strong)]">
                      {t(lang, 'wallpaperTitle')}
                    </span>
                    <span className="text-[11px] text-[var(--bn-text-muted)] tabular-nums">
                      {t(lang, 'availableCount', { n: FABI_WALLPAPERS.length })}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
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
                  {t(lang, 'done')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
