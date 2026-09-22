import { bollinger, rsi, sma } from './indicators.js';

const YAHOO_BASE_URL = 'https://query1.finance.yahoo.com';
const REQUEST_TIMEOUT_MS = 8000;
const CHART_CACHE_TTL_MS = 30 * 1000;
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;

const SYMBOL_PATTERN = /^[A-Za-z0-9.^=-]{1,15}$/;
const SEARCHABLE_TYPES = new Set(['EQUITY', 'ETF', 'INDEX', 'MUTUALFUND', 'CRYPTOCURRENCY']);

/**
 * Each display range fetches more history than it shows, so the long moving
 * averages (MA200) already have values at the left edge of the chart.
 */
export const RANGES = {
  '1D': { fetchRange: '5d', interval: '5m', intraday: true },
  '1W': { fetchRange: '1mo', interval: '30m', intraday: true },
  '1M': { fetchRange: '1y', interval: '1d', intraday: false },
  '3M': { fetchRange: '2y', interval: '1d', intraday: false },
  YTD: { fetchRange: '2y', interval: '1d', intraday: false },
  '1Y': { fetchRange: '2y', interval: '1d', intraday: false },
  '5Y': { fetchRange: '10y', interval: '1wk', intraday: false },
  MAX: { fetchRange: 'max', interval: '1mo', intraday: false },
};

export class StockValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StockValidationError';
  }
}

export class StockNotFoundError extends Error {
  constructor(symbol) {
    super(`No data found for symbol '${symbol}'.`);
    this.name = 'StockNotFoundError';
  }
}

export class UpstreamError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UpstreamError';
  }
}

const round = (value, digits = 4) =>
  value === null || value === undefined ? null : Number(value.toFixed(digits));

/** Unix seconds at which the visible window for `range` starts. */
export function windowStart(range, lastTime, gmtOffset) {
  const local = new Date((lastTime + gmtOffset) * 1000);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const day = local.getUTCDate();
  const monthsBack = { '1M': 1, '3M': 3, '1Y': 12, '5Y': 60 }[range];

  if (range === '1D') return Date.UTC(year, month, day) / 1000 - gmtOffset;
  if (range === '1W') return lastTime - 7 * 86400;
  if (range === 'YTD') return Date.UTC(year, 0, 1) / 1000 - gmtOffset;
  if (monthsBack) return Date.UTC(year, month - monthsBack, day) / 1000 - gmtOffset;
  return -Infinity;
}

export function buildChart(result, range) {
  const { meta = {}, timestamp = [], indicators = {} } = result;
  const quote = indicators.quote?.[0] ?? {};

  const bars = timestamp
    .map((time, i) => ({
      time,
      open: quote.open?.[i] ?? null,
      high: quote.high?.[i] ?? null,
      low: quote.low?.[i] ?? null,
      close: quote.close?.[i] ?? null,
      volume: quote.volume?.[i] ?? 0,
    }))
    .filter((bar) => bar.close !== null);

  if (bars.length === 0) throw new StockNotFoundError(meta.symbol ?? 'unknown');

  const closes = bars.map((bar) => bar.close);
  const ma50 = sma(closes, 50);
  const ma200 = sma(closes, 200);
  const bands = bollinger(closes, 20, 2);
  const rsi14 = rsi(closes, 14);

  const gmtOffset = meta.gmtoffset ?? 0;
  const start = windowStart(range, bars[bars.length - 1].time, gmtOffset);
  let firstVisible = bars.findIndex((bar) => bar.time >= start);
  if (firstVisible === -1) firstVisible = 0;

  const points = bars.slice(firstVisible).map((bar, offset) => {
    const i = firstVisible + offset;
    return {
      time: bar.time,
      open: round(bar.open),
      high: round(bar.high),
      low: round(bar.low),
      close: round(bar.close),
      volume: bar.volume,
      ma50: round(ma50[i]),
      ma200: round(ma200[i]),
      bollUpper: round(bands[i].upper),
      bollMiddle: round(bands[i].middle),
      bollLower: round(bands[i].lower),
      rsi: round(rsi14[i], 2),
    };
  });

  // Change is measured from the last close before the window (for 1D that is
  // the previous session's close), falling back to the first visible bar.
  const baseline = firstVisible > 0 ? closes[firstVisible - 1] : closes[0];
  const price = meta.regularMarketPrice ?? closes[closes.length - 1];
  const change = price - baseline;

  return {
    symbol: meta.symbol,
    name: meta.longName || meta.shortName || meta.symbol,
    currency: meta.currency ?? 'USD',
    exchange: meta.fullExchangeName ?? meta.exchangeName ?? '',
    range,
    interval: RANGES[range].interval,
    intraday: RANGES[range].intraday,
    gmtOffset,
    price: round(price),
    baseline: round(baseline),
    change: round(change),
    changePercent: round((change / baseline) * 100, 2),
    points,
  };
}

/**
 * Stock data backed by Yahoo Finance's public endpoints. `fetchImpl` is
 * injectable so tests never touch the network.
 */
export function createStockService({ fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  const cache = new Map();

  async function cached(key, ttl, load) {
    const hit = cache.get(key);
    if (hit && hit.expires > now()) return hit.value;
    const value = await load();
    if (cache.size >= MAX_CACHE_ENTRIES) cache.clear();
    cache.set(key, { value, expires: now() + ttl });
    return value;
  }

  async function getJson(url) {
    let res;
    try {
      res = await fetchImpl(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (TaskFlow)' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      throw new UpstreamError(`Could not reach the market data provider: ${err.message}`);
    }
    const body = await res.json().catch(() => null);
    return { res, body };
  }

  async function search(query) {
    const q = String(query ?? '').trim();
    if (!q) return [];
    if (q.length > 50) throw new StockValidationError('Search query is too long.');

    return cached(`search:${q.toLowerCase()}`, SEARCH_CACHE_TTL_MS, async () => {
      const params = new URLSearchParams({ q, quotesCount: '8', newsCount: '0', listsCount: '0' });
      const { res, body } = await getJson(`${YAHOO_BASE_URL}/v1/finance/search?${params}`);
      if (!res.ok || !body) throw new UpstreamError(`Search failed with status ${res.status}.`);

      return (body.quotes ?? [])
        .filter((item) => item.symbol && SEARCHABLE_TYPES.has(item.quoteType))
        .map((item) => ({
          symbol: item.symbol,
          name: item.longname || item.shortname || item.symbol,
          exchange: item.exchDisp || item.exchange || '',
          type: item.typeDisp || item.quoteType,
        }));
    });
  }

  async function chart(symbol, range) {
    if (!SYMBOL_PATTERN.test(symbol ?? '')) throw new StockValidationError('Invalid stock symbol.');
    if (!RANGES[range]) {
      throw new StockValidationError(`range must be one of ${Object.keys(RANGES).join(', ')}.`);
    }
    const upper = symbol.toUpperCase();

    return cached(`chart:${upper}:${range}`, CHART_CACHE_TTL_MS, async () => {
      const { fetchRange, interval } = RANGES[range];
      const params = new URLSearchParams({ range: fetchRange, interval });
      const { res, body } = await getJson(
        `${YAHOO_BASE_URL}/v8/finance/chart/${encodeURIComponent(upper)}?${params}`
      );

      const result = body?.chart?.result?.[0];
      if (res.status === 404 || (res.ok && !result)) throw new StockNotFoundError(upper);
      if (!res.ok || !result) throw new UpstreamError(`Chart request failed with status ${res.status}.`);
      return buildChart(result, range);
    });
  }

  return { search, chart };
}
