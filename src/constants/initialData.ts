import {
  Bookmark,
  BrowserSettings,
  TopSiteItem,
  WebTab,
  WallpaperItem,
  FabiShieldState,
  FabiNewTabCustomization,
  BrowserProfile
} from '../types';

export const APP_VERSION = '1.5.0';

export const FABI_WALLPAPERS: WallpaperItem[] = [
  {
    id: 'alpine-dusk',
    name: 'Cresta Alpina al Anochecer',
    url: '/src/assets/images/wallpaper_alpine_dusk_1794763338300.jpg'
  },
  {
    id: 'architectural-concrete',
    name: 'Hormigón y Vidrio',
    url: '/src/assets/images/wallpaper_architectural_concrete_1794763339193.jpg'
  },
  {
    id: 'nordic-fjord',
    name: 'Fiordo Nórdico',
    url: '/src/assets/images/wallpaper_nordic_fjord_1794763339286.jpg'
  }
];

export const INITIAL_SHIELD_STATE: FabiShieldState = {
  enabled: true,
  blockTrackersAndAds: 'standard',
  upgradeHttps: true,
  blockScripts: false,
  blockFingerprinting: 'standard',
  blockCrossSiteCookies: true,
  httpsUpgradesCount: 0,
  trackersBlockedCount: 0,
  bandwidthSavedKb: 0
};

export const INITIAL_PROFILE: BrowserProfile = {
  name: 'Fabian',
  email: 'fabianajjdvd@gmail.com',
  avatarUrl: '/src/assets/images/avatar_fabian_profile_1794763339501.jpg',
  lastExportTimestamp: null
};

export const INITIAL_NEWTAB_CUSTOMIZATION: FabiNewTabCustomization = {
  showStats: true,
  showTopSites: true,
  showClock: true,
  selectedWallpaperId: 'alpine-dusk'
};

export const INITIAL_TOP_SITES: TopSiteItem[] = [
  { id: 'ts-1', title: 'Wikipedia', url: 'https://es.wikipedia.org/wiki/Wikipedia:Portada' },
  { id: 'ts-2', title: 'GitHub', url: 'https://github.com' },
  { id: 'ts-3', title: 'MDN Docs', url: 'https://developer.mozilla.org/es/' },
  { id: 'ts-4', title: 'OpenStreetMap', url: 'https://www.openstreetmap.org' },
  { id: 'ts-5', title: 'WhatsApp Web', url: 'https://web.whatsapp.com' },
  { id: 'ts-6', title: 'Discord', url: 'https://discord.com/app' },
  { id: 'ts-7', title: 'Archive.org', url: 'https://archive.org' }
];

export const INITIAL_TABS: WebTab[] = [
  {
    id: 'tab-1',
    title: 'Nueva pestaña',
    url: 'fabinav://newtab',
    displayUrl: 'fabinav://newtab',
    isLoading: false,
    canGoBack: false,
    canGoForward: false,
    history: ['fabinav://newtab'],
    historyIndex: 0,
    isPinned: false,
    isMuted: false,
    isBookmarked: false,
    createdAt: Date.now(),
    tabMode: 'normal'
  }
];

export const INITIAL_BOOKMARKS: Bookmark[] = [
  {
    id: 'bm-1',
    title: 'Wikipedia',
    url: 'https://es.wikipedia.org/wiki/Wikipedia:Portada',
    folder: 'Barra de marcadores',
    createdAt: Date.now()
  },
  {
    id: 'bm-2',
    title: 'GitHub',
    url: 'https://github.com',
    folder: 'Barra de marcadores',
    createdAt: Date.now()
  },
  {
    id: 'bm-3',
    title: 'MDN Web Docs',
    url: 'https://developer.mozilla.org/es/',
    folder: 'Barra de marcadores',
    createdAt: Date.now()
  },
  {
    id: 'bm-4',
    title: 'OpenStreetMap',
    url: 'https://www.openstreetmap.org',
    folder: 'Barra de marcadores',
    createdAt: Date.now()
  }
];

export const DEFAULT_SETTINGS: BrowserSettings = {
  defaultSearchEngine: 'brave',
  homepage: 'fabinav://newtab',
  theme: 'brave-dark',
  showSidebar: true,
  sidebarPosition: 'right',
  showBookmarksBar: true,
  useVerticalTabs: false,
  showHomeButton: false,
  zoomLevel: 100
};

export const ELECTRON_BOILERPLATE = {
  mainJs: `// main.js - FabiNav Desktop Runtime v${APP_VERSION}
const { app, BrowserWindow, session } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    titleBarStyle: 'hidden',
    backgroundColor: '#17181c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: true
    }
  });

  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const blocked = ['doubleclick.net', 'google-analytics.com', 'criteo.net'];
    const shouldBlock = blocked.some((domain) => details.url.includes(domain));
    callback({ cancel: shouldBlock });
  });

  win.loadURL('http://localhost:3000');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
`,
  preloadJs: `// preload.js - FabiNav Context Bridge v${APP_VERSION}
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fabinavNative', {
  appVersion: '${APP_VERSION}',
  platform: process.platform,
  sendDevCommand: (cmd) => ipcRenderer.send('dev-command', cmd)
});
`,
  packageJson: `{
  "name": "fabinav-desktop",
  "version": "${APP_VERSION}",
  "description": "FabiNav — Navegador web de escritorio con interfaz estilo Brave.",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "build:win": "electron-builder --win",
    "build:mac": "electron-builder --mac",
    "build:linux": "electron-builder --linux"
  },
  "dependencies": {
    "electron-store": "^8.1.0"
  },
  "devDependencies": {
    "electron": "^31.0.0",
    "electron-builder": "^24.13.3"
  }
}`
};
