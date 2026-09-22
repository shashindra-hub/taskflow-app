const HEADERS = { 'User-Agent': 'Mozilla/5.0 (TaskFlow screener)' };
const TIMEOUT_MS = 15000;

// OCC option symbol: root, YYMMDD expiry, C/P, strike x 1000 (8 digits).
const OCC_PATTERN = /^([A-Z.]+)(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/;

async function getJson(url, fetchImpl, what) {
  let res;
  try {
    res = await fetchImpl(url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    throw new Error(`${what}: ${err.message}`);
  }
  if (!res.ok) throw new Error(`${what}: HTTP ${res.status}`);
  return res.json();
}

/** Date (YYYY-MM-DD) in the given UTC offset, e.g. an exchange's local date. */
export function localDate(unixSeconds, gmtOffset) {
  return new Date((unixSeconds + gmtOffset) * 1000).toISOString().slice(0, 10);
}

/**
 * About a year of daily bars from Yahoo Finance. The last bar is today's
 * session while the market is open.
 */
export async function fetchDailyHistory(symbol, { fetchImpl = globalThis.fetch } = {}) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`;
  const body = await getJson(url, fetchImpl, `${symbol} price history`);
  const result = body?.chart?.result?.[0];
  if (!result) throw new Error(`${symbol} price history: no data`);

  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const bars = (result.timestamp ?? [])
    .map((time, i) => ({ time, close: closes[i] }))
    .filter((bar) => bar.close !== null && bar.close !== undefined);
  const gmtOffset = result.meta?.gmtoffset ?? 0;

  return {
    symbol,
    price: result.meta?.regularMarketPrice ?? bars[bars.length - 1]?.close,
    lastBarDate: bars.length ? localDate(bars[bars.length - 1].time, gmtOffset) : null,
    bars,
  };
}

/** Put options from Cboe's free delayed quotes (about 15 minutes behind), with greeks. */
export async function fetchPuts(symbol, { fetchImpl = globalThis.fetch } = {}) {
  const url = `https://cdn.cboe.com/api/global/delayed_quotes/options/${encodeURIComponent(symbol)}.json`;
  const body = await getJson(url, fetchImpl, `${symbol} option chain`);
  const options = body?.data?.options ?? [];

  return options.flatMap((o) => {
    const m = OCC_PATTERN.exec(o.option ?? '');
    if (!m || m[5] !== 'P') return [];
    return [
      {
        contract: o.option,
        expiration: `20${m[2]}-${m[3]}-${m[4]}`,
        strike: Number(m[6]) / 1000,
        bid: o.bid ?? 0,
        ask: o.ask ?? 0,
        delta: o.delta ?? null,
        openInterest: o.open_interest ?? 0,
      },
    ];
  });
}
