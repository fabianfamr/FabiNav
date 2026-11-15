import {
  Bookmark,
  BrowserSettings,
  TopSiteItem,
  WebTab,
  WallpaperItem,
  FabiShieldState,
  FabiNewTabCustomization,
  LocalBackupMeta
} from '../types';

export const APP_VERSION = '1.9.0';

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
  },
  {
    id: 'aurora-iceland',
    name: 'Aurora Boreal en Islandia',
    url: '/src/assets/images/wallpaper_aurora_iceland_1794766516425.jpg'
  },
  {
    id: 'redwood-mist',
    name: 'Bosque de Secuoyas',
    url: '/src/assets/images/wallpaper_redwood_mist_1794766516630.jpg'
  },
  {
    id: 'patagonia-peaks',
    name: 'Cumbres de la Patagonia',
    url: '/src/assets/images/wallpaper_patagonia_peaks_1794766517969.jpg'
  },
  {
    id: 'sahara-dunes',
    name: 'Dunas al Crepúsculo',
    url: '/src/assets/images/wallpaper_sahara_dunes_1794766518257.jpg'
  },
  {
    id: 'basalt-ocean',
    name: 'Acantilados de Basalto',
    url: '/src/assets/images/wallpaper_basalt_ocean_1794766517480.jpg'
  },
  {
    id: 'kyoto-bamboo',
    name: 'Jardín de Bambú en Kioto',
    url: '/src/assets/images/wallpaper_kyoto_bamboo_1794766517951.jpg'
  },
  {
    id: 'antelope-canyon',
    name: 'Cañón de Arenisca',
    url: '/src/assets/images/wallpaper_antelope_canyon_1794766518992.jpg'
  },
  {
    id: 'arctic-glacier',
    name: 'Glaciar Ártico',
    url: '/src/assets/images/wallpaper_arctic_glacier_1794766518369.jpg'
  },
  {
    id: 'mediterranean-cove',
    name: 'Cala del Mediterráneo',
    url: '/src/assets/images/wallpaper_mediterranean_cove_1794766519597.jpg'
  },
  {
    id: 'minimal-pavilion',
    name: 'Pabellón Minimalista',
    url: '/src/assets/images/wallpaper_minimal_pavilion_1794766520100.jpg'
  }
];

export const INITIAL_SHIELD_STATE: FabiShieldState = {
  enabled: true,
  blockTrackersAndAds: 'standard',
  upgradeHttps: true,
  strictTls: true,
  blockScripts: false,
  blockFingerprinting: 'standard',
  blockCrossSiteCookies: true,
  httpsUpgradesCount: 0,
  trackersBlockedCount: 0,
  cookiesBlockedCount: 0,
  searchesCount: 0
};

export const INITIAL_BACKUP_META: LocalBackupMeta = {
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
  { id: 'ts-5', title: 'Archive.org', url: 'https://archive.org' }
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
  defaultSearchEngine: 'fabinav',
  homepage: 'fabinav://newtab',
  theme: 'brave-dark',
  showSidebar: true,
  sidebarMode: 'on',
  sidebarPosition: 'right',
  showBookmarksBar: true,
  useVerticalTabs: false,
  showHomeButton: false,
  zoomLevel: 100
};

export const ELECTRON_MAIN_JS = `const { app, BrowserWindow, session } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 620,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#17181c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  });

  // Forzar TLS moderno y cabecera DNT en Chromium
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['DNT'] = '1';
    callback({ requestHeaders: details.requestHeaders });
  });

  win.loadURL(process.env.FABINAV_URL || 'http://localhost:3000');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
`;

export const ELECTRON_PRELOAD_JS = `const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('fabinavDesktop', {
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
});
`;

export const ELECTRON_BOILERPLATE = {
  mainJs: ELECTRON_MAIN_JS,
  preloadJs: ELECTRON_PRELOAD_JS,
  packageJson: JSON.stringify(
    {
      name: 'fabinav-desktop',
      version: APP_VERSION,
      main: 'main.js',
      scripts: {
        start: 'electron .',
        'build:win': 'electron-builder --win',
        'build:mac': 'electron-builder --mac',
        'build:linux': 'electron-builder --linux'
      },
      devDependencies: {
        electron: '^31.0.0',
        'electron-builder': '^24.13.3'
      }
    },
    null,
    2
  )
};
