import { BrowserExtension } from '../types';

const DARK_READER_CONTENT_JS = `(function () {
  var STYLE_ID = 'fabinav-ext-darkreader-style';
  var DEFAULTS = { brightness: 100, contrast: 100, sepia: 0, disabledHosts: [] };

  function getHost() {
    try { return location.hostname || 'local'; } catch (e) { return 'local'; }
  }

  function isAlreadyDarkPage() {
    try {
      var target = document.body || document.documentElement;
      if (!target) return false;
      var bg = getComputedStyle(target).backgroundColor || '';
      var m = bg.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/i);
      if (!m) return false;
      var lum = (0.299 * Number(m[1]) + 0.587 * Number(m[2]) + 0.114 * Number(m[3])) / 255;
      return bg.indexOf('rgba') === 0 && bg.endsWith(', 0)') ? false : lum < 0.35;
    } catch (e) { return false; }
  }

  function removeDarkCss() {
    var el = document.getElementById(STYLE_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function applySettings(cfg) {
    var settings = Object.assign({}, DEFAULTS, cfg || {});
    var host = getHost();
    if (Array.isArray(settings.disabledHosts) && settings.disabledHosts.indexOf(host) !== -1) {
      removeDarkCss();
      return;
    }
    var style = document.getElementById(STYLE_ID);
    if (!style && document.head) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    if (!style) return;

    var br = Number(settings.brightness || 100) / 100;
    var ct = Number(settings.contrast || 100) / 100;
    var sp = Number(settings.sepia || 0) / 100;

    if (isAlreadyDarkPage()) {
      style.textContent = 'html { filter: brightness(' + br + ') contrast(' + ct + ') sepia(' + sp + ') !important; }';
    } else {
      style.textContent =
        'html { filter: invert(0.91) hue-rotate(180deg) brightness(' + br + ') contrast(' + ct + ') sepia(' + sp + ') !important; background: #ffffff !important; min-height: 100%; }' +
        'img, video, picture, canvas, iframe, svg image, [style*="background-image"] { filter: invert(1) hue-rotate(180deg) !important; }';
    }
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(DEFAULTS, function (res) {
      applySettings(res);
    });
    if (chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(function () {
        chrome.storage.local.get(DEFAULTS, function (res) { applySettings(res); });
      });
    }
  } else {
    applySettings(DEFAULTS);
  }

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function (msg) {
      if (msg && msg.type === 'DARKREADER_UPDATE') {
        applySettings(msg.payload);
      } else if (msg && msg.type === 'FABINAV_EXT_UNLOAD') {
        removeDarkCss();
      }
    });
  }
})();`;

