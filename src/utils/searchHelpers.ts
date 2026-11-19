import { InstantAnswerData, SearchResultItem } from '../types';

export interface GroupedSearchResult {
  primary: SearchResultItem;
  sitelinks: SearchResultItem[];
}

const DOMAIN_ACCENTS = [
  'bg-orange-500/15 text-orange-400',
  'bg-blue-500/15 text-blue-400',
  'bg-emerald-500/15 text-emerald-400',
  'bg-indigo-500/15 text-indigo-400',
  'bg-rose-500/15 text-rose-400',
  'bg-amber-500/15 text-amber-400'
];

export function getDomainVisuals(rawUrl: string): {
  host: string;
  rootDomain: string;
  breadcrumb: string;
  faviconUrl: string;
  colorClass: string;
  initial: string;
} {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.replace(/^www\./, '');
    const parts = host.split('.');
    const rootDomain = parts.length >= 2 ? parts.slice(-2).join('.') : host;
    const pathSegments = parsed.pathname
      .split('/')
      .filter(Boolean)
      .slice(0, 3)
      .map((s) => {
        try {
          return decodeURIComponent(s);
        } catch {
          return s;
        }
      });
    const breadcrumb =
      pathSegments.length > 0 ? `${host} › ${pathSegments.join(' › ')}` : host;
    let hash = 0;
    for (let i = 0; i < host.length; i++) {
      hash = (hash * 31 + host.charCodeAt(i)) >>> 0;
    }
    return {
      host,
      rootDomain,
      breadcrumb,
      faviconUrl: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`,
      colorClass: DOMAIN_ACCENTS[hash % DOMAIN_ACCENTS.length],
      initial: (host[0] || 'W').toUpperCase()
    };
  } catch {
    return {
      host: rawUrl,
      rootDomain: rawUrl,
      breadcrumb: rawUrl,
      faviconUrl: '',
      colorClass: DOMAIN_ACCENTS[0],
      initial: 'W'
    };
  }
}

export function groupResultsByDomain(items: SearchResultItem[]): GroupedSearchResult[] {
  const groups: GroupedSearchResult[] = [];
  const seenPrimaryByRoot = new Map<string, GroupedSearchResult>();

  for (const item of items) {
    const { rootDomain } = getDomainVisuals(item.url);
    const existing = seenPrimaryByRoot.get(rootDomain);
    if (existing && existing.sitelinks.length < 4 && existing.primary.url !== item.url) {
      existing.sitelinks.push(item);
    } else if (!existing) {
      const group: GroupedSearchResult = { primary: item, sitelinks: [] };
      seenPrimaryByRoot.set(rootDomain, group);
      groups.push(group);
    } else {
      groups.push({ primary: item, sitelinks: [] });
    }
  }

  return groups;
}

/* ============================================================================
   Safe Recursive-Descent Math Evaluator (no eval / no Function)
============================================================================ */

type Token =
  | { type: 'num'; value: number }
  | { type: 'op'; value: string }
  | { type: 'ident'; value: string }
  | { type: 'paren'; value: '(' | ')' };

function tokenizeMath(expr: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  const s = expr.trim();

  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let numStr = '';
      let dots = 0;
      while (i < s.length && /[0-9.]/.test(s[i])) {
        if (s[i] === '.') dots++;
        if (dots > 1) return null;
        numStr += s[i++];
      }
      const val = Number(numStr);
      if (!Number.isFinite(val)) return null;
      tokens.push({ type: 'num', value: val });
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      let ident = '';
      while (i < s.length && /[a-zA-Z]/.test(s[i])) {
        ident += s[i++];
      }
      tokens.push({ type: 'ident', value: ident.toLowerCase() });
      continue;
    }
    if ('+-*/%^'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }
    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch });
      i++;
      continue;
    }
    return null;
  }
  return tokens;
}

function evaluateMathTokens(tokens: Token[]): number | null {
  let pos = 0;
  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  const parseExpr = (): number | null => {
    let left = parseTerm();
    if (left === null) return null;
    while (peek()?.type === 'op' && (peek()!.value === '+' || peek()!.value === '-')) {
      const op = consume()!.value;
      const right = parseTerm();
      if (right === null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  };

  const parseTerm = (): number | null => {
    let left = parsePower();
    if (left === null) return null;
    while (
      peek()?.type === 'op' &&
      (peek()!.value === '*' || peek()!.value === '/' || peek()!.value === '%')
    ) {
      const op = consume()!.value;
      const right = parsePower();
      if (right === null) return null;
      if ((op === '/' || op === '%') && right === 0) return null;
      left = op === '*' ? left * right : op === '/' ? left / right : left % right;
    }
    return left;
  };

  const parsePower = (): number | null => {
    const base = parseUnary();
    if (base === null) return null;
    if (peek()?.type === 'op' && peek()!.value === '^') {
      consume();
      const exp = parsePower();
      if (exp === null) return null;
      return Math.pow(base, exp);
    }
    return base;
  };

  const parseUnary = (): number | null => {
    if (peek()?.type === 'op' && (peek()!.value === '-' || peek()!.value === '+')) {
      const op = consume()!.value;
      const val = parseUnary();
      if (val === null) return null;
      return op === '-' ? -val : val;
    }
    return parsePrimary();
  };

  const parsePrimary = (): number | null => {
    const tok = peek();
    if (!tok) return null;

    if (tok.type === 'num') {
      consume();
      return tok.value;
    }

    if (tok.type === 'paren' && tok.value === '(') {
      consume();
      const inner = parseExpr();
      if (inner === null) return null;
      if (peek()?.type !== 'paren' || peek()!.value !== ')') return null;
      consume();
      return inner;
    }

    if (tok.type === 'ident') {
      consume();
      if (tok.value === 'pi') return Math.PI;
      if (tok.value === 'e') return Math.E;
      if (peek()?.type === 'paren' && peek()!.value === '(') {
        consume();
        const arg = parseExpr();
        if (arg === null) return null;
        if (peek()?.type !== 'paren' || peek()!.value !== ')') return null;
        consume();
        switch (tok.value) {
          case 'sqrt':
          case 'raiz':
            return arg < 0 ? null : Math.sqrt(arg);
          case 'abs':
            return Math.abs(arg);
          case 'sin':
            return Math.sin(arg);
          case 'cos':
            return Math.cos(arg);
          case 'tan':
            return Math.tan(arg);
          case 'log':
            return arg <= 0 ? null : Math.log10(arg);
          case 'ln':
            return arg <= 0 ? null : Math.log(arg);
          case 'round':
            return Math.round(arg);
          default:
            return null;
        }
      }
      return null;
    }

    return null;
  };

  const res = parseExpr();
  if (res === null || pos !== tokens.length || !Number.isFinite(res)) return null;
  return res;
}

function formatSmartNumber(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString('es-ES');
  const rounded = Number(n.toPrecision(10));
  return rounded.toLocaleString('es-ES', { maximumFractionDigits: 6 });
}

/* ============================================================================
   Local Deterministic Instant Answers (Math, Units, Percentages, Colors)
============================================================================ */

export function evaluateLocalInstantAnswer(rawQuery: string): InstantAnswerData | null {
  const q = rawQuery.trim();
  if (!q || q.length > 90) return null;

  // 1. Color Preview (#hex or rgb(...))
  const hexMatch = q.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r / 255:
          h = ((g - b) / 255 / d + (g < b ? 6 : 0)) / 6;
          break;
        case g / 255:
          h = ((b - r) / 255 / d + 2) / 6;
          break;
        case b / 255:
          h = ((r - g) / 255 / d + 4) / 6;
          break;
      }
    }
    const fullHex = `#${hex.toUpperCase()}`;
    return {
      type: 'color',
      title: 'Selector de color',
      subtitle: fullHex,
      resultText: `rgb(${r}, ${g}, ${b})`,
      swatchColor: fullHex,
      details: [
        { label: 'HEX', value: fullHex },
        { label: 'RGB', value: `${r}, ${g}, ${b}` },
        {
          label: 'HSL',
          value: `${Math.round(h * 360)}°, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%`
        }
      ]
    };
  }

  const rgbMatch = q.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  if (rgbMatch) {
    const r = Math.min(255, Number(rgbMatch[1]));
    const g = Math.min(255, Number(rgbMatch[2]));
    const b = Math.min(255, Number(rgbMatch[3]));
    const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    return {
      type: 'color',
      title: 'Selector de color',
      subtitle: `rgb(${r}, ${g}, ${b})`,
      resultText: hex,
      swatchColor: hex,
      details: [
        { label: 'HEX', value: hex },
        { label: 'RGB', value: `${r}, ${g}, ${b}` }
      ]
    };
  }

  // 2. Percentage query ("15% de 800", "20 % of 450")
  const pctMatch = q.match(/^(-?\d+(?:[.,]\d+)?)\s*%\s+(?:de|of)\s+(-?\d+(?:[.,]\d+)?)$/i);
  if (pctMatch) {
    const pct = Number(pctMatch[1].replace(',', '.'));
    const base = Number(pctMatch[2].replace(',', '.'));
    if (Number.isFinite(pct) && Number.isFinite(base)) {
      const value = (pct / 100) * base;
      return {
        type: 'math',
        title: 'Calculadora',
        subtitle: `${pct}% de ${formatSmartNumber(base)}`,
        resultText: formatSmartNumber(value)
      };
    }
  }

  // 3. Unit conversions ("100 km a millas", "30 c a f", "70 kg to lb", "16 gb en mb")
  const unitMatch = q.match(
    /^(-?\d+(?:[.,]\d+)?)\s*([a-zA-Z°/]+)\s+(?:a|to|en|in)\s+([a-zA-Z°/]+)$/i
  );
  if (unitMatch) {
    const val = Number(unitMatch[1].replace(',', '.'));
    const from = unitMatch[2].toLowerCase().replace('°', '');
    const to = unitMatch[3].toLowerCase().replace('°', '');

    if (Number.isFinite(val)) {
      // Temperature
      const tempResult = convertTemperature(val, from, to);
      if (tempResult !== null) {
        return {
          type: 'unit',
          title: 'Conversor de temperatura',
          subtitle: `${formatSmartNumber(val)} ${tempResult.fromLabel} =`,
          resultText: `${formatSmartNumber(tempResult.value)} ${tempResult.toLabel}`,
          details: [
            { label: 'Fórmula', value: tempResult.formula }
          ]
        };
      }

      // Linear units
      const linearResult = convertLinearUnit(val, from, to);
      if (linearResult !== null) {
        return {
          type: 'unit',
          title: `Conversor de ${linearResult.category}`,
          subtitle: `${formatSmartNumber(val)} ${linearResult.fromLabel} =`,
          resultText: `${formatSmartNumber(linearResult.value)} ${linearResult.toLabel}`
        };
      }
    }
  }

  // 4. Math expression ("250 * 48", "(120 + 80) / 4", "sqrt(144)", "2^10")
  const normalized = q.replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '.');
  if (/[+\-*/%^()]/.test(normalized) && /\d/.test(normalized)) {
    const tokens = tokenizeMath(normalized);
    if (tokens && tokens.length >= 3) {
      const value = evaluateMathTokens(tokens);
      if (value !== null) {
        return {
          type: 'math',
          title: 'Calculadora',
          subtitle: `${q} =`,
          resultText: formatSmartNumber(value)
        };
      }
    }
  }

  return null;
}

