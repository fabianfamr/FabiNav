import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  X,
  Pin,
  VolumeX,
  Volume2,
  Globe,
  RotateCw,
  ShieldCheck,
  Lock,
  PanelLeft,
  RotateCcw,
  Search,
  Copy,
  Columns,
  Compass
} from 'lucide-react';
import { WebTab, ClosedTabRecord, AppLanguage } from '../types';
import { t } from '../i18n/translations';

interface TabBarProps {
  tabs: WebTab[];
  activeTabId: string;
  splitTabId: string | null;
  closedTabs: ClosedTabRecord[];
  useVerticalTabs: boolean;
  isMaximized: boolean;
  windowTitle?: string;
  language?: AppLanguage;
  openTabSearchSignal?: number;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onCloseOtherTabs: (tabId: string) => void;
  onCloseTabsToRight: (tabId: string) => void;
  onDuplicateTab: (tabId: string) => void;
  onReloadTab: (tabId: string) => void;
  onNewTab: () => void;
  onNewTabToRight: (afterTabId: string) => void;
  onReopenClosedTab: (recordId?: string) => void;
  onTogglePinTab: (tabId: string) => void;
  onToggleMuteTab: (tabId: string) => void;
  onToggleSplitTab: (tabId: string) => void;
  onToggleVerticalTabs: () => void;
  onMinimizeWindow: () => void;
  onToggleMaximizeWindow: () => void;
  onCloseWindow: () => void;
}