const DARK_READER_POPUP_HTML = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
  body { margin: 0; padding: 14px; background: #181a20; color: #eceef2; font-size: 12px; }
  .head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .host { font-size: 11px; color: #9ea4b0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 175px; }
  .btn { border: 1px solid #303440; background: #23262f; color: #fff; padding: 5px 10px; border-radius: 999px; font-size: 11px; cursor: pointer; font-weight: 600; }
  .btn.active { background: #7c6bf2; border-color: #7c6bf2; }
  .row { margin-bottom: 10px; }
  .label { display: flex; justify-content: space-between; margin-bottom: 4px; color: #c7ccd6; font-size: 11px; }
  input[type=range] { width: 100%; accent-color: #7c6bf2; cursor: pointer; }
  .footer { display: flex; justify-content: flex-end; padding-top: 4px; }
  .reset { background: transparent; border: none; color: #9ea4b0; font-size: 11px; cursor: pointer; text-decoration: underline; }
</style>
</head>
<body>
  <div class="head">
    <div>
      <div style="font-weight:700;font-size:13px;">Dark Web Reader</div>
      <div id="host" class="host">Detectando sitio...</div>
    </div>
    <button id="toggleSite" class="btn active" type="button">Activo aquí</button>
  </div>
  <div class="row">
    <div class="label"><span>Brillo</span><span id="valBr">100%</span></div>
    <input id="br" type="range" min="70" max="125" value="100" />
  </div>
  <div class="row">
    <div class="label"><span>Contraste</span><span id="valCt">100%</span></div>
    <input id="ct" type="range" min="70" max="135" value="100" />
  </div>
  <div class="row">
    <div class="label"><span>Sepia cálido</span><span id="valSp">0%</span></div>
    <input id="sp" type="range" min="0" max="50" value="0" />
  </div>
  <div class="footer">
    <button id="resetBtn" class="reset" type="button">Restablecer valores</button>
  </div>
<script>
  var DEFAULTS = { brightness: 100, contrast: 100, sepia: 0, disabledHosts: [] };
  var state = Object.assign({}, DEFAULTS);
  var currentHost = '';
  function syncUI() {
    document.getElementById('br').value = state.brightness;
    document.getElementById('ct').value = state.contrast;
    document.getElementById('sp').value = state.sepia;
    document.getElementById('valBr').textContent = state.brightness + '%';
    document.getElementById('valCt').textContent = state.contrast + '%';
    document.getElementById('valSp').textContent = state.sepia + '%';
    var btn = document.getElementById('toggleSite');
    var disabled = currentHost && state.disabledHosts.indexOf(currentHost) !== -1;
    btn.textContent = disabled ? 'Excluido aquí' : 'Activo aquí';
    btn.className = disabled ? 'btn' : 'btn active';
  }
  function pushUpdate() {
    chrome.storage.local.set(state, function () {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs && tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'DARKREADER_UPDATE', payload: state });
        }
      });
    });
  }
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    try {
      var u = new URL((tabs && tabs[0] && tabs[0].url) || '');
      currentHost = u.hostname || 'sitio local';
    } catch (e) { currentHost = 'página actual'; }
    document.getElementById('host').textContent = currentHost;
    chrome.storage.local.get(DEFAULTS, function (res) {
      state = Object.assign({}, DEFAULTS, res || {});
      syncUI();
    });
  });
  ['br','ct','sp'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', function () {
      state.brightness = Number(document.getElementById('br').value);
      state.contrast = Number(document.getElementById('ct').value);
      state.sepia = Number(document.getElementById('sp').value);
      syncUI();
      pushUpdate();
    });
  });
  document.getElementById('toggleSite').addEventListener('click', function () {
    if (!currentHost) return;
    var list = Array.isArray(state.disabledHosts) ? state.disabledHosts.slice() : [];
    var idx = list.indexOf(currentHost);
    if (idx === -1) list.push(currentHost); else list.splice(idx, 1);
    state.disabledHosts = list;
    syncUI();
    pushUpdate();
  });
  document.getElementById('resetBtn').addEventListener('click', function () {
    state.brightness = 100; state.contrast = 100; state.sepia = 0;
    syncUI();
    pushUpdate();
  });
