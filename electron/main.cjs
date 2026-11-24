const { app, BrowserWindow, ipcMain, session, shell, dialog } = require('electron');
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

function getSavedExtensionsPathFile() {
  return path.join(app.getPath('userData'), 'extensions-paths.json');
}

function loadSavedExtensionPaths() {
  try {
    const file = getSavedExtensionsPathFile();
    if (!fs.existsSync(file)) return [];
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(parsed) ? parsed.filter((p) => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

function saveExtensionPaths(paths) {
  try {
    fs.writeFileSync(getSavedExtensionsPathFile(), JSON.stringify(paths, null, 2), 'utf8');
  } catch {
    // ignore write error
  }
}

function guessExtMime(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.ico')) return 'image/x-icon';
  if (lower.endsWith('.css')) return 'text/css';
  if (lower.endsWith('.json')) return 'application/json';
  return 'application/octet-stream';
}

function readExtensionFromDirectory(dirPath, nativeElectronId) {
  const readRel = (rel) => {
    const clean = String(rel || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
    const full = path.join(dirPath, clean);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      return fs.readFileSync(full);
    }
    return null;
  };

  const manifestBuf = readRel('manifest.json');
  if (!manifestBuf) {
    throw new Error('La carpeta seleccionada no contiene manifest.json.');
  }
  const manifest = JSON.parse(manifestBuf.toString('utf8').replace(/^\uFEFF/, ''));

  const defaultLocale = typeof manifest.default_locale === 'string' ? manifest.default_locale : 'en';
  let messagesMap = {};
  for (const loc of ['es', defaultLocale, 'en', 'en_US']) {
    const mb = readRel(`_locales/${loc}/messages.json`);
    if (mb) {
      try {
        messagesMap = JSON.parse(mb.toString('utf8').replace(/^\uFEFF/, ''));
        break;
      } catch {
        // try next
      }
    }
  }
  const resolveMsg = (val, fallback) => {
    if (typeof val !== 'string' || !val.trim()) return fallback;
    return val.replace(/__MSG_([A-Za-z0-9_@]+)__/g, (full, key) => {
      if (messagesMap[key] && messagesMap[key].message) return messagesMap[key].message;
      const found = Object.entries(messagesMap).find(([k]) => k.toLowerCase() === key.toLowerCase());
      return found && found[1] && found[1].message ? found[1].message : full;
    });
  };

  const name = resolveMsg(manifest.name, path.basename(dirPath)).trim();
  const description = resolveMsg(manifest.description, 'Extensión Web cargada localmente.').trim();
  const version = typeof manifest.version === 'string' ? manifest.version : '1.0.0';
  const author = typeof manifest.author === 'string' ? manifest.author : 'Unpacked Extension';
  const manifestVersion = Number(manifest.manifest_version) === 2 ? 2 : 3;
  const actionObj = manifest.action || manifest.browser_action || {};

  let iconDataUrl;
  const iconMap = manifest.icons || (typeof actionObj.default_icon === 'object' ? actionObj.default_icon : null);
  const iconCandidates = [];
  if (iconMap) {
    for (const sz of ['128', '96', '64', '48', '32', '16']) {
      if (typeof iconMap[sz] === 'string') iconCandidates.push(iconMap[sz]);
    }
    for (const val of Object.values(iconMap)) {
      if (typeof val === 'string') iconCandidates.push(val);
    }
  } else if (typeof actionObj.default_icon === 'string') {
    iconCandidates.push(actionObj.default_icon);
  }
  for (const ic of iconCandidates) {
    const b = readRel(ic);
    if (b) {
      iconDataUrl = `data:${guessExtMime(ic)};base64,${b.toString('base64')}`;
      break;
    }
  }

  const contentScripts = (Array.isArray(manifest.content_scripts) ? manifest.content_scripts : [])
    .map((cs) => ({
      matches: Array.isArray(cs.matches) ? cs.matches : [],
      excludeMatches: Array.isArray(cs.exclude_matches) ? cs.exclude_matches : undefined,
      css: (Array.isArray(cs.css) ? cs.css : []).map((p) => readRel(p)?.toString('utf8') || '').filter(Boolean),
      js: (Array.isArray(cs.js) ? cs.js : []).map((p) => readRel(p)?.toString('utf8') || '').filter(Boolean),
      runAt: cs.run_at === 'document_start' || cs.run_at === 'document_end' ? cs.run_at : 'document_idle',
      allFrames: !!cs.all_frames
    }))
    .filter((cs) => cs.matches.length > 0 && (cs.css.length > 0 || cs.js.length > 0));

  let popupHtml;
  if (typeof actionObj.default_popup === 'string' && actionObj.default_popup) {
    const pBuf = readRel(actionObj.default_popup);
    if (pBuf) {
      const pDir = actionObj.default_popup.includes('/')
        ? actionObj.default_popup.slice(0, actionObj.default_popup.lastIndexOf('/') + 1)
        : '';
      const resAsset = (ref) => {
        const clean = ref.split('?')[0].split('#')[0];
        return clean.startsWith('/') ? clean.slice(1) : `${pDir}${clean}`;
      };
      let html = pBuf.toString('utf8');
      html = html.replace(/<link\b[^>]*rel=["']?stylesheet["']?[^>]*href=["']([^"']+)["'][^>]*>/gi, (full, href) => {
        if (/^https?:\/\//i.test(href)) return full;
        const b = readRel(resAsset(href)) || readRel(href);
        return b ? `<style>${b.toString('utf8')}</style>` : full;
      });
      html = html.replace(/<script\b[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi, (full, src) => {
        if (/^https?:\/\//i.test(src)) return full;
        const b = readRel(resAsset(src)) || readRel(src);
        return b ? `<script>${b.toString('utf8').replace(/<\/script>/gi, '<\\/script>')}</script>` : full;
      });
      popupHtml = html;
    }
  }

  return {
    name,
    description,
    version,
    author,
    enabled: true,
    pinned: true,
    manifestVersion,
    manifestJson: JSON.stringify(manifest, null, 2),
    permissions: Array.isArray(manifest.permissions) ? manifest.permissions : ['activeTab'],
    hostPermissions: Array.isArray(manifest.host_permissions) ? manifest.host_permissions : [],
    accentColor: '#6366f1',
    mode: 'webextension',
    iconDataUrl,
    popupHtml,
    popupTitle: resolveMsg(actionObj.default_title, name),
    contentScripts,
    sourceType: 'unpacked',
    localPath: dirPath,
    nativeElectronId,
    builtIn: false
  };
}

ipcMain.handle('fabinav:ext-pick-unpacked', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Seleccionar carpeta de extensión descomprimida (manifest.json)',
      properties: ['openDirectory']
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { ok: false, canceled: true };
    }
    const dirPath = result.filePaths[0];
    const extApi = session.defaultSession.extensions || session.defaultSession;
    const loaded = await extApi.loadExtension(dirPath, { allowFileAccess: true });
    const parsed = readExtensionFromDirectory(dirPath, loaded && loaded.id ? loaded.id : undefined);

    const saved = loadSavedExtensionPaths();
    if (!saved.includes(dirPath)) {
      saved.push(dirPath);
      saveExtensionPaths(saved);
    }
    return { ok: true, extension: parsed };
  } catch (err) {
    return {
      ok: false,
      message: err && err.message ? err.message : 'No se pudo cargar la extensión desde la carpeta.'
    };
  }
});

ipcMain.handle('fabinav:ext-remove', async (_ev, nativeId, localPath) => {
  try {
    const extApi = session.defaultSession.extensions || session.defaultSession;
    if (nativeId && typeof extApi.removeExtension === 'function') {
      await extApi.removeExtension(nativeId);
    }
    if (localPath) {
      const saved = loadSavedExtensionPaths().filter((p) => p !== localPath);
      saveExtensionPaths(saved);
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
});

app.whenReady().then(async () => {
  setupAutoUpdater();
  // Reload previously installed unpacked Chromium extensions
  const extApi = session.defaultSession.extensions || session.defaultSession;
  for (const dirPath of loadSavedExtensionPaths()) {
    try {
      if (fs.existsSync(path.join(dirPath, 'manifest.json'))) {
        await extApi.loadExtension(dirPath, { allowFileAccess: true });
      }
    } catch {
      // ignore missing/invalid unpacked extension on startup
    }
  }
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
