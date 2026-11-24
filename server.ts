import express from 'express';
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import tls from 'tls';
import net from 'net';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const resolvedFilename =
  typeof __filename !== 'undefined'
    ? __filename
    : typeof import.meta?.url === 'string' && import.meta.url
    ? fileURLToPath(import.meta.url)
    : path.resolve(process.cwd(), 'server.ts');
const resolvedDirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(resolvedFilename);
const DEFAULT_PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.FABINAV_DATA_DIR || path.resolve(resolvedDirname, 'data');
const COOKIES_FILE = path.join(DATA_DIR, 'fabinav-cookies.json');

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

interface ProxyCacheEntry {
  url: string;
  finalUrl: string;
  contentType: string;
  status: number;
  html: string;
  trackersBlocked: number;
  sizeBytes: number;
  cachedAt: number;
  expiresAt: number;
}

interface SearchCacheEntry {
  key: string;
  query: string;
  payload: Record<string, unknown>;
  sizeBytes: number;
  cachedAt: number;
  expiresAt: number;
}

const proxyCache = new Map<string, ProxyCacheEntry>();
const searchCache = new Map<string, SearchCacheEntry>();
const MAX_PROXY_CACHE_ENTRIES = 45;
const MAX_SEARCH_CACHE_ENTRIES = 50;
const PROXY_CACHE_TTL_MS = 5 * 60 * 1000;
const SEARCH_CACHE_TTL_MS = 3 * 60 * 1000;

let cookieSaveTimer: NodeJS.Timeout | null = null;

function flushNormalCookiesToDisk() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const now = Date.now();
    const persistable = cookieJar.normal.filter((c) => !c.expiresAt || c.expiresAt > now);
    fs.writeFileSync(COOKIES_FILE, JSON.stringify(persistable, null, 2), 'utf-8');
  } catch {
    // Ignore disk write errors on read-only environments
  }
}

function scheduleSaveNormalCookies() {
  if (cookieSaveTimer) clearTimeout(cookieSaveTimer);
  cookieSaveTimer = setTimeout(() => {
    cookieSaveTimer = null;
    flushNormalCookiesToDisk();
  }, 250);
}

function loadNormalCookiesFromDisk() {
  try {
    if (!fs.existsSync(COOKIES_FILE)) return;
    const raw = fs.readFileSync(COOKIES_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    const now = Date.now();
    cookieJar.normal = parsed.filter(
      (c): c is StoredCookie =>
        c &&
        typeof c === 'object' &&
        typeof c.name === 'string' &&
        typeof c.domain === 'string' &&
        (!c.expiresAt || c.expiresAt > now)
    );
  } catch {
    cookieJar.normal = [];
  }
}

function pruneExpiredCache() {
  const now = Date.now();
  for (const [k, entry] of proxyCache.entries()) {
    if (entry.expiresAt <= now) proxyCache.delete(k);
  }
  for (const [k, entry] of searchCache.entries()) {
    if (entry.expiresAt <= now) searchCache.delete(k);
  }
}

function setProxyCacheEntry(key: string, entry: ProxyCacheEntry) {
  pruneExpiredCache();
  if (proxyCache.size >= MAX_PROXY_CACHE_ENTRIES) {
    const oldestKey = proxyCache.keys().next().value;
    if (oldestKey) proxyCache.delete(oldestKey);
  }
  proxyCache.set(key, entry);
}

function setSearchCacheEntry(key: string, entry: SearchCacheEntry) {
  pruneExpiredCache();
  if (searchCache.size >= MAX_SEARCH_CACHE_ENTRIES) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey) searchCache.delete(oldestKey);
  }
  searchCache.set(key, entry);
}

const TRACKER_DOMAINS = [
  'doubleclick.net',
  'google-analytics.com',
  'googletagmanager.com',
  'googlesyndication.com',
  'googleadservices.com',
  'adservice.google.',
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
  'bing.com/bat.js',
  'bat.bing.com',
  'sentry.io',
  'mc.yandex.ru',
  'moatads.com',
  'doubleverify.com',
  'adform.net',
  'adsrvr.org'
];

const SOCIAL_TRACKER_DOMAINS = [
  'connect.facebook.net',
  'facebook.com/tr',
  'pixel.facebook.com',
  'analytics.twitter.com',
  'ads-twitter.com',
  'platform.twitter.com/widgets.js',
  'snap.licdn.com',
  'px.ads.linkedin.com',
  'ct.pinterest.com'
];

