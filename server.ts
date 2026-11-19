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

function buildBuiltInExtensionCss(extModes: string[]): string {
  const chunks: string[] = [];
  if (extModes.includes('dark-web')) {
    chunks.push(
      'html{filter:invert(0.92) hue-rotate(180deg);background:#121316!important;}img,video,picture,canvas,svg image,[style*="background-image"]{filter:invert(1) hue-rotate(180deg)!important;}'
    );
  }
  if (extModes.includes('reader')) {
    chunks.push(
      'body{max-width:740px!important;margin:0 auto!important;padding:32px 24px!important;font-size:18px!important;line-height:1.72!important;font-family:Georgia,"Times New Roman",serif!important;}nav,aside,.sidebar,[role="complementary"],.ad,[class*="sidebar"],[class*="banner"]{opacity:0.25!important;}'
    );
  }
  if (extModes.includes('ad-cosmetic')) {
    chunks.push(
      '[class*="newsletter"],[id*="newsletter"],[class*="subscribe-modal"],[class*="paywall-banner"],[class*="sticky-footer"],.fc-ab-root{display:none!important;}'
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

  // Insert <base href="..."> + Fingerprint guard + Cookie annoyances + Extensions style
  const baseTag = `<base href="${escapeHtml(finalUrl)}">${cookieBannerGuard}${extStyleTag}${fingerprintGuard}`;
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
  var applyExtensions = function (modes, customCss) {
    try {
      var builtInEl = document.getElementById('fabinav-extensions-style');
      if (!builtInEl && document.head) {
        builtInEl = document.createElement('style');
        builtInEl.id = 'fabinav-extensions-style';
        document.head.appendChild(builtInEl);
      }
      if (builtInEl) {
        var chunks = [];
        if (Array.isArray(modes)) {
          if (modes.indexOf('dark-web') !== -1) {
            chunks.push('html{filter:invert(0.92) hue-rotate(180deg);background:#121316!important;}img,video,picture,canvas,svg image,[style*="background-image"]{filter:invert(1) hue-rotate(180deg)!important;}');
          }
          if (modes.indexOf('reader') !== -1) {
            chunks.push('body{max-width:740px!important;margin:0 auto!important;padding:32px 24px!important;font-size:18px!important;line-height:1.72!important;font-family:Georgia,"Times New Roman",serif!important;}nav,aside,.sidebar,[role="complementary"],.ad,[class*="sidebar"],[class*="banner"]{opacity:0.25!important;}');
          }
          if (modes.indexOf('ad-cosmetic') !== -1) {
            chunks.push('[class*="newsletter"],[id*="newsletter"],[class*="subscribe-modal"],[class*="paywall-banner"],[class*="sticky-footer"],.fc-ab-root{display:none!important;}');
          }
        }
        builtInEl.textContent = chunks.join('\\n');
      }
      var customEl = document.getElementById('fabinav-custom-css');
      if (!customEl && document.head) {
        customEl = document.createElement('style');
        customEl.id = 'fabinav-custom-css';
        document.head.appendChild(customEl);
      }
      if (customEl) {
        customEl.textContent = typeof customCss === 'string' ? customCss : '';
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
      applyExtensions(d.modes, d.customCss);
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
  loadNormalCookiesFromDisk();
  const app = express();
  app.use(express.json({ limit: '512kb' }));

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
    const upgradeHttps = req.query.upgradeHttps !== '0';
    const strictTls = req.query.strictTls !== '0';
    const rawDownload = req.query.raw === '1';
    const refresh = req.query.refresh === '1';
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
        upgradeHttps: shields && upgradeHttps
      });

      const contentType = String(outcome.headers['content-type'] || 'text/html');
      if (contentType.includes('text/html') || contentType.includes('application/xhtml+xml')) {
        const rawHtml = outcome.body.toString('utf-8');
        if (rawDownload) {
          res.status(outcome.status >= 400 ? outcome.status : 200);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.send(rawHtml);
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
