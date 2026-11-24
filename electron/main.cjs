const { app, BrowserWindow, ipcMain, session, shell } = require('electron');
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

  const configureWebSession = (targetSession) => {
    if (!targetSession) return;
    targetSession.webRequest.onBeforeSendHeaders((details, callback) => {
      details.requestHeaders['DNT'] = '1';
      if (cleanChromeUa) {
        details.requestHeaders['User-Agent'] = cleanChromeUa;
      }
      callback({ requestHeaders: details.requestHeaders });
    });
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
