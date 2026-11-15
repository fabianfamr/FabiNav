import express from 'express';
import path from 'path';
import http from 'http';
import https from 'https';
import tls from 'tls';
import net from 'net';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 3000;

interface SearchResult {
  title: string;
  url: string;
  displayUrl: string;
  snippet: string;
  source: 'web' | 'wikipedia';
}

interface StoredCookie {
  id: string;
  partition: 'normal' | 'private';
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

const cookieJar: Record<'normal' | 'private', StoredCookie[]> = {
  normal: [],
  private: []
};

const TRACKER_DOMAINS = [
  'doubleclick.net',
  'google-analytics.com',
  'googletagmanager.com',
  'googlesyndication.com',
  'googleadservices.com',
  'adservice.google.',
  'connect.facebook.net',
  'facebook.com/tr',
  'pixel.facebook.com',
  'analytics.twitter.com',
  'ads-twitter.com',
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
  'bing.com/bat.js',
  'bat.bing.com',
  'sentry.io'
];

const TRACKER_COOKIE_PATTERNS = [
  /^_ga/i,
  /^_gid$/i,
  /^_gat/i,
  /^_fbp$/i,
  /^_fbc$/i,
  /^_gcl_/i,
  /^_hj/i,
  /^_clck$/i,
  /^_clsk$/i,
  /^IDE$/,
  /^test_cookie$/,
  /^fr$/,
  /^muc_ads$/,
  /^personalization_id$/
];

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().trim();
  if (
    !lower ||
    lower === 'localhost' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower === '0.0.0.0' ||
    lower === '::1'
  ) {
    return true;
  }

  const ipVersion = net.isIP(lower);
  if (ipVersion === 4) {
    const parts = lower.split('.').map((n) => Number(n));
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
  } else if (ipVersion === 6) {
    if (lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) {
      return true;
    }
  }
  return false;
}

function normalizeCookieDomain(host: string): string {
  return host.toLowerCase().replace(/^\./, '');
}

function cookieMatchesHost(cookieDomain: string, requestHost: string): boolean {
  const cleanCookie = normalizeCookieDomain(cookieDomain);
  const cleanReq = requestHost.toLowerCase();
  return cleanReq === cleanCookie || cleanReq.endsWith(`.${cleanCookie}`);
}

function pruneExpiredCookies(partition: 'normal' | 'private') {
  const now = Date.now();
  cookieJar[partition] = cookieJar[partition].filter((c) => !c.expiresAt || c.expiresAt > now);
}

