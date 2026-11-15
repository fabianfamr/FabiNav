export type BrowserTheme = 'brave-dark' | 'brave-midnight' | 'brave-light';

export type SidebarPanelView =
  | 'bookmarks'
  | 'history'
  | 'downloads'
  | 'notes'
  | 'whatsapp'
  | 'discord'
  | 'telegram'
  | 'devtools'
  | null;

export type TabMode = 'normal' | 'private';

export interface WebTab {
  id: string;
  title: string;
  url: string;
  displayUrl: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  history: string[];
  historyIndex: number;
  isPinned: boolean;
  isMuted: boolean;
  isBookmarked?: boolean;
  createdAt: number;
  tabMode?: TabMode;
}

export interface ClosedTabRecord {
  id: string;
  title: string;
  url: string;
  closedAt: number;
  tabMode?: TabMode;
}

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  folder: string;
  createdAt: number;
}

export interface HistoryEntry {
  id: string;
  title: string;
  url: string;
  timestamp: number;
  timeFormatted: string;
}

export interface BrowserProfile {
  name: string;
  email: string;
  avatarUrl: string;
  lastExportTimestamp: number | null;
}

export interface DownloadItem {
  id: string;
  filename: string;
  fileSize: string;
  status: 'completed' | 'canceled';
  url: string;
  timestamp: number;
}

export interface DevToolLog {
  id: string;
  type: 'log' | 'info' | 'warn' | 'error';
  message: string;
  source: string;
  timestamp: string;
}

export interface DevToolNetworkReq {
  id: string;
  url: string;
  method: 'GET' | 'POST';
  status: number;
  type: string;
  timestamp: string;
}

export interface BrowserSettings {
  defaultSearchEngine: 'brave' | 'google' | 'duckduckgo' | 'bing' | 'ecosia';
  homepage: string;
  theme: BrowserTheme;
  showSidebar: boolean;
  sidebarPosition: 'left' | 'right';
  showBookmarksBar: boolean;
  useVerticalTabs: boolean;
  showHomeButton: boolean;
  zoomLevel: number;
}

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  shortcut?: string;
  category: string;
  action: () => void;
}

export interface FabiShieldState {
  enabled: boolean;
  blockTrackersAndAds: 'standard' | 'aggressive' | 'disabled';
  upgradeHttps: boolean;
  blockScripts: boolean;
  blockFingerprinting: 'standard' | 'strict' | 'disabled';
  blockCrossSiteCookies: boolean;
  httpsUpgradesCount: number;
  trackersBlockedCount: number;
  bandwidthSavedKb: number;
}

export interface TopSiteItem {
  id: string;
  title: string;
  url: string;
}

export interface WallpaperItem {
  id: string;
  name: string;
  url: string;
}

export interface FabiNewTabCustomization {
  showStats: boolean;
  showTopSites: boolean;
  showClock: boolean;
  selectedWallpaperId: string;
}