function convertTemperature(
  val: number,
  from: string,
  to: string
): { value: number; fromLabel: string; toLabel: string; formula: string } | null {
  const norm = (u: string): 'c' | 'f' | 'k' | null => {
    if (['c', 'celsius', 'centigrados'].includes(u)) return 'c';
    if (['f', 'fahrenheit'].includes(u)) return 'f';
    if (['k', 'kelvin'].includes(u)) return 'k';
    return null;
  };
  const f = norm(from);
  const t = norm(to);
  if (!f || !t || f === t) return null;

  const celsius = f === 'c' ? val : f === 'f' ? ((val - 32) * 5) / 9 : val - 273.15;
  const out = t === 'c' ? celsius : t === 'f' ? (celsius * 9) / 5 + 32 : celsius + 273.15;
  const labels = { c: '°C', f: '°F', k: 'K' };
  const formula =
    f === 'c' && t === 'f'
      ? '(°C × 9/5) + 32'
      : f === 'f' && t === 'c'
        ? '(°F − 32) × 5/9'
        : 'Escala Kelvin (K = °C + 273.15)';
  return { value: out, fromLabel: labels[f], toLabel: labels[t], formula };
}

const LINEAR_UNITS: Array<{
  category: string;
  units: Record<string, { factor: number; label: string }>;
}> = [
  {
    category: 'longitud',
    units: {
      mm: { factor: 0.001, label: 'mm' },
      cm: { factor: 0.01, label: 'cm' },
      m: { factor: 1, label: 'm' },
      metros: { factor: 1, label: 'm' },
      km: { factor: 1000, label: 'km' },
      kilometros: { factor: 1000, label: 'km' },
      in: { factor: 0.0254, label: 'pulgadas' },
      pulgadas: { factor: 0.0254, label: 'pulgadas' },
      ft: { factor: 0.3048, label: 'pies' },
      pies: { factor: 0.3048, label: 'pies' },
      yd: { factor: 0.9144, label: 'yardas' },
      mi: { factor: 1609.344, label: 'millas' },
      millas: { factor: 1609.344, label: 'millas' },
      miles: { factor: 1609.344, label: 'millas' }
    }
  },
  {
    category: 'peso',
    units: {
      mg: { factor: 0.001, label: 'mg' },
      g: { factor: 1, label: 'g' },
      gramos: { factor: 1, label: 'g' },
      kg: { factor: 1000, label: 'kg' },
      kilos: { factor: 1000, label: 'kg' },
      kilogramos: { factor: 1000, label: 'kg' },
      oz: { factor: 28.349523125, label: 'oz' },
      onzas: { factor: 28.349523125, label: 'oz' },
      lb: { factor: 453.59237, label: 'lb' },
      libras: { factor: 453.59237, label: 'lb' },
      ton: { factor: 1000000, label: 'toneladas' },
      t: { factor: 1000000, label: 't' }
    }
  },
  {
    category: 'datos digitales',
    units: {
      b: { factor: 1, label: 'Bytes' },
      bytes: { factor: 1, label: 'Bytes' },
      kb: { factor: 1024, label: 'KB' },
      mb: { factor: 1024 ** 2, label: 'MB' },
      gb: { factor: 1024 ** 3, label: 'GB' },
      tb: { factor: 1024 ** 4, label: 'TB' }
    }
  },
  {
    category: 'velocidad',
    units: {
      'km/h': { factor: 1 / 3.6, label: 'km/h' },
      kmh: { factor: 1 / 3.6, label: 'km/h' },
      'm/s': { factor: 1, label: 'm/s' },
      ms: { factor: 1, label: 'm/s' },
      mph: { factor: 0.44704, label: 'mph' }
    }
  },
  {
    category: 'tiempo',
    units: {
      s: { factor: 1, label: 'segundos' },
      seg: { factor: 1, label: 'segundos' },
      segundos: { factor: 1, label: 'segundos' },
      min: { factor: 60, label: 'minutos' },
      minutos: { factor: 60, label: 'minutos' },
      h: { factor: 3600, label: 'horas' },
      horas: { factor: 3600, label: 'horas' },
      dias: { factor: 86400, label: 'días' },
      days: { factor: 86400, label: 'días' }
    }
  }
];

function convertLinearUnit(
  val: number,
  from: string,
  to: string
): { value: number; category: string; fromLabel: string; toLabel: string } | null {
  for (const group of LINEAR_UNITS) {
    const f = group.units[from];
    const t = group.units[to];
    if (f && t && from !== to) {
      const baseValue = val * f.factor;
      return {
        value: baseValue / t.factor,
        category: group.category,
        fromLabel: f.label,
        toLabel: t.label
      };
    }
  }
  return null;
}