function storeSetCookieHeaders(
  setCookieList: string[] | undefined,
  requestUrl: URL,
  partition: 'normal' | 'private',
  blockCrossSiteCookies: boolean
): number {
  if (!setCookieList || setCookieList.length === 0) return 0;
  pruneExpiredCookies(partition);

  let blockedCount = 0;
  const reqHost = requestUrl.hostname.toLowerCase();

  for (const raw of setCookieList) {
    const segments = raw.split(';').map((s) => s.trim()).filter(Boolean);
    if (segments.length === 0) continue;

    const eqIdx = segments[0].indexOf('=');
    if (eqIdx <= 0) continue;

    const name = segments[0].slice(0, eqIdx).trim();
    const value = segments[0].slice(eqIdx + 1).trim();

    let domain = reqHost;
    let cookiePath = '/';
    let secure = false;
    let httpOnly = false;
    let sameSite = 'Lax';
    let expiresAt: number | null = null;

    for (const attr of segments.slice(1)) {
      const [kRaw, ...rest] = attr.split('=');
      const k = kRaw.trim().toLowerCase();
      const v = rest.join('=').trim();

      if (k === 'domain' && v) {
        domain = normalizeCookieDomain(v);
      } else if (k === 'path' && v) {
        cookiePath = v;
      } else if (k === 'secure') {
        secure = true;
      } else if (k === 'httponly') {
        httpOnly = true;
      } else if (k === 'samesite' && v) {
        sameSite = v;
      } else if (k === 'max-age' && v) {
        const secs = Number(v);
        if (!Number.isNaN(secs)) {
          expiresAt = Date.now() + secs * 1000;
        }
      } else if (k === 'expires' && v && !expiresAt) {
        const parsed = Date.parse(v);
        if (!Number.isNaN(parsed)) {
          expiresAt = parsed;
        }
      }
    }

    const isThirdParty = !cookieMatchesHost(domain, reqHost);
    const isTrackingCookie = TRACKER_COOKIE_PATTERNS.some((rx) => rx.test(name));

    if (blockCrossSiteCookies && (isThirdParty || isTrackingCookie)) {
      blockedCount += 1;
      continue;
    }

    // Delete cookie if Max-Age <= 0 or expired
    if (expiresAt !== null && expiresAt <= Date.now()) {
      cookieJar[partition] = cookieJar[partition].filter(
        (c) => !(c.domain === domain && c.name === name && c.path === cookiePath)
      );
      continue;
    }

    const existingIdx = cookieJar[partition].findIndex(
      (c) => c.domain === domain && c.name === name && c.path === cookiePath
    );

    const record: StoredCookie = {
      id: `${partition}-${domain}-${name}-${cookiePath}`,
      partition,
      domain,
      path: cookiePath,
      name,
      value,
      secure,
      httpOnly,
      sameSite,
      expiresAt,
      createdAt: Date.now(),
      isThirdParty
    };

    if (existingIdx >= 0) {
      cookieJar[partition][existingIdx] = record;
    } else {
      cookieJar[partition].unshift(record);
      if (cookieJar[partition].length > 300) {
        cookieJar[partition] = cookieJar[partition].slice(0, 300);
      }
    }
  }

  return blockedCount;
}

function buildCookieHeader(requestUrl: URL, partition: 'normal' | 'private'): string {
  pruneExpiredCookies(partition);
  const reqHost = requestUrl.hostname.toLowerCase();
  const reqPath = requestUrl.pathname || '/';
  const isHttps = requestUrl.protocol === 'https:';

  const matching = cookieJar[partition].filter((c) => {
    if (!cookieMatchesHost(c.domain, reqHost)) return false;
    if (!reqPath.startsWith(c.path)) return false;
    if (c.secure && !isHttps) return false;
    return true;
  });

  return matching.map((c) => `${c.name}=${c.value}`).join('; ');
}

function isTrackerUrl(rawSrc: string, aggressive: boolean): boolean {
  const lower = rawSrc.toLowerCase();
  if (TRACKER_DOMAINS.some((d) => lower.includes(d))) {
    return true;
  }
  if (aggressive) {
    if (/(\/ads\/|adserver|analytics\.js|telemetry|tracking|pixel\.)/i.test(lower)) {
      return true;
    }
  }
  return false;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function unwrapDuckDuckGoUrl(rawHref: string): string {
  try {
    const cleaned = rawHref.startsWith('//') ? `https:${rawHref}` : rawHref;
    const parsed = new URL(cleaned);
    const uddg = parsed.searchParams.get('uddg');
    if (uddg) {
      return decodeURIComponent(uddg);
    }
    return cleaned;
  } catch {
    return rawHref;
  }
}

async function fetchDuckDuckGoResults(query: string): Promise<SearchResult[]> {
  const endpoint = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(endpoint, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
    },
    signal: AbortSignal.timeout(6500)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();
  const results: SearchResult[] = [];

  const blocks = html.split(/class="result\s+results_links/i).slice(1, 14);
  for (const block of blocks) {
    const titleMatch = block.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!titleMatch) continue;

    const rawUrl = unwrapDuckDuckGoUrl(decodeHtmlEntities(titleMatch[1]));
    const title = decodeHtmlEntities(titleMatch[2]);
    if (!title || !rawUrl.startsWith('http')) continue;

    const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|div|span)>/i);
    const snippet = snippetMatch ? decodeHtmlEntities(snippetMatch[1]) : '';

    let displayUrl = rawUrl;
    try {
      const u = new URL(rawUrl);
      displayUrl = `${u.hostname}${u.pathname === '/' ? '' : u.pathname}`;
    } catch {
      displayUrl = rawUrl;
    }

    results.push({
      title,
      url: rawUrl,
      displayUrl,
      snippet,
      source: 'web'
    });
  }

  return results;
}