const REGIONAL_TRACKER_DOMAINS = [
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

function stripUrlTrackingParams(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'fbclid',
      'gclid',
      'yclid',
      'mc_eid',
      'igshid'
    ];
    let changed = false;
    for (const p of trackingParams) {
      if (u.searchParams.has(p)) {
        u.searchParams.delete(p);
        changed = true;
      }
    }
    return changed ? u.toString() : rawUrl;
  } catch {
    return rawUrl;
  }
}

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

  if (partition === 'normal') {
    scheduleSaveNormalCookies();
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

function isTrackerUrl(
  rawSrc: string,
  aggressive: boolean,
  filterLists: string[] = ['core-trackers', 'cookie-notices', 'url-tracking'],
  customRules: string[] = []
): boolean {
  const lower = rawSrc.toLowerCase();
  const hasCore = filterLists.includes('core-trackers');
  const hasSocial = filterLists.includes('social-widgets');
  const hasRegional = filterLists.includes('regional-es-ja');

  if (hasCore && TRACKER_DOMAINS.some((d) => lower.includes(d))) {
    return true;
  }
  if (hasSocial && SOCIAL_TRACKER_DOMAINS.some((d) => lower.includes(d))) {
    return true;
  }
  if (hasRegional && REGIONAL_TRACKER_DOMAINS.some((d) => lower.includes(d))) {
    return true;
  }
  if (customRules.some((rule) => rule && lower.includes(rule.toLowerCase()))) {
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
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
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

async function fetchBingWebRss(
  query: string,
  page = 1,
  lang: 'es' | 'all' = 'all'
): Promise<{ results: SearchResult[]; hasMore: boolean }> {
  const first = Math.max(1, (page - 1) * 10 + 1);
  const params = new URLSearchParams({
    q: query,
    format: 'rss',
    count: '12',
    first: String(first)
  });
  if (lang === 'es') {
    params.set('setlang', 'es');
  }

  const endpoint = `https://www.bing.com/search?${params.toString()}`;
  const response = await fetch(endpoint, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Accept: 'application/rss+xml, application/xml, text/xml'
    },
    signal: AbortSignal.timeout(5500)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const xml = await response.text();
  const blocks = xml.split(/<item>/i).slice(1, 16);
  const results: SearchResult[] = [];

  for (const block of blocks) {
    const titleRaw = block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '';
    const linkRaw = block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || '';
    const descRaw = block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || '';

    const title = unwrapXmlCdata(titleRaw);
    const rawUrl = unwrapXmlCdata(linkRaw).trim();
    const snippet = unwrapXmlCdata(descRaw);
    if (!title || !rawUrl.startsWith('http')) continue;

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

  return { results, hasMore: results.length >= 8 };
}

async function fetchDuckDuckGoResults(
  query: string,
  page = 1,
  lang: 'es' | 'all' = 'all'
): Promise<{ results: SearchResult[]; hasMore: boolean }> {
  try {
    const offset = Math.max(0, (page - 1) * 15);
    const params = new URLSearchParams({ q: query });
    if (offset > 0) {
      params.set('s', String(offset));
      params.set('dc', String(offset + 1));
    }
    if (lang === 'es') {
      params.set('kl', 'es-es');
    }
    const endpoint = `https://html.duckduckgo.com/html/?${params.toString()}`;
    const response = await fetch(endpoint, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept-Language': lang === 'es' ? 'es-ES,es;q=0.9' : 'es-ES,es;q=0.9,en;q=0.8'
      },
      signal: AbortSignal.timeout(5500)
    });

    if (response.ok) {
      const html = await response.text();
      const results: SearchResult[] = [];

      const blocks = html.split(/class="result\s+results_links/i).slice(1, 18);
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

      if (results.length > 0) {
        const hasMore = blocks.length >= 10 && /value="Next"|next_form/i.test(html);
        return { results, hasMore };
      }
    }
  } catch {
    // Fall back to Bing Web RSS cleanly
  }

  return fetchBingWebRss(query, page, lang);
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
        'User-Agent': 'FabiNav/1.11.1 (Web Browser UI)',
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

interface RelatedTopicItem {
  title: string;
  extract: string;
  url: string;
}

async function fetchWikipediaResults(
  query: string
): Promise<{
  items: SearchResult[];
  knowledge: WikiKnowledgeCard | null;
  relatedTopics: RelatedTopicItem[];
}> {
  const endpoint = `https://es.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
    query
  )}&gsrlimit=5&prop=extracts|info&exintro=1&explaintext=1&exsentences=2&inprop=url&format=json&utf8=1`;

  const response = await fetch(endpoint, {
    headers: {
      'User-Agent': 'FabiNav/1.11.1 (Web Browser UI)'
    },
    signal: AbortSignal.timeout(5000)
  });

  if (!response.ok) {
    return { items: [], knowledge: null, relatedTopics: [] };
  }

  const data = (await response.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          pageid: number;
          index?: number;
          title: string;
          extract?: string;
          fullurl?: string;
        }
      >;
    };
  };

  const rawPages = Object.values(data?.query?.pages || {}).sort(
    (a, b) => (a.index ?? 999) - (b.index ?? 999)
  );

  const items: SearchResult[] = rawPages.map((item) => {
    const slug = encodeURIComponent(item.title.replace(/ /g, '_'));
    const url = item.fullurl || `https://es.wikipedia.org/wiki/${slug}`;
    return {
      title: `${item.title} — Wikipedia`,
      url,
      displayUrl: `es.wikipedia.org/wiki/${item.title.replace(/ /g, '_')}`,
      snippet: (item.extract || '').trim(),
      source: 'wikipedia' as const
    };
  });

  const relatedTopics: RelatedTopicItem[] = rawPages
    .filter((p) => p.extract && p.extract.trim().length > 20)
    .slice(0, 4)
    .map((p) => {
      const slug = encodeURIComponent(p.title.replace(/ /g, '_'));
      return {
        title: p.title,
        extract: p.extract!.trim(),
        url: p.fullurl || `https://es.wikipedia.org/wiki/${slug}`
      };
    });

  const knowledge =
    rawPages.length > 0 ? await fetchWikipediaSummary(rawPages[0].title) : null;

  return { items, knowledge, relatedTopics };
}

interface SearchImageItem {
  title: string;
  thumbnailUrl: string;
  imageUrl: string;
  sourceUrl: string;
}

async function fetchWikimediaImages(query: string): Promise<SearchImageItem[]> {
  try {
    const endpoint = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
      query
    )}&gsrlimit=12&prop=imageinfo&iiprop=url|mime&iiurlwidth=480&format=json`;
    const response = await fetch(endpoint, {
      headers: {
        'User-Agent': 'FabiNav/1.11.1 (Web Browser UI)',
        Accept: 'application/json'
      },
      signal: AbortSignal.timeout(4500)
    });
    if (!response.ok) return [];
    const data = (await response.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            title?: string;
            fullurl?: string;
            imageinfo?: Array<{
              url?: string;
              thumburl?: string;
              descriptionurl?: string;
              mime?: string;
            }>;
          }
        >;
      };
    };
    const pages = Object.values(data?.query?.pages || {});
    const images: SearchImageItem[] = [];
    for (const p of pages) {
      const info = p.imageinfo?.[0];
      if (!info?.url || !info.mime?.startsWith('image/')) continue;
      if (info.mime === 'image/svg+xml' || info.mime === 'image/tiff') continue;
      images.push({
        title: (p.title || 'Imagen').replace(/^File:/i, '').replace(/\.[^.]+$/, ''),
        thumbnailUrl: info.thumburl || info.url,
        imageUrl: info.url,
        sourceUrl: info.descriptionurl || info.url
      });
    }
    return images.slice(0, 12);
  } catch {
    return [];
  }
}

async function fetchRelatedQueries(query: string): Promise<string[]> {
  try {
    const [ddgSettled, wikiSettled] = await Promise.allSettled([
      fetch(`https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}&type=list`, {
        headers: {
          'User-Agent': 'FabiNav/1.11.0 (Web Browser UI)',
          Accept: 'application/json'
        },
        signal: AbortSignal.timeout(2500)
      }).then((r) => (r.ok ? r.json() : [])),
      fetch(
        `https://es.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
          query
        )}&limit=6&namespace=0&format=json`,
        {
          headers: {
            'User-Agent': 'FabiNav/1.11.0 (Web Browser UI)',
            Accept: 'application/json'
          },
          signal: AbortSignal.timeout(2500)
        }
      ).then((r) => (r.ok ? r.json() : []))
    ]);

    const merged: string[] = [];
    const seen = new Set<string>([query.trim().toLowerCase()]);

    const pushCandidate = (raw: unknown) => {
      if (typeof raw !== 'string') return;
      const clean = raw.trim();
      const lower = clean.toLowerCase();
      if (!clean || seen.has(lower)) return;
      seen.add(lower);
      merged.push(clean);
    };

    if (ddgSettled.status === 'fulfilled' && Array.isArray(ddgSettled.value?.[1])) {
      for (const s of ddgSettled.value[1]) pushCandidate(s);
    }
    if (wikiSettled.status === 'fulfilled' && Array.isArray(wikiSettled.value?.[1])) {
      for (const s of wikiSettled.value[1]) pushCandidate(s);
    }

    return merged.slice(0, 8);
  } catch {
    return [];
  }
}

interface SearchNewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  timestamp: number;
}

function formatRelativeSpanishDate(ts: number): string {
  if (!ts || Number.isNaN(ts)) return '';
  const diffMin = Math.max(1, Math.floor((Date.now() - ts) / 60000));
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays <= 7) return `Hace ${diffDays} d`;
  return new Date(ts).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function unwrapXmlCdata(raw: string): string {
  return decodeHtmlEntities(raw.replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/i, '$1'));
}

function unwrapBingNewsUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const direct = parsed.searchParams.get('url');
    if (direct && direct.startsWith('http')) {
      return direct;
    }
    return rawUrl;
  } catch {
    return rawUrl;
  }
}

async function fetchGoogleNewsRss(
  query: string,
  lang: 'es' | 'all' = 'all'
): Promise<SearchNewsItem[]> {
  try {
    const setlang = lang === 'es' ? 'es' : 'es-es';
    const endpoint = `https://www.bing.com/news/search?q=${encodeURIComponent(
      query
    )}&format=rss&setlang=${setlang}`;
    const response = await fetch(endpoint, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'application/rss+xml, application/xml, text/xml'
      },
      signal: AbortSignal.timeout(4500)
    });
    if (!response.ok) return [];
    const xml = await response.text();
    const items = xml.split(/<item>/i).slice(1, 10);
    const parsed: SearchNewsItem[] = [];

    for (const block of items) {
      const titleRaw = block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '';
      const linkRaw = block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || '';
      const pubRaw = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] || '';
      const sourceRaw =
        block.match(/<News:Source>([\s\S]*?)<\/News:Source>/i)?.[1] ||
        block.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] ||
        '';

      const title = unwrapXmlCdata(titleRaw);
      const rawUrl = unwrapXmlCdata(linkRaw).trim();
      const url = unwrapBingNewsUrl(rawUrl);
      let source = unwrapXmlCdata(sourceRaw);
      if (!source && url.startsWith('http')) {
        try {
          source = new URL(url).hostname.replace(/^www\./, '');
        } catch {
          source = 'Noticias';
        }
      }
      if (!title || !url.startsWith('http')) continue;

      const ts = pubRaw ? Date.parse(pubRaw) : Date.now();
      parsed.push({
        title,
        url,
        source: source || 'Noticias',
        publishedAt: formatRelativeSpanishDate(ts),
        timestamp: Number.isNaN(ts) ? Date.now() : ts
      });
    }

    return parsed.slice(0, 8);
  } catch {
    return [];
  }
}

interface SearchVideoItem {
  title: string;
  url: string;
  displayUrl: string;
  snippet: string;
  thumbnailUrl: string | null;
  videoId: string | null;
  channel: string;
}

function extractYouTubeId(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{6,15}$/.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (u.pathname === '/watch') {
        const v = u.searchParams.get('v');
        return v && /^[a-zA-Z0-9_-]{6,15}$/.test(v) ? v : null;
      }
      const parts = u.pathname.split('/').filter(Boolean);
      if ((parts[0] === 'shorts' || parts[0] === 'embed') && parts[1]) {
        return /^[a-zA-Z0-9_-]{6,15}$/.test(parts[1]) ? parts[1] : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

async function fetchVideoResults(
  query: string,
  existingWebResults: SearchResult[]
): Promise<SearchVideoItem[]> {
  const seen = new Set<string>();
  const videos: SearchVideoItem[] = [];

  const pushIfVideo = (item: SearchResult) => {
    if (seen.has(item.url)) return;
    const ytId = extractYouTubeId(item.url);
    const lower = item.url.toLowerCase();
    const isVideoHost =
      ytId !== null ||
      lower.includes('youtube.com/') ||
      lower.includes('vimeo.com/') ||
      lower.includes('dailymotion.com/');
    if (!isVideoHost) return;
    seen.add(item.url);
    let channel = 'Video web';
    try {
      const host = new URL(item.url).hostname.replace(/^www\./, '');
      channel = host === 'youtube.com' || host === 'youtu.be' ? 'YouTube' : host;
    } catch {
      channel = 'Video web';
    }
    videos.push({
      title: item.title.replace(/\s*-\s*YouTube$/i, '').trim() || item.title,
      url: item.url,
      displayUrl: item.displayUrl,
      snippet: item.snippet,
      thumbnailUrl: ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : null,
      videoId: ytId,
      channel
    });
  };

  for (const r of existingWebResults) {
    pushIfVideo(r);
  }

  if (videos.length < 4) {
    try {
      const { results: ytResults } = await fetchBingWebRss(`site:youtube.com/watch ${query}`, 1);
      for (const r of ytResults) {
        pushIfVideo(r);
        if (videos.length >= 8) break;
      }
    } catch {
      // keep existing video results if targeted search fails
    }
  }

  return videos.slice(0, 8);
}

interface SearchRepoItem {
  fullName: string;
  description: string;
  url: string;
  language: string | null;
  stars: number;
  forks: number;
  updatedAt: string;
}

async function fetchGitHubRepos(query: string): Promise<SearchRepoItem[]> {
  try {
    const endpoint = `https://api.github.com/search/repositories?q=${encodeURIComponent(
      query
    )}&sort=stars&order=desc&per_page=6`;
    const response = await fetch(endpoint, {
      headers: {
        'User-Agent': 'FabiNav/1.11.0 (Web Browser UI)',
        Accept: 'application/vnd.github+json'
      },
      signal: AbortSignal.timeout(4000)
    });
    if (!response.ok) return [];
    const data = (await response.json()) as {
      items?: Array<{
        full_name?: string;
        description?: string | null;
        html_url?: string;
        language?: string | null;
        stargazers_count?: number;
        forks_count?: number;
        updated_at?: string;
      }>;
    };
    return (data.items || [])
      .filter((r) => r.full_name && r.html_url)
      .map((r) => ({
        fullName: r.full_name!,
        description: r.description || 'Repositorio público en GitHub.',
        url: r.html_url!,
        language: r.language || null,
        stars: r.stargazers_count || 0,
        forks: r.forks_count || 0,
        updatedAt: r.updated_at ? formatRelativeSpanishDate(Date.parse(r.updated_at)) : ''
      }));
  } catch {
    return [];
  }
}

interface ServerInstantAnswer {
  type: 'currency' | 'dictionary';
  title: string;
  subtitle: string;
  resultText: string;
  details?: Array<{ label: string; value: string }>;
  sourceUrl?: string;
  sourceLabel?: string;
}

const CURRENCY_ALIASES: Record<string, string> = {
  usd: 'USD',
  dolar: 'USD',
  dolares: 'USD',
  dollar: 'USD',
  dollars: 'USD',
  eur: 'EUR',
  euro: 'EUR',
  euros: 'EUR',
  mxn: 'MXN',
  peso: 'MXN',
  pesos: 'MXN',
  cop: 'COP',
  ars: 'ARS',
  clp: 'CLP',
  pen: 'PEN',
  soles: 'PEN',
  brl: 'BRL',
  gbp: 'GBP',
  libra: 'GBP',
  libras: 'GBP',
  jpy: 'JPY',
  yen: 'JPY',
  cad: 'CAD',
  chf: 'CHF',
  uyu: 'UYU',
  ves: 'VES',
  gtq: 'GTQ',
  dop: 'DOP'
};

async function fetchServerInstantAnswer(query: string): Promise<ServerInstantAnswer | null> {
  const trimmed = query.trim();

  // 1. Live currency conversion ("100 usd a mxn", "50 eur to cop")
  const currMatch = trimmed.match(
    /^(\d+(?:[.,]\d+)?)\s*([a-zA-ZáéíóúÁÉÍÓÚ]{3,10})\s+(?:a|to|en|in)\s+([a-zA-ZáéíóúÁÉÍÓÚ]{3,10})$/i
  );
  if (currMatch) {
    const amount = Number(currMatch[1].replace(',', '.'));
    const fromKey = currMatch[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const toKey = currMatch[3].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const fromCode = CURRENCY_ALIASES[fromKey] || (fromKey.length === 3 ? fromKey.toUpperCase() : null);
    const toCode = CURRENCY_ALIASES[toKey] || (toKey.length === 3 ? toKey.toUpperCase() : null);

    if (Number.isFinite(amount) && fromCode && toCode && fromCode !== toCode) {
      try {
        const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(fromCode)}`, {
          headers: { 'User-Agent': 'FabiNav/1.11.0 (Web Browser UI)' },
          signal: AbortSignal.timeout(3500)
        });
        if (res.ok) {
          const json = (await res.json()) as {
            result?: string;
            rates?: Record<string, number>;
            time_last_update_utc?: string;
          };
          const rate = json?.rates?.[toCode];
          if (json?.result === 'success' && typeof rate === 'number') {
            const converted = amount * rate;
            return {
              type: 'currency',
              title: 'Conversor de divisas en vivo',
              subtitle: `${amount.toLocaleString('es-ES')} ${fromCode} equivale a`,
              resultText: `${converted.toLocaleString('es-ES', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })} ${toCode}`,
              details: [
                {
                  label: 'Tipo de cambio',
                  value: `1 ${fromCode} = ${rate.toLocaleString('es-ES', { maximumFractionDigits: 4 })} ${toCode}`
                },
                ...(json.time_last_update_utc
                  ? [
                      {
                        label: 'Actualización',
                        value: new Date(json.time_last_update_utc).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })
                      }
                    ]
                  : [])
              ],
              sourceUrl: 'https://www.exchangerate-api.com',
              sourceLabel: 'ExchangeRate-API'
            };
          }
        }
      } catch {
        // ignore and return null
      }
    }
  }

  // 2. Real Dictionary Lookup ("define <word>", "definir <word>", "significado de <word>")
  const dictMatch = trimmed.match(/^(?:define|definir|definicion de|definición de|significado de)\s+([a-zA-ZáéíóúÁÉÍÓÚñÑ-]+)$/i);
  if (dictMatch) {
    const word = dictMatch[1].trim();
    try {
      const dictRes = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (dictRes.ok) {
        const entries = (await dictRes.json()) as Array<{
          word?: string;
          phonetic?: string;
          meanings?: Array<{
            partOfSpeech?: string;
            definitions?: Array<{ definition?: string; example?: string }>;
          }>;
          sourceUrls?: string[];
        }>;
        const first = entries?.[0];
        const firstMeaning = first?.meanings?.[0];
        const firstDef = firstMeaning?.definitions?.[0]?.definition;
        if (first && firstDef) {
          return {
            type: 'dictionary',
            title: 'Diccionario',
            subtitle: `${first.word || word}${first.phonetic ? ` · ${first.phonetic}` : ''}`,
            resultText: firstDef,
            details: [
              ...(firstMeaning?.partOfSpeech
                ? [{ label: 'Categoría', value: firstMeaning.partOfSpeech }]
                : []),
              ...(firstMeaning?.definitions?.[0]?.example
                ? [{ label: 'Ejemplo', value: `«${firstMeaning.definitions[0].example}»` }]
                : [])
            ],
            sourceUrl: first.sourceUrls?.[0] || `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}`,
            sourceLabel: 'DictionaryAPI'
          };
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
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
    explicitProtocol?: boolean;
  },
  redirectsLeft = 10
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
    const originalWasHttp = parsed.protocol === 'http:';
    if (originalWasHttp && options.upgradeHttps) {
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
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        DNT: '1',
        ...(cookieHeader ? { Cookie: cookieHeader } : {})
      },
      timeout: 18000
    };

    if (isHttps) {
      reqOptions.minVersion = 'TLSv1.2';
      reqOptions.rejectUnauthorized = options.strictTls;
    }

    const tryFallbackFetch = async (urlToTry: string): Promise<ProxyFetchOutcome | null> => {
      try {
        const resp = await fetch(urlToTry, {
          method: 'GET',
          redirect: 'follow',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
            ...(cookieHeader ? { Cookie: cookieHeader } : {})
          },
          signal: AbortSignal.timeout(15000)
        });
        const ab = await resp.arrayBuffer();
        const headersObj: http.IncomingHttpHeaders = {};
        resp.headers.forEach((v, k) => {
          headersObj[k.toLowerCase()] = v;
        });
        return {
          status: resp.status,
          headers: headersObj,
          body: Buffer.from(ab),
          finalUrl: resp.url || urlToTry,
          cookiesBlocked: 0,
          upgradedHttps
        };
      } catch {
        return null;
      }
    };

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
          fetchViaNodeHttp(
            nextUrl,
            {
              ...options,
              upgradeHttps: nextUrl.startsWith('http://') ? false : options.upgradeHttps
            },
            redirectsLeft - 1
          )
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
      const MAX_BYTES = 8 * 1024 * 1024; // 8MB safety limit

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
        } else if (
          encoding === 'zstd' &&
          typeof (zlib as unknown as { zstdDecompress?: typeof zlib.gunzip }).zstdDecompress === 'function'
        ) {
          (zlib as unknown as { zstdDecompress: typeof zlib.gunzip }).zstdDecompress(
            rawBuf,
            (err, decoded) => finishDecompressed(err ? rawBuf : decoded)
          );
        } else {
          finishDecompressed(rawBuf);
        }
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('Tiempo de espera agotado al conectar con el sitio'));
    });

    req.on('error', async (err) => {
      // If automatic HTTPS upgrade failed, retry on plain HTTP before giving up
      if (upgradedHttps && originalWasHttp) {
        try {
          const httpOutcome = await fetchViaNodeHttp(
            targetUrlStr,
            { ...options, upgradeHttps: false },
            redirectsLeft
          );
          resolve(httpOutcome);
          return;
        } catch {
          // fall through to fetch fallback
        }
      }
      // Fallback to Node fetch (undici) for servers rejecting node:https TLS/ALPN
      if (options.strictTls) {
        const fallback = await tryFallbackFetch(parsed.href);
        if (fallback) {
          resolve(fallback);
          return;
        }
      }
      reject(err);
    });
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

