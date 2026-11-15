import express from 'express';
import path from 'path';
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

async function fetchWikipediaResults(query: string): Promise<SearchResult[]> {
  const endpoint = `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    query
  )}&format=json&utf8=1&srlimit=4`;

  const response = await fetch(endpoint, {
    headers: {
      'User-Agent': 'FabiNav/1.6.0 (Web Browser UI)'
    },
    signal: AbortSignal.timeout(5000)
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as {
    query?: {
      search?: Array<{ title: string; snippet: string; pageid: number }>;
    };
  };

  const items = data?.query?.search || [];
  return items.map((item) => {
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
}

async function startServer() {
  const app = express();

  app.get('/api/search', async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) {
      res.status(400).json({ error: 'Consulta vacía', results: [], wikipedia: [] });
      return;
    }

    const [webSettled, wikiSettled] = await Promise.allSettled([
      fetchDuckDuckGoResults(q),
      fetchWikipediaResults(q)
    ]);

    const results = webSettled.status === 'fulfilled' ? webSettled.value : [];
    const wikipedia = wikiSettled.status === 'fulfilled' ? wikiSettled.value : [];
    const webError =
      webSettled.status === 'rejected'
        ? String(webSettled.reason instanceof Error ? webSettled.reason.message : webSettled.reason)
        : null;

    res.json({
      query: q,
      results,
      wikipedia,
      webError,
      fetchedAt: Date.now()
    });
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