interface WikiKnowledgeCard {
  title: string;
  description: string | null;
  extract: string;
  thumbnailUrl: string | null;
  url: string;
}

async function fetchWikipediaSummary(articleTitle: string): Promise<WikiKnowledgeCard | null> {
  try {
    const slug = encodeURIComponent(articleTitle.replace(/ /g, '_'));
    const endpoint = `https://es.wikipedia.org/api/rest_v1/page/summary/${slug}`;
    const response = await fetch(endpoint, {
      headers: {
        'User-Agent': 'FabiNav/1.8.0 (Web Browser UI)',
        Accept: 'application/json'
      },
      signal: AbortSignal.timeout(3500)
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      title?: string;
      description?: string;
      extract?: string;
      thumbnail?: { source?: string };
      content_urls?: { desktop?: { page?: string } };
      type?: string;
    };
    if (!data?.extract || data.type === 'disambiguation') return null;
    return {
      title: data.title || articleTitle,
      description: data.description || null,
      extract: data.extract,
      thumbnailUrl: data.thumbnail?.source || null,
      url: data.content_urls?.desktop?.page || `https://es.wikipedia.org/wiki/${slug}`
    };
  } catch {
    return null;
  }
}

async function fetchWikipediaResults(
  query: string
): Promise<{ items: SearchResult[]; knowledge: WikiKnowledgeCard | null }> {
  const endpoint = `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    query
  )}&format=json&utf8=1&srlimit=4`;

  const response = await fetch(endpoint, {
    headers: {
      'User-Agent': 'FabiNav/1.8.0 (Web Browser UI)'
    },
    signal: AbortSignal.timeout(5000)
  });

  if (!response.ok) {
    return { items: [], knowledge: null };
  }

  const data = (await response.json()) as {
    query?: {
      search?: Array<{ title: string; snippet: string; pageid: number }>;
    };
  };

  const rawItems = data?.query?.search || [];
  const items: SearchResult[] = rawItems.map((item) => {
    const slug = encodeURIComponent(item.title.replace(/ /g, '_'));
    const url = `https://es.wikipedia.org/wiki/${slug}`;
    return {
      title: `${item.title} — Wikipedia`,
      url,
      displayUrl: `es.wikipedia.org/wiki/${item.title.replace(/ /g, '_')}`,
      snippet: decodeHtmlEntities(item.snippet),
      source: 'wikipedia' as const
    };
  });

  const knowledge =
    rawItems.length > 0 ? await fetchWikipediaSummary(rawItems[0].title) : null;

  return { items, knowledge };
}

function inspectTlsCertificate(host: string, port = 443): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (payload: Record<string, unknown>) => {
      if (settled) return;
      settled = true;
      resolve(payload);
    };

    try {
      const socket = tls.connect(
        {
          host,
          port,
          servername: host,
          rejectUnauthorized: false,
          minVersion: 'TLSv1.2',
          ALPNProtocols: ['h2', 'http/1.1']
        },
        () => {
          const cert = socket.getPeerCertificate();
          const cipher = socket.getCipher();
          const protocol = socket.getProtocol();
          const alpn = (socket as tls.TLSSocket & { alpnProtocol?: string }).alpnProtocol || null;

          finish({
            host,
            port,
            authorized: socket.authorized,
            authorizationError: socket.authorizationError
              ? String(socket.authorizationError)
              : null,
            protocol: protocol || null,
            cipher: cipher?.name || null,
            alpnProtocol: alpn,
            subjectCN: cert?.subject?.CN || host,
            issuerCN: cert?.issuer?.CN || null,
            issuerO: cert?.issuer?.O || null,
            validFrom: cert?.valid_from || null,
            validTo: cert?.valid_to || null,
            fingerprint256: cert?.fingerprint256 || null,
            checkedAt: Date.now()
          });
          socket.end();
        }
      );

      socket.setTimeout(4500, () => {
        socket.destroy();
        finish({
          host,
          port,
          authorized: false,
          authorizationError: 'Tiempo de espera TLS agotado',
          protocol: null,
          cipher: null,
          alpnProtocol: null,
          subjectCN: null,
          issuerCN: null,
          issuerO: null,
          validFrom: null,
          validTo: null,
          fingerprint256: null,
          checkedAt: Date.now(),
          error: 'Timeout al inspeccionar TLS'
        });
      });

      socket.on('error', (err) => {
        finish({
          host,
          port,
          authorized: false,
          authorizationError: err.message,
          protocol: null,
          cipher: null,
          alpnProtocol: null,
          subjectCN: null,
          issuerCN: null,
          issuerO: null,
          validFrom: null,
          validTo: null,
          fingerprint256: null,
          checkedAt: Date.now(),
          error: err.message
        });
      });
    } catch (err) {
      finish({
        host,
        port,
        authorized: false,
        authorizationError: err instanceof Error ? err.message : 'Error TLS',
        protocol: null,
        cipher: null,
        alpnProtocol: null,
        subjectCN: null,
        issuerCN: null,
        issuerO: null,
        validFrom: null,
        validTo: null,
        fingerprint256: null,
        checkedAt: Date.now(),
        error: err instanceof Error ? err.message : 'Error TLS'
      });
    }
  });
}