const EASE_OUT: [number, number, number, number] = [0, 0, 0.58, 1];

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  splitTabId,
  closedTabs,
  useVerticalTabs,
  isMaximized,
  windowTitle,
  language = 'es',
  openTabSearchSignal = 0,
  onSelectTab,
  onCloseTab,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onDuplicateTab,
  onReloadTab,
  onNewTab,
  onNewTabToRight,
  onReopenClosedTab,
  onTogglePinTab,
  onToggleMuteTab,
  onToggleSplitTab,
  onToggleVerticalTabs,
  onMinimizeWindow,
  onToggleMaximizeWindow,
  onCloseWindow
}) => {
  const [showTabSearch, setShowTabSearch] = useState(false);
  const [tabQuery, setTabQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    tabId: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (openTabSearchSignal > 0) {
      setShowTabSearch(true);
      setTabQuery('');
    }
  }, [openTabSearchSignal]);

  const searchRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowTabSearch(false);
      }
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowTabSearch(false);
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isPrivateWindow = activeTab?.tabMode === 'private';
  const contextTab = contextMenu ? tabs.find((t) => t.id === contextMenu.tabId) : null;
  const contextTabIndex = contextTab ? tabs.findIndex((t) => t.id === contextTab.id) : -1;
  const hasTabsToRight = contextTabIndex >= 0 && contextTabIndex < tabs.length - 1;
  const hasOtherTabs = tabs.length > 1;

  const renderFavicon = (tab: WebTab, isActive: boolean) => {
    if (tab.isLoading) {
      return <RotateCw className="w-3.5 h-3.5 text-[var(--bn-accent)] animate-spin" />;
    }
    if (tab.tabMode === 'private') {
      return <Lock className="w-3.5 h-3.5 text-[var(--bn-private-text)]" />;
    }
    if (tab.url === 'fabinav://newtab' || !tab.url) {
      return (
        <Compass
          className={`w-3.5 h-3.5 ${
            isActive ? 'text-[var(--bn-text-strong)]' : 'text-[var(--bn-text-muted)]'
          }`}
        />
      );
    }
    if (tab.url.startsWith('fabinav://search')) {
      return <Search className="w-3.5 h-3.5 text-[var(--bn-accent)]" />;
    }
    if (tab.url.startsWith('fabinav://shields')) {
      return <ShieldCheck className="w-3.5 h-3.5 text-[var(--bn-accent)]" />;
    }
    return (
      <Globe
        className={`w-3.5 h-3.5 transition-colors ${
          isActive ? 'text-[var(--bn-text-strong)]' : 'text-[var(--bn-text-muted)]'
        }`}
      />
    );
  };

  const filteredOpenTabs = tabs.filter(
    (t) =>
      t.title.toLowerCase().includes(tabQuery.toLowerCase()) ||
      t.url.toLowerCase().includes(tabQuery.toLowerCase())
  );

  return (
    <div
      id="fabinav-tabstrip"
      onDoubleClick={(e) => {
        if (e.target === e.currentTarget) onToggleMaximizeWindow();
      }}
      className="h-[38px] bg-[var(--bn-tabstrip)] flex items-center pl-2 pr-0 gap-1 select-none z-[45] shrink-0 relative fabi-drag-region"
      role="tablist"
      aria-label="Pestañas de FabiNav"
    >
      {/* Floating Rounded Tabs */}
      {!useVerticalTabs ? (
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1 max-w-full py-1">
          <AnimatePresence initial={false}>
            {tabs.map((tab, index) => {
              const isActive = tab.id === activeTabId;
              const isSplit = tab.id === splitTabId;
              const isNewTab = tab.url === 'fabinav://newtab' || !tab.url;

              return (
                <motion.div
                  key={tab.id}
                  layout="position"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ duration: 0.14, ease: EASE_OUT }}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onSelectTab(tab.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({
                      tabId: tab.id,
                      x: Math.max(8, Math.min(e.clientX, window.innerWidth - 280)),
                      y: Math.max(8, Math.min(e.clientY + 4, window.innerHeight - 360))
                    });
                  }}
                  onAuxClick={(e) => {
                    if (e.button === 1 && (!tab.isPinned || tabs.length === 1)) {
                      e.preventDefault();
                      onCloseTab(tab.id);
                    }
                  }}
                  className={`group relative flex items-center h-[30px] px-2.5 text-xs cursor-pointer transition-colors fabi-transition-s shrink-0 rounded-[8px] fabi-no-drag ${
                    isActive
                      ? 'bg-[var(--bn-tab-active)] text-[var(--bn-text-strong)] font-medium shadow-xs'
                      : isSplit
                      ? 'bg-[var(--bn-surface-alt)]/75 text-[var(--bn-text-strong)]'
                      : 'bg-transparent text-[var(--bn-text-muted)] hover:bg-[var(--bn-hover)]/65 hover:text-[var(--bn-text)]'
                  } ${
                    tab.isPinned
                      ? 'min-w-[38px] max-w-[38px] justify-center px-1.5'
                      : 'min-w-[135px] max-w-[230px] flex-1'
                  } ${tab.isDiscarded && !isActive ? 'opacity-65' : ''}`}
                  title={`${tab.title}${tab.isDiscarded ? ' (Suspendida · Ahorro de memoria)' : ''} (clic derecho para opciones)`}
                >
                  {/* Subtle divider between consecutive inactive tabs */}
                  {!isActive && index > 0 && tabs[index - 1].id !== activeTabId && (
                    <span className="absolute -left-[2px] top-2 bottom-2 w-[1px] bg-[var(--bn-border)] opacity-50 pointer-events-none" />
                  )}

                  <div className="flex items-center justify-center shrink-0 mr-2">
                    {renderFavicon(tab, isActive)}
                  </div>

                  {!tab.isPinned && (
                    <span className="truncate flex-1 text-[12px] leading-none">
                      {isNewTab ? t(language, 'newTab') : tab.title || t(language, 'untitled')}
                    </span>
                  )}

                  <div className="flex items-center gap-0.5 ml-1.5 shrink-0">
                    {tab.isPinned && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePinTab(tab.id);
                        }}
                        className="p-0.5 text-[var(--bn-accent)] rounded-full"
                        title="Desanclar pestaña"
                      >
                        <Pin className="w-2.5 h-2.5" />
                      </button>
                    )}

                    {tab.isMuted && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleMuteTab(tab.id);
                        }}
                        className="p-0.5 text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] rounded-full"
                        title="Activar sonido"
                      >
                        <VolumeX className="w-3 h-3" />
                      </button>
                    )}

                    {(!tab.isPinned || tabs.length === 1) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCloseTab(tab.id);
                        }}
                        title={
                          tabs.length === 1
                            ? 'Cerrar pestaña y salir del navegador (Ctrl+W)'
                            : 'Cerrar pestaña (Ctrl+W)'
                        }
                        className={`p-0.5 rounded-full hover:bg-[var(--bn-hover)] active:scale-90 text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] transition-all ${
                          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* '+' New Tab button right next to tabs */}
          <button
            id="btn-new-tab"
            type="button"
            onClick={onNewTab}
            title={`${t(language, 'newTab')} (Ctrl+T)`}
            className="ml-0.5 h-7 w-7 flex items-center justify-center rounded-[8px] hover:bg-[var(--bn-hover)] active:scale-90 text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] transition-all fabi-transition-s shrink-0 fabi-no-drag"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex-1 flex items-center h-8 px-2 text-xs text-[var(--bn-text-muted)]">
          <span className="truncate font-medium text-[var(--bn-text-strong)]">
            {activeTab?.title || 'FabiNav'}
          </span>
        </div>
      )}

      {/* Right Frame Controls: Window Name (if set), Private Badge, Vertical Tabs Toggle, Tab Search (v), Minimize (—), Maximize (❐), Close (×) */}
      <div className="flex items-center h-full shrink-0 pl-2 fabi-no-drag">
        {windowTitle && windowTitle.trim() && (
          <span
            title={`Ventana: ${windowTitle}`}
            className="mr-1.5 px-2.5 py-0.5 rounded-full bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] text-[var(--bn-text-strong)] text-[11px] font-medium max-w-[140px] truncate"
          >
            {windowTitle}
          </span>
        )}
        {isPrivateWindow && (
          <span className="mr-1.5 px-2.5 py-0.5 rounded-full bg-[var(--bn-private)]/20 text-[var(--bn-private-text)] text-[11px] font-medium flex items-center gap-1 whitespace-nowrap">
            <Lock className="w-3 h-3" />
            <span>{t(language, 'privateBadge')}</span>
          </span>
        )}

        <button
          type="button"
          onClick={onToggleVerticalTabs}
          title={useVerticalTabs ? t(language, 'verticalTabsOn') : t(language, 'verticalTabsOff')}
          className={`w-7 h-7 rounded-[7px] flex items-center justify-center active:scale-90 transition-all fabi-transition-s mr-0.5 ${
            useVerticalTabs
              ? 'bg-[var(--bn-hover)] text-[var(--bn-accent)]'
              : 'text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)]'
          }`}
        >
          <PanelLeft className="w-3.5 h-3.5" />
        </button>

        {/* Tab Search Popover (triggered via Ctrl+Shift+A or Menu) */}
        <div className="relative flex items-center" ref={searchRef}>
          <AnimatePresence>
            {showTabSearch && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                transition={{ duration: 0.16, ease: EASE_OUT }}
                className="absolute right-0 top-9 w-80 bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-2xl shadow-2xl z-50 overflow-hidden text-xs origin-top-right"
              >
                <div className="p-2.5 border-b border-[var(--bn-border)] flex items-center gap-2 bg-[var(--bn-toolbar)]">
                  <Search className="w-3.5 h-3.5 text-[var(--bn-text-muted)] shrink-0" />
                  <input
                    type="text"
                    autoFocus
                    value={tabQuery}
                    onChange={(e) => setTabQuery(e.target.value)}
                    placeholder={t(language, 'searchOpenTabsPlaceholder')}
                    className="w-full bg-transparent text-[var(--bn-text-strong)] placeholder-[var(--bn-text-muted)] focus:outline-none text-xs"
                  />
                </div>

                <div className="max-h-72 overflow-y-auto p-1.5 space-y-1">
                  <div className="px-2 py-1 text-[11px] font-medium text-[var(--bn-text-muted)] tabular-nums">
                    {t(language, 'openTabsCount')} ({filteredOpenTabs.length})
                  </div>
                  {filteredOpenTabs.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => {
                        onSelectTab(t.id);
                        setShowTabSearch(false);
                      }}
                      className={`px-2.5 py-2 rounded-xl flex items-center justify-between gap-2 cursor-pointer transition-colors fabi-transition-xs ${
                        t.id === activeTabId
                          ? 'bg-[var(--bn-active)] text-[var(--bn-text-strong)]'
                          : 'hover:bg-[var(--bn-hover)] text-[var(--bn-text)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {renderFavicon(t, t.id === activeTabId)}
                        <div className="min-w-0">
                          <div className="truncate font-medium">{t.title}</div>
                          <div className="truncate text-[10px] text-[var(--bn-text-muted)]">{t.url}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCloseTab(t.id);
                        }}
                        title={tabs.length === 1 ? 'Cerrar pestaña y salir' : 'Cerrar pestaña'}
                        className="p-1 text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] rounded-full"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {closedTabs.length > 0 && (
                    <>
                      <div className="px-2 pt-2 pb-1 text-[11px] font-medium text-[var(--bn-text-muted)] border-t border-[var(--bn-border)] mt-1">
                        Cerradas recientemente
                      </div>
                      {closedTabs.slice(0, 4).map((ct) => (
                        <button
                          key={ct.id}
                          type="button"
                          onClick={() => {
                            onReopenClosedTab(ct.id);
                            setShowTabSearch(false);
                          }}
                          className="w-full px-2.5 py-2 rounded-xl flex items-center justify-between gap-2 hover:bg-[var(--bn-hover)] text-left transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-[var(--bn-text)] font-medium">{ct.title}</div>
                            <div className="truncate text-[10px] text-[var(--bn-text-muted)]">{ct.url}</div>
                          </div>
                          <RotateCcw className="w-3.5 h-3.5 text-[var(--bn-text-muted)] shrink-0" />
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Desktop Window Controls: Minimize (—), Maximize/Restore (❐), Close (×) */}
        <div className="flex items-center h-full">
          <button
            type="button"
            onClick={onMinimizeWindow}
            title={t(language, 'minimizeWindow')}
            aria-label={t(language, 'minimizeWindow')}
            className="w-11 h-full flex items-center justify-center text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)] transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1.15" />
            </svg>
          </button>

          <button
            type="button"
            onClick={onToggleMaximizeWindow}
            title={isMaximized ? t(language, 'restoreWindow') : t(language, 'maximizeWindow')}
            aria-label={isMaximized ? t(language, 'restoreWindow') : t(language, 'maximizeWindow')}
            className="w-11 h-full flex items-center justify-center text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)] transition-colors"
          >
            {isMaximized ? (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <rect x="1.2" y="2.8" width="6" height="6" stroke="currentColor" strokeWidth="1.1" />
                <path d="M3 2.8V1.2H8.8V7H7.2" stroke="currentColor" strokeWidth="1.1" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <rect x="1.2" y="1.2" width="7.6" height="7.6" stroke="currentColor" strokeWidth="1.1" />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={onCloseWindow}
            title={t(language, 'closeWindow')}
            aria-label={t(language, 'closeWindow')}
            className="w-11 h-full flex items-center justify-center text-[var(--bn-text-muted)] hover:bg-[#c42b1c] hover:text-white transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <line x1="1.5" y1="1.5" x2="8.5" y2="8.5" stroke="currentColor" strokeWidth="1.15" />
              <line x1="8.5" y1="1.5" x2="1.5" y2="8.5" stroke="currentColor" strokeWidth="1.15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tab Context Menu (Right Click) rendered in portal so TitleBar/Omnibox never overlap */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {contextMenu && contextTab && (
              <motion.div
                ref={contextRef}
                initial={{ opacity: 0, scale: 0.97, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.12, ease: EASE_OUT }}
                style={{ left: contextMenu.x, top: contextMenu.y }}
                className="fixed w-[268px] bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-xl overflow-hidden shadow-2xl z-[9999] py-0 text-[12px] text-[var(--bn-text)] select-none"
              >
                <button
                  type="button"
                  onClick={() => {
                    onNewTabToRight(contextTab.id);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center gap-2.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-[var(--bn-text-muted)] shrink-0" />
                  <span className="truncate">{t(language, 'tabNewRight')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onToggleSplitTab(contextTab.id);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center gap-2.5 transition-colors"
                >
                  <Columns className="w-3.5 h-3.5 text-[var(--bn-text-muted)] shrink-0" />
                  <span className="truncate">
                    {splitTabId === contextTab.id
                      ? t(language, 'tabRemoveSplit')
                      : t(language, 'tabAddSplit')}
                  </span>
                </button>

                <div className="h-[1px] bg-[var(--bn-border)] my-1.5" />

                <button
                  type="button"
                  onClick={() => {
                    onReloadTab(contextTab.id);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center justify-between gap-2.5 transition-colors"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <RotateCw className="w-3.5 h-3.5 text-[var(--bn-text-muted)] shrink-0" />
                    <span className="truncate">{t(language, 'tabReload')}</span>
                  </span>
                  <span className="text-[11px] text-[var(--bn-text-muted)] font-mono shrink-0">
                    Ctrl+R
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onDuplicateTab(contextTab.id);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center gap-2.5 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-[var(--bn-text-muted)] shrink-0" />
                  <span className="truncate">{t(language, 'tabDuplicate')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onTogglePinTab(contextTab.id);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center gap-2.5 transition-colors"
                >
                  <Pin className="w-3.5 h-3.5 text-[var(--bn-text-muted)] shrink-0" />
                  <span className="truncate">
                    {contextTab.isPinned ? t(language, 'tabUnpin') : t(language, 'tabPin')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onToggleMuteTab(contextTab.id);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center gap-2.5 transition-colors"
                >
                  {contextTab.isMuted ? (
                    <Volume2 className="w-3.5 h-3.5 text-[var(--bn-text-muted)] shrink-0" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 text-[var(--bn-text-muted)] shrink-0" />
                  )}
                  <span className="truncate">
                    {contextTab.isMuted ? t(language, 'tabUnmute') : t(language, 'tabMute')}
                  </span>
                </button>

                <div className="h-[1px] bg-[var(--bn-border)] my-1.5" />

                <button
                  type="button"
                  onClick={() => {
                    onToggleVerticalTabs();
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center gap-2.5 transition-colors"
                >
                  <PanelLeft className="w-3.5 h-3.5 text-[var(--bn-text-muted)] shrink-0" />
                  <span className="truncate">
                    {useVerticalTabs
                      ? t(language, 'verticalTabsOn')
                      : t(language, 'verticalTabsOff')}
                  </span>
                </button>

                <div className="h-[1px] bg-[var(--bn-border)] my-1.5" />

                {(!contextTab.isPinned || tabs.length === 1) && (
                  <button
                    type="button"
                    onClick={() => {
                      onCloseTab(contextTab.id);
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] text-[var(--bn-danger-text)] flex items-center justify-between gap-2.5 transition-colors"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <X className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        {tabs.length === 1 ? t(language, 'tabCloseAndExit') : t(language, 'tabClose')}
                      </span>
                    </span>
                    <span className="text-[11px] opacity-75 font-mono shrink-0">Ctrl+W</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={!hasOtherTabs}
                  onClick={() => {
                    if (!hasOtherTabs) return;
                    onCloseOtherTabs(contextTab.id);
                    setContextMenu(null);
                  }}
                  className={`w-full text-left px-3.5 py-2 flex items-center gap-2.5 transition-colors ${
                    hasOtherTabs
                      ? 'hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)]'
                      : 'text-[var(--bn-text-muted)]/45 cursor-not-allowed'
                  }`}
                >
                  <span className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{t(language, 'tabCloseOthers')}</span>
                </button>

                <button
                  type="button"
                  disabled={!hasTabsToRight}
                  onClick={() => {
                    if (!hasTabsToRight) return;
                    onCloseTabsToRight(contextTab.id);
                    setContextMenu(null);
                  }}
                  className={`w-full text-left px-3.5 py-2 flex items-center gap-2.5 transition-colors ${
                    hasTabsToRight
                      ? 'hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)]'
                      : 'text-[var(--bn-text-muted)]/45 cursor-not-allowed'
                  }`}
                >
                  <span className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{t(language, 'tabCloseRight')}</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
};
