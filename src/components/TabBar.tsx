import React, { useState, useRef, useEffect } from 'react';
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
  ChevronDown,
  PanelLeft,
  RotateCcw,
  Search,
  Copy,
  Columns
} from 'lucide-react';
import { WebTab, ClosedTabRecord } from '../types';

interface TabBarProps {
  tabs: WebTab[];
  activeTabId: string;
  splitTabId: string | null;
  closedTabs: ClosedTabRecord[];
  useVerticalTabs: boolean;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onCloseOtherTabs: (tabId: string) => void;
  onDuplicateTab: (tabId: string) => void;
  onReloadTab: (tabId: string) => void;
  onNewTab: () => void;
  onReopenClosedTab: (recordId?: string) => void;
  onTogglePinTab: (tabId: string) => void;
  onToggleMuteTab: (tabId: string) => void;
  onToggleSplitTab: (tabId: string) => void;
  onToggleVerticalTabs: () => void;
}

const LEO_EASE_OUT: [number, number, number, number] = [0, 0, 0.58, 1];

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  splitTabId,
  closedTabs,
  useVerticalTabs,
  onSelectTab,
  onCloseTab,
  onCloseOtherTabs,
  onDuplicateTab,
  onReloadTab,
  onNewTab,
  onReopenClosedTab,
  onTogglePinTab,
  onToggleMuteTab,
  onToggleSplitTab,
  onToggleVerticalTabs
}) => {
  const [showTabSearch, setShowTabSearch] = useState(false);
  const [tabQuery, setTabQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    tabId: string;
    x: number;
    y: number;
  } | null>(null);

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

  const renderFavicon = (tab: WebTab, isActive: boolean) => {
    if (tab.isLoading) {
      return <RotateCw className="w-3.5 h-3.5 text-[var(--bn-accent)] animate-spin" />;
    }
    if (tab.tabMode === 'private') {
      return <Lock className="w-3.5 h-3.5 text-[var(--bn-private-text)]" />;
    }
    if (tab.url === 'fabinav://newtab' || !tab.url) {
      return (
        <span
          className="w-3.5 h-3.5 rounded-full text-white flex items-center justify-center text-[8px] font-bold shadow-xs"
          style={{ background: 'var(--leo-gradient-brand)' }}
        >
          F
        </span>
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
      className="h-10 bg-[var(--bn-tabstrip)] flex items-end px-2 pt-1.5 gap-1 select-none z-40 shrink-0 relative"
      role="tablist"
      aria-label="Pestañas del navegador"
    >
      {/* Brave Tab Search Button */}
      <div className="relative mb-1.5 mr-1 shrink-0" ref={searchRef}>
        <button
          type="button"
          onClick={() => {
            setShowTabSearch(!showTabSearch);
            setTabQuery('');
          }}
          title="Buscar pestañas y cerradas recientemente"
          className="w-7 h-7 rounded-full flex items-center justify-center bg-[var(--bn-surface-alt)]/75 hover:bg-[var(--bn-hover)] active:scale-95 text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] transition-all leo-transition-s"
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-150 ${
              showTabSearch ? 'rotate-180 text-[var(--bn-text-strong)]' : ''
            }`}
          />
        </button>

        <AnimatePresence>
          {showTabSearch && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.16, ease: LEO_EASE_OUT }}
              className="absolute left-0 top-9 w-80 bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-2xl shadow-2xl z-50 overflow-hidden text-xs origin-top-left"
            >
              <div className="p-2.5 border-b border-[var(--bn-border)] flex items-center gap-2 bg-[var(--bn-toolbar)]">
                <Search className="w-3.5 h-3.5 text-[var(--bn-text-muted)] shrink-0" />
                <input
                  type="text"
                  autoFocus
                  value={tabQuery}
                  onChange={(e) => setTabQuery(e.target.value)}
                  placeholder="Buscar pestañas abiertas..."
                  className="w-full bg-transparent text-[var(--bn-text-strong)] placeholder-[var(--bn-text-muted)] focus:outline-none text-xs"
                />
              </div>

              <div className="max-h-72 overflow-y-auto p-1.5 space-y-1">
                <div className="px-2 py-1 text-[11px] font-medium text-[var(--bn-text-muted)] tabular-nums">
                  Pestañas abiertas ({filteredOpenTabs.length})
                </div>
                {filteredOpenTabs.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      onSelectTab(t.id);
                      setShowTabSearch(false);
                    }}
                    className={`px-2.5 py-2 rounded-xl flex items-center justify-between gap-2 cursor-pointer transition-colors leo-transition-xs ${
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
                    {tabs.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCloseTab(t.id);
                        }}
                        title="Cerrar pestaña"
                        className="p-1 text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] rounded-full"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
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

      {/* Horizontal Chromium/Brave Tabs with Leo motion & context menu */}
      {!useVerticalTabs ? (
        <div className="flex items-end gap-0.5 overflow-x-auto no-scrollbar flex-1 max-w-full">
          <AnimatePresence initial={false}>
            {tabs.map((tab, index) => {
              const isActive = tab.id === activeTabId;
              const isSplit = tab.id === splitTabId;
              const isNewTab = tab.url === 'fabinav://newtab' || !tab.url;

              return (
                <motion.div
                  key={tab.id}
                  layout="position"
                  initial={{ opacity: 0, y: 6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ duration: 0.16, ease: LEO_EASE_OUT }}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onSelectTab(tab.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({
                      tabId: tab.id,
                      x: Math.min(e.clientX, window.innerWidth - 220),
                      y: Math.min(e.clientY + 4, window.innerHeight - 280)
                    });
                  }}
                  onAuxClick={(e) => {
                    if (e.button === 1 && !tab.isPinned && tabs.length > 1) {
                      e.preventDefault();
                      onCloseTab(tab.id);
                    }
                  }}
                  className={`group relative flex items-center h-[34px] px-3 text-xs cursor-pointer transition-colors leo-transition-s shrink-0 ${
                    isActive
                      ? 'bg-[var(--bn-toolbar)] text-[var(--bn-text-strong)] font-medium rounded-t-[10px] shadow-sm'
                      : isSplit
                      ? 'bg-[var(--bn-surface-alt)]/75 text-[var(--bn-text-strong)] rounded-t-[8px]'
                      : 'bg-transparent text-[var(--bn-text-muted)] hover:bg-[var(--bn-hover)]/65 hover:text-[var(--bn-text)] rounded-t-[8px]'
                  } ${tab.isPinned ? 'min-w-[42px] max-w-[42px] justify-center px-1.5' : 'min-w-[125px] max-w-[230px] flex-1'}`}
                  title={`${tab.title} (clic derecho para opciones)`}
                >
                  {/* Divider between inactive tabs */}
                  {!isActive && index > 0 && tabs[index - 1].id !== activeTabId && (
                    <span className="absolute left-0 top-2 bottom-2 w-[1px] bg-[var(--bn-border)] opacity-60" />
                  )}

                  <div className="flex items-center justify-center shrink-0 mr-2">
                    {renderFavicon(tab, isActive)}
                  </div>

                  {!tab.isPinned && (
                    <span className="truncate flex-1 text-[12px] leading-none">
                      {isNewTab ? 'Nueva pestaña' : tab.title || 'Sin título'}
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

                    {!tab.isPinned && tabs.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCloseTab(tab.id);
                        }}
                        title="Cerrar pestaña (Ctrl+W)"
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

          {/* New Tab '+' Button right next to tabs */}
          <button
            id="btn-new-tab"
            type="button"
            onClick={onNewTab}
            title="Nueva pestaña (Ctrl+T)"
            className="mb-1 ml-1 p-1.5 h-7 w-7 flex items-center justify-center rounded-full hover:bg-[var(--bn-hover)] active:scale-90 text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] transition-all leo-transition-s shrink-0"
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

      {/* Right Frame Controls: Private Indicator + Vertical Tabs Toggle */}
      <div className="flex items-center gap-1.5 mb-1.5 shrink-0 pl-2">
        {isPrivateWindow && (
          <span className="px-2.5 py-0.5 rounded-full bg-[var(--bn-private)]/20 text-[var(--bn-private-text)] text-[11px] font-medium flex items-center gap-1 whitespace-nowrap">
            <Lock className="w-3 h-3" />
            <span>Privado</span>
          </span>
        )}
        <button
          type="button"
          onClick={onToggleVerticalTabs}
          title={useVerticalTabs ? 'Cambiar a pestañas horizontales' : 'Cambiar a pestañas verticales'}
          className={`p-1.5 rounded-full active:scale-90 transition-all leo-transition-s ${
            useVerticalTabs
              ? 'bg-[var(--bn-hover)] text-[var(--bn-accent)]'
              : 'text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)]'
          }`}
        >
          <PanelLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Brave Tab Context Menu (Right Click) */}
      <AnimatePresence>
        {contextMenu && contextTab && (
          <motion.div
            ref={contextRef}
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.12, ease: LEO_EASE_OUT }}
            style={{ left: contextMenu.x, top: contextMenu.y }}
            className="fixed w-52 bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-2xl shadow-2xl z-50 py-1.5 text-xs text-[var(--bn-text)]"
          >
            <button
              type="button"
              onClick={() => {
                onReloadTab(contextTab.id);
                setContextMenu(null);
              }}
              className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center gap-2.5 transition-colors"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Recargar pestaña</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onDuplicateTab(contextTab.id);
                setContextMenu(null);
              }}
              className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center gap-2.5 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Duplicar pestaña</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onTogglePinTab(contextTab.id);
                setContextMenu(null);
              }}
              className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center gap-2.5 transition-colors"
            >
              <Pin className="w-3.5 h-3.5" />
              <span>{contextTab.isPinned ? 'Desanclar pestaña' : 'Anclar pestaña'}</span>
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
                <Volume2 className="w-3.5 h-3.5" />
              ) : (
                <VolumeX className="w-3.5 h-3.5" />
              )}
              <span>{contextTab.isMuted ? 'Activar sonido' : 'Silenciar sitio'}</span>
            </button>

            {tabs.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  onToggleSplitTab(contextTab.id);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center gap-2.5 transition-colors"
              >
                <Columns className="w-3.5 h-3.5" />
                <span>{splitTabId === contextTab.id ? 'Quitar vista dividida' : 'Abrir en vista dividida'}</span>
              </button>
            )}

            <div className="h-[1px] bg-[var(--bn-border)] my-1.5" />

            {tabs.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  onCloseOtherTabs(contextTab.id);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] hover:text-[var(--bn-text-strong)] flex items-center gap-2.5 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cerrar otras pestañas</span>
              </button>
            )}

            {!contextTab.isPinned && tabs.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  onCloseTab(contextTab.id);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-[var(--bn-hover)] text-[var(--bn-danger-text)] flex items-center gap-2.5 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cerrar pestaña</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