interface ProxyFetchOutcome {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
  finalUrl: string;
  cookiesBlocked: number;
  upgradedHttps: boolean;
}

function fetchViaNodeHttp(
  targetUrlStr: string,
  options: {
    partition: 'normal' | 'private';
    blockCookies: boolean;
    strictTls: boolean;
    upgradeHttps: boolean;
  },
  redirectsLeft = 5
): Promise<ProxyFetchOutcome> {
  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(targetUrlStr);
    } catch {
      reject(new Error('URL inválida'));
      return;
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      reject(new Error('Solo se permiten protocolos http y https'));
      return;
    }

    if (isBlockedHostname(parsed.hostname)) {
      reject(new Error('Acceso bloqueado a direcciones locales o privadas'));
      return;
    }

    let upgradedHttps = false;
    if (parsed.protocol === 'http:' && options.upgradeHttps) {
      parsed.protocol = 'https:';
      upgradedHttps = true;
    }

    const cookieHeader = buildCookieHeader(parsed, options.partition);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;

    const reqOptions: https.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: `${parsed.pathname}${parsed.search}`,
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        DNT: '1',
        ...(cookieHeader ? { Cookie: cookieHeader } : {})
      },
      timeout: 9000
    };

    if (isHttps) {
      reqOptions.minVersion = 'TLSv1.2';
      reqOptions.rejectUnauthorized = options.strictTls;
    }

    const req = transport.request(reqOptions, (res) => {
      const status = res.statusCode || 200;
      const setCookies = res.headers['set-cookie'];
      const blockedHere = storeSetCookieHeaders(
        setCookies,
        parsed,
        options.partition,
        options.blockCookies
      );

      // Handle redirects cleanly while updating Cookie Jar at each hop
      if ([301, 302, 303, 307, 308].includes(status) && res.headers.location && redirectsLeft > 0) {
        res.resume();
        try {
          const nextUrl = new URL(res.headers.location, parsed.href).href;
          fetchViaNodeHttp(nextUrl, options, redirectsLeft - 1)
            .then((nextOutcome) => {
              resolve({
                ...nextOutcome,
                cookiesBlocked: nextOutcome.cookiesBlocked + blockedHere,
                upgradedHttps: nextOutcome.upgradedHttps || upgradedHttps
              });
            })
            .catch(reject);
        } catch (err) {
          reject(err);
        }
        return;
      }

      const chunks: Buffer[] = [];
      let totalBytes = 0;
      const MAX_BYTES = 5 * 1024 * 1024; // 5MB safety limit

      res.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes <= MAX_BYTES) {
          chunks.push(chunk);
        } else {
          res.destroy();
        }
      });

      res.on('end', () => {
        const rawBuf = Buffer.concat(chunks);
        const encoding = String(res.headers['content-encoding'] || '').toLowerCase();

        const finishDecompressed = (finalBuf: Buffer) => {
          resolve({
            status,
            headers: res.headers,
            body: finalBuf,
            finalUrl: parsed.href,
            cookiesBlocked: blockedHere,
            upgradedHttps
          });
        };

        if (encoding === 'gzip') {
          zlib.gunzip(rawBuf, (err, decoded) => finishDecompressed(err ? rawBuf : decoded));
        } else if (encoding === 'deflate') {
          zlib.inflate(rawBuf, (err, decoded) => finishDecompressed(err ? rawBuf : decoded));
        } else if (encoding === 'br') {
          zlib.brotliDecompress(rawBuf, (err, decoded) => finishDecompressed(err ? rawBuf : decoded));
        } else {
          finishDecompressed(rawBuf);
        }
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('Tiempo de espera agotado al conectar con el sitio'));
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeAndEnhanceHtml(
  rawHtml: string,
  finalUrl: string,
  options: {
    shields: boolean;
    blockTrackers: 'standard' | 'aggressive' | 'disabled';
    blockScripts: boolean;
    cookiesBlocked: number;
    upgradedHttps: boolean;
  }
): { html: string; trackersBlocked: number } {
  let html = rawHtml;
  let trackersBlocked = 0;

  // Strip meta CSP frame-ancestors tags if present
  html = html.replace(
    /<meta[^>]+http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi,
    ''
  );

  // Filter tracker scripts & tracking pixels/iframes when Shields are enabled
  if (options.shields && options.blockTrackers !== 'disabled') {
    const aggressive = options.blockTrackers === 'aggressive';

    html = html.replace(
      /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>[\s\S]*?<\/script>/gi,
      (fullTag, src) => {
        if (options.blockScripts || isTrackerUrl(src, aggressive)) {
          trackersBlocked += 1;
          return '';
        }
        return fullTag;
      }
    );

    if (options.blockScripts) {
      html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, () => {
        trackersBlocked += 1;
        return '';
      });
    }

    html = html.replace(
      /<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*>[\s\S]*?<\/iframe>/gi,
      (fullTag, src) => {
        if (isTrackerUrl(src, aggressive)) {
          trackersBlocked += 1;
          return '';
        }
        return fullTag;
      }
    );

    html = html.replace(
      /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi,
      (fullTag, src) => {
        if (isTrackerUrl(src, aggressive)) {
          trackersBlocked += 1;
          return '';
        }
        return fullTag;
      }
    );
  } else if (options.shields && options.blockScripts) {
    html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, () => {
      trackersBlocked += 1;
      return '';
    });
  }

  // Insert <base href="..."> so relative assets resolve properly against finalUrl
  const baseTag = `<base href="${escapeHtml(finalUrl)}">`;
  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, (match) => `${match}\n${baseTag}`);
  } else {
    html = `<head>${baseTag}</head>\n${html}`;
  }

  // Inject lightweight FabiNav bridge (links + forms + real title/shield telemetry via postMessage)
  const bridgeScript = `
<script data-fabinav-bridge="1">
(function () {
  var currentUrl = ${JSON.stringify(finalUrl)};
  var report = function () {
    try {
      window.parent.postMessage({
        type: 'fabinav:page-info',
        url: currentUrl,
        title: document.title || currentUrl,
        blockedTrackers: ${trackersBlocked},
        blockedCookies: ${options.cookiesBlocked},
        upgradedHttps: ${options.upgradedHttps ? 'true' : 'false'}
      }, '*');
    } catch (e) {}
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', report);
  } else {
    report();
  }
  window.addEventListener('load', report);

  document.addEventListener('click', function (ev) {
    var el = ev.target;
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (!el || !el.getAttribute) return;
    var rawHref = el.getAttribute('href');
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) return;
    try {
      var resolved = new URL(rawHref, currentUrl).href;
      if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
        ev.preventDefault();
        window.parent.postMessage({ type: 'fabinav:navigate', url: resolved }, '*');
      }
    } catch (e) {}
  }, true);

  document.addEventListener('submit', function (ev) {
    var form = ev.target;
    if (!form || form.tagName !== 'FORM') return;
    var method = (form.getAttribute('method') || 'GET').toUpperCase();
    if (method !== 'GET') return;
    try {
      var action = form.getAttribute('action') || currentUrl;
      var target = new URL(action, currentUrl);
      var fd = new FormData(form);
      fd.forEach(function (val, key) {
        if (typeof val === 'string') target.searchParams.set(key, val);
      });
      ev.preventDefault();
      window.parent.postMessage({ type: 'fabinav:navigate', url: target.href }, '*');
    } catch (e) {}
  }, true);
})();
</script>`;

  if (/<\/body>/i.test(html)) {
    html = html.replace(/<\/body>/i, `${bridgeScript}\n</body>`);
  } else {
    html = `${html}\n${bridgeScript}`;
  }

  return { html, trackersBlocked };
}