</script>
</body>
</html>`;

const READER_CONTENT_JS = `(function () {
  var OVERLAY_ID = 'fabinav-reader-zen-overlay';
  var DEFAULTS = { fontSize: 18, width: 740, theme: 'sepia' };

  function removeReader() {
    var old = document.getElementById(OVERLAY_ID);
    if (old && old.parentNode) old.parentNode.removeChild(old);
    if (document.documentElement) document.documentElement.style.overflow = '';
  }

  function extractArticleHtml() {
    var root =
      document.querySelector('article') ||
      document.querySelector('[role="main"]') ||
      document.querySelector('main') ||
      document.body;
    if (!root) return { html: '', words: 0 };
    var clone = root.cloneNode(true);
    var junk = clone.querySelectorAll('script,style,noscript,nav,aside,footer,header,iframe,[class*="ad"],[class*="banner"],[class*="cookie"],[class*="popup"]');
    for (var i = 0; i < junk.length; i++) {
      if (junk[i].parentNode) junk[i].parentNode.removeChild(junk[i]);
    }
    var text = (clone.textContent || '').trim();
    var words = text ? text.split(/\\s+/).length : 0;
    return { html: clone.innerHTML || '', words: words };
  }

  function renderReader(cfg) {
    var settings = Object.assign({}, DEFAULTS, cfg || {});
    var themes = {
      sepia: { bg: '#f7f1e3', fg: '#2b2620', border: '#dfd4be', muted: '#6b6254' },
      light: { bg: '#ffffff', fg: '#1c1e21', border: '#e5e7eb', muted: '#6b7280' },
      dark: { bg: '#15171c', fg: '#e7e9ee', border: '#2b2f3a', muted: '#9ca3af' }
    };
    var pal = themes[settings.theme] || themes.sepia;
    var overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
      var extracted = extractArticleHtml();
      if (!extracted.html || extracted.words < 20) return;
      overlay = document.createElement('div');
      overlay.id = OVERLAY_ID;
      var mins = Math.max(1, Math.round(extracted.words / 210));
      overlay.innerHTML =
        '<div id="fabi-rz-inner" style="margin:0 auto;padding:42px 24px 80px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:14px;margin-bottom:24px;border-bottom:1px solid ' + pal.border + ';font-family:system-ui,sans-serif;font-size:12px;color:' + pal.muted + ';">' +
            '<span>Modo Lectura Zen · ~' + mins + ' min (' + extracted.words + ' palabras)</span>' +
            '<button id="fabi-rz-close" type="button" style="border:1px solid ' + pal.border + ';background:transparent;color:inherit;padding:4px 12px;border-radius:999px;cursor:pointer;font-size:12px;">Salir de lectura</button>' +
          '</div>' +
          '<h1 style="font-size:1.75em;line-height:1.25;margin:0 0 20px;">' + (document.title || location.hostname).replace(/</g, '&lt;') + '</h1>' +
          '<div id="fabi-rz-body">' + extracted.html + '</div>' +
        '</div>';
      document.body.appendChild(overlay);
      var closeBtn = document.getElementById('fabi-rz-close');
      if (closeBtn) closeBtn.onclick = removeReader;
    }

    overlay.style.cssText =
      'position:fixed;inset:0;z-index:2147483640;overflow-y:auto;background:' + pal.bg + ';color:' + pal.fg + ';font-family:Georgia,"Times New Roman",serif;line-height:1.75;';
    var inner = document.getElementById('fabi-rz-inner');
    if (inner) {
      inner.style.maxWidth = Number(settings.width || 740) + 'px';
      inner.style.fontSize = Number(settings.fontSize || 18) + 'px';
    }
    var imgs = overlay.querySelectorAll('img');
    for (var j = 0; j < imgs.length; j++) {
      imgs[j].style.maxWidth = '100%';
      imgs[j].style.height = 'auto';
      imgs[j].style.borderRadius = '8px';
    }
    if (document.documentElement) document.documentElement.style.overflow = 'hidden';
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(DEFAULTS, function (res) { renderReader(res); });
    if (chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(function () {
        chrome.storage.local.get(DEFAULTS, function (res) { renderReader(res); });
      });
    }
  } else {
    renderReader(DEFAULTS);
  }

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function (msg) {
      if (msg && msg.type === 'READER_UPDATE') renderReader(msg.payload);
      else if (msg && msg.type === 'FABINAV_EXT_UNLOAD') removeReader();
    });
  }
})();`;

const READER_POPUP_HTML = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
  body { margin: 0; padding: 14px; background: #181a20; color: #eceef2; font-size: 12px; }
  .title { font-weight: 700; font-size: 13px; margin-bottom: 10px; }
  .themes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 12px; }
  .tbtn { border: 1px solid #303440; border-radius: 10px; padding: 8px 4px; text-align: center; cursor: pointer; font-size: 11px; font-weight: 600; }
  .tbtn.active { outline: 2px solid #10b981; }
  .row { margin-bottom: 10px; }
  .label { display: flex; justify-content: space-between; margin-bottom: 4px; color: #c7ccd6; font-size: 11px; }
  input[type=range] { width: 100%; accent-color: #10b981; cursor: pointer; }
</style>
</head>
<body>
  <div class="title">Modo Lectura Zen</div>
  <div class="themes">
    <button type="button" data-theme="sepia" class="tbtn" style="background:#f7f1e3;color:#2b2620;">Sepia</button>
    <button type="button" data-theme="light" class="tbtn" style="background:#ffffff;color:#111;">Claro</button>
    <button type="button" data-theme="dark" class="tbtn" style="background:#15171c;color:#eee;">Noche</button>
  </div>
  <div class="row">
    <div class="label"><span>Tamaño de fuente</span><span id="valFs">18 px</span></div>
    <input id="fs" type="range" min="14" max="26" value="18" />
  </div>
  <div class="row">
    <div class="label"><span>Ancho de columna</span><span id="valW">740 px</span></div>
    <input id="w" type="range" min="540" max="980" step="20" value="740" />
  </div>
<script>
  var DEFAULTS = { fontSize: 18, width: 740, theme: 'sepia' };
  var state = Object.assign({}, DEFAULTS);
  function syncUI() {
    document.getElementById('fs').value = state.fontSize;
    document.getElementById('w').value = state.width;
    document.getElementById('valFs').textContent = state.fontSize + ' px';
    document.getElementById('valW').textContent = state.width + ' px';
    document.querySelectorAll('.tbtn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-theme') === state.theme);
    });
  }
  function pushUpdate() {
    chrome.storage.local.set(state, function () {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs && tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: 'READER_UPDATE', payload: state });
      });
    });
  }
  chrome.storage.local.get(DEFAULTS, function (res) { state = Object.assign({}, DEFAULTS, res || {}); syncUI(); });
  document.querySelectorAll('.tbtn').forEach(function (b) {
    b.addEventListener('click', function () {
      state.theme = b.getAttribute('data-theme'); syncUI(); pushUpdate();
    });
  });
  document.getElementById('fs').addEventListener('input', function (e) {
    state.fontSize = Number(e.target.value); syncUI(); pushUpdate();
  });
  document.getElementById('w').addEventListener('input', function (e) {
    state.width = Number(e.target.value); syncUI(); pushUpdate();
  });
</script>
</body>
</html>`;

