import { BrowserExtension } from '../types';

export function buildExtensionPopupDocument(
  ext: BrowserExtension,
  activeTabInfo: { url: string; title: string; incognito: boolean }
): string {
  const manifestObj = (() => {
    if (ext.manifestJson) {
      try {
        return JSON.parse(ext.manifestJson) as Record<string, unknown>;
      } catch {
        // fallback below
      }
    }
    return {
      manifest_version: ext.manifestVersion || 3,
      name: ext.name,
      version: ext.version,
      description: ext.description,
      permissions: ext.permissions
    };
  })();

  const resourcesJson = JSON.stringify(ext.resources || {});
  const polyfill = `<script data-fabinav-ext-api="1">
(function () {
  var EXT_ID = ${JSON.stringify(ext.id)};
  var MANIFEST = ${JSON.stringify(manifestObj)};
  var RESOURCES = ${resourcesJson};
  var ACTIVE_TAB = {
    id: 1,
    index: 0,
    windowId: 1,
    active: true,
    highlighted: true,
    incognito: ${JSON.stringify(!!activeTabInfo.incognito)},
    url: ${JSON.stringify(activeTabInfo.url || 'fabinav://newtab')},
    title: ${JSON.stringify(activeTabInfo.title || 'FabiNav')}
  };
  var STORAGE_KEY = 'fabinav_ext_storage_' + EXT_ID;
  var pendingCallbacks = {};
  var reqCounter = 1;
  var storageListeners = [];
  var messageListeners = [];

  function readStore() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function writeStore(data, changes) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
    try {
      window.parent.postMessage({
        type: 'fabinav:ext-storage-changed',
        extId: EXT_ID,
        changes: changes
      }, '*');
    } catch (e) {}
    storageListeners.forEach(function (fn) {
      try { fn(changes, 'local'); } catch (e) {}
    });
  }

  function resolveGet(keys, cb) {
    var store = readStore();
    var out = {};
    if (keys === null || keys === undefined) {
      out = Object.assign({}, store);
    } else if (typeof keys === 'string') {
      if (Object.prototype.hasOwnProperty.call(store, keys)) out[keys] = store[keys];
    } else if (Array.isArray(keys)) {
      keys.forEach(function (k) {
        if (Object.prototype.hasOwnProperty.call(store, k)) out[k] = store[k];
      });
    } else if (typeof keys === 'object') {
      Object.keys(keys).forEach(function (k) {
        out[k] = Object.prototype.hasOwnProperty.call(store, k) ? store[k] : keys[k];
      });
    }
    if (typeof cb === 'function') setTimeout(function () { cb(out); }, 0);
    return Promise.resolve(out);
  }

  function resolveSet(items, cb) {
    var store = readStore();
    var changes = {};
    Object.keys(items || {}).forEach(function (k) {
      changes[k] = { oldValue: store[k], newValue: items[k] };
      store[k] = items[k];
    });
    writeStore(store, changes);
    if (typeof cb === 'function') setTimeout(function () { cb(); }, 0);
    return Promise.resolve();
  }

  function resolveRemove(keys, cb) {
    var list = Array.isArray(keys) ? keys : [keys];
    var store = readStore();
    var changes = {};
    list.forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(store, k)) {
        changes[k] = { oldValue: store[k], newValue: undefined };
        delete store[k];
      }
    });
    writeStore(store, changes);
    if (typeof cb === 'function') setTimeout(function () { cb(); }, 0);
    return Promise.resolve();
  }

  function resolveClear(cb) {
    var store = readStore();
    var changes = {};
    Object.keys(store).forEach(function (k) {
      changes[k] = { oldValue: store[k], newValue: undefined };
    });
    writeStore({}, changes);
    if (typeof cb === 'function') setTimeout(function () { cb(); }, 0);
    return Promise.resolve();
  }

  function sendToContent(message, cb) {
    var requestId = 'extreq_' + Date.now() + '_' + (reqCounter++);
    return new Promise(function (resolve) {
      var done = function (resp) {
        if (typeof cb === 'function') {
          try { cb(resp); } catch (e) {}
        }
        resolve(resp);
      };
      pendingCallbacks[requestId] = done;
      setTimeout(function () {
        if (pendingCallbacks[requestId]) {
          delete pendingCallbacks[requestId];
          done(undefined);
        }
      }, 1500);
      try {
        window.parent.postMessage({
          type: 'fabinav:ext-send-message',
          extId: EXT_ID,
          requestId: requestId,
          message: message
        }, '*');
      } catch (e) {}
    });
  }

  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'fabinav:ext-message-response' && d.requestId && pendingCallbacks[d.requestId]) {
      var fn = pendingCallbacks[d.requestId];
      delete pendingCallbacks[d.requestId];
      fn(d.response);
    } else if (d.type === 'fabinav:ext-runtime-message' && d.extId === EXT_ID) {
      messageListeners.forEach(function (fn) {
        try {
          fn(d.message, { id: EXT_ID, tab: ACTIVE_TAB }, function () {});
        } catch (e) {}
      });
    }
  });

  var storageArea = {
    get: resolveGet,
    set: resolveSet,
    remove: resolveRemove,
    clear: resolveClear
  };

  var api = {
    runtime: {
      id: EXT_ID,
      lastError: null,
      getManifest: function () { return MANIFEST; },
      getURL: function (rel) {
        var clean = String(rel || '').replace(/^\\/+/, '');
        return RESOURCES[clean] || clean;
      },
      sendMessage: function (msg, cb) { return sendToContent(msg, cb); },
      onMessage: {
        addListener: function (fn) { if (typeof fn === 'function') messageListeners.push(fn); },
        removeListener: function (fn) { messageListeners = messageListeners.filter(function (f) { return f !== fn; }); }
      }
    },
    storage: {
      local: storageArea,
      sync: storageArea,
      session: storageArea,
      onChanged: {
        addListener: function (fn) { if (typeof fn === 'function') storageListeners.push(fn); },
        removeListener: function (fn) { storageListeners = storageListeners.filter(function (f) { return f !== fn; }); }
      }
    },
    tabs: {
      query: function (_q, cb) {
        var list = [ACTIVE_TAB];
        if (typeof cb === 'function') setTimeout(function () { cb(list); }, 0);
        return Promise.resolve(list);
      },
      sendMessage: function (_tabId, msg, cb) { return sendToContent(msg, cb); },
      create: function (props, cb) {
        if (props && props.url) {
          window.parent.postMessage({ type: 'fabinav:ext-open-tab', url: props.url }, '*');
        }
        if (typeof cb === 'function') setTimeout(function () { cb(ACTIVE_TAB); }, 0);
        return Promise.resolve(ACTIVE_TAB);
      },
      insertCSS: function (_tabId, details, cb) {
        if (details && details.code) {
          window.parent.postMessage({ type: 'fabinav:ext-scripting', extId: EXT_ID, action: 'insertCSS', css: details.code }, '*');
        }
        if (typeof cb === 'function') setTimeout(function () { cb(); }, 0);
        return Promise.resolve();
      },
      executeScript: function (_tabId, details, cb) {
        if (details && details.code) {
          window.parent.postMessage({ type: 'fabinav:ext-scripting', extId: EXT_ID, action: 'executeScript', code: details.code }, '*');
        }
        if (typeof cb === 'function') setTimeout(function () { cb([]); }, 0);
        return Promise.resolve([]);
      }
    },
    scripting: {
      insertCSS: function (inj, cb) {
        if (inj && inj.css) {
          window.parent.postMessage({ type: 'fabinav:ext-scripting', extId: EXT_ID, action: 'insertCSS', css: inj.css }, '*');
        }
        if (typeof cb === 'function') setTimeout(function () { cb(); }, 0);
        return Promise.resolve();
      },
      executeScript: function (inj, cb) {
        if (inj && typeof inj.func === 'function') {
          var argsJson = JSON.stringify(Array.isArray(inj.args) ? inj.args : []);
          var code = '(' + inj.func.toString() + ').apply(null, ' + argsJson + ');';
          window.parent.postMessage({ type: 'fabinav:ext-scripting', extId: EXT_ID, action: 'executeScript', code: code }, '*');
        }
        if (typeof cb === 'function') setTimeout(function () { cb([]); }, 0);
        return Promise.resolve([]);
      }
    },
    action: {
      setBadgeText: function () {},
      setBadgeBackgroundColor: function () {}
    }
  };
  api.browserAction = api.action;
  window.chrome = api;
  window.browser = api;
})();
</script>`;

  const rawHtml =
    ext.popupHtml ||
    `<!doctype html><html><body style="font-family:system-ui,sans-serif;padding:16px;background:#181a20;color:#eceef2;font-size:12px;"><strong>${ext.name}</strong><p style="color:#9ea4b0;">Extensión activa (v${ext.version}).</p></body></html>`;

  if (/<head[^>]*>/i.test(rawHtml)) {
    return rawHtml.replace(/<head[^>]*>/i, (m) => `${m}\n${polyfill}`);
  }
  return `${polyfill}\n${rawHtml}`;
}