function renderProxyFallbackHtml(targetUrl: string, errorMessage: string): string {
  const safeUrl = escapeHtml(targetUrl);
  const safeErr = escapeHtml(errorMessage);
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>No se pudo cargar ${safeUrl}</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      background: #1e2025;
      color: #d8dade;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      max-width: 480px;
      width: 100%;
      background: #27292e;
      border: 1px solid #34363e;
      border-radius: 18px;
      padding: 24px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.45);
    }
    h1 { font-size: 16px; color: #fff; margin: 0 0 8px 0; }
    p { font-size: 13px; color: #9398a3; line-height: 1.5; margin: 0 0 14px 0; }
    .err {
      font-family: monospace;
      font-size: 11px;
      background: #191a1e;
      border: 1px solid #34363e;
      border-radius: 10px;
      padding: 10px 12px;
      color: #fb542b;
      margin-bottom: 16px;
      word-break: break-word;
    }
    a.btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #fb542b;
      color: #fff;
      text-decoration: none;
      font-size: 12px;
      font-weight: 600;
      padding: 9px 16px;
      border-radius: 999px;
    }
    a.btn:hover { background: #e0441e; }
  </style>
</head>
<body>
  <div class="card">
    <h1>No se pudo abrir esta página dentro del visor</h1>
    <p>El servidor remoto rechazó la conexión TLS/proxy o requiere ejecución nativa fuera del entorno embebido.</p>
    <div class="err">${safeErr}</div>
    <a class="btn" href="${safeUrl}" target="_blank" rel="noopener noreferrer">Abrir sitio en una ventana nueva &#8599;</a>
  </div>
</body>
</html>`;
}

async function startServer() {
  const app = express();

  // 1. Live Web Search API
  app.get('/api/search', async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) {
      res.status(400).json({ error: 'Consulta vacía', results: [], wikipedia: [], knowledge: null });
      return;
    }

    const startedAt = Date.now();
    const [webSettled, wikiSettled] = await Promise.allSettled([
      fetchDuckDuckGoResults(q),
      fetchWikipediaResults(q)
    ]);

    const results = webSettled.status === 'fulfilled' ? webSettled.value : [];
    const wikipedia = wikiSettled.status === 'fulfilled' ? wikiSettled.value.items : [];
    const knowledge = wikiSettled.status === 'fulfilled' ? wikiSettled.value.knowledge : null;
    const webError =
      webSettled.status === 'rejected'
        ? String(webSettled.reason instanceof Error ? webSettled.reason.message : webSettled.reason)
        : null;

    res.json({
      query: q,
      results,
      wikipedia,
      knowledge,
      durationMs: Date.now() - startedAt,
      webError,
      fetchedAt: Date.now()
    });
  });

  // 2. Real TLS Certificate & Handshake Inspection API
  app.get('/api/tls', async (req, res) => {
    const rawUrl = String(req.query.url || '').trim();
    if (!rawUrl) {
      res.status(400).json({ error: 'Falta el parámetro url' });
      return;
    }

    try {
      const parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
      if (isBlockedHostname(parsed.hostname)) {
        res.status(403).json({ error: 'Host local no permitido' });
        return;
      }
      if (parsed.protocol !== 'https:') {
        res.json({
          host: parsed.hostname,
          port: 80,
          authorized: false,
          authorizationError: 'Conexión HTTP sin cifrado TLS',
          protocol: null,
          cipher: null,
          alpnProtocol: null,
          subjectCN: null,
          issuerCN: null,
          issuerO: null,
          validFrom: null,
          validTo: null,
          fingerprint256: null,
          checkedAt: Date.now()
        });
        return;
      }

      const tlsInfo = await inspectTlsCertificate(parsed.hostname, Number(parsed.port) || 443);
      res.json(tlsInfo);
    } catch {
      res.status(400).json({ error: 'URL inválida' });
    }
  });

  // 3. Real Partitioned Cookie Jar API
  app.get('/api/cookies', (req, res) => {
    const partition = req.query.partition === 'private' ? 'private' : 'normal';
    const domainFilter = String(req.query.domain || '').toLowerCase().trim();
    pruneExpiredCookies(partition);

    const list = domainFilter
      ? cookieJar[partition].filter((c) => cookieMatchesHost(c.domain, domainFilter))
      : cookieJar[partition];

    res.json({
      partition,
      cookies: list
    });
  });

  app.delete('/api/cookies', (req, res) => {
    const partition = req.query.partition === 'private' ? 'private' : 'normal';
    const id = String(req.query.id || '').trim();
    const domain = String(req.query.domain || '').toLowerCase().trim();

    if (id) {
      cookieJar[partition] = cookieJar[partition].filter((c) => c.id !== id);
    } else if (domain) {
      cookieJar[partition] = cookieJar[partition].filter((c) => !cookieMatchesHost(c.domain, domain));
    } else {
      cookieJar[partition] = [];
    }

    res.json({
      ok: true,
      partition,
      remaining: cookieJar[partition].length
    });
  });

  // 4. Brave-Style Secure Web Proxy (strips X-Frame-Options/frame-ancestors, enforces TLS & Shields)
  app.get('/api/proxy', async (req, res) => {
    const targetUrl = String(req.query.url || '').trim();
    if (!targetUrl) {
      res.status(400).send(renderProxyFallbackHtml('', 'URL vacía'));
      return;
    }

    const partition = req.query.partition === 'private' ? 'private' : 'normal';
    const shields = req.query.shields !== '0';
    const blockTrackersRaw = String(req.query.blockTrackers || 'standard');
    const blockTrackers =
      blockTrackersRaw === 'aggressive' || blockTrackersRaw === 'disabled'
        ? blockTrackersRaw
        : 'standard';
    const blockScripts = req.query.blockScripts === '1';
    const blockCookies = req.query.blockCookies !== '0';
    const upgradeHttps = req.query.upgradeHttps !== '0';
    const strictTls = req.query.strictTls !== '0';

    try {
      const outcome = await fetchViaNodeHttp(targetUrl, {
        partition,
        blockCookies: shields && blockCookies,
        strictTls,
        upgradeHttps: shields && upgradeHttps
      });

      const contentType = String(outcome.headers['content-type'] || 'text/html');
      if (contentType.includes('text/html') || contentType.includes('application/xhtml+xml')) {
        const rawHtml = outcome.body.toString('utf-8');
        const { html } = sanitizeAndEnhanceHtml(rawHtml, outcome.finalUrl, {
          shields,
          blockTrackers,
          blockScripts,
          cookiesBlocked: outcome.cookiesBlocked,
          upgradedHttps: outcome.upgradedHttps
        });
        res.status(outcome.status >= 400 ? outcome.status : 200);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.send(html);
        return;
      }

      res.status(outcome.status);
      res.setHeader('Content-Type', contentType);
      res.send(outcome.body);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al cargar el sitio';
      res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(renderProxyFallbackHtml(targetUrl, msg));
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FabiNav server listening on http://localhost:${PORT}`);
  });
}

startServer();
