import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BrowserSettings,
  InstantAnswerData,
  SearchApiResponse,
  SearchImageItem,
  SearchResultItem
} from '../types';
import {
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  Calculator,
  Check,
  ChevronDown,
  Code2,
  Compass,
  Copy,
  ExternalLink,
  GitFork,
  Globe,
  Image as ImageIcon,
  Lock,
  Newspaper,
  Play,
  RotateCw,
  Search,
  SlidersHorizontal,
  Star,
  Video,
  X
} from 'lucide-react';
import {
  evaluateLocalInstantAnswer,
  getDomainVisuals,
  groupResultsByDomain
} from '../utils/searchHelpers';

const FABI_EASE_OUT: [number, number, number, number] = [0, 0, 0.58, 1];

type SearchFilterTab = 'all' | 'images' | 'videos' | 'news' | 'wikipedia' | 'code';

interface FabiSearchViewProps {
  query: string;
  defaultEngine: BrowserSettings['defaultSearchEngine'];
  onNavigate: (url: string) => void;
}

const SiteFavicon: React.FC<{
  url: string;
  isWiki?: boolean;
  size?: 'sm' | 'md';
}> = ({ url, isWiki, size = 'sm' }) => {
  const [failed, setFailed] = useState(false);
  const visuals = getDomainVisuals(url);
  const boxClass = size === 'md' ? 'w-9 h-9 rounded-xl text-sm' : 'w-6 h-6 rounded-full text-[11px]';
  const imgClass = size === 'md' ? 'w-5 h-5 rounded-sm' : 'w-4 h-4 rounded-xs';

  useEffect(() => {
    setFailed(false);
  }, [url]);

  if (failed || !visuals.faviconUrl) {
    return (
      <span
        className={`${boxClass} flex items-center justify-center font-bold shrink-0 ${visuals.colorClass}`}
        aria-hidden="true"
      >
        {isWiki ? 'W' : visuals.initial}
      </span>
    );
  }

  return (
    <span
      className={`${boxClass} flex items-center justify-center shrink-0 bg-[var(--bn-omnibox)] border border-[var(--bn-border)] overflow-hidden`}
      aria-hidden="true"
    >
      <img
        src={visuals.faviconUrl}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${imgClass} object-contain`}
      />
    </span>
  );
};

function renderHighlightedSnippet(text: string, query: string): React.ReactNode {
  if (!text) return null;
  const terms = query
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .filter((t) => t.length >= 3)
    .slice(0, 5);

  if (terms.length === 0) return text;
  const regex = new RegExp(`(${terms.join('|')})`, 'gi');
  const parts = text.split(regex);
  if (parts.length <= 1) return text;

  const lowerTerms = new Set(terms.map((t) => t.replace(/\\/g, '').toLowerCase()));
  return parts.map((part, idx) =>
    lowerTerms.has(part.toLowerCase()) ? (
      <strong key={idx} className="font-semibold text-[var(--bn-text-strong)]">
        {part}
      </strong>
    ) : (
      <React.Fragment key={idx}>{part}</React.Fragment>
    )
  );
}

export const FabiSearchView: React.FC<FabiSearchViewProps> = ({
  query,
  defaultEngine,
  onNavigate
}) => {
  const [inputVal, setInputVal] = useState(query);
  const [activeFilter, setActiveFilter] = useState<SearchFilterTab>('all');
  const [langFilter, setLangFilter] = useState<'all' | 'es'>('all');
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [showTools, setShowTools] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [data, setData] = useState<SearchApiResponse | null>(null);
  const [extraWebResults, setExtraWebResults] = useState<SearchResultItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [reloadTick, setReloadTick] = useState(0);
  const [wikiImgFailed, setWikiImgFailed] = useState(false);
  const [previewImage, setPreviewImage] = useState<SearchImageItem | null>(null);
  const [expandedTopicIdx, setExpandedTopicIdx] = useState<number | null>(0);
  const [copiedInstant, setCopiedInstant] = useState(false);

  // Autocomplete dropdown state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setInputVal(query);
    setWikiImgFailed(false);
    setPreviewImage(null);
    setExtraWebResults([]);
    setCurrentPage(1);
    setHasMore(false);
    setExpandedTopicIdx(0);
    setDropdownOpen(false);
    setHighlightedIdx(-1);
  }, [query]);

  // Close autocomplete on outside click
  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  // Debounced live suggestions
  useEffect(() => {
    const trimmed = inputVal.trim();
    if (!trimmed || trimmed.length < 2 || !dropdownOpen) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/suggest?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal
      })
        .then((r) => (r.ok ? r.json() : { suggestions: [] }))
        .then((json: { suggestions?: string[] }) => {
          setSuggestions(Array.isArray(json.suggestions) ? json.suggestions.slice(0, 7) : []);
          setHighlightedIdx(-1);
        })
        .catch(() => {
          // ignore aborts or transient errors
        });
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [inputVal, dropdownOpen]);

  // Main search fetch
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setData(null);
      setErrorMsg(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setErrorMsg(null);
    setExtraWebResults([]);
    setCurrentPage(1);

    fetch(`/api/search?q=${encodeURIComponent(trimmed)}&page=1&lang=${langFilter}`, {
      signal: controller.signal
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return (await res.json()) as SearchApiResponse;
      })
      .then((json) => {
        setData(json);
        setHasMore(Boolean(json.hasMore));
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setErrorMsg('No se pudo conectar con el servicio de búsqueda.');
        setLoading(false);
      });

    return () => controller.abort();
  }, [query, langFilter, reloadTick]);

  const handleLoadMore = async () => {
    if (loadingMore || !query.trim()) return;
    const nextPage = currentPage + 1;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(query.trim())}&page=${nextPage}&lang=${langFilter}`
      );
      if (res.ok) {
        const json = (await res.json()) as SearchApiResponse;
        const seenUrls = new Set([
          ...(data?.results || []).map((r) => r.url),
          ...extraWebResults.map((r) => r.url)
        ]);
        const fresh = (json.results || []).filter((r) => !seenUrls.has(r.url));
        setExtraWebResults((prev) => [...prev, ...fresh]);
        setCurrentPage(nextPage);
        setHasMore(Boolean(json.hasMore) && fresh.length > 0 && nextPage < 4);
      }
    } catch {
      // keep existing items on transient pagination error
    } finally {
      setLoadingMore(false);
    }
  };

  const submitQuery = (target: string) => {
    const cleaned = target.trim();
    if (!cleaned) return;
    setDropdownOpen(false);
    onNavigate(cleaned);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (highlightedIdx >= 0 && suggestions[highlightedIdx]) {
      submitQuery(suggestions[highlightedIdx]);
      return;
    }
    submitQuery(inputVal);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!dropdownOpen || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIdx((idx) => (idx + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIdx((idx) => (idx <= 0 ? suggestions.length - 1 : idx - 1));
    } else if (e.key === 'Escape') {
      setDropdownOpen(false);
    }
  };

  const dropdownInstantPreview = useMemo(
    () => evaluateLocalInstantAnswer(inputVal),
    [inputVal]
  );

  const activeInstantAnswer: InstantAnswerData | null = useMemo(() => {
    if (data?.instantAnswer) return data.instantAnswer;
    return evaluateLocalInstantAnswer(query);
  }, [data?.instantAnswer, query]);

  const handleCopyInstant = (value: string) => {
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopiedInstant(true);
    window.setTimeout(() => setCopiedInstant(false), 1600);
  };

  const webResults = useMemo(
    () => [...(data?.results || []), ...extraWebResults],
    [data?.results, extraWebResults]
  );
  const wikiResults = data?.wikipedia || [];
  const imageResults = data?.images || [];
  const newsResults = data?.news || [];
  const videoResults = data?.videos || [];
  const repoResults = data?.repos || [];
  const relatedTopics = data?.relatedTopics || [];
  const relatedQueries = data?.relatedQueries || [];

  const mergedAll: SearchResultItem[] = useMemo(
    () => [
      ...webResults,
      ...wikiResults.filter((w) => !webResults.some((r) => r.url === w.url))
    ],
    [webResults, wikiResults]
  );

  const groupedAll = useMemo(() => groupResultsByDomain(mergedAll), [mergedAll]);
  const featuredGroup =
    activeFilter === 'all' && groupedAll.length > 0 ? groupedAll[0] : null;
  const standardGroups = useMemo(() => {
    if (activeFilter === 'wikipedia') {
      return wikiResults.map((item) => ({ primary: item, sitelinks: [] as SearchResultItem[] }));
    }
    return featuredGroup ? groupedAll.slice(1) : groupedAll;
  }, [activeFilter, wikiResults, featuredGroup, groupedAll]);

  const knowledge = data?.knowledge || null;
  const durationLabel =
    typeof data?.durationMs === 'number'
      ? `${(data.durationMs / 1000).toFixed(2)} s`
      : null;

  const externalEngines = [
    {
      id: 'google',
      name: 'Google',
      href: `https://www.google.com/search?q=${encodeURIComponent(query)}`
    },
    {
      id: 'duckduckgo',
      name: 'DuckDuckGo',
      href: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
    },
    {
      id: 'bing',
      name: 'Bing',
      href: `https://www.bing.com/search?q=${encodeURIComponent(query)}`
    },
    {
      id: 'ecosia',
      name: 'Ecosia',
      href: `https://www.ecosia.org/search?q=${encodeURIComponent(query)}`
    }
  ];

  const tabs: Array<{
    id: SearchFilterTab;
    label: string;
    icon: React.ReactNode;
    count: number;
  }> = [
    { id: 'all', label: 'Todo', icon: <Globe className="w-3.5 h-3.5" />, count: mergedAll.length },
    {
      id: 'images',
      label: 'Imágenes',
      icon: <ImageIcon className="w-3.5 h-3.5" />,
      count: imageResults.length
    },
    {
      id: 'videos',
      label: 'Videos',
      icon: <Video className="w-3.5 h-3.5" />,
      count: videoResults.length
    },
    {
      id: 'news',
      label: 'Noticias',
      icon: <Newspaper className="w-3.5 h-3.5" />,
      count: newsResults.length
    },
    {
      id: 'wikipedia',
      label: 'Wikipedia',
      icon: <BookOpen className="w-3.5 h-3.5" />,
      count: wikiResults.length
    },
    {
      id: 'code',
      label: 'Código',
      icon: <Code2 className="w-3.5 h-3.5" />,
      count: repoResults.length
    }
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bn-surface)] text-[var(--bn-text)]">
      {/* Top FabiNav Search Header */}
      <header className="sticky top-0 z-20 bg-[var(--bn-toolbar)]/95 backdrop-blur-md border-b border-[var(--bn-border)] px-5 sm:px-8 pt-3.5 pb-0">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 sm:gap-5">
            {/* Brand Wordmark */}
            <button
              type="button"
              onClick={() => onNavigate('fabinav://newtab')}
              title="Volver a Nueva pestaña"
              className="flex items-center gap-2.5 shrink-0 group whitespace-nowrap"
            >
              <span
                className="w-8 h-8 rounded-xl flex items-center justify-center shadow-xs transition-transform fabi-transition-s group-hover:scale-105"
                style={{ background: 'var(--fabi-gradient-brand)' }}
              >
                <Compass className="w-4 h-4 text-white" />
              </span>
              <span className="hidden sm:inline text-sm font-bold text-[var(--bn-text-strong)] tracking-tight">
                FabiNav Search
              </span>
            </button>

            {/* Live Search Bar with Autocomplete Dropdown */}
            <div ref={searchBoxRef} className="relative flex-1 max-w-2xl">
              <form onSubmit={handleSubmit}>
                <div className="h-10 rounded-full bg-[var(--bn-omnibox)] border border-[var(--bn-border)] focus-within:border-[var(--bn-accent)] focus-within:bg-[var(--bn-omnibox-focus)] flex items-center pl-3.5 pr-1.5 gap-2 transition-colors fabi-transition-s shadow-xs">
                  <Search className="w-4 h-4 text-[var(--bn-text-muted)] shrink-0" />
                  <input
                    type="text"
                    value={inputVal}
                    onFocus={() => setDropdownOpen(true)}
                    onChange={(e) => {
                      setInputVal(e.target.value);
                      setDropdownOpen(true);
                    }}
                    onKeyDown={handleInputKeyDown}
                    placeholder="Buscar en la web o escribir una URL..."
                    aria-label="Buscar en FabiNav Search"
                    className="flex-1 bg-transparent outline-none text-[13px] text-[var(--bn-text-strong)] placeholder:text-[var(--bn-text-muted)] select-text"
                  />
                  {inputVal.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setInputVal('');
                        setSuggestions([]);
                      }}
                      title="Limpiar búsqueda"
                      className="p-1 rounded-full text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)] transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] active:scale-95 text-white text-xs font-medium transition-all fabi-transition-xs shrink-0 whitespace-nowrap"
                  >
                    Buscar
                  </button>
                </div>
              </form>

              {/* Autocomplete & Live Calculation Dropdown */}
              <AnimatePresence>
                {dropdownOpen &&
                  (dropdownInstantPreview !== null || suggestions.length > 0) && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.12, ease: FABI_EASE_OUT }}
                      className="absolute left-0 right-0 top-full mt-1.5 rounded-2xl border border-[var(--bn-border-strong)] bg-[var(--bn-surface-alt)] shadow-xl overflow-hidden z-40"
                    >
                      {dropdownInstantPreview && (
                        <button
                          type="button"
                          onClick={() => submitQuery(inputVal)}
                          className="w-full px-4 py-2.5 flex items-center justify-between gap-3 bg-[var(--bn-accent-soft)] hover:bg-[var(--bn-hover)] text-left border-b border-[var(--bn-border)] transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Calculator className="w-4 h-4 text-[var(--bn-accent)] shrink-0" />
                            <span className="text-xs text-[var(--bn-text-muted)] truncate">
                              {dropdownInstantPreview.subtitle}
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-[var(--bn-text-strong)] tabular-nums shrink-0">
                            {dropdownInstantPreview.resultText}
                          </span>
                        </button>
                      )}

                      {suggestions.map((sug, idx) => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => submitQuery(sug)}
                          onMouseEnter={() => setHighlightedIdx(idx)}
                          className={`w-full px-4 py-2 flex items-center gap-3 text-left text-[13px] transition-colors ${
                            highlightedIdx === idx
                              ? 'bg-[var(--bn-hover)] text-[var(--bn-text-strong)]'
                              : 'text-[var(--bn-text)] hover:bg-[var(--bn-hover)]'
                          }`}
                        >
                          <Search className="w-3.5 h-3.5 text-[var(--bn-text-muted)] shrink-0" />
                          <span className="truncate">{sug}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
              </AnimatePresence>
            </div>

            <button
              type="button"
              onClick={() => setReloadTick((n) => n + 1)}
              title="Actualizar resultados"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)] transition-colors fabi-transition-xs shrink-0"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-[var(--bn-accent)]' : ''}`} />
            </button>
          </div>

          {/* Filter Tabs & Tools Toggle Row */}
          <div className="flex items-center justify-between gap-4 mt-3 text-xs">
            <div className="flex items-center gap-5 sm:gap-6 font-medium overflow-x-auto no-scrollbar">
              {tabs.map((tab) => {
                const isActive = activeFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveFilter(tab.id)}
                    className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-colors fabi-transition-s whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'border-[var(--bn-accent)] text-[var(--bn-text-strong)]'
                        : 'border-transparent text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)]'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {!loading && data && (
                      <span className="text-[11px] text-[var(--bn-text-muted)] tabular-nums">
                        ({tab.count})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3 pb-2 shrink-0">
              {!loading && data && durationLabel && (
                <span className="hidden md:inline text-[11px] text-[var(--bn-text-muted)] tabular-nums whitespace-nowrap">
                  {durationLabel}
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowTools((v) => !v)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  showTools
                    ? 'bg-[var(--bn-active)] text-[var(--bn-text-strong)]'
                    : 'text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)]'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Herramientas</span>
              </button>
            </div>
          </div>

          {/* Collapsible Search Tools Bar */}
          <AnimatePresence>
            {showTools && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.14, ease: FABI_EASE_OUT }}
                className="overflow-hidden border-t border-[var(--bn-border)]/70"
              >
                <div className="py-2.5 flex flex-wrap items-center gap-4 text-xs text-[var(--bn-text-muted)]">
                  <div className="flex items-center gap-1.5">
                    <span>Idioma:</span>
                    <button
                      type="button"
                      onClick={() => setLangFilter('all')}
                      className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap ${
                        langFilter === 'all'
                          ? 'bg-[var(--bn-active)] text-[var(--bn-text-strong)] font-medium'
                          : 'hover:bg-[var(--bn-hover)]'
                      }`}
                    >
                      Global
                    </button>
                    <button
                      type="button"
                      onClick={() => setLangFilter('es')}
                      className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap ${
                        langFilter === 'es'
                          ? 'bg-[var(--bn-active)] text-[var(--bn-text-strong)] font-medium'
                          : 'hover:bg-[var(--bn-hover)]'
                      }`}
                    >
                      Priorizar español
                    </button>
                  </div>

                  <span aria-hidden="true" className="text-[var(--bn-border-strong)]">
                    |
                  </span>

                  <div className="flex items-center gap-1.5">
                    <span>Vista:</span>
                    <button
                      type="button"
                      onClick={() => setDensity('comfortable')}
                      className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap ${
                        density === 'comfortable'
                          ? 'bg-[var(--bn-active)] text-[var(--bn-text-strong)] font-medium'
                          : 'hover:bg-[var(--bn-hover)]'
                      }`}
                    >
                      Cómoda
                    </button>
                    <button
                      type="button"
                      onClick={() => setDensity('compact')}
                      className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap ${
                        density === 'compact'
                          ? 'bg-[var(--bn-active)] text-[var(--bn-text-strong)] font-medium'
                          : 'hover:bg-[var(--bn-hover)]'
                      }`}
                    >
                      Compacta
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Results Body */}
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6">
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-6">
              <div className="h-36 rounded-2xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] animate-pulse" />
              {[1, 2, 3, 4].map((idx) => (
                <div key={idx} className="animate-pulse space-y-2 py-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-[var(--bn-hover)]" />
                    <div className="h-3 w-48 rounded bg-[var(--bn-hover)]" />
                  </div>
                  <div className="h-4 w-72 rounded bg-[var(--bn-active)]" />
                  <div className="h-3 w-full rounded bg-[var(--bn-hover)]" />
                  <div className="h-3 w-5/6 rounded bg-[var(--bn-hover)]" />
                </div>
              ))}
            </div>
            <div className="lg:col-span-4">
              <div className="h-72 rounded-2xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] animate-pulse" />
            </div>
          </div>
        ) : errorMsg ? (
          <div className="p-6 rounded-2xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] flex items-start gap-3.5 max-w-2xl">
            <AlertCircle className="w-5 h-5 text-[var(--bn-warning-text)] shrink-0 mt-0.5" />
            <div className="space-y-2.5">
              <div className="text-sm font-semibold text-[var(--bn-text-strong)]">{errorMsg}</div>
              <p className="text-xs text-[var(--bn-text-muted)] leading-relaxed">
                Puedes reintentar la consulta o abrirla directamente en un buscador externo.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setReloadTick((n) => n + 1)}
                  className="px-4 py-1.5 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white text-xs font-medium"
                >
                  Reintentar
                </button>
                {externalEngines.slice(0, 3).map((eng) => (
                  <a
                    key={eng.id}
                    href={eng.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 rounded-full bg-[var(--bn-toolbar)] border border-[var(--bn-border-strong)] hover:bg-[var(--bn-hover)] text-xs font-medium text-[var(--bn-text-strong)] inline-flex items-center gap-1.5"
                  >
                    <span>{eng.name}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        ) : activeFilter === 'images' ? (
          <div className="space-y-5">
            {imageResults.length === 0 ? (
              <div className="p-8 rounded-2xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] text-center space-y-2">
                <ImageIcon className="w-8 h-8 text-[var(--bn-text-muted)] mx-auto opacity-70" />
                <div className="text-sm font-semibold text-[var(--bn-text-strong)]">
                  No se encontraron imágenes para «{query}»
                </div>
                <p className="text-xs text-[var(--bn-text-muted)]">
                  Prueba con otro término en la barra superior.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                {imageResults.map((img, i) => (
                  <button
                    key={`${img.imageUrl}-${i}`}
                    type="button"
                    onClick={() => setPreviewImage(img)}
                    className="group text-left rounded-2xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] overflow-hidden hover:border-[var(--bn-accent)] transition-colors"
                  >
                    <div className="aspect-[4/3] w-full bg-[var(--bn-omnibox)] overflow-hidden">
                      <img
                        src={img.thumbnailUrl}
                        alt={img.title}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="p-2.5">
                      <div className="text-xs font-medium text-[var(--bn-text-strong)] truncate">
                        {img.title}
                      </div>
                      <div className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                        Wikimedia Commons
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : activeFilter === 'videos' ? (
          <div className="space-y-4">
            {videoResults.length === 0 ? (
              <div className="p-8 rounded-2xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] text-center space-y-2">
                <Video className="w-8 h-8 text-[var(--bn-text-muted)] mx-auto opacity-70" />
                <div className="text-sm font-semibold text-[var(--bn-text-strong)]">
                  No se encontraron videos para «{query}»
                </div>
                <p className="text-xs text-[var(--bn-text-muted)]">
                  Intenta agregar términos como «tutorial», «review» o «en vivo».
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {videoResults.map((vid, idx) => (
                  <article
                    key={`${vid.url}-${idx}`}
                    className="rounded-2xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] overflow-hidden hover:border-[var(--bn-border-strong)] transition-colors flex flex-col"
                  >
                    <button
                      type="button"
                      onClick={() => onNavigate(vid.url)}
                      className="relative aspect-video w-full bg-[var(--bn-omnibox)] overflow-hidden group text-left"
                    >
                      {vid.thumbnailUrl ? (
                        <img
                          src={vid.thumbnailUrl}
                          alt={vid.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[var(--bn-text-muted)]">
                          <Video className="w-10 h-10 opacity-60" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-center justify-center">
                        <span className="w-12 h-12 rounded-full bg-black/70 border border-white/25 flex items-center justify-center text-white group-hover:bg-[var(--bn-accent)] group-hover:border-[var(--bn-accent)] transition-colors">
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </span>
                      </div>
                    </button>

                    <div className="p-4 flex-1 flex flex-col justify-between gap-2.5">
                      <div>
                        <div className="text-[11px] text-[var(--bn-text-muted)] flex items-center gap-1.5">
                          <span>{vid.channel}</span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{vid.displayUrl}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onNavigate(vid.url)}
                          className="mt-1 text-left text-sm font-semibold text-[var(--bn-link)] hover:text-[var(--bn-link-hover)] hover:underline line-clamp-2"
                        >
                          {vid.title}
                        </button>
                        {vid.snippet && (
                          <p className="mt-1.5 text-xs text-[var(--bn-text-muted)] line-clamp-2">
                            {vid.snippet}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[var(--bn-border)]/70 text-xs">
                        <button
                          type="button"
                          onClick={() => onNavigate(vid.url)}
                          className="text-[var(--bn-accent)] hover:underline font-medium inline-flex items-center gap-1"
                        >
                          <span>Abrir video</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={vid.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] inline-flex items-center gap-1"
                        >
                          <span>Externa</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        ) : activeFilter === 'news' ? (
          <div className="max-w-3xl space-y-3">
            {newsResults.length === 0 ? (
              <div className="p-8 rounded-2xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] text-center space-y-2">
                <Newspaper className="w-8 h-8 text-[var(--bn-text-muted)] mx-auto opacity-70" />
                <div className="text-sm font-semibold text-[var(--bn-text-strong)]">
                  No se encontraron noticias recientes para «{query}»
                </div>
                <p className="text-xs text-[var(--bn-text-muted)]">
                  Prueba con un tema de actualidad o el nombre completo del evento.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--bn-border)] rounded-2xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] overflow-hidden">
                {newsResults.map((item, idx) => (
                  <article
                    key={`${item.url}-${idx}`}
                    className="p-4 sm:p-5 hover:bg-[var(--bn-hover)]/45 transition-colors flex items-start justify-between gap-4"
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-[var(--bn-text-muted)] tabular-nums">
                        <span className="font-medium text-[var(--bn-text-strong)]">{item.source}</span>
                        {item.publishedAt && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{item.publishedAt}</span>
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigate(item.url)}
                        className="text-left text-base font-semibold text-[var(--bn-link)] hover:text-[var(--bn-link-hover)] hover:underline leading-snug block"
                      >
                        {item.title}
                      </button>
                    </div>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir noticia en ventana externa"
                      className="p-2 rounded-full text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)] shrink-0"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </article>
                ))}
              </div>
            )}
          </div>
        ) : activeFilter === 'code' ? (
          <div className="space-y-4">
            {repoResults.length === 0 ? (
              <div className="p-8 rounded-2xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] text-center space-y-2">
                <Code2 className="w-8 h-8 text-[var(--bn-text-muted)] mx-auto opacity-70" />
                <div className="text-sm font-semibold text-[var(--bn-text-strong)]">
                  No se encontraron repositorios en GitHub para «{query}»
                </div>
                <p className="text-xs text-[var(--bn-text-muted)]">
                  Prueba con el nombre de una librería, lenguaje o proyecto de código abierto.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {repoResults.map((repo) => (
                  <article
                    key={repo.fullName}
                    className="p-4 rounded-2xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] hover:border-[var(--bn-border-strong)] transition-colors flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onNavigate(repo.url)}
                          className="text-left text-sm font-semibold text-[var(--bn-link)] hover:text-[var(--bn-link-hover)] hover:underline truncate"
                        >
                          {repo.fullName}
                        </button>
                        <a
                          href={repo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir en GitHub"
                          className="p-1 text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] shrink-0"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      <p className="mt-1.5 text-xs text-[var(--bn-text)]/90 line-clamp-2 leading-relaxed">
                        {repo.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--bn-text-muted)] tabular-nums pt-2 border-t border-[var(--bn-border)]/70">
                      {repo.language && (
                        <>
                          <span className="font-medium text-[var(--bn-text-strong)]">
                            {repo.language}
                          </span>
                          <span aria-hidden="true">·</span>
                        </>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Star className="w-3 h-3 text-[var(--bn-warning-text)]" />
                        <span>{repo.stars.toLocaleString('es-ES')}</span>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <GitFork className="w-3 h-3" />
                        <span>{repo.forks.toLocaleString('es-ES')}</span>
                      </span>
                      {repo.updatedAt && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{repo.updatedAt}</span>
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left / Main Column */}
            <div className="lg:col-span-8 space-y-5">
              {data?.webError && webResults.length === 0 && (
                <div className="p-3.5 rounded-xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] text-xs text-[var(--bn-text-muted)]">
                  La búsqueda web directa alcanzó un límite temporal; se muestran los resultados disponibles de Wikipedia y fuentes paralelas.
                </div>
              )}

              {/* Instant Answer Card (Math / Units / Currency / Color / Dictionary) */}
              {activeFilter === 'all' && activeInstantAnswer && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.16, ease: FABI_EASE_OUT }}
                  className="p-5 rounded-2xl border border-[var(--bn-border-strong)] bg-[var(--bn-surface-alt)] space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-[var(--bn-accent)]">
                      {activeInstantAnswer.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyInstant(activeInstantAnswer.resultText)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)] inline-flex items-center gap-1.5 transition-colors"
                    >
                      {copiedInstant ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[var(--bn-success-text)]" />
                          <span>Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    {activeInstantAnswer.swatchColor && (
                      <div
                        className="w-14 h-14 rounded-xl border border-[var(--bn-border-strong)] shrink-0 shadow-xs"
                        style={{ backgroundColor: activeInstantAnswer.swatchColor }}
                        aria-hidden="true"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="text-xs text-[var(--bn-text-muted)]">
                        {activeInstantAnswer.subtitle}
                      </div>
                      <div className="text-2xl font-bold text-[var(--bn-text-strong)] tabular-nums mt-0.5 break-words select-text">
                        {activeInstantAnswer.resultText}
                      </div>
                    </div>
                  </div>

                  {activeInstantAnswer.details && activeInstantAnswer.details.length > 0 && (
                    <div className="pt-2.5 border-t border-[var(--bn-border)]/70 flex flex-wrap gap-x-6 gap-y-1.5 text-xs">
                      {activeInstantAnswer.details.map((det) => (
                        <div key={det.label} className="flex items-center gap-1.5">
                          <span className="text-[var(--bn-text-muted)]">{det.label}:</span>
                          <span className="font-medium text-[var(--bn-text-strong)] tabular-nums select-text">
                            {det.value}
                          </span>
                        </div>
                      ))}
                      {activeInstantAnswer.sourceUrl && (
                        <a
                          href={activeInstantAnswer.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--bn-link)] hover:underline ml-auto"
                        >
                          {activeInstantAnswer.sourceLabel || 'Fuente'}
                        </a>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Featured Top Result Card + Sitelinks */}
              {featuredGroup && (() => {
                const featuredResult = featuredGroup.primary;
                const visuals = getDomainVisuals(featuredResult.url);
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.16, ease: FABI_EASE_OUT }}
                    className="p-5 rounded-2xl border border-[var(--bn-border-strong)] bg-[var(--bn-surface-alt)] shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <SiteFavicon
                          url={featuredResult.url}
                          isWiki={featuredResult.source === 'wikipedia'}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--bn-text-strong)]">
                            <span className="truncate">{visuals.host}</span>
                            {featuredResult.url.startsWith('https://') && (
                              <Lock className="w-3 h-3 text-[var(--bn-success-text)] shrink-0" />
                            )}
                          </div>
                          <div className="text-[11px] text-[var(--bn-text-muted)] truncate">
                            {visuals.breadcrumb}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-[var(--bn-accent)] shrink-0">
                        Resultado principal
                      </span>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => onNavigate(featuredResult.url)}
                        className="text-left text-lg font-semibold text-[var(--bn-link)] hover:text-[var(--bn-link-hover)] hover:underline transition-colors leading-snug block"
                      >
                        {featuredResult.title}
                      </button>
                      {featuredResult.snippet && (
                        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--bn-text)]/90 line-clamp-3 select-text">
                          {renderHighlightedSnippet(featuredResult.snippet, query)}
                        </p>
                      )}
                    </div>

                    {featuredGroup.sitelinks.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2 pt-2 border-t border-[var(--bn-border)]/70">
                        {featuredGroup.sitelinks.map((sl) => (
                          <button
                            key={sl.url}
                            type="button"
                            onClick={() => onNavigate(sl.url)}
                            className="text-left group py-1"
                          >
                            <div className="text-[13px] font-medium text-[var(--bn-link)] group-hover:underline truncate">
                              {sl.title}
                            </div>
                            {sl.snippet && (
                              <div className="text-[11px] text-[var(--bn-text-muted)] line-clamp-1 mt-0.5">
                                {sl.snippet}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onNavigate(featuredResult.url)}
                        className="px-4 py-1.5 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                      >
                        <span>Abrir en FabiNav</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                      <a
                        href={featuredResult.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-1.5 rounded-full bg-[var(--bn-surface)] hover:bg-[var(--bn-hover)] border border-[var(--bn-border)] text-xs font-medium text-[var(--bn-text)] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                      >
                        <span>Ventana externa</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </motion.div>
                );
              })()}

              {/* Top Stories / Noticias destacadas inside Todo tab */}
              {activeFilter === 'all' && newsResults.length > 0 && (
                <section className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <h2 className="font-semibold text-[var(--bn-text-strong)] flex items-center gap-1.5">
                      <Newspaper className="w-3.5 h-3.5 text-[var(--bn-accent)]" />
                      <span>Noticias destacadas</span>
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveFilter('news')}
                      className="text-[11px] text-[var(--bn-accent)] hover:underline font-medium"
                    >
                      Ver todas ({newsResults.length})
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {newsResults.slice(0, 3).map((item, idx) => (
                      <button
                        key={`${item.url}-${idx}`}
                        type="button"
                        onClick={() => onNavigate(item.url)}
                        className="p-3.5 rounded-2xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] hover:border-[var(--bn-accent)] text-left flex flex-col justify-between gap-2.5 transition-colors"
                      >
                        <div className="text-xs font-semibold text-[var(--bn-text-strong)] line-clamp-3 leading-snug">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-[var(--bn-text-muted)] flex items-center gap-1.5 truncate tabular-nums">
                          <span className="truncate font-medium">{item.source}</span>
                          {item.publishedAt && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="shrink-0">{item.publishedAt}</span>
                            </>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Videos Strip inside Todo tab */}
              {activeFilter === 'all' && videoResults.length > 0 && (
                <section className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <h2 className="font-semibold text-[var(--bn-text-strong)] flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5 text-[var(--bn-accent)]" />
                      <span>Videos</span>
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveFilter('videos')}
                      className="text-[11px] text-[var(--bn-accent)] hover:underline font-medium"
                    >
                      Ver todos ({videoResults.length})
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {videoResults.slice(0, 3).map((vid, idx) => (
                      <button
                        key={`${vid.url}-${idx}`}
                        type="button"
                        onClick={() => onNavigate(vid.url)}
                        className="rounded-2xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] hover:border-[var(--bn-accent)] overflow-hidden text-left group transition-colors flex flex-col"
                      >
                        <div className="relative aspect-video w-full bg-[var(--bn-omnibox)] overflow-hidden">
                          {vid.thumbnailUrl ? (
                            <img
                              src={vid.thumbnailUrl}
                              alt={vid.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[var(--bn-text-muted)]">
                              <Video className="w-7 h-7 opacity-60" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-center justify-center">
                            <span className="w-9 h-9 rounded-full bg-black/70 border border-white/25 flex items-center justify-center text-white group-hover:bg-[var(--bn-accent)] transition-colors">
                              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                            </span>
                          </div>
                        </div>
                        <div className="p-3 space-y-1">
                          <div className="text-xs font-semibold text-[var(--bn-text-strong)] line-clamp-2 leading-snug">
                            {vid.title}
                          </div>
                          <div className="text-[11px] text-[var(--bn-text-muted)] truncate">
                            {vid.channel}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Standard Organic Results */}
              {standardGroups.length === 0 && !featuredGroup ? (
                <div className="p-8 rounded-2xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] text-center space-y-2.5">
                  <div className="text-sm font-semibold text-[var(--bn-text-strong)]">
                    No se encontraron resultados para «{query}»
                  </div>
                  <p className="text-xs text-[var(--bn-text-muted)]">
                    Prueba con otros términos o usa un motor de búsqueda externo en la columna derecha.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--bn-border)]/70">
                  {standardGroups.map((group, idx) => {
                    const item = group.primary;
                    const visuals = getDomainVisuals(item.url);
                    const padClass = density === 'compact' ? 'py-2.5 first:pt-1' : 'py-4 first:pt-1';
                    return (
                      <motion.article
                        key={`${item.url}-${idx}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.14,
                          delay: Math.min(idx * 0.02, 0.14),
                          ease: FABI_EASE_OUT
                        }}
                        className={`${padClass} group`}
                      >
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <SiteFavicon
                              url={item.url}
                              isWiki={item.source === 'wikipedia'}
                              size="sm"
                            />
                            <div className="min-w-0 flex items-center gap-1.5 text-xs text-[var(--bn-text-muted)]">
                              <span className="truncate font-medium text-[var(--bn-text)]">
                                {visuals.breadcrumb}
                              </span>
                              {item.source === 'wikipedia' && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="shrink-0">Wikipedia</span>
                                </>
                              )}
                            </div>
                          </div>

                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir en ventana externa"
                            className="p-1.5 rounded-full text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)] opacity-60 group-hover:opacity-100 shrink-0 transition-all fabi-transition-xs"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>

                        <button
                          type="button"
                          onClick={() => onNavigate(item.url)}
                          className="text-left text-[17px] font-semibold text-[var(--bn-link)] hover:text-[var(--bn-link-hover)] hover:underline transition-colors fabi-transition-xs leading-snug block"
                        >
                          {item.title}
                        </button>

                        {item.snippet && (
                          <p
                            className={`mt-1.5 text-[13px] leading-relaxed text-[var(--bn-text)]/90 max-w-[68ch] select-text ${
                              density === 'compact' ? 'line-clamp-2' : 'line-clamp-3'
                            }`}
                          >
                            {renderHighlightedSnippet(item.snippet, query)}
                          </p>
                        )}

                        {group.sitelinks.length > 0 && (
                          <div className="mt-2.5 pl-3 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-1.5 border-l border-[var(--bn-border)]">
                            {group.sitelinks.map((sl) => (
                              <button
                                key={sl.url}
                                type="button"
                                onClick={() => onNavigate(sl.url)}
                                className="text-left group/sl py-0.5"
                              >
                                <div className="text-xs font-medium text-[var(--bn-link)] group-hover/sl:underline truncate">
                                  {sl.title}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </motion.article>
                    );
                  })}
                </div>
              )}

              {/* Mini Image Strip Preview inside Todo tab */}
              {activeFilter === 'all' && imageResults.length > 0 && (
                <section className="p-4 rounded-2xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <h2 className="font-semibold text-[var(--bn-text-strong)] flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-[var(--bn-accent)]" />
                      <span>Imágenes relacionadas</span>
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveFilter('images')}
                      className="text-[11px] text-[var(--bn-accent)] hover:underline font-medium"
                    >
                      Ver todas ({imageResults.length})
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {imageResults.slice(0, 4).map((img, i) => (
                      <button
                        key={`${img.thumbnailUrl}-${i}`}
                        type="button"
                        onClick={() => setPreviewImage(img)}
                        className="aspect-square rounded-xl overflow-hidden bg-[var(--bn-omnibox)] border border-[var(--bn-border)] hover:border-[var(--bn-accent)] transition-colors"
                      >
                        <img
                          src={img.thumbnailUrl}
                          alt={img.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                        />
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Expandable Wikipedia Topics ("Temas relacionados") */}
              {activeFilter === 'all' && relatedTopics.length > 0 && (
                <section className="rounded-2xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--bn-border)] text-xs font-semibold text-[var(--bn-text-strong)]">
                    Temas relacionados · Wikipedia
                  </div>
                  <div className="divide-y divide-[var(--bn-border)]/70">
                    {relatedTopics.map((topic, idx) => {
                      const isOpen = expandedTopicIdx === idx;
                      return (
                        <div key={topic.url}>
                          <button
                            type="button"
                            onClick={() => setExpandedTopicIdx(isOpen ? null : idx)}
                            className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left text-[13px] font-medium text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)]/45 transition-colors"
                          >
                            <span className="truncate">{topic.title}</span>
                            <ChevronDown
                              className={`w-4 h-4 text-[var(--bn-text-muted)] shrink-0 transition-transform duration-150 ${
                                isOpen ? 'rotate-180' : ''
                              }`}
                            />
                          </button>
                          {isOpen && (
                            <div className="px-4 pb-3.5 text-xs leading-relaxed text-[var(--bn-text)]/90 space-y-2">
                              <p className="select-text">{topic.extract}</p>
                              <button
                                type="button"
                                onClick={() => onNavigate(topic.url)}
                                className="text-[var(--bn-link)] hover:underline font-medium inline-flex items-center gap-1"
                              >
                                <span>Leer artículo completo</span>
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Load More Pagination */}
              {activeFilter === 'all' && hasMore && (
                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={handleLoadMore}
                    className="px-6 py-2 rounded-full bg-[var(--bn-surface-alt)] hover:bg-[var(--bn-hover)] border border-[var(--bn-border-strong)] text-xs font-medium text-[var(--bn-text-strong)] inline-flex items-center gap-2 transition-colors disabled:opacity-60"
                  >
                    {loadingMore && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>{loadingMore ? 'Cargando más resultados...' : 'Más resultados'}</span>
                  </button>
                </div>
              )}

              {/* Related Queries */}
              {relatedQueries.length > 0 && (
                <div className="pt-4 border-t border-[var(--bn-border)] space-y-2.5">
                  <h3 className="text-xs font-semibold text-[var(--bn-text-strong)]">
                    Búsquedas relacionadas
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {relatedQueries.map((rq) => (
                      <button
                        key={rq}
                        type="button"
                        onClick={() => onNavigate(rq)}
                        className="px-3.5 py-2.5 rounded-xl bg-[var(--bn-surface-alt)] hover:bg-[var(--bn-hover)] border border-[var(--bn-border)] text-left text-xs font-medium text-[var(--bn-text-strong)] flex items-center gap-2.5 transition-colors"
                      >
                        <Search className="w-3.5 h-3.5 text-[var(--bn-text-muted)] shrink-0" />
                        <span className="truncate">{rq}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Knowledge Panel + External Engine Launcher */}
            <aside className="lg:col-span-4 space-y-4 lg:sticky lg:top-32">
              {knowledge && (
                <div className="rounded-2xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] overflow-hidden">
                  {knowledge.thumbnailUrl && !wikiImgFailed && (
                    <div className="w-full h-44 bg-[var(--bn-omnibox)] overflow-hidden border-b border-[var(--bn-border)]">
                      <img
                        src={knowledge.thumbnailUrl}
                        alt={knowledge.title}
                        referrerPolicy="no-referrer"
                        onError={() => setWikiImgFailed(true)}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-4 space-y-2.5">
                    <div>
                      <div className="text-[11px] text-[var(--bn-text-muted)]">
                        Resumen · Wikipedia
                      </div>
                      <h2 className="text-base font-semibold text-[var(--bn-text-strong)] leading-snug mt-0.5">
                        {knowledge.title}
                      </h2>
                      {knowledge.description && (
                        <div className="text-xs text-[var(--bn-text-muted)] mt-0.5">
                          {knowledge.description}
                        </div>
                      )}
                    </div>

                    <p className="text-xs leading-relaxed text-[var(--bn-text)] line-clamp-6 select-text">
                      {knowledge.extract}
                    </p>

                    <div className="pt-1 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onNavigate(knowledge.url)}
                        className="px-3.5 py-1.5 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                      >
                        <span>Leer artículo</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>

                      <a
                        href={knowledge.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:underline whitespace-nowrap"
                      >
                        Fuente externa
                      </a>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 rounded-2xl border border-[var(--bn-border)] bg-[var(--bn-surface-alt)] space-y-3">
                <div>
                  <h3 className="text-xs font-semibold text-[var(--bn-text-strong)]">
                    Buscar «{query}» en otro motor
                  </h3>
                  <p className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                    Abre esta misma consulta en una ventana externa.
                  </p>
                </div>

                <div className="space-y-1.5">
                  {externalEngines.map((eng) => {
                    const isDef = eng.id === defaultEngine;
                    return (
                      <a
                        key={eng.id}
                        href={eng.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`w-full px-3.5 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors fabi-transition-xs ${
                          isDef
                            ? 'bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white'
                            : 'bg-[var(--bn-surface)] hover:bg-[var(--bn-hover)] text-[var(--bn-text-strong)] border border-[var(--bn-border)]'
                        }`}
                      >
                        <span className="truncate">
                          {eng.name}
                          {isDef ? ' · Predeterminado' : ''}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    );
                  })}
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewImage(null)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-3xl w-full bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="px-4 py-3 bg-[var(--bn-toolbar)] border-b border-[var(--bn-border)] flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-[var(--bn-text-strong)] truncate">
                  {previewImage.title}
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="p-1 text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="bg-black/50 flex items-center justify-center max-h-[65vh] overflow-hidden p-4">
                <img
                  src={previewImage.imageUrl}
                  alt={previewImage.title}
                  referrerPolicy="no-referrer"
                  className="max-h-[58vh] max-w-full object-contain rounded-lg"
                />
              </div>
              <div className="px-4 py-3 bg-[var(--bn-toolbar)] border-t border-[var(--bn-border)] flex items-center justify-between text-xs">
                <span className="text-[var(--bn-text-muted)]">Wikimedia Commons</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate(previewImage.sourceUrl);
                      setPreviewImage(null);
                    }}
                    className="px-3.5 py-1.5 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white font-medium inline-flex items-center gap-1.5"
                  >
                    <span>Abrir fuente en FabiNav</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                  <a
                    href={previewImage.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 rounded-full bg-[var(--bn-surface-alt)] hover:bg-[var(--bn-hover)] border border-[var(--bn-border-strong)] text-[var(--bn-text-strong)] font-medium inline-flex items-center gap-1.5"
                  >
                    <span>Imagen original</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
