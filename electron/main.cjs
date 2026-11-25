const { app, BrowserWindow, ipcMain, Notification, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

app.setName('FabiNav');
if (process.platform === 'win32') {
  app.setAppUserModelId('com.fabinav.browser');
}

let mainWindow = null;
let embeddedServer = null;
let autoUpdater = null;

function sendUpdateStatus(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('fabinav:update-status', payload);
  }
}

function setupAutoUpdater() {
  if (!app.isPackaged) {
    return;
  }
  try {
    ({ autoUpdater } = require('electron-updater'));
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      sendUpdateStatus({ state: 'checking', message: 'Buscando actualizaciones de FabiNav...' });
    });

    autoUpdater.on('update-available', (info) => {
      sendUpdateStatus({
        state: 'available',
        version: info && info.version ? info.version : undefined,
        message: `Nueva versión ${info?.version || ''} disponible. Descargando...`
      });
    });

    autoUpdater.on('download-progress', (progress) => {
      sendUpdateStatus({
        state: 'downloading',
        progress: Math.round(progress?.percent || 0),
        message: `Descargando actualización (${Math.round(progress?.percent || 0)}%)...`
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      sendUpdateStatus({
        state: 'downloaded',
        version: info && info.version ? info.version : undefined,
        progress: 100,
        message: `FabiNav v${info?.version || ''} listo para instalar.`
      });
    });

    autoUpdater.on('update-not-available', (info) => {
      sendUpdateStatus({
        state: 'not-available',
        version: info && info.version ? info.version : app.getVersion(),
        message: `FabiNav v${app.getVersion()} está actualizado.`
      });
    });

    autoUpdater.on('error', (err) => {
      sendUpdateStatus({
        state: 'error',
        message: err && err.message ? err.message : 'No se pudo comprobar actualizaciones.'
      });
    });
  } catch {
    autoUpdater = null;
  }
}

async function resolveStartUrl() {
  if (process.env.FABINAV_URL) {
    return process.env.FABINAV_URL;
  }

  process.env.FABINAV_EMBEDDED = '1';
  process.env.FABINAV_ELECTRON = '1';
  process.env.FABINAV_DIST_DIR = path.join(__dirname, '..', 'dist');
  process.env.FABINAV_DATA_DIR = app.getPath('userData');

  const serverBundlePath = path.join(__dirname, '..', 'dist-server', 'server.cjs');
  const { startServer } = require(serverBundlePath);
  const started = await startServer();
  embeddedServer = started.server;
  return `http://127.0.0.1:${started.port}`;
}

function isAllowedOAuthPopup(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'accounts.google.com' ||
      host.endsWith('.firebaseapp.com') ||
      host.endsWith('.google.com') ||
      host.endsWith('.googleusercontent.com') ||
      host === '127.0.0.1' ||
      host === 'localhost'
    );
  } catch {
    return false;
  }
}

