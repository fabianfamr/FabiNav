export type BrowserTheme =
  | 'fabi-dark'
  | 'fabi-midnight'
  | 'fabi-light'
  | 'brave-dark'
  | 'brave-midnight'
  | 'brave-light';

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

export interface GoogleUserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoUrl: string | null;
}

export interface StoredCookieItem {
  id: string;
  partition: TabMode;
  domain: string;
  path: string;
  name: string;
  value: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string;
  expiresAt: number | null;
  createdAt: number;
  isThirdParty: boolean;
}

export interface TlsInspectionResult {
  host: string;
  port: number;
  authorized: boolean;
  authorizationError: string | null;
  protocol: string | null;
  cipher: string | null;
  alpnProtocol: string | null;
  subjectCN: string | null;
  issuerCN: string | null;
  issuerO: string | null;
  validFrom: string | null;
  validTo: string | null;
  fingerprint256: string | null;
  checkedAt: number;
  error?: string;
}

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
  lastActiveAt?: number;
  isDiscarded?: boolean;
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

export interface LocalBackupMeta {
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

export type AppLanguage = 'es' | 'en' | 'ja';

export type StartupMode = 'newtab' | 'continue' | 'specific';
export type MemorySaverLevel = 'moderate' | 'balanced' | 'maximum';

export interface BrowserSettings {
  defaultSearchEngine: 'fabinav' | 'google' | 'duckduckgo' | 'bing' | 'ecosia' | 'brave';
  homepage: string;
  startupMode?: StartupMode;
  startupUrls?: string;
  theme: BrowserTheme;
  language: AppLanguage;
  showSidebar: boolean;
  sidebarMode?: 'on' | 'auto' | 'off';
  sidebarPosition: 'left' | 'right';
  showBookmarksBar: boolean;
  autoHideBookmarksBar?: boolean;
  autoHideSidebarIdle?: boolean;
  barsAutoHideDelaySec?: 5 | 10 | 15 | 30 | 60;
  useVerticalTabs: boolean;
  showHomeButton: boolean;
  zoomLevel: number;
  memorySaver?: boolean;
  memorySaverMode?: MemorySaverLevel;
  alwaysActiveDomains?: string[];
  preloadPages?: boolean;
  spellCheck?: boolean;
  translateOffer?: boolean;
  translateTargetLang?: AppLanguage;
  reduceMotion?: boolean;
  notificationsEnabled?: boolean;
  notificationDefaultPolicy?: 'ask' | 'block';
  notificationDesktopRelay?: boolean;
  notificationSound?: boolean;
  notificationDoNotDisturb?: boolean;
  notificationPermissions?: Record<string, 'allow' | 'block'>;
}

export interface BrowserNotificationItem {
  id: string;
  tabId?: string;
  origin: string;
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  url?: string;
  createdAt: number;
  read: boolean;
}

export interface PendingNotificationPermission {
  id: string;
  tabId?: string;
  origin: string;
  url?: string;
  source: 'iframe' | 'webview';
  requestId?: string;
}

export interface AutofillEntry {
  id: string;
  category: 'address' | 'payment' | 'contact';
  label: string;
  value: string;
  secondary?: string;
  createdAt: number;
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
  strictTls: boolean;
  blockScripts: boolean;
  blockFingerprinting: 'standard' | 'strict' | 'disabled';
  blockCrossSiteCookies: boolean;
  forgetOnCloseDomains?: string[];
  filterLists?: string[];
  customFilterRules?: string[];
  httpsUpgradesCount: number;
  trackersBlockedCount: number;
  cookiesBlockedCount: number;
  searchesCount: number;
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

export interface SearchResultItem {
  title: string;
  url: string;
  displayUrl: string;
  snippet: string;
  source: 'web' | 'wikipedia';
}

export interface WikiKnowledgeCard {
  title: string;
  description: string | null;
  extract: string;
  thumbnailUrl: string | null;
  url: string;
}

export interface SearchImageItem {
  title: string;
  thumbnailUrl: string;
  imageUrl: string;
  sourceUrl: string;
}

export interface SearchNewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  timestamp: number;
}

export interface SearchVideoItem {
  title: string;
  url: string;
  displayUrl: string;
  snippet: string;
  thumbnailUrl: string | null;
  videoId: string | null;
  channel: string;
}

export interface SearchRepoItem {
  fullName: string;
  description: string;
  url: string;
  language: string | null;
  stars: number;
  forks: number;
  updatedAt: string;
}

export interface RelatedTopicItem {
  title: string;
  extract: string;
  url: string;
}

export interface InstantAnswerData {
  type: 'currency' | 'dictionary' | 'math' | 'unit' | 'color';
  title: string;
  subtitle: string;
  resultText: string;
  details?: Array<{ label: string; value: string }>;
  swatchColor?: string;
  sourceUrl?: string;
  sourceLabel?: string;
}

export interface SearchApiResponse {
  query: string;
  page?: number;
  hasMore?: boolean;
  lang?: 'es' | 'all';
  results: SearchResultItem[];
  wikipedia: SearchResultItem[];
  images?: SearchImageItem[];
  news?: SearchNewsItem[];
  videos?: SearchVideoItem[];
  repos?: SearchRepoItem[];
  relatedTopics?: RelatedTopicItem[];
  relatedQueries?: string[];
  knowledge?: WikiKnowledgeCard | null;
  instantAnswer?: InstantAnswerData | null;
  durationMs?: number;
  webError: string | null;
  fetchedAt: number;
}

export interface DesktopUpdateStatus {
  state: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'unsupported' | 'error';
  version?: string;
  progress?: number;
  message?: string;
}

export interface CacheEntrySummary {
  kind: 'page' | 'search';
  label: string;
  sizeBytes: number;
  cachedAt: number;
}

export interface CacheStatusInfo {
  proxyCount: number;
  searchCount: number;
  totalBytes: number;
  entries: CacheEntrySummary[];
}

export interface FabiNavDesktopBridge {
  isElectron: boolean;
  platform: string;
  versions?: {
    chrome?: string;
    electron?: string;
    node?: string;
  };
  minimizeWindow: () => void;
  toggleMaximizeWindow: () => void;
  closeWindow: () => void;
  capturePage?: () => Promise<string | null>;
  checkForUpdates: () => Promise<DesktopUpdateStatus>;
  installUpdate: () => Promise<void>;
  openUninstallSettings: () => Promise<{ ok: boolean; message?: string }>;
  onWindowState?: (callback: (state: { isMaximized: boolean }) => void) => () => void;
  onUpdateStatus?: (callback: (status: DesktopUpdateStatus) => void) => () => void;
  onOpenUrlInTab?: (callback: (url: string) => void) => () => void;
  showDesktopNotification?: (payload: {
    id: string;
    title: string;
    body: string;
    origin?: string;
    tabId?: string;
    url?: string;
  }) => Promise<boolean>;
  respondNotificationPermission?: (requestId: string, granted: boolean) => void;
  onNotificationPermissionRequest?: (
    callback: (req: { requestId: string; origin: string; url?: string }) => void
  ) => () => void;
  onNotificationClicked?: (
    callback: (payload: { id: string; tabId?: string; url?: string }) => void
  ) => () => void;
}

declare global {
  interface Window {
    fabinavDesktop?: FabiNavDesktopBridge;
  }
}