const STYLUS_DEFAULT_CSS = `/* CSS personalizado de Stylus */
body {
  scroll-behavior: smooth;
  -webkit-font-smoothing: antialiased;
}
a {
  text-decoration-thickness: 1.5px;
  text-underline-offset: 3px;
}
::selection {
  background: rgba(255, 111, 76, 0.28);
}`;

const STYLUS_CONTENT_JS = `(function () {
  var STYLE_ID = 'fabinav-ext-stylus-style';
  function apply(css) {
    var el = document.getElementById(STYLE_ID);
    if (!el && document.head) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    if (el) el.textContent = typeof css === 'string' ? css : '';
  }
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get({ userCss: '' }, function (res) {
      if (res && res.userCss) apply(res.userCss);
    });
    if (chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(function () {
        chrome.storage.local.get({ userCss: '' }, function (res) {
          if (res && typeof res.userCss === 'string') apply(res.userCss);
        });
      });
    }
  }
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function (msg) {
      if (msg && msg.type === 'STYLUS_CSS') apply(msg.css);
      else if (msg && msg.type === 'FABINAV_EXT_UNLOAD') apply('');
    });
  }
})();`;

const STYLUS_POPUP_HTML = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
  body { margin: 0; padding: 14px; background: #181a20; color: #eceef2; font-size: 12px; }
  .title { font-weight: 700; font-size: 13px; margin-bottom: 8px; }
  .presets { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
  .chip { border: 1px solid #303440; background: #23262f; color: #d8dce6; padding: 4px 8px; border-radius: 999px; font-size: 11px; cursor: pointer; }
  textarea { width: 100%; height: 130px; background: #111318; color: #e5e7eb; border: 1px solid #303440; border-radius: 10px; padding: 8px; font-family: ui-monospace, monospace; font-size: 11px; resize: vertical; }
  .apply { margin-top: 8px; width: 100%; background: #14b8a6; color: #fff; border: none; border-radius: 999px; padding: 7px; font-weight: 600; cursor: pointer; font-size: 12px; }
</style>
</head>
<body>
  <div class="title">Stylus — Editor rápido CSS</div>
  <div class="presets">
    <button type="button" class="chip" data-preset="editorial">Editorial</button>
    <button type="button" class="chip" data-preset="contrast">Alto contraste</button>
    <button type="button" class="chip" data-preset="links">Resaltar enlaces</button>
  </div>
  <textarea id="cssBox" placeholder="Escribe reglas CSS para inyectar en el sitio actual..."></textarea>
  <button id="applyBtn" class="apply" type="button">Aplicar CSS en vivo</button>
<script>
  var PRESETS = {
    editorial: "body { font-family: Georgia, serif !important; line-height: 1.75 !important; letter-spacing: 0.01em; }",
    contrast: "body { filter: contrast(1.12); } a { font-weight: 600 !important; }",
    links: "a { text-decoration: underline !important; text-decoration-color: #fb542b !important; text-underline-offset: 3px; }"
  };
  var box = document.getElementById('cssBox');
  chrome.storage.local.get({ userCss: '' }, function (res) {
    if (res && res.userCss) box.value = res.userCss;
  });
  document.querySelectorAll('.chip').forEach(function (c) {
    c.addEventListener('click', function () {
      box.value = PRESETS[c.getAttribute('data-preset')] || '';
    });
  });
  document.getElementById('applyBtn').addEventListener('click', function () {
    var css = box.value;
    chrome.storage.local.set({ userCss: css }, function () {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs && tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: 'STYLUS_CSS', css: css });
      });
    });
  });
</script>
</body>
</html>`;

const CLEANWEB_CONTENT_JS = `(function () {
  var SELECTORS = [
    '[class*="newsletter"]', '[id*="newsletter"]',
    '[class*="subscribe-modal"]', '[class*="paywall-banner"]',
    '[class*="cookie-banner"]', '[id*="cookie-banner"]',
    '[class*="consent-banner"]', '[class*="promo-banner"]',
    '#CybotCookiebotDialog', '.fc-ab-root', '.fc-consent-root'
  ];
  var removedCount = 0;

  function sweep() {
    var count = 0;
    try {
      var nodes = document.querySelectorAll(SELECTORS.join(','));
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].style.display !== 'none') {
          nodes[i].style.setProperty('display', 'none', 'important');
          count++;
        }
      }
      if (count > 0) {
        removedCount += count;
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ lastBlockedCount: removedCount, lastHost: location.hostname });
        }
      }
    } catch (e) {}
  }

  sweep();
  var obs = new MutationObserver(sweep);
  if (document.documentElement) obs.observe(document.documentElement, { childList: true, subtree: true });

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
      if (msg && msg.type === 'CLEANWEB_SWEEP') {
        sweep();
        if (sendResponse) sendResponse({ blocked: removedCount });
      } else if (msg && msg.type === 'FABINAV_EXT_UNLOAD') {
        obs.disconnect();
      }
    });
  }
})();`;

const CLEANWEB_POPUP_HTML = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
  body { margin: 0; padding: 14px; background: #181a20; color: #eceef2; font-size: 12px; }
  .stat { padding: 12px; border-radius: 12px; background: #23262f; border: 1px solid #303440; text-align: center; margin-bottom: 10px; }
  .num { font-size: 26px; font-weight: 700; color: #f97316; font-variant-numeric: tabular-nums; }
  .btn { width: 100%; background: #f97316; color: #fff; border: none; border-radius: 999px; padding: 8px; font-weight: 600; cursor: pointer; font-size: 12px; }
</style>
</head>
<body>
  <div class="stat">
    <div id="cnt" class="num">0</div>
    <div style="color:#9ea4b0;font-size:11px;margin-top:2px;">Banners y avisos ocultados</div>
  </div>
  <button id="sweepBtn" class="btn" type="button">Limpiar overlays ahora</button>
<script>
  chrome.storage.local.get({ lastBlockedCount: 0 }, function (res) {
    document.getElementById('cnt').textContent = String((res && res.lastBlockedCount) || 0);
  });
  document.getElementById('sweepBtn').addEventListener('click', function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs && tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'CLEANWEB_SWEEP' }, function (resp) {
          if (resp && typeof resp.blocked === 'number') {
            document.getElementById('cnt').textContent = String(resp.blocked);
          }
        });
      }
    });
  });
</script>
</body>
</html>`;