async function createWindow() {
  const startUrl = await resolveStartUrl();
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 940,
    minHeight: 600,
    frame: false,
    backgroundColor: '#17181c',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true
    }
  });

  mainWindow.on('maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('fabinav:window-state', { isMaximized: true });
    }
  });

  mainWindow.on('unmaximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('fabinav:window-state', { isMaximized: false });
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedOAuthPopup(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 660,
          autoHideMenuBar: true,
          backgroundColor: '#ffffff',
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
          }
        }
      };
    }
    shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });

  const cleanChromeUa = (app.userAgentFallback || '')
    .replace(/\s*Electron\/[^\s]+/gi, '')
    .replace(/\s*FabiNav\/[^\s]+/gi, '');
  if (cleanChromeUa) {
    app.userAgentFallback = cleanChromeUa;
  }

  const pendingNotifPermissions = new Map();

  ipcMain.on('fabinav:notif-permission-response', (_event, payload) => {
    if (!payload || !payload.requestId) return;
    const entry = pendingNotifPermissions.get(payload.requestId);
    if (entry) {
      pendingNotifPermissions.delete(payload.requestId);
      clearTimeout(entry.timer);
      try {
        entry.callback(!!payload.granted);
      } catch {
        // ignore
      }
    }
  });

  let currentShieldState = {
    enabled: true,
    blockTrackersAndAds: 'standard',
    upgradeHttps: true,
    strictTls: true,
    blockScripts: false,
    blockFingerprinting: 'standard',
    blockCrossSiteCookies: true,
    filterLists: ['core-trackers', 'cookie-notices', 'url-tracking'],
    customFilterRules: [],
    siteOverrides: {}
  };

  ipcMain.on('fabinav:sync-shields', (_event, nextState) => {
    if (nextState && typeof nextState === 'object') {
      currentShieldState = {
        ...currentShieldState,
        ...nextState,
        siteOverrides:
          nextState.siteOverrides && typeof nextState.siteOverrides === 'object'
            ? nextState.siteOverrides
            : {}
      };
    }
  });

  const ELECTRON_TRACKER_DOMAINS = [
    'doubleclick.net',
    'doubleclick.com',
    'google-analytics.com',
    'googletagmanager.com',
    'googlesyndication.com',
    'pagead2.googlesyndication.com',
    'googleadservices.com',
    'adservice.google.',
    'ads.youtube.com',
    'cloudflareinsights.com',
    'adtng.com',
    'tsyndicate.com',
    'scorecardresearch.com',
    'quantserve.com',
    'criteo.com',
    'criteo.net',
    'taboola.com',
    'outbrain.com',
    'hotjar.com',
    'mixpanel.com',
    'segment.io',
    'segment.com',
    'amplitude.com',
    'clarity.ms',
    'newrelic.com',
    'nr-data.net',
    'omtrdc.net',
    'demdex.net',
    'pubmatic.com',
    'rubiconproject.com',
    'openx.net',
    'adnxs.com',
    'casalemedia.com',
    'amazon-adsystem.com',
    'adsystem.com',
    'advertising.com',
    'bat.bing.com',
    'mc.yandex.ru',
    'moatads.com',
    'doubleverify.com',
    'adform.net',
    'adsrvr.org',
    'bidswitch.net',
    'bluekai.com',
    'chartbeat.com',
    'exoclick.com',
    'indexww.com',
    'krxd.net',
    'mediamath.com',
    'mgid.com',
    'onesignal.com',
    'optimizely.com',
    'popads.net',
    'propellerads.com',
    'revcontent.com',
    'sharethrough.com',
    'analytics.tiktok.com',
    'yieldmo.com',
    'zemanta.com'
  ];
  const ELECTRON_SOCIAL_DOMAINS = [
    'connect.facebook.net',
    'facebook.com/tr',
    'pixel.facebook.com',
    'analytics.twitter.com',
    'ads-twitter.com',
    'snap.licdn.com',
    'px.ads.linkedin.com',
    'ct.pinterest.com'
  ];
  const ELECTRON_REGIONAL_DOMAINS = [
    'adingo.jp',
    'microad.jp',
    'nend.net',
    'geniee.jp',
    'im-apps.net',
    'smartadserver.com',
    'teads.tv',
    'seedtag.com',
    'e-planning.net'
  ];
  const ELECTRON_TRACKING_PARAMS = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'utm_id',
    'fbclid',
    'gclid',
    'dclid',
    'msclkid',
    'yclid',
    'mc_cid',
    'mc_eid',
    'igshid',
    'igsh',
    '_hsenc',
    '_hsmi',
    'twclid',
    'ttclid',
    'si'
  ];

  const extractDomain = (rawUrl) => {
    try {
      const u = new URL(rawUrl);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
      return u.hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return '';
    }
  };

  const resolveElectronShield = (siteUrl) => {
    const domain = extractDomain(siteUrl);
    const ov = domain && currentShieldState.siteOverrides ? currentShieldState.siteOverrides[domain] : null;
    if (!ov) return currentShieldState;
    return {
      ...currentShieldState,
      ...ov
    };
  };

  const isInternalHostUrl = (rawUrl) => {
    if (!rawUrl) return true;
    if (
      rawUrl.startsWith('http://127.0.0.1') ||
      rawUrl.startsWith('http://localhost') ||
      rawUrl.startsWith('devtools://') ||
      rawUrl.startsWith('chrome-extension://') ||
      rawUrl.startsWith('data:') ||
      rawUrl.startsWith('blob:')
    ) {
      return true;
    }
    return false;
  };

  const isElectronTracker = (rawUrl, effShield) => {
    const lower = rawUrl.toLowerCase();
    const lists = Array.isArray(effShield.filterLists)
      ? effShield.filterLists
      : ['core-trackers', 'cookie-notices', 'url-tracking'];
    const custom = Array.isArray(effShield.customFilterRules) ? effShield.customFilterRules : [];

    if (lists.includes('core-trackers') && ELECTRON_TRACKER_DOMAINS.some((d) => lower.includes(d))) {
      return true;
    }
    if (lists.includes('social-widgets') && ELECTRON_SOCIAL_DOMAINS.some((d) => lower.includes(d))) {
      return true;
    }
    if (lists.includes('regional-es-ja') && ELECTRON_REGIONAL_DOMAINS.some((d) => lower.includes(d))) {
      return true;
    }
    if (custom.some((rule) => rule && lower.includes(String(rule).toLowerCase()))) {
      return true;
    }
    if (effShield.blockTrackersAndAds === 'aggressive') {
      if (/(\/ads\/|adserver|analytics\.js|telemetry|tracking|pixel\.)/i.test(lower)) {
        return true;
      }
    }
    return false;
  };

  const configureWebSession = (targetSession) => {
    if (!targetSession) return;

    targetSession.webRequest.onBeforeRequest((details, callback) => {
      try {
        const reqUrl = details.url || '';
        if (isInternalHostUrl(reqUrl)) {
          callback({});
          return;
        }

        const siteContextUrl =
          details.resourceType === 'mainFrame'
            ? reqUrl
            : details.referrer || details.initiator || reqUrl;
        const effShield = resolveElectronShield(siteContextUrl);

        if (!effShield.enabled) {
          callback({});
          return;
        }

        if (details.resourceType === 'mainFrame') {
          let nextUrl = reqUrl;
          const lists = Array.isArray(effShield.filterLists) ? effShield.filterLists : [];
          if (effShield.upgradeHttps && nextUrl.startsWith('http://')) {
            const host = extractDomain(nextUrl);
            if (host && host !== 'localhost' && host !== '127.0.0.1') {
              nextUrl = nextUrl.replace(/^http:\/\//i, 'https://');
            }
          }
          if (lists.includes('url-tracking')) {
            try {
              const parsed = new URL(nextUrl);
              let stripped = false;
              for (const p of ELECTRON_TRACKING_PARAMS) {
                if (parsed.searchParams.has(p)) {
                  parsed.searchParams.delete(p);
                  stripped = true;
                }
              }
              if (stripped) nextUrl = parsed.toString();
            } catch {
              // ignore url parse errors
            }
          }
          if (nextUrl !== reqUrl) {
            callback({ redirectURL: nextUrl });
            return;
          }
          callback({});
          return;
        }

        const blockScript = effShield.blockScripts && details.resourceType === 'script';
        const blockTracker =
          effShield.blockTrackersAndAds !== 'disabled' && isElectronTracker(reqUrl, effShield);

        if (blockScript || blockTracker) {
          if (mainWindow && !mainWindow.isDestroyed()) {
            let pageOrigin = siteContextUrl;
            try {
              pageOrigin = new URL(siteContextUrl).origin;
            } catch {
              // keep raw
            }
            mainWindow.webContents.send('fabinav:shield-blocked', {
              pageOrigin,
              blockedUrl: reqUrl,
              resourceType: details.resourceType || 'other'
            });
          }
          callback({ cancel: true });
          return;
        }
      } catch {
        // fail open on unexpected webRequest error
      }
      callback({});
    });

    targetSession.webRequest.onBeforeSendHeaders((details, callback) => {
      details.requestHeaders['DNT'] = '1';
      if (cleanChromeUa) {
        details.requestHeaders['User-Agent'] = cleanChromeUa;
      }
      try {
        const reqUrl = details.url || '';
        const siteUrl = details.referrer || details.initiator || reqUrl;
        const effShield = resolveElectronShield(siteUrl);
        if (
          effShield.enabled &&
          effShield.blockCrossSiteCookies &&
          details.resourceType !== 'mainFrame' &&
          !isInternalHostUrl(reqUrl) &&
          !isAllowedOAuthPopup(reqUrl)
        ) {
          const reqHost = extractDomain(reqUrl);
          const siteHost = extractDomain(siteUrl);
          if (reqHost && siteHost && reqHost !== siteHost && !reqHost.endsWith(`.${siteHost}`)) {
            delete details.requestHeaders['Cookie'];
            delete details.requestHeaders['cookie'];
          }
        }
      } catch {
        // ignore header filter error
      }
      callback({ requestHeaders: details.requestHeaders });
    });

    targetSession.webRequest.onHeadersReceived((details, callback) => {
      try {
        const reqUrl = details.url || '';
        const siteUrl = details.referrer || details.initiator || reqUrl;
        const effShield = resolveElectronShield(siteUrl);
        if (
          effShield.enabled &&
          effShield.blockCrossSiteCookies &&
          details.resourceType !== 'mainFrame' &&
          !isInternalHostUrl(reqUrl) &&
          !isAllowedOAuthPopup(reqUrl) &&
          details.responseHeaders
        ) {
          const reqHost = extractDomain(reqUrl);
          const siteHost = extractDomain(siteUrl);
          if (reqHost && siteHost && reqHost !== siteHost && !reqHost.endsWith(`.${siteHost}`)) {
            const headers = { ...details.responseHeaders };
            delete headers['set-cookie'];
            delete headers['Set-Cookie'];
            callback({ responseHeaders: headers });
            return;
          }
        }
      } catch {
        // ignore response header filter error
      }
      callback({});
    });

    if (typeof targetSession.setPermissionRequestHandler === 'function') {
      targetSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
        if (permission !== 'notifications') {
          callback(false);
          return;
        }
        if (!mainWindow || mainWindow.isDestroyed()) {
          callback(false);
          return;
        }
        const rawUrl = (details && details.requestingUrl) || (webContents && webContents.getURL ? webContents.getURL() : '');
        let origin = rawUrl;
        try {
          origin = new URL(rawUrl).origin;
        } catch {
          // keep raw
        }
        const requestId = `np-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const timer = setTimeout(() => {
          const item = pendingNotifPermissions.get(requestId);
          if (item) {
            pendingNotifPermissions.delete(requestId);
            try {
              item.callback(false);
            } catch {
              // ignore
            }
          }
        }, 30000);
        pendingNotifPermissions.set(requestId, { callback, timer });
        mainWindow.webContents.send('fabinav:webview-notif-permission-req', {
          requestId,
          origin,
          url: rawUrl
        });
      });
    }
  };
  configureWebSession(session.defaultSession);
  configureWebSession(session.fromPartition('persist:normal'));
  configureWebSession(session.fromPartition('private'));

  await mainWindow.loadURL(startUrl);

  if (app.isPackaged && autoUpdater) {
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    }, 3500);
  }
}

ipcMain.on('fabinav:win-minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
  }
});

ipcMain.on('fabinav:win-toggle-maximize', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.on('fabinav:win-close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  } else {
    app.quit();
  }
});

ipcMain.handle('fabinav:show-desktop-notification', async (_event, payload) => {
  try {
    if (!Notification || typeof Notification.isSupported !== 'function' || !Notification.isSupported()) {
      return false;
    }
    const title = payload && payload.title ? String(payload.title) : 'FabiNav';
    const origin = payload && payload.origin ? String(payload.origin) : '';
    const bodyText = payload && payload.body ? String(payload.body) : '';
    const fullBody = origin ? `${origin}${bodyText ? ` — ${bodyText}` : ''}` : bodyText;
    const iconPath = path.join(__dirname, '..', 'build', 'icon.png');
    const notif = new Notification({
      title,
      body: fullBody,
      icon: fs.existsSync(iconPath) ? iconPath : undefined,
      silent: !!(payload && payload.silent)
    });
    notif.on('click', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
        mainWindow.webContents.send('fabinav:notification-clicked', {
          id: payload?.id || '',
          tabId: payload?.tabId,
          url: payload?.url
        });
      }
    });
    notif.show();
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('fabinav:capture-page', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  try {
    const img = await mainWindow.webContents.capturePage();
    return img.toDataURL();
  } catch {
    return null;
  }
});

ipcMain.handle('fabinav:check-updates', async () => {
  if (!app.isPackaged || !autoUpdater) {
    return {
      state: 'unsupported',
      version: app.getVersion(),
      message: 'Las actualizaciones automáticas se activan en el instalador oficial de GitHub Releases.'
    };
  }
  try {
    const res = await autoUpdater.checkForUpdates();
    const nextVer = res && res.updateInfo ? res.updateInfo.version : undefined;
    if (nextVer && nextVer !== app.getVersion()) {
      return {
        state: 'available',
        version: nextVer,
        message: `Versión ${nextVer} encontrada. Descargando en segundo plano...`
      };
    }
    return {
      state: 'not-available',
      version: app.getVersion(),
      message: `FabiNav v${app.getVersion()} ya es la versión más reciente.`
    };
  } catch (err) {
    return {
      state: 'error',
      message: err && err.message ? err.message : 'Error al buscar actualizaciones.'
    };
  }
});

ipcMain.handle('fabinav:install-update', () => {
  if (app.isPackaged && autoUpdater) {
    autoUpdater.quitAndInstall(false, true);
  }
});

ipcMain.handle('fabinav:open-uninstall', async () => {
  try {
    if (process.platform === 'win32') {
      const exeDir = path.dirname(app.getPath('exe'));
      const candidates = ['Uninstall FabiNav.exe', 'uninstall.exe'];
      for (const fileName of candidates) {
        const uninstaller = path.join(exeDir, fileName);
        if (fs.existsSync(uninstaller)) {
          spawn(uninstaller, [], { detached: true, stdio: 'ignore' }).unref();
          setTimeout(() => app.quit(), 250);
          return { ok: true, message: 'Iniciando desinstalador oficial de FabiNav...' };
        }
      }
      await shell.openExternal('ms-settings:appsfeatures');
      return { ok: true, message: 'Abriendo Aplicaciones instaladas de Windows...' };
    }

    if (process.platform === 'linux' && process.env.APPIMAGE) {
      shell.showItemInFolder(process.env.APPIMAGE);
      return { ok: true, message: 'Ubicación del AppImage abierta para eliminación directa.' };
    }

    if (process.platform === 'darwin') {
      const bundlePath = path.resolve(app.getPath('exe'), '../../..');
      shell.showItemInFolder(bundlePath);
      return { ok: true, message: 'Aplicación mostrada en Finder.' };
    }

    await shell.openPath(path.dirname(app.getPath('exe')));
    return { ok: true, message: 'Carpeta de instalación abierta.' };
  } catch (err) {
    return {
      ok: false,
      message: err && err.message ? err.message : 'No se pudo abrir el desinstalador del sistema.'
    };
  }
});

app.whenReady().then(async () => {
  setupAutoUpdater();
  app.on('web-contents-created', (_event, contents) => {
    if (contents.getType() === 'webview') {
      contents.setWindowOpenHandler(({ url }) => {
        if (isAllowedOAuthPopup(url)) {
          return {
            action: 'allow',
            overrideBrowserWindowOptions: {
              width: 520,
              height: 660,
              autoHideMenuBar: true,
              backgroundColor: '#ffffff',
              webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true
              }
            }
          };
        }
        if (mainWindow && !mainWindow.isDestroyed() && /^https?:\/\//i.test(url)) {
          mainWindow.webContents.send('fabinav:webview-new-tab', url);
        }
        return { action: 'deny' };
      });
    }
  });

  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', () => {
  if (embeddedServer) {
    try {
      embeddedServer.close();
    } catch {
      // ignore close errors
    }
    embeddedServer = null;
  }
});