function guessMimeFromExt(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.ico')) return 'image/x-icon';
  if (lower.endsWith('.css')) return 'text/css';
  if (lower.endsWith('.js')) return 'application/javascript';
  if (lower.endsWith('.json')) return 'application/json';
  return 'application/octet-stream';
}

function extractZipOrCrxEntries(rawBuffer: Buffer): Map<string, Buffer> {
  let buf = rawBuffer;
  // Unwrap CRX2 or CRX3 header if present ("Cr24")
  if (buf.length >= 16 && buf.subarray(0, 4).toString('ascii') === 'Cr24') {
    const version = buf.readUInt32LE(4);
    if (version === 2) {
      const pubKeyLen = buf.readUInt32LE(8);
      const sigLen = buf.readUInt32LE(12);
      const offset = 16 + pubKeyLen + sigLen;
      if (offset < buf.length) buf = buf.subarray(offset);
    } else if (version === 3) {
      const headerSize = buf.readUInt32LE(8);
      const offset = 12 + headerSize;
      if (offset < buf.length) buf = buf.subarray(offset);
    }
  }

  // Locate ZIP End of Central Directory (PK\x05\x06)
  let eocdOffset = -1;
  const minOffset = Math.max(0, buf.length - 65560);
  for (let i = buf.length - 22; i >= minOffset; i--) {
    if (
      buf[i] === 0x50 &&
      buf[i + 1] === 0x4b &&
      buf[i + 2] === 0x05 &&
      buf[i + 3] === 0x06
    ) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error('El archivo no es un paquete ZIP/CRX válido');
  }

  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  const files = new Map<string, Buffer>();

  let ptr = cdOffset;
  for (let idx = 0; idx < totalEntries && ptr + 46 <= eocdOffset; idx++) {
    if (
      buf[ptr] !== 0x50 ||
      buf[ptr + 1] !== 0x4b ||
      buf[ptr + 2] !== 0x01 ||
      buf[ptr + 3] !== 0x02
    ) {
      break;
    }
    const method = buf.readUInt16LE(ptr + 10);
    const compressedSize = buf.readUInt32LE(ptr + 20);
    const fnLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localHeaderOffset = buf.readUInt32LE(ptr + 42);
    const rawName = buf
      .subarray(ptr + 46, ptr + 46 + fnLen)
      .toString('utf8')
      .replace(/\\/g, '/')
      .replace(/^\.\//, '')
      .replace(/^\/+/, '');
    ptr += 46 + fnLen + extraLen + commentLen;

    if (!rawName || rawName.endsWith('/')) continue;
    if (
      localHeaderOffset + 30 > buf.length ||
      buf[localHeaderOffset] !== 0x50 ||
      buf[localHeaderOffset + 1] !== 0x4b ||
      buf[localHeaderOffset + 2] !== 0x03 ||
      buf[localHeaderOffset + 3] !== 0x04
    ) {
      continue;
    }
    const lhFnLen = buf.readUInt16LE(localHeaderOffset + 26);
    const lhExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + lhFnLen + lhExtraLen;
    const dataEnd = Math.min(buf.length, dataStart + compressedSize);
    if (dataStart > buf.length) continue;

    const compSlice = buf.subarray(dataStart, dataEnd);
    try {
      if (method === 0) {
        files.set(rawName, compSlice);
      } else if (method === 8) {
        files.set(rawName, zlib.inflateRawSync(compSlice));
      }
    } catch {
      // Skip malformed entry
    }
  }

  // Normalize single top-level wrapper folder if manifest.json lives inside it
  if (!files.has('manifest.json')) {
    const manifestEntry = Array.from(files.keys()).find(
      (k) => k.toLowerCase().endsWith('/manifest.json') && k.split('/').length === 2
    );
    if (manifestEntry) {
      const prefix = manifestEntry.slice(0, manifestEntry.indexOf('/') + 1);
      const stripped = new Map<string, Buffer>();
      for (const [k, v] of files.entries()) {
        if (k.startsWith(prefix)) stripped.set(k.slice(prefix.length), v);
      }
      return stripped;
    }
  }

  return files;
}

function buildExtensionFromFileMap(
  files: Map<string, Buffer>,
  sourceType: 'unpacked' | 'crx' | 'zip' | 'webstore',
  localPath?: string
) {
  const getFile = (relPath: string): Buffer | undefined => {
    const clean = relPath.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
    if (files.has(clean)) return files.get(clean);
    const lower = clean.toLowerCase();
    for (const [k, v] of files.entries()) {
      if (k.toLowerCase() === lower) return v;
    }
    return undefined;
  };

  const manifestBuf = getFile('manifest.json');
  if (!manifestBuf) {
    throw new Error('No se encontró manifest.json dentro de la extensión.');
  }
  const manifestRaw = manifestBuf.toString('utf8').replace(/^\uFEFF/, '');
  const manifest = JSON.parse(manifestRaw) as Record<string, unknown>;

  // Resolve i18n __MSG_...__ strings from _locales
  const defaultLocale =
    typeof manifest.default_locale === 'string' ? manifest.default_locale : 'en';
  const localeCandidates = ['es', defaultLocale, 'en', 'en_US'];
  let messagesMap: Record<string, { message?: string }> = {};
  for (const loc of localeCandidates) {
    const msgBuf = getFile(`_locales/${loc}/messages.json`);
    if (msgBuf) {
      try {
        messagesMap = JSON.parse(msgBuf.toString('utf8').replace(/^\uFEFF/, ''));
        break;
      } catch {
        // try next locale
      }
    }
  }
  const resolveMsg = (val: unknown, fallback: string): string => {
    if (typeof val !== 'string' || !val.trim()) return fallback;
    return val.replace(/__MSG_([A-Za-z0-9_@]+)__/g, (full, key: string) => {
      const hit =
        messagesMap[key] ||
        Object.entries(messagesMap).find(([k]) => k.toLowerCase() === key.toLowerCase())?.[1];
      return hit?.message || full;
    });
  };

  const name = resolveMsg(manifest.name, 'Extensión Web').trim();
  const description = resolveMsg(
    manifest.description,
    'Extensión cargada desde paquete WebExtension.'
  ).trim();
  const version = typeof manifest.version === 'string' ? manifest.version : '1.0.0';
  const author =
    typeof manifest.author === 'string'
      ? manifest.author
      : typeof (manifest.author as { email?: string } | undefined)?.email === 'string'
      ? String((manifest.author as { email: string }).email)
      : 'WebExtension';
  const manifestVersion: 2 | 3 = Number(manifest.manifest_version) === 2 ? 2 : 3;

  // Icon extraction
  let iconDataUrl: string | undefined;
  const actionObj = (manifest.action || manifest.browser_action || {}) as Record<string, unknown>;
  const iconMap =
    (manifest.icons as Record<string, string> | undefined) ||
    (typeof actionObj.default_icon === 'object'
      ? (actionObj.default_icon as Record<string, string>)
      : undefined);
  const iconCandidates: string[] = [];
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
    const icBuf = getFile(ic);
    if (icBuf) {
      iconDataUrl = `data:${guessMimeFromExt(ic)};base64,${icBuf.toString('base64')}`;
      break;
    }
  }

  // Content scripts extraction
  const rawScripts = Array.isArray(manifest.content_scripts) ? manifest.content_scripts : [];
  const contentScripts = rawScripts
    .map((entry) => {
      const obj = entry as Record<string, unknown>;
      const matches = Array.isArray(obj.matches)
        ? obj.matches.filter((m): m is string => typeof m === 'string')
        : [];
      const excludeMatches = Array.isArray(obj.exclude_matches)
        ? obj.exclude_matches.filter((m): m is string => typeof m === 'string')
        : undefined;
      const css = Array.isArray(obj.css)
        ? obj.css
            .filter((p): p is string => typeof p === 'string')
            .map((p) => getFile(p)?.toString('utf8') || '')
            .filter(Boolean)
        : [];
      const js = Array.isArray(obj.js)
        ? obj.js
            .filter((p): p is string => typeof p === 'string')
            .map((p) => getFile(p)?.toString('utf8') || '')
            .filter(Boolean)
        : [];
      const runAtRaw = typeof obj.run_at === 'string' ? obj.run_at : 'document_idle';
      const runAt: 'document_start' | 'document_end' | 'document_idle' =
        runAtRaw === 'document_start' || runAtRaw === 'document_end' ? runAtRaw : 'document_idle';
      return { matches, excludeMatches, css, js, runAt, allFrames: !!obj.all_frames };
    })
    .filter((cs) => cs.matches.length > 0 && (cs.css.length > 0 || cs.js.length > 0));

  // Inline default popup HTML assets
  let popupHtml: string | undefined;
  const popupRel = typeof actionObj.default_popup === 'string' ? actionObj.default_popup : '';
  if (popupRel) {
    const popupBuf = getFile(popupRel);
    if (popupBuf) {
      const popupDir = popupRel.includes('/') ? popupRel.slice(0, popupRel.lastIndexOf('/') + 1) : '';
      const resolvePopupAsset = (ref: string) => {
        const clean = ref.split('?')[0].split('#')[0];
        return clean.startsWith('/') ? clean.slice(1) : `${popupDir}${clean}`;
      };
      let html = popupBuf.toString('utf8');
      html = html.replace(
        /<link\b[^>]*rel=["']?stylesheet["']?[^>]*href=["']([^"']+)["'][^>]*>/gi,
        (full, href: string) => {
          if (/^https?:\/\//i.test(href)) return full;
          const b = getFile(resolvePopupAsset(href)) || getFile(href);
          return b ? `<style>${b.toString('utf8')}</style>` : full;
        }
      );
      html = html.replace(
        /<script\b[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi,
        (full, src: string) => {
          if (/^https?:\/\//i.test(src)) return full;
          const b = getFile(resolvePopupAsset(src)) || getFile(src);
          return b ? `<script>${b.toString('utf8').replace(/<\/script>/gi, '<\\/script>')}</script>` : full;
        }
      );
      html = html.replace(
        /(<img\b[^>]*\bsrc=["'])([^"']+)(["'][^>]*>)/gi,
        (full, pre: string, src: string, post: string) => {
          if (/^(https?:|data:)/i.test(src)) return full;
          const assetPath = resolvePopupAsset(src);
          const b = getFile(assetPath) || getFile(src);
          return b ? `${pre}data:${guessMimeFromExt(assetPath)};base64,${b.toString('base64')}${post}` : full;
        }
      );
      popupHtml = html;
    }
  }

  // Resources map for chrome.runtime.getURL(...)
  const resources: Record<string, string> = {};
  let resCount = 0;
  for (const [k, v] of files.entries()) {
    if (resCount >= 30) break;
    if (v.length > 260_000) continue;
    const mime = guessMimeFromExt(k);
    if (mime.startsWith('image/') || mime === 'text/css' || mime === 'application/json') {
      resources[k] = `data:${mime};base64,${v.toString('base64')}`;
      resCount++;
    }
  }

  const permissions = Array.isArray(manifest.permissions)
    ? manifest.permissions.filter((p): p is string => typeof p === 'string')
    : [];
  const hostPermissions = Array.isArray(manifest.host_permissions)
    ? manifest.host_permissions.filter((p): p is string => typeof p === 'string')
    : [];

  const palette = ['#6366f1', '#10b981', '#f97316', '#14b8a6', '#ec4899', '#3b82f6'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const accentColor = palette[hash % palette.length];

  return {
    name,
    description,
    version,
    author,
    enabled: true,
    pinned: true,
    manifestVersion,
    manifestJson: JSON.stringify(manifest, null, 2),
    permissions: permissions.length > 0 ? permissions : ['activeTab'],
    hostPermissions,
    accentColor,
    mode: 'webextension' as const,
    iconDataUrl,
    popupHtml,
    popupTitle: resolveMsg(actionObj.default_title, name),
    contentScripts,
    resources,
    sourceType,
    localPath,
    builtIn: false
  };
}

function parseUserscriptText(code: string) {
  const headerMatch = code.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/);
  const metaBlock = headerMatch ? headerMatch[1] : '';
  const getMeta = (key: string) => {
    const m = metaBlock.match(new RegExp(`^\\s*//\\s*@${key}\\s+(.+)$`, 'm'));
    return m ? m[1].trim() : '';
  };
  const getAllMeta = (key: string) => {
    const out: string[] = [];
    const re = new RegExp(`^\\s*//\\s*@${key}\\s+(.+)$`, 'gm');
    let m: RegExpExecArray | null;
    while ((m = re.exec(metaBlock)) !== null) out.push(m[1].trim());
    return out;
  };

  const name = getMeta('name') || 'Userscript personalizado';
  const version = getMeta('version') || '1.0.0';
  const description = getMeta('description') || 'Script de usuario ejecutado en páginas coincidentes.';
  const author = getMeta('author') || 'UserScript';
  const matches = [...getAllMeta('match'), ...getAllMeta('include')];
  const excludeMatches = getAllMeta('exclude');
  const runAtRaw = getMeta('run-at').replace(/-/g, '_');
  const runAt: 'document_start' | 'document_end' | 'document_idle' =
    runAtRaw === 'document_start' || runAtRaw === 'document_end' ? runAtRaw : 'document_idle';

  return {
    name,
    description,
    version,
    author,
    enabled: true,
    pinned: true,
    manifestVersion: 3 as const,
    permissions: ['Ejecutar script de usuario', 'Inyectar CSS (GM_addStyle)'],
    hostPermissions: matches.length > 0 ? matches : ['<all_urls>'],
    accentColor: '#f59e0b',
    mode: 'userscript' as const,
    customJs: code,
    matchPatterns: matches.length > 0 ? matches : ['<all_urls>'],
    contentScripts: [
      {
        matches: matches.length > 0 ? matches : ['<all_urls>'],
        excludeMatches: excludeMatches.length > 0 ? excludeMatches : undefined,
        js: [code],
        runAt
      }
    ],
    sourceType: 'userscript' as const,
    builtIn: false
  };
}

function buildBuiltInExtensionCss(extModes: string[]): string {
  const chunks: string[] = [];
  if (extModes.includes('dark-web')) {
    chunks.push(
      'html{filter:invert(0.91) hue-rotate(180deg)!important;background:#ffffff!important;min-height:100%;}img,video,picture,canvas,iframe,svg image,[style*="background-image"]{filter:invert(1) hue-rotate(180deg)!important;}'
    );
  }
  if (extModes.includes('reader')) {
    chunks.push(
      'html,body{background:#f7f3eb!important;color:#1f2328!important;}body{max-width:760px!important;margin:0 auto!important;padding:36px 28px!important;font-size:18px!important;line-height:1.75!important;font-family:Georgia,"Times New Roman",serif!important;}header,nav,aside,footer,.sidebar,[role="complementary"],[role="navigation"],.ad,[class*="sidebar"],[class*="banner"],[class*="nav"]{display:none!important;}article,main{max-width:100%!important;width:100%!important;margin:0!important;padding:0!important;}img{max-width:100%!important;height:auto!important;border-radius:8px!important;}'
    );
  }
  if (extModes.includes('ad-cosmetic')) {
    chunks.push(
      '[class*="newsletter"],[id*="newsletter"],[class*="subscribe-modal"],[class*="paywall-banner"],[class*="sticky-footer"],[class*="cookie-banner"],[id*="cookie-banner"],[class*="consent-banner"],[class*="promo-banner"],.fc-ab-root{display:none!important;}'
    );
  }
  return chunks.join('\n');
}

function sanitizeAndEnhanceHtml(
  rawHtml: string,
  finalUrl: string,
  options: {
    shields: boolean;
    blockTrackers: 'standard' | 'aggressive' | 'disabled';
    blockScripts: boolean;
    blockFingerprinting: 'standard' | 'strict' | 'disabled';
    cookiesBlocked: number;
    upgradedHttps: boolean;
    filterLists: string[];
    customRules: string[];
    extModes?: string[];
  }
): { html: string; trackersBlocked: number; blockedTrackerUrls: string[] } {
  let html = rawHtml;
  let trackersBlocked = 0;
  const blockedTrackerUrls: string[] = [];

  const recordBlocked = (rawSrc: string) => {
    trackersBlocked += 1;
    try {
      const resolved = new URL(rawSrc, finalUrl).href;
      if (!blockedTrackerUrls.includes(resolved) && blockedTrackerUrls.length < 40) {
        blockedTrackerUrls.push(resolved);
      }
    } catch {
      if (rawSrc && !blockedTrackerUrls.includes(rawSrc) && blockedTrackerUrls.length < 40) {
        blockedTrackerUrls.push(rawSrc);
      }
    }
  };

  // Strip meta CSP frame-ancestors tags and prior <base> tags so relative URLs resolve cleanly
  html = html.replace(
    /<meta[^>]+http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi,
    ''
  );
  html = html.replace(/<base\b[^>]*>/gi, '');
  // Prevent target="_top" or target="_parent" from silently failing inside sandboxed iframe
  html = html.replace(/\btarget\s*=\s*["']?(_top|_parent)["']?/gi, 'target="_self"');
  // Rewrite meta refresh redirects so they navigate through FabiNav instead of breaking out of proxy
  html = html.replace(
    /<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*content\s*=\s*["']([^"']+)["'][^>]*>/gi,
    (fullTag, contentVal) => {
      const m = String(contentVal || '').match(/^\s*(\d+)\s*;\s*url\s*=\s*(.+)\s*$/i);
      if (!m) return fullTag;
      const delayMs = Math.max(0, Number(m[1]) || 0) * 1000;
      const rawTarget = m[2].replace(/^['"]|['"]$/g, '').trim();
      try {
        const resolvedRefresh = new URL(rawTarget, finalUrl).href;
        return `<script data-fabinav-refresh="1">setTimeout(function(){try{window.parent.postMessage({type:'fabinav:navigate',url:${JSON.stringify(resolvedRefresh)}},'*');}catch(e){}},${delayMs});</script>`;
      } catch {
        return fullTag;
      }
    }
  );

  // Filter tracker scripts & tracking pixels/iframes when Shields are enabled
  if (options.shields && options.blockTrackers !== 'disabled') {
    const aggressive = options.blockTrackers === 'aggressive';

    html = html.replace(
      /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>[\s\S]*?<\/script>/gi,
      (fullTag, src) => {
        if (
          options.blockScripts ||
          isTrackerUrl(src, aggressive, options.filterLists, options.customRules)
        ) {
          recordBlocked(src);
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
        if (isTrackerUrl(src, aggressive, options.filterLists, options.customRules)) {
          recordBlocked(src);
          return '';
        }
        return fullTag;
      }
    );

    html = html.replace(
      /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi,
      (fullTag, src) => {
        if (isTrackerUrl(src, aggressive, options.filterLists, options.customRules)) {
          recordBlocked(src);
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

  // Real Anti-Fingerprinting Protection Script (Canvas, WebGL, Hardware & Audio)
  const fpLevel = options.shields ? options.blockFingerprinting : 'disabled';
  const fingerprintGuard =
    fpLevel !== 'disabled'
      ? `
<script data-fabinav-fp="1">
(function () {
  var strict = ${fpLevel === 'strict' ? 'true' : 'false'};
  try {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: function () { return 4; }, configurable: true });
    if ('deviceMemory' in navigator) {
      Object.defineProperty(navigator, 'deviceMemory', { get: function () { return strict ? 4 : 8; }, configurable: true });
    }
  } catch (e) {}
  try {
    var origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function () {
      try {
        var ctx = this.getContext('2d');
        if (ctx && this.width > 0 && this.height > 0 && this.width <= 512 && this.height <= 512) {
          var img = ctx.getImageData(0, 0, Math.min(4, this.width), Math.min(4, this.height));
          if (img && img.data && img.data.length > 3) {
            img.data[0] = (img.data[0] ^ (strict ? 3 : 1)) & 255;
            ctx.putImageData(img, 0, 0);
          }
        }
      } catch (e) {}
      return origToDataURL.apply(this, arguments);
    };
  } catch (e) {}
  try {
    var patchWebGL = function (Proto) {
      if (!Proto || !Proto.prototype || !Proto.prototype.getParameter) return;
      var origGetParam = Proto.prototype.getParameter;
      Proto.prototype.getParameter = function (param) {
        if (param === 37445) return 'FabiNav Protected GPU';
        if (param === 37446) return 'ANGLE (FabiNav Privacy Renderer)';
        return origGetParam.apply(this, arguments);
      };
    };
    patchWebGL(window.WebGLRenderingContext);
    patchWebGL(window.WebGL2RenderingContext);
  } catch (e) {}
  if (strict) {
    try {
      var origGetChannelData = window.AudioBuffer && AudioBuffer.prototype.getChannelData;
      if (origGetChannelData) {
        AudioBuffer.prototype.getChannelData = function () {
          var data = origGetChannelData.apply(this, arguments);
          if (data && data.length > 0) data[0] = data[0] + 0.0000001;
          return data;
        };
      }
    } catch (e) {}
  }
})();
</script>`
      : '';

  const cookieBannerGuard =
    options.shields && options.filterLists.includes('cookie-notices')
      ? `<style data-fabinav-annoyances="1">[id*="cookie-banner"],[class*="cookie-banner"],[id*="onetrust-banner"],.fc-consent-root,#CybotCookiebotDialog{display:none!important;}</style>`
      : '';

  const initialExtCss = buildBuiltInExtensionCss(options.extModes || []);
  const extStyleTag = `<style id="fabinav-extensions-style">${initialExtCss}</style><style id="fabinav-custom-css"></style>`;

  const compatShim = `
<script data-fabinav-shim="1">
(function () {
  var currentHref = ${JSON.stringify(finalUrl)};
  var makeMemStorage = function () {
    var map = Object.create(null);
    return {
      get length() { return Object.keys(map).length; },
      clear: function () { map = Object.create(null); },
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(map, String(k)) ? map[String(k)] : null; },
      key: function (i) { var keys = Object.keys(map); return keys[i] || null; },
      removeItem: function (k) { delete map[String(k)]; },
      setItem: function (k, v) { map[String(k)] = String(v); }
    };
  };
  ['localStorage', 'sessionStorage'].forEach(function (prop) {
    try {
      var test = window[prop];
      var k = '__fabinav_test__';
      test.setItem(k, '1');
      test.removeItem(k);
    } catch (e) {
      try {
        var mem = makeMemStorage();
        Object.defineProperty(window, prop, { get: function () { return mem; }, configurable: true });
      } catch (e2) {}
    }
  });
  try {
    var origPush = history.pushState;
    var origReplace = history.replaceState;
    var notifyRoute = function (urlArg) {
      if (!urlArg) return;
      try {
        var resolved = new URL(String(urlArg), currentHref).href;
        currentHref = resolved;
        window.parent.postMessage({ type: 'fabinav:navigate-state', url: resolved }, '*');
      } catch (e) {}
    };
    history.pushState = function (state, title, urlArg) {
      try { return origPush.apply(history, arguments); } catch (e) { notifyRoute(urlArg); }
    };
    history.replaceState = function (state, title, urlArg) {
      try { return origReplace.apply(history, arguments); } catch (e) { notifyRoute(urlArg); }
    };
  } catch (e) {}
  try {
    var _cookieTest = document.cookie;
  } catch (e) {
    try {
      var memCookies = '';
      Object.defineProperty(document, 'cookie', {
        get: function () { return memCookies; },
        set: function (v) { memCookies = String(v || ''); },
        configurable: true
      });
    } catch (e2) {}
  }
  try {
    window.open = function (targetUrl) {
      if (targetUrl && typeof targetUrl === 'string') {
        try {
          var abs = new URL(targetUrl, currentHref).href;
          if (/^https?:\\/\\//i.test(abs)) {
            window.parent.postMessage({ type: 'fabinav:open-url-new-tab', url: abs }, '*');
          }
        } catch (e) {}
      }
      return null;
    };
  } catch (e) {}
})();
</script>`;

  // Insert <base href="..."> + Compatibility shim + Fingerprint guard + Cookie annoyances + Extensions style
  const baseTag = `<base href="${escapeHtml(finalUrl)}">${compatShim}${cookieBannerGuard}${extStyleTag}${fingerprintGuard}`;
  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, (match) => `${match}\n${baseTag}`);
  } else {
    html = `<head>${baseTag}</head>\n${html}`;
  }

  // Inject lightweight FabiNav bridge (links + forms + find-in-page + extensions + translate + audio mute + real telemetry via postMessage)
  const bridgeScript = `
<script data-fabinav-bridge="1">
(function () {
  var currentUrl = ${JSON.stringify(finalUrl)};
  var isTabMuted = false;
  var translatedNodes = [];
  var applyMute = function (muted) {
    isTabMuted = !!muted;
    try {
      var els = document.querySelectorAll('audio, video');
      for (var i = 0; i < els.length; i++) {
        els[i].muted = isTabMuted;
      }
    } catch (e) {}
  };
  var extRunRegistry = {};
  var extMessageListeners = {};
  var extStorageListeners = {};

  var matchSinglePattern = function (url, pattern) {
    if (!pattern || pattern === '<all_urls>' || pattern === '*://*/*') return true;
    try {
      var regexStr = '^' + String(pattern)
        .replace(/[.+?^$()|[\\]\\\\{}]/g, '\\\\$&')
        .replace(/\\*/g, '.*') + '$';
      return new RegExp(regexStr, 'i').test(url);
    } catch (e) {
      return false;
    }
  };

  var urlMatchesExtRule = function (url, matches, excludeMatches) {
    if (!Array.isArray(matches) || matches.length === 0) return true;
    var hit = false;
    for (var i = 0; i < matches.length; i++) {
      if (matchSinglePattern(url, matches[i])) { hit = true; break; }
    }
    if (!hit) return false;
    if (Array.isArray(excludeMatches)) {
      for (var j = 0; j < excludeMatches.length; j++) {
        if (matchSinglePattern(url, excludeMatches[j])) return false;
      }
    }
    return true;
  };

  var createChromeEnvForExt = function (ext) {
    var extId = ext.id;
    var storeKey = 'fabinav_ext_storage_' + extId;
    var readStore = function () {
      try {
        var r = localStorage.getItem(storeKey);
        return r ? JSON.parse(r) : {};
      } catch (e) { return {}; }
    };
    var writeStore = function (data, changes) {
      try { localStorage.setItem(storeKey, JSON.stringify(data)); } catch (e) {}
      var list = extStorageListeners[extId] || [];
      for (var i = 0; i < list.length; i++) {
        try { list[i](changes, 'local'); } catch (e) {}
      }
    };
    var storageArea = {
      get: function (keys, cb) {
        var store = readStore();
        var out = {};
        if (keys === null || keys === undefined) out = Object.assign({}, store);
        else if (typeof keys === 'string') { if (Object.prototype.hasOwnProperty.call(store, keys)) out[keys] = store[keys]; }
        else if (Array.isArray(keys)) { keys.forEach(function (k) { if (Object.prototype.hasOwnProperty.call(store, k)) out[k] = store[k]; }); }
        else if (typeof keys === 'object') { Object.keys(keys).forEach(function (k) { out[k] = Object.prototype.hasOwnProperty.call(store, k) ? store[k] : keys[k]; }); }
        if (typeof cb === 'function') setTimeout(function () { cb(out); }, 0);
        return Promise.resolve(out);
      },
      set: function (items, cb) {
        var store = readStore();
        var changes = {};
        Object.keys(items || {}).forEach(function (k) {
          changes[k] = { oldValue: store[k], newValue: items[k] };
          store[k] = items[k];
        });
        writeStore(store, changes);
        if (typeof cb === 'function') setTimeout(function () { cb(); }, 0);
        return Promise.resolve();
      },
      remove: function (keys, cb) {
        var store = readStore();
        var changes = {};
        (Array.isArray(keys) ? keys : [keys]).forEach(function (k) {
          if (Object.prototype.hasOwnProperty.call(store, k)) {
            changes[k] = { oldValue: store[k], newValue: undefined };
            delete store[k];
          }
        });
        writeStore(store, changes);
        if (typeof cb === 'function') setTimeout(function () { cb(); }, 0);
        return Promise.resolve();
      }
    };
    var resMap = ext.resources || {};
    var manifestObj = {
      name: ext.name,
      version: ext.version,
      manifest_version: ext.manifestVersion || 3
    };
    return {
      runtime: {
        id: extId,
        getManifest: function () { return manifestObj; },
        getURL: function (rel) {
          var clean = String(rel || '').replace(/^\\/+/, '');
          return resMap[clean] || clean;
        },
        sendMessage: function (msg, cb) {
          try { window.parent.postMessage({ type: 'fabinav:ext-content-message', extId: extId, message: msg }, '*'); } catch (e) {}
          if (typeof cb === 'function') setTimeout(function () { cb(undefined); }, 0);
          return Promise.resolve(undefined);
        },
        onMessage: {
          addListener: function (fn) {
            if (typeof fn !== 'function') return;
            if (!extMessageListeners[extId]) extMessageListeners[extId] = [];
            extMessageListeners[extId].push(fn);
          },
          removeListener: function (fn) {
            if (!extMessageListeners[extId]) return;
            extMessageListeners[extId] = extMessageListeners[extId].filter(function (f) { return f !== fn; });
          }
        }
      },
      storage: {
        local: storageArea,
        sync: storageArea,
        onChanged: {
          addListener: function (fn) {
            if (typeof fn !== 'function') return;
            if (!extStorageListeners[extId]) extStorageListeners[extId] = [];
            extStorageListeners[extId].push(fn);
          }
        }
      }
    };
  };

  var notifyExtUnload = function (extId) {
    var list = extMessageListeners[extId] || [];
    for (var i = 0; i < list.length; i++) {
      try { list[i]({ type: 'FABINAV_EXT_UNLOAD' }, { id: extId }, function () {}); } catch (e) {}
    }
    extMessageListeners[extId] = [];
    extStorageListeners[extId] = [];
    delete extRunRegistry[extId];
    var oldStyles = document.querySelectorAll('style[data-fabinav-ext-id="' + extId + '"]');
    for (var j = 0; j < oldStyles.length; j++) {
      if (oldStyles[j].parentNode) oldStyles[j].parentNode.removeChild(oldStyles[j]);
    }
  };

  var applyExtensions = function (modes, customCss, activeExtensions) {
    try {
      var list = Array.isArray(activeExtensions) ? activeExtensions : [];
      var activeIds = {};

      // Clean up deactivated extensions
      Object.keys(extRunRegistry).forEach(function (prevId) {
        if (!list.some(function (e) { return e.id === prevId; })) {
          notifyExtUnload(prevId);
        }
      });

      list.forEach(function (ext) {
        activeIds[ext.id] = true;
        var cssChunks = [];
        var jsChunks = [];

        if (Array.isArray(ext.contentScripts) && ext.contentScripts.length > 0) {
          ext.contentScripts.forEach(function (cs) {
            if (urlMatchesExtRule(currentUrl, cs.matches, cs.excludeMatches)) {
              if (Array.isArray(cs.css)) cssChunks = cssChunks.concat(cs.css);
              if (Array.isArray(cs.js)) jsChunks = jsChunks.concat(cs.js);
            }
          });
        }

        if (ext.customCss && urlMatchesExtRule(currentUrl, ext.matchPatterns, null)) {
          cssChunks.push(ext.customCss);
        }
        if (ext.customJs && (!Array.isArray(ext.contentScripts) || ext.contentScripts.length === 0) && urlMatchesExtRule(currentUrl, ext.matchPatterns, null)) {
          jsChunks.push(ext.customJs);
        }

        // Apply CSS cleanly
        var styleId = 'fabinav-ext-style-' + ext.id;
        var styleEl = document.getElementById(styleId);
        if (cssChunks.length > 0) {
          if (!styleEl && document.head) {
            styleEl = document.createElement('style');
            styleEl.id = styleId;
            styleEl.setAttribute('data-fabinav-ext-id', ext.id);
            document.head.appendChild(styleEl);
          }
          if (styleEl) styleEl.textContent = cssChunks.join('\\n');
        } else if (styleEl && styleEl.parentNode) {
          styleEl.parentNode.removeChild(styleEl);
        }

        // Execute JS content scripts once per version/signature
        if (jsChunks.length > 0) {
          var sig = jsChunks.join('\\n/*---*/\\n');
          if (extRunRegistry[ext.id] !== sig) {
            if (extRunRegistry[ext.id]) notifyExtUnload(ext.id);
            extRunRegistry[ext.id] = sig;
            var chromeApi = createChromeEnvForExt(ext);
            var gmAddStyle = function (cssText) {
              if (!document.head) return;
              var s = document.createElement('style');
              s.setAttribute('data-fabinav-ext-id', ext.id);
              s.textContent = String(cssText || '');
              document.head.appendChild(s);
            };
            var gmInfo = { script: { name: ext.name, version: ext.version } };
            jsChunks.forEach(function (code) {
              try {
                var runner = new Function('chrome', 'browser', 'GM_addStyle', 'GM_info', code);
                runner(chromeApi, chromeApi, gmAddStyle, gmInfo);
              } catch (err) {
                try { console.warn('[FabiNav Ext]', ext.name, err); } catch (e) {}
              }
            });
          }
        }
      });

      // Keep legacy CSS tag cleared/updated for backward fallback only when no full ext payload was passed
      var customEl = document.getElementById('fabinav-custom-css');
      if (list.length === 0 && customEl) {
        customEl.textContent = typeof customCss === 'string' ? customCss : '';
      } else if (customEl) {
        customEl.textContent = '';
      }
    } catch (e) {}
  };
  var collectTranslatableNodes = function () {
    translatedNodes = [];
    var texts = [];
    try {
      var walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, null);
      var node;
      while ((node = walker.nextNode()) && texts.length < 65) {
        var parentTag = node.parentElement ? node.parentElement.tagName : '';
        if (parentTag === 'SCRIPT' || parentTag === 'STYLE' || parentTag === 'NOSCRIPT' || parentTag === 'CODE' || parentTag === 'PRE') continue;
        var val = (node.nodeValue || '').trim();
        if (val.length >= 4 && /[a-zA-Z\\u00C0-\\u024F\\u3040-\\u30FF\\u4E00-\\u9FFF]/.test(val)) {
          translatedNodes.push(node);
          texts.push(val.slice(0, 420));
        }
      }
    } catch (e) {}
    return texts;
  };
  try {
    var obs = new MutationObserver(function () {
      if (isTabMuted) applyMute(true);
    });
    if (document.documentElement) {
      obs.observe(document.documentElement, { childList: true, subtree: true });
    }
  } catch (e) {}
  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'fabinav:set-muted') {
      applyMute(!!d.muted);
    } else if (d.type === 'fabinav:apply-extensions') {
      applyExtensions(d.modes, d.customCss, d.extensions);
    } else if (d.type === 'fabinav:ext-storage-changed' && d.extId) {
      var sListeners = extStorageListeners[d.extId] || [];
      sListeners.forEach(function (fn) { try { fn(d.changes || {}, 'local'); } catch (e) {} });
    } else if (d.type === 'fabinav:ext-runtime-message' && d.extId) {
      var mListeners = extMessageListeners[d.extId] || [];
      var responded = false;
      var sendResp = function (resp) {
        if (responded) return;
        responded = true;
        if (d.requestId) {
          try {
            window.parent.postMessage({
              type: 'fabinav:ext-message-response',
              requestId: d.requestId,
              response: resp
            }, '*');
          } catch (e) {}
        }
      };
      mListeners.forEach(function (fn) {
        try { fn(d.message, { id: d.extId, tab: { id: 1, url: currentUrl, title: document.title } }, sendResp); } catch (e) {}
      });
    } else if (d.type === 'fabinav:ext-scripting' && d.extId) {
      if (d.action === 'insertCSS' && typeof d.css === 'string' && document.head) {
        var s = document.createElement('style');
        s.setAttribute('data-fabinav-ext-id', d.extId);
        s.textContent = d.css;
        document.head.appendChild(s);
      } else if (d.action === 'executeScript' && typeof d.code === 'string') {
        try { (new Function(d.code))(); } catch (e) {}
      }
    } else if (d.type === 'fabinav:translate-request') {
      var collected = collectTranslatableNodes();
      try {
        window.parent.postMessage({
          type: 'fabinav:translate-collected',
          texts: collected,
          targetLang: d.targetLang || 'es'
        }, '*');
      } catch (e) {}
    } else if (d.type === 'fabinav:translate-apply' && Array.isArray(d.translatedTexts)) {
      for (var j = 0; j < translatedNodes.length && j < d.translatedTexts.length; j++) {
        if (typeof d.translatedTexts[j] === 'string' && d.translatedTexts[j]) {
          translatedNodes[j].nodeValue = d.translatedTexts[j];
        }
      }
    } else if (d.type === 'fabinav:find' && typeof d.query === 'string') {
      var found = false;
      try {
        if (typeof window.find === 'function') {
          found = !!window.find(d.query, false, !!d.backwards, true);
        }
      } catch (e) {}
      try {
        window.parent.postMessage({ type: 'fabinav:find-result', found: found }, '*');
      } catch (e) {}
    }
  });
  try {
    window.parent.postMessage({ type: 'fabinav:bridge-ready', url: currentUrl }, '*');
  } catch (e) {}
  var report = function () {
    try {
      window.parent.postMessage({
        type: 'fabinav:page-info',
        url: currentUrl,
        title: document.title || currentUrl,
        blockedTrackers: ${trackersBlocked},
        blockedCookies: ${options.cookiesBlocked},
        blockedTrackerUrls: ${JSON.stringify(blockedTrackerUrls)},
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

  return { html, trackersBlocked, blockedTrackerUrls };
}

function renderProxyFallbackHtml(
  targetUrl: string,
  errorMessage: string,
  customHeading?: string,
  customDesc?: string
): string {
  const safeUrl = escapeHtml(targetUrl);
  const safeErr = escapeHtml(errorMessage);
  const heading = escapeHtml(customHeading || 'No se pudo abrir esta página dentro del visor');
  const desc = escapeHtml(
    customDesc ||
      'El servidor remoto rechazó la conexión TLS/proxy o requiere verificación directa del navegador.'
  );
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
      max-width: 500px;
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
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .btn {
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
      border: 0;
      cursor: pointer;
    }
    .btn:hover { background: #e0441e; }
    .btn-sec {
      background: #32353d;
      color: #e2e4ea;
      border: 1px solid #444752;
    }
    .btn-sec:hover { background: #3e424c; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${heading}</h1>
    <p>${desc}</p>
    <div class="err">${safeErr}</div>
    <div class="actions">
      <button type="button" class="btn btn-sec" onclick="try{window.parent.postMessage({type:'fabinav:retry-relaxed',url:${JSON.stringify(targetUrl)}},'*');}catch(e){location.reload();}">Reintentar sin TLS estricto</button>
      <a class="btn" href="${safeUrl}" target="_blank" rel="noopener noreferrer">Abrir sitio directamente &#8599;</a>
    </div>
  </div>
</body>
</html>`;
}

async function startServer() {
  loadNormalCookiesFromDisk();
  const app = express();

  // 0a-ext. Real WebExtension Package Importer (.zip, .crx, unpacked files, .user.js)
  // Registered BEFORE global 512kb JSON limit so multi-megabyte .crx/.zip extensions are accepted.
  app.post('/api/extensions/import', express.json({ limit: '25mb' }), (req, res) => {
    try {
      const body = req.body as {
        filename?: string;
        fileName?: string;
        base64?: string;
        contentBase64?: string;
        text?: string;
        files?: Array<{ path: string; base64?: string; contentBase64?: string }>;
      };

      // Case 1: Unpacked folder files array from browser picker
      if (Array.isArray(body?.files) && body.files.length > 0) {
        const fileMap = new Map<string, Buffer>();
        for (const item of body.files) {
          const itemBase64 = item?.base64 || item?.contentBase64;
          if (!item?.path || typeof itemBase64 !== 'string') continue;
          const norm = item.path.replace(/\\/g, '/').replace(/^\/+/, '');
          fileMap.set(norm, Buffer.from(itemBase64, 'base64'));
        }
        // Strip top-level directory if all files share one
        if (!fileMap.has('manifest.json')) {
          const manifestKey = Array.from(fileMap.keys()).find((k) =>
            k.toLowerCase().endsWith('/manifest.json')
          );
          if (manifestKey) {
            const prefix = manifestKey.slice(0, manifestKey.lastIndexOf('manifest.json'));
            const stripped = new Map<string, Buffer>();
            for (const [k, v] of fileMap.entries()) {
              if (k.startsWith(prefix)) stripped.set(k.slice(prefix.length), v);
            }
            const ext = buildExtensionFromFileMap(stripped, 'unpacked');
            res.json({ ok: true, extension: ext });
            return;
          }
        }
        const ext = buildExtensionFromFileMap(fileMap, 'unpacked');
        res.json({ ok: true, extension: ext });
        return;
      }

      const filename = String(body?.filename || body?.fileName || '').toLowerCase();
      const rawBase64 = body?.base64 || body?.contentBase64 || '';

      // Case 2: Userscript (.user.js / .js)
      if (filename.endsWith('.js') || typeof body?.text === 'string') {
        const scriptCode =
          typeof body?.text === 'string'
            ? body.text
            : Buffer.from(String(rawBase64), 'base64').toString('utf8');
        if (!scriptCode.trim()) {
          res.status(400).json({ ok: false, error: 'El script está vacío.' });
          return;
        }
        res.json({ ok: true, extension: parseUserscriptText(scriptCode) });
        return;
      }

      // Case 3: .crx or .zip archive
      if (typeof rawBase64 !== 'string' || !rawBase64) {
        res.status(400).json({ ok: false, error: 'Archivo de extensión inválido.' });
        return;
      }
      const rawBuf = Buffer.from(rawBase64, 'base64');
      const isCrx =
        filename.endsWith('.crx') ||
        (rawBuf.length >= 4 && rawBuf.subarray(0, 4).toString('ascii') === 'Cr24');
      const entries = extractZipOrCrxEntries(rawBuf);
      const ext = buildExtensionFromFileMap(entries, isCrx ? 'crx' : 'zip');
      res.json({ ok: true, extension: ext });
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err instanceof Error ? err.message : 'No se pudo leer la extensión.'
      });
    }
  });

  app.use(express.json({ limit: '512kb' }));

  // 0b-ext. Install directly from Chrome Web Store URL or Extension ID
  app.post('/api/extensions/fetch-store', express.json({ limit: '64kb' }), async (req, res) => {
    try {
      const rawInput = String((req.body as { input?: string })?.input || '').trim();
      const idMatch = rawInput.match(/([a-p]{32})/i);
      if (!idMatch) {
        res.status(400).json({
          ok: false,
          error: 'Introduce una URL válida de Chrome Web Store o un ID de 32 caracteres.'
        });
        return;
      }
      const extId = idMatch[1].toLowerCase();
      const crxUrl = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=131.0.0.0&acceptformat=crx2,crx3&x=id%3D${extId}%26uc`;
      const resp = await fetch(crxUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 Chrome/131.0.0.0 Safari/537.36' },
        redirect: 'follow',
        signal: AbortSignal.timeout(15000)
      });
      if (!resp.ok) {
        res.status(502).json({
          ok: false,
          error: `Chrome Web Store devolvió HTTP ${resp.status}. También puedes descargar el .crx/.zip e importarlo directamente.`
        });
        return;
      }
      const arrBuf = await resp.arrayBuffer();
      const crxBuf = Buffer.from(arrBuf);
      if (crxBuf.length < 32) {
        res.status(502).json({
          ok: false,
          error: 'No se recibió un paquete CRX válido desde Chrome Web Store.'
        });
        return;
      }
      const entries = extractZipOrCrxEntries(crxBuf);
      const ext = buildExtensionFromFileMap(entries, 'webstore');
      res.json({ ok: true, extension: ext });
    } catch (err) {
      res.status(502).json({
        ok: false,
        error:
          err instanceof Error
            ? `Error al descargar de Chrome Web Store: ${err.message}`
            : 'No se pudo descargar la extensión.'
      });
    }
  });

  // 0a. Page Text Translation Endpoint (real free Google web translate endpoint)
  app.post('/api/translate', async (req, res) => {
    const body = req.body as { texts?: unknown; targetLang?: unknown } | undefined;
    const rawTexts = Array.isArray(body?.texts) ? body.texts.slice(0, 65) : [];
    const targetLang =
      body?.targetLang === 'en' || body?.targetLang === 'ja' ? body.targetLang : 'es';
    const texts = rawTexts.map((x) => (typeof x === 'string' ? x.slice(0, 420) : ''));

    if (texts.length === 0) {
      res.json({ translatedTexts: [] });
      return;
    }

    const SEP = '\n[[[FN_SEP]]]\n';
    const joined = texts.join(SEP);
    try {
      const apiUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
        targetLang
      )}&dt=t&q=${encodeURIComponent(joined)}`;
      const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) });
      if (!resp.ok) {
        res.status(502).json({ error: 'Translation upstream unavailable', translatedTexts: texts });
        return;
      }
      const parsed = (await resp.json()) as unknown[];
      const segments = Array.isArray(parsed?.[0]) ? (parsed[0] as unknown[][]) : [];
      const fullOut = segments
        .map((seg) => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : ''))
        .join('');
      const parts = fullOut.split(/\s*\[\[\[FN_SEP\]\]\]\s*/);
      const translatedTexts = texts.map((orig, idx) => (parts[idx] ? parts[idx].trim() : orig));
      res.json({ translatedTexts });
    } catch {
      res.json({ translatedTexts: texts });
    }
  });

  // 0. Live Autocomplete Suggestions API
  app.get('/api/suggest', async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) {
      res.json({ query: '', suggestions: [] });
      return;
    }
    const suggestions = await fetchRelatedQueries(q);
    res.json({ query: q, suggestions });
  });

  // 1. Live Multi-Vertical Web Search API (with in-memory search cache)
  app.get('/api/search', async (req, res) => {
    const q = String(req.query.q || '').trim();
    const page = Math.max(1, Math.min(5, Number(req.query.page) || 1));
    const lang: 'es' | 'all' = req.query.lang === 'es' ? 'es' : 'all';

    if (!q) {
      res.status(400).json({
        error: 'Consulta vacía',
        page,
        hasMore: false,
        lang,
        results: [],
        wikipedia: [],
        images: [],
        news: [],
        videos: [],
        repos: [],
        relatedTopics: [],
        relatedQueries: [],
        knowledge: null,
        instantAnswer: null
      });
      return;
    }

    const searchCacheKey = `${q.toLowerCase()}::p${page}::${lang}`;
    const cachedSearch = req.query.refresh === '1' ? undefined : searchCache.get(searchCacheKey);
    if (cachedSearch && cachedSearch.expiresAt > Date.now()) {
      res.setHeader('X-FabiNav-Cache', 'HIT');
      res.json({ ...cachedSearch.payload, cached: true });
      return;
    }

    const startedAt = Date.now();

    if (page > 1) {
      const webSettled = await Promise.allSettled([fetchDuckDuckGoResults(q, page, lang)]);
      const outcome =
        webSettled[0].status === 'fulfilled'
          ? webSettled[0].value
          : { results: [], hasMore: false };
      const webError =
        webSettled[0].status === 'rejected'
          ? String(
              webSettled[0].reason instanceof Error
                ? webSettled[0].reason.message
                : webSettled[0].reason
            )
          : null;

      const payload = {
        query: q,
        page,
        hasMore: outcome.hasMore,
        lang,
        results: outcome.results,
        wikipedia: [],
        durationMs: Date.now() - startedAt,
        webError,
        fetchedAt: Date.now()
      };
      const serializedSize = Buffer.byteLength(JSON.stringify(payload), 'utf-8');
      setSearchCacheEntry(searchCacheKey, {
        key: searchCacheKey,
        query: q,
        payload,
        sizeBytes: serializedSize,
        cachedAt: Date.now(),
        expiresAt: Date.now() + SEARCH_CACHE_TTL_MS
      });
      res.setHeader('X-FabiNav-Cache', 'MISS');
      res.json(payload);
      return;
    }

    const [
      webSettled,
      wikiSettled,
      imagesSettled,
      relatedSettled,
      newsSettled,
      reposSettled,
      instantSettled
    ] = await Promise.allSettled([
      fetchDuckDuckGoResults(q, 1, lang),
      fetchWikipediaResults(q),
      fetchWikimediaImages(q),
      fetchRelatedQueries(q),
      fetchGoogleNewsRss(q, lang),
      fetchGitHubRepos(q),
      fetchServerInstantAnswer(q)
    ]);

    const webOutcome =
      webSettled.status === 'fulfilled'
        ? webSettled.value
        : { results: [], hasMore: false };
    const results = webOutcome.results;
    const wikipedia = wikiSettled.status === 'fulfilled' ? wikiSettled.value.items : [];
    const knowledge = wikiSettled.status === 'fulfilled' ? wikiSettled.value.knowledge : null;
    const relatedTopics =
      wikiSettled.status === 'fulfilled' ? wikiSettled.value.relatedTopics : [];
    const images = imagesSettled.status === 'fulfilled' ? imagesSettled.value : [];
    const relatedQueries = relatedSettled.status === 'fulfilled' ? relatedSettled.value : [];
    const news = newsSettled.status === 'fulfilled' ? newsSettled.value : [];
    const repos = reposSettled.status === 'fulfilled' ? reposSettled.value : [];
    const instantAnswer =
      instantSettled.status === 'fulfilled' ? instantSettled.value : null;

    const videos = await fetchVideoResults(q, results);

    const webError =
      webSettled.status === 'rejected'
        ? String(webSettled.reason instanceof Error ? webSettled.reason.message : webSettled.reason)
        : null;

    const payload = {
      query: q,
      page: 1,
      hasMore: webOutcome.hasMore,
      lang,
      results,
      wikipedia,
      images,
      news,
      videos,
      repos,
      relatedTopics,
      relatedQueries,
      knowledge,
      instantAnswer,
      durationMs: Date.now() - startedAt,
      webError,
      fetchedAt: Date.now()
    };

    if (results.length > 0 || wikipedia.length > 0 || news.length > 0) {
      const serializedSize = Buffer.byteLength(JSON.stringify(payload), 'utf-8');
      setSearchCacheEntry(searchCacheKey, {
        key: searchCacheKey,
        query: q,
        payload,
        sizeBytes: serializedSize,
        cachedAt: Date.now(),
        expiresAt: Date.now() + SEARCH_CACHE_TTL_MS
      });
    }

    res.setHeader('X-FabiNav-Cache', 'MISS');
    res.json(payload);
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

    if (partition === 'normal') {
      scheduleSaveNormalCookies();
    }

    res.json({
      ok: true,
      partition,
      remaining: cookieJar[partition].length
    });
  });

  // 3b. Real Proxy & Search Cache Management API
  app.get('/api/cache', (_req, res) => {
    pruneExpiredCache();
    let totalBytes = 0;
    const entries: Array<{ kind: 'page' | 'search'; label: string; sizeBytes: number; cachedAt: number }> = [];

    for (const item of proxyCache.values()) {
      totalBytes += item.sizeBytes;
      entries.push({
        kind: 'page',
        label: item.finalUrl || item.url,
        sizeBytes: item.sizeBytes,
        cachedAt: item.cachedAt
      });
    }
    for (const item of searchCache.values()) {
      totalBytes += item.sizeBytes;
      entries.push({
        kind: 'search',
        label: `Búsqueda: ${item.query}`,
        sizeBytes: item.sizeBytes,
        cachedAt: item.cachedAt
      });
    }

    entries.sort((a, b) => b.cachedAt - a.cachedAt);
    res.json({
      proxyCount: proxyCache.size,
      searchCount: searchCache.size,
      totalBytes,
      entries: entries.slice(0, 20)
    });
  });

  app.delete('/api/cache', (_req, res) => {
    let freedBytes = 0;
    for (const item of proxyCache.values()) freedBytes += item.sizeBytes;
    for (const item of searchCache.values()) freedBytes += item.sizeBytes;
    const clearedEntries = proxyCache.size + searchCache.size;
    proxyCache.clear();
    searchCache.clear();
    res.json({
      ok: true,
      clearedEntries,
      freedBytes
    });
  });

  // 4. FabiNav Secure Web Proxy (strips X-Frame-Options/frame-ancestors, enforces TLS, Cache, Fingerprinting & Shields)
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
    const fpRaw = String(req.query.fingerprint || 'standard');
    const blockFingerprinting: 'standard' | 'strict' | 'disabled' =
      fpRaw === 'strict' || fpRaw === 'disabled' ? fpRaw : 'standard';
    const relaxedTls = req.query.relaxedTls === '1';
    const upgradeHttps = !relaxedTls && req.query.upgradeHttps !== '0';
    const strictTls = !relaxedTls && req.query.strictTls !== '0';
    const rawDownload = req.query.raw === '1';
    const refresh = req.query.refresh === '1' || relaxedTls;
    const filterListsRaw = String(req.query.lists || 'core-trackers,cookie-notices,url-tracking');
    const filterLists = filterListsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const customRulesRaw = String(req.query.customRules || '');
    const customRules = customRulesRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 30);
    const extModes = String(req.query.ext || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const requestTargetUrl =
      shields && filterLists.includes('url-tracking')
        ? stripUrlTrackingParams(targetUrl)
        : targetUrl;

    const cacheKey = `${requestTargetUrl}::s${shields ? 1 : 0}::t${blockTrackers}::js${
      blockScripts ? 1 : 0
    }::fp${blockFingerprinting}::l[${filterLists.join('|')}]::r[${customRules.join('|')}]::e[${extModes.join('|')}]`;

    if (partition === 'normal' && !rawDownload && !refresh) {
      const hit = proxyCache.get(cacheKey);
      if (hit && hit.expiresAt > Date.now()) {
        res.status(hit.status);
        res.setHeader('Content-Type', hit.contentType);
        res.setHeader('X-FabiNav-Cache', 'HIT');
        res.send(hit.html);
        return;
      }
    }

    try {
      const outcome = await fetchViaNodeHttp(requestTargetUrl, {
        partition,
        blockCookies: shields && blockCookies,
        strictTls,
        upgradeHttps
      });

      const contentType = String(outcome.headers['content-type'] || 'text/html');
      if (
        contentType.includes('text/html') ||
        contentType.includes('application/xhtml+xml') ||
        contentType.includes('text/plain')
      ) {
        const isLatin1 = /charset\s*=\s*(iso-8859-1|latin1|windows-1252)/i.test(contentType);
        const rawHtml = outcome.body.toString(isLatin1 ? 'latin1' : 'utf-8');
        if (rawDownload) {
          res.status(outcome.status >= 400 ? outcome.status : 200);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.send(rawHtml);
          return;
        }

        // Detect anti-bot / Cloudflare Turnstile challenge pages that cannot complete inside a sandboxed proxy iframe
        const cfMitigated = String(outcome.headers['cf-mitigated'] || '').toLowerCase() === 'challenge';
        const isBotChallenge =
          cfMitigated ||
          ((outcome.status === 403 || outcome.status === 429 || outcome.status === 503) &&
            (/<title>\s*(just a moment|attention required|access denied|robot or human)/i.test(rawHtml) ||
              /challenge-platform|cf-turnstile|ddos-guard|perimeterx/i.test(rawHtml)));

        if (isBotChallenge) {
          res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.send(
            renderProxyFallbackHtml(
              outcome.finalUrl || targetUrl,
              `HTTP ${outcome.status} · Protección anti-bots detectada`,
              'Este sitio requiere verificación anti-bots directa',
              'En la versión web, el visor proxy no puede completar captchas o desafíos de Cloudflare en tu nombre. Puedes abrir el sitio directamente o usar FabiNav Escritorio (.exe) donde las páginas cargan de forma nativa.'
            )
          );
          return;
        }

        const { html, trackersBlocked } = sanitizeAndEnhanceHtml(rawHtml, outcome.finalUrl, {
          shields,
          blockTrackers,
          blockScripts,
          blockFingerprinting,
          cookiesBlocked: outcome.cookiesBlocked,
          upgradedHttps: outcome.upgradedHttps,
          filterLists,
          customRules,
          extModes
        });

        const upstreamCacheControl = String(outcome.headers['cache-control'] || '').toLowerCase();
        const allowCache =
          partition === 'normal' &&
          outcome.status < 400 &&
          !upstreamCacheControl.includes('no-store') &&
          !upstreamCacheControl.includes('private');

        if (allowCache) {
          const sizeBytes = Buffer.byteLength(html, 'utf-8');
          if (sizeBytes <= 2 * 1024 * 1024) {
            setProxyCacheEntry(cacheKey, {
              url: targetUrl,
              finalUrl: outcome.finalUrl,
              contentType: 'text/html; charset=utf-8',
              status: 200,
              html,
              trackersBlocked,
              sizeBytes,
              cachedAt: Date.now(),
              expiresAt: Date.now() + PROXY_CACHE_TTL_MS
            });
          }
        }

        res.status(outcome.status >= 400 ? outcome.status : 200);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('X-FabiNav-Cache', 'MISS');
        res.setHeader(
          'Cache-Control',
          partition === 'private' ? 'no-store' : 'private, max-age=180'
        );
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

  if (process.env.NODE_ENV !== 'production' && process.env.FABINAV_ELECTRON !== '1') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = process.env.FABINAV_DIST_DIR || path.resolve(resolvedDirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return new Promise<{ app: express.Express; server: http.Server; port: number }>((resolve) => {
    const listenPort = process.env.FABINAV_EMBEDDED === '1' ? 0 : DEFAULT_PORT;
    const server = app.listen(listenPort, listenPort === 0 ? '127.0.0.1' : '0.0.0.0', () => {
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : DEFAULT_PORT;
      console.log(`FabiNav server listening on http://localhost:${actualPort}`);
      resolve({ app, server, port: actualPort });
    });
  });
}

export { startServer };

if (process.env.FABINAV_EMBEDDED !== '1') {
  startServer();
}
