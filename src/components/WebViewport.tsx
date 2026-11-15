import React from 'react';
import {
  WebTab,
  BrowserSettings,
  FabiShieldState,
  FabiNewTabCustomization,
  BrowserProfile,
  HistoryEntry,
  Bookmark,
  DownloadItem,
  TopSiteItem
} from '../types';
import { Columns, ExternalLink, ShieldCheck, ShieldOff, Search, Globe } from 'lucide-react';
import { FabiNewTabView } from './FabiNewTabView';
import { FabiInternalsView } from './FabiInternalsView';

interface WebViewportProps {
  primaryTab: WebTab;
  splitTab?: WebTab | null;
  settings: BrowserSettings;
  shieldState: FabiShieldState;
  onUpdateShieldState: (updates: Partial<FabiShieldState>) => void;
  onUpdateSettings: (updates: Partial<BrowserSettings>) => void;
  customization: FabiNewTabCustomization;
  topSites: TopSiteItem[];
  onAddTopSite: (title: string, url: string) => void;
  onRemoveTopSite: (id: string) => void;
  onNavigate: (tabId: string, url: string) => void;
  onToggleSplitTab?: (tabId: string) => void;
  onUpdateCustomization: (updates: Partial<FabiNewTabCustomization>) => void;
  onOpenShieldModal: () => void;
  profile: BrowserProfile;
  onUpdateProfile: (updates: Partial<BrowserProfile>) => void;
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
}

export const WebViewport: React.FC<WebViewportProps> = ({
  primaryTab,
  splitTab,
  settings,
  shieldState,
  onUpdateShieldState,
  onUpdateSettings,
  customization,
  topSites,
  onAddTopSite,
  onRemoveTopSite,
  onNavigate,
  onToggleSplitTab,
  onUpdateCustomization,
  onOpenShieldModal,
  profile,
  onUpdateProfile,
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
  onOpenElectronModal
}) => {
  const isSplit = !!splitTab;

  const sharedProps = {
    settings,
    shieldState,
    onUpdateShieldState,
    onUpdateSettings,
    customization,
    topSites,
    onAddTopSite,
    onRemoveTopSite,
    onUpdateCustomization,
    onOpenShieldModal,
    profile,
    onUpdateProfile,
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
    onOpenElectronModal
  };

  return (
    <main
      id="fabinav-viewport-container"
      className="flex-1 bg-[var(--bn-surface)] relative overflow-hidden flex"
    >
      <div
        className={`h-full overflow-hidden flex flex-col ${
          isSplit ? 'w-1/2 border-r border-[var(--bn-border)]' : 'w-full'
        }`}
      >
        <SingleTabFrame
          tab={primaryTab}
          onNavigate={(url) => onNavigate(primaryTab.id, url)}
          onCloseSplit={isSplit && splitTab ? () => onToggleSplitTab?.(splitTab.id) : undefined}
          isSplit={isSplit}
          label="Panel izquierdo"
          {...sharedProps}
        />
      </div>

      {isSplit && splitTab && (
        <div className="w-1/2 h-full overflow-hidden flex flex-col bg-[var(--bn-surface)]">
          <SingleTabFrame
            tab={splitTab}
            onNavigate={(url) => onNavigate(splitTab.id, url)}
            onCloseSplit={() => onToggleSplitTab?.(splitTab.id)}
            isSplit={true}
            label="Panel derecho"
            {...sharedProps}
          />
        </div>
      )}
    </main>
  );
};

interface SingleTabFrameProps {
  tab: WebTab;
  settings: BrowserSettings;
  shieldState: FabiShieldState;
  onUpdateShieldState: (updates: Partial<FabiShieldState>) => void;
  onUpdateSettings: (updates: Partial<BrowserSettings>) => void;
  customization: FabiNewTabCustomization;
  topSites: TopSiteItem[];
  onAddTopSite: (title: string, url: string) => void;
  onRemoveTopSite: (id: string) => void;
  onNavigate: (url: string) => void;
  onCloseSplit?: () => void;
  isSplit?: boolean;
  label?: string;
  onUpdateCustomization: (updates: Partial<FabiNewTabCustomization>) => void;
  onOpenShieldModal: () => void;
  profile: BrowserProfile;
  onUpdateProfile: (updates: Partial<BrowserProfile>) => void;
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
}