export const INITIAL_EXTENSIONS: BrowserExtension[] = [
  {
    id: 'ext-dark-web',
    name: 'Dark Web Reader',
    description:
      'Modo oscuro inteligente con controles reales de brillo, contraste, sepia y exclusión por sitio.',
    version: '1.5.0',
    author: 'FabiNav Labs',
    enabled: false,
    pinned: true,
    manifestVersion: 3,
    permissions: ['storage', 'activeTab'],
    hostPermissions: ['<all_urls>'],
    accentColor: '#7c6bf2',
    mode: 'dark-web',
    sourceType: 'builtin',
    popupTitle: 'Dark Web Reader',
    popupHtml: DARK_READER_POPUP_HTML,
    contentScripts: [
      {
        matches: ['<all_urls>'],
        js: [DARK_READER_CONTENT_JS],
        runAt: 'document_end'
      }
    ],
    manifestJson: JSON.stringify(
      {
        manifest_version: 3,
        name: 'Dark Web Reader',
        version: '1.5.0',
        description:
          'Modo oscuro inteligente con controles reales de brillo, contraste, sepia y exclusión por sitio.',
        permissions: ['storage', 'activeTab'],
        host_permissions: ['<all_urls>'],
        action: { default_title: 'Dark Web Reader', default_popup: 'popup.html' },
        content_scripts: [{ matches: ['<all_urls>'], js: ['content.js'], run_at: 'document_end' }]
      },
      null,
      2
    ),
    builtIn: true
  },
  {
    id: 'ext-reader-zen',
    name: 'Modo Lectura Zen',
    description:
      'Extrae el artículo principal con cálculo de tiempo de lectura, temas sepia/claro/noche y tipografía ajustable.',
    version: '1.3.0',
    author: 'FabiNav Labs',
    enabled: false,
    pinned: true,
    manifestVersion: 3,
    permissions: ['storage', 'activeTab'],
    hostPermissions: ['<all_urls>'],
    accentColor: '#10b981',
    mode: 'reader',
    sourceType: 'builtin',
    popupTitle: 'Modo Lectura Zen',
    popupHtml: READER_POPUP_HTML,
    contentScripts: [
      {
        matches: ['<all_urls>'],
        js: [READER_CONTENT_JS],
        runAt: 'document_end'
      }
    ],
    manifestJson: JSON.stringify(
      {
        manifest_version: 3,
        name: 'Modo Lectura Zen',
        version: '1.3.0',
        description:
          'Extrae el artículo principal con cálculo de tiempo de lectura, temas sepia/claro/noche y tipografía ajustable.',
        permissions: ['storage', 'activeTab'],
        host_permissions: ['<all_urls>'],
        action: { default_title: 'Modo Lectura Zen', default_popup: 'popup.html' },
        content_scripts: [{ matches: ['<all_urls>'], js: ['content.js'], run_at: 'document_end' }]
      },
      null,
      2
    ),
    builtIn: true
  },
  {
    id: 'ext-stylus',
    name: 'Stylus — Estilos de Usuario',
    description:
      'Inyector real de hojas CSS personalizadas con editor rápido en vivo y preajustes por página.',
    version: '2.2.0',
    author: 'FabiNav Community',
    enabled: false,
    pinned: true,
    manifestVersion: 3,
    permissions: ['storage', 'activeTab'],
    hostPermissions: ['<all_urls>'],
    accentColor: '#14b8a6',
    mode: 'stylus',
    sourceType: 'builtin',
    customCss: STYLUS_DEFAULT_CSS,
    popupTitle: 'Stylus',
    popupHtml: STYLUS_POPUP_HTML,
    contentScripts: [
      {
        matches: ['<all_urls>'],
        js: [STYLUS_CONTENT_JS],
        runAt: 'document_end'
      }
    ],
    manifestJson: JSON.stringify(
      {
        manifest_version: 3,
        name: 'Stylus — Estilos de Usuario',
        version: '2.2.0',
        description:
          'Inyector real de hojas CSS personalizadas con editor rápido en vivo y preajustes por página.',
        permissions: ['storage', 'activeTab'],
        host_permissions: ['<all_urls>'],
        action: { default_title: 'Stylus', default_popup: 'popup.html' },
        content_scripts: [{ matches: ['<all_urls>'], js: ['content.js'], run_at: 'document_end' }]
      },
      null,
      2
    ),
    builtIn: true
  },
  {
    id: 'ext-cleanweb',
    name: 'CleanWeb Banners & Popups',
    description:
      'Observador DOM en vivo que detecta y elimina avisos de cookies, boletines y overlays invasivos.',
    version: '1.2.0',
    author: 'FabiNav Privacy',
    enabled: true,
    pinned: false,
    manifestVersion: 3,
    permissions: ['storage', 'activeTab'],
    hostPermissions: ['<all_urls>'],
    accentColor: '#f97316',
    mode: 'ad-cosmetic',
    sourceType: 'builtin',
    popupTitle: 'CleanWeb',
    popupHtml: CLEANWEB_POPUP_HTML,
    contentScripts: [
      {
        matches: ['<all_urls>'],
        js: [CLEANWEB_CONTENT_JS],
        runAt: 'document_end'
      }
    ],
    manifestJson: JSON.stringify(
      {
        manifest_version: 3,
        name: 'CleanWeb Banners & Popups',
        version: '1.2.0',
        description:
          'Observador DOM en vivo que detecta y elimina avisos de cookies, boletines y overlays invasivos.',
        permissions: ['storage', 'activeTab'],
        host_permissions: ['<all_urls>'],
        action: { default_title: 'CleanWeb', default_popup: 'popup.html' },
        content_scripts: [{ matches: ['<all_urls>'], js: ['content.js'], run_at: 'document_end' }]
      },
      null,
      2
    ),
    builtIn: true
  }
];