const SingleTabFrame: React.FC<SingleTabFrameProps> = ({
  tab,
  settings,
  shieldState,
  onUpdateShieldState,
  onUpdateSettings,
  customization,
  topSites,
  onAddTopSite,
  onRemoveTopSite,
  onNavigate,
  onCloseSplit,
  isSplit,
  label,
  onUpdateCustomization,
  onOpenShieldModal,
  profile,
  onUpdateProfile,
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
  onOpenElectronModal
}) => {
  const isNewTab = tab.url === 'fabinav://newtab' || !tab.url;
  const isSearchPage = tab.url.startsWith('fabinav://search?q=');
  const isFabiInternal = tab.url.startsWith('fabinav://') && !isNewTab && !isSearchPage;

  const searchQuery = isSearchPage
    ? decodeURIComponent(tab.url.replace('fabinav://search?q=', ''))
    : '';

  const searchTargets = isSearchPage
    ? [
        {
          id: 'brave',
          name: 'Brave Search',
          desc: 'Motor de búsqueda privado predeterminado',
          href: `https://search.brave.com/search?q=${encodeURIComponent(searchQuery)}`
        },
        {
          id: 'google',
          name: 'Google',
          desc: 'Resultados web de Google',
          href: `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`
        },
        {
          id: 'duckduckgo',
          name: 'DuckDuckGo',
          desc: 'Búsqueda sin seguimiento',
          href: `https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}`
        },
        {
          id: 'bing',
          name: 'Bing',
          desc: 'Buscador web de Microsoft',
          href: `https://www.bing.com/search?q=${encodeURIComponent(searchQuery)}`
        },
        {
          id: 'ecosia',
          name: 'Ecosia',
          desc: 'Buscador ecológico',
          href: `https://www.ecosia.org/search?q=${encodeURIComponent(searchQuery)}`
        },
        {
          id: 'wikipedia',
          name: 'Wikipedia',
          desc: 'Enciclopedia libre (carga directa en pestaña)',
          internalUrl: `https://es.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(searchQuery)}`
        }
      ]
    : [];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-[var(--bn-surface)]">
      {/* Loading bar */}
      {tab.isLoading && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-transparent z-30">
          <div className="h-full bg-[var(--bn-accent)] w-full animate-pulse" />
        </div>
      )}

      {/* Split header strip */}
      {isSplit && (
        <div className="h-7 px-3 bg-[var(--bn-toolbar)] border-b border-[var(--bn-border)] flex items-center justify-between text-[11px] text-[var(--bn-text-muted)] shrink-0">
          <span className="font-medium text-[var(--bn-text-strong)] flex items-center gap-1.5 truncate">
            <Columns className="w-3.5 h-3.5 text-[var(--bn-accent)] shrink-0" />
            <span className="truncate">
              {label}: {tab.title}
            </span>
          </span>
          {onCloseSplit && (
            <button
              type="button"
              onClick={onCloseSplit}
              className="text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] px-2 py-0.5 rounded-full hover:bg-[var(--bn-hover)] whitespace-nowrap shrink-0"
            >
              Cerrar vista dividida
            </button>
          )}
        </div>
      )}

      {isNewTab ? (
        <FabiNewTabView
          onNavigate={onNavigate}
          shieldState={shieldState}
          settings={settings}
          customization={customization}
          topSites={topSites}
          onAddTopSite={onAddTopSite}
          onRemoveTopSite={onRemoveTopSite}
          onUpdateCustomization={onUpdateCustomization}
          onOpenShieldModal={onOpenShieldModal}
        />
      ) : isSearchPage ? (
        <div className="flex-1 overflow-y-auto bg-[var(--bn-surface)] text-[var(--bn-text)] p-8">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="pb-5 border-b border-[var(--bn-border)] flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--bn-accent-soft)] text-[var(--bn-accent)] flex items-center justify-center shrink-0">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-[var(--bn-text-strong)]">
                  Buscar: "{searchQuery}"
                </h1>
                <p className="text-xs text-[var(--bn-text-muted)]">
                  Elige el motor donde deseas abrir los resultados de búsqueda.
                </p>
              </div>
            </div>

            <div className="divide-y divide-[var(--bn-border)] border border-[var(--bn-border)] rounded-2xl bg-[var(--bn-surface-alt)] overflow-hidden">
              {searchTargets.map((target) => {
                const isDefault = target.id === settings.defaultSearchEngine;
                return (
                  <div
                    key={target.id}
                    className="p-4 flex items-center justify-between gap-4 hover:bg-[var(--bn-hover)] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Globe className="w-4 h-4 text-[var(--bn-text-muted)] shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[var(--bn-text-strong)] flex items-center gap-2">
                          <span>{target.name}</span>
                          {isDefault && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bn-accent-soft)] text-[var(--bn-accent)] font-medium">
                              Predeterminado
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[var(--bn-text-muted)]">{target.desc}</div>
                      </div>
                    </div>

                    {target.internalUrl ? (
                      <button
                        type="button"
                        onClick={() => onNavigate(target.internalUrl!)}
                        className="px-3.5 py-1.5 bg-[var(--bn-toolbar)] hover:bg-[var(--bn-active)] border border-[var(--bn-border-strong)] rounded-full text-xs font-medium text-[var(--bn-text-strong)] whitespace-nowrap shrink-0"
                      >
                        Abrir en pestaña
                      </button>
                    ) : (
                      <a
                        href={target.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                          isDefault
                            ? 'bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white'
                            : 'bg-[var(--bn-toolbar)] hover:bg-[var(--bn-active)] border border-[var(--bn-border-strong)] text-[var(--bn-text-strong)]'
                        }`}
                      >
                        <span>Abrir búsqueda</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : isFabiInternal ? (
        <FabiInternalsView
          url={tab.url}
          shieldState={shieldState}
          onUpdateShieldState={onUpdateShieldState}
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          profile={profile}
          onUpdateProfile={onUpdateProfile}
          bookmarks={bookmarks}
          onAddBookmark={onAddBookmark}
          onRemoveBookmark={onRemoveBookmark}
          historyEntries={historyEntries}
          onClearHistory={onClearHistory}
          onDeleteHistoryItem={onDeleteHistoryItem}
          downloads={downloads}
          onRemoveDownload={onRemoveDownload}
          onClearDownloads={onClearDownloads}
          onExportBackup={onExportBackup}
          onImportBackup={onImportBackup}
          onOpenElectronModal={onOpenElectronModal}
          onNavigate={onNavigate}
        />
      ) : (
        <div className="flex-1 w-full h-full relative bg-white flex flex-col">
          <div
            className="flex-1 w-full h-full relative"
            style={{
              zoom: settings.zoomLevel / 100
            }}
          >
            <iframe
              src={tab.url}
              title={tab.title}
              className="w-full h-full border-none bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
            />
          </div>

          {/* Unobtrusive Footer Context Strip */}
          <div className="h-8 px-3.5 bg-[var(--bn-toolbar)] border-t border-[var(--bn-border)] flex items-center justify-between text-[11px] text-[var(--bn-text-muted)] shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {shieldState.enabled ? (
                <span className="text-[var(--bn-success)] flex items-center gap-1 font-medium shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Escudos activos</span>
                </span>
              ) : (
                <span className="text-[var(--bn-text-muted)] flex items-center gap-1 shrink-0">
                  <ShieldOff className="w-3.5 h-3.5" />
                  <span>Escudos pausados</span>
                </span>
              )}
              <span aria-hidden="true">·</span>
              <span className="truncate font-mono">{tab.url}</span>
            </div>

            <a
              href={tab.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--bn-accent)] hover:underline flex items-center gap-1 whitespace-nowrap shrink-0 font-medium"
            >
              <span>Abrir en pestaña externa</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
