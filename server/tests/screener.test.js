import { ema } from '../src/indicators.js';
import {
  RULES,
  daysToExpiration,
  evaluateTechnicals,
  formatMessage,
  pickPut,
  screenSymbol,
} from '../src/screener/screener.js';

const TODAY = '2026-09-22';

describe('ema', () => {
  test('seeds with the SMA, then weights recent values more', () => {
    // k = 2 / (3 + 1) = 0.5; seed = mean(1, 2, 3) = 2; then 10*0.5 + 2*0.5 = 6
    expect(ema([1, 2, 3, 10], 3)).toEqual([null, null, 2, 6]);
  });

  test('returns all nulls when there is not enough data', () => {
    expect(ema([1, 2], 3)).toEqual([null, null]);
  });
});

describe('evaluateTechnicals', () => {
  // 60 flat days at 100, then a slide: price ends below EMA50 with a soft RSI.
  const closes = [...new Array(60).fill(100), 99, 100, 98, 99.5, 97.5, 98.5, 97, 98, 96.5];

  test('flags a red day below the EMA with RSI in range', () => {
    const t = evaluateTechnicals({ price: 96.5, previousClose: 98, closes });
    expect(t.redDay).toBe(true);
    expect(t.changePercent).toBeCloseTo(-1.53, 2);
    expect(t.belowEma).toBe(true);
    expect(t.rsi).toBeGreaterThanOrEqual(30);
    expect(t.rsi).toBeLessThanOrEqual(50);
    expect(t.rsiInRange).toBe(true);
  });

  test('uses the live price in place of the last bar', () => {
    const t = evaluateTechnicals({ price: 110, previousClose: 98, closes });
    expect(t.redDay).toBe(false);
    expect(t.belowEma).toBe(false);
    expect(t.rsiInRange).toBe(false);
  });
});

describe('pickPut', () => {
  const put = (expiration, strike, delta, bid) => ({ expiration, strike, delta, bid, ask: bid + 0.1 });

  test('daysToExpiration counts calendar days', () => {
    expect(daysToExpiration('2026-10-23', TODAY)).toBe(31);
  });

  test('picks the expiry nearest 30 DTE, then the strike nearest 0.30 delta', () => {
    const picked = pickPut(
      [
        put('2026-10-16', 95, -0.3, 2.5), // 24 DTE
        put('2026-10-23', 90, -0.2, 1.5), // 31 DTE
        put('2026-10-23', 95, -0.31, 2.1),
        put('2026-10-23', 100, -0.45, 4.0),
        put('2026-11-20', 95, -0.3, 3.5), // 59 DTE
      ],
      TODAY
    );
    expect(picked).toMatchObject({ expiration: '2026-10-23', strike: 95, dte: 31, collateral: 9500, premium: 210 });
    expect(picked.yieldPercent).toBeCloseTo(2.21, 2);
    expect(picked.meetsYield).toBe(true);
  });

  test('measures yield from the bid and requires at least 2%', () => {
    const picked = pickPut([put('2026-10-23', 100, -0.3, 1.99)], TODAY);
    expect(picked.meetsYield).toBe(false);
    expect(pickPut([put('2026-10-23', 100, -0.3, 2.0)], TODAY).meetsYield).toBe(true);
  });

  test('ignores contracts with no bid, no delta or already expired', () => {
    expect(
      pickPut([put('2026-10-23', 100, -0.3, 0), put('2026-10-23', 100, null, 3), put(TODAY, 100, -0.3, 3)], TODAY)
    ).toBeNull();
  });
});

describe('screenSymbol', () => {
  function yahooBody(dates, closes) {
    return {
      chart: {
        result: [
          {
            meta: { gmtoffset: -14400, regularMarketPrice: closes.at(-1) },
            timestamp: dates.map((d) => Date.parse(`${d}T13:30:00Z`) / 1000),
            indicators: { quote: [{ close: closes }] },
          },
        ],
      },
    };
  }

  function fakeFetch(routes) {
    return async (url) => {
      const [, body] = Object.entries(routes).find(([key]) => url.includes(key)) ?? [];
      if (!body) return { ok: false, status: 404, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => body };
    };
  }

  const dates = Array.from({ length: 70 }, (_, i) => new Date(Date.parse(TODAY) - (69 - i) * 86400000).toISOString().slice(0, 10));
  const closes = [...new Array(61).fill(100), 99, 100, 98, 99.5, 97.5, 98.5, 97, 98, 96.5];

  test('matches when all three checks pass', async () => {
    const fetchImpl = fakeFetch({
      'finance.yahoo.com': yahooBody(dates, closes),
      'cboe.com': { data: { options: [{ option: 'ABC261023P00093000', bid: 2.0, ask: 2.1, delta: -0.3 }] } },
    });
    const r = await screenSymbol('ABC', TODAY, { fetchImpl });
    expect(r.error).toBeUndefined();
    expect(r.technicals.previousClose).toBe(98);
    expect(r.put).toMatchObject({ strike: 93, dte: 31 });
    expect(r.match).toBe(true);
  });

  test('reports a closed market when the last bar is not today', async () => {
    const fetchImpl = fakeFetch({ 'finance.yahoo.com': yahooBody(dates.slice(0, -1), closes.slice(0, -1)) });
    expect(await screenSymbol('ABC', TODAY, { fetchImpl })).toEqual({ symbol: 'ABC', marketClosed: true });
  });

  test('returns an error instead of throwing when data is missing', async () => {
    const r = await screenSymbol('ABC', TODAY, { fetchImpl: fakeFetch({}) });
    expect(r.error).toMatch(/ABC price history: HTTP 404/);
  });
});

describe('formatMessage', () => {
  const runAt = new Date('2026-09-22T14:00:00Z'); // 9:00 AM CDT
  const technicals = (overrides) => ({
    price: 95,
    previousClose: 97,
    changePercent: -2.06,
    redDay: true,
    ema: 99,
    emaGapPercent: -4.04,
    belowEma: true,
    rsi: 41.6,
    rsiInRange: true,
    ...overrides,
  });
  const put = { expiration: '2026-10-23', strike: 93, delta: -0.3, dte: 31, bid: 2.0, premium: 200, collateral: 9300, yieldPercent: 2.15, meetsYield: true };

  test('lists matches with the put to sell, then why the others failed', () => {
    const message = formatMessage(
      [
        { symbol: 'NVDA', technicals: technicals(), put, match: true },
        { symbol: 'TSLA', technicals: technicals({ price: 380, changePercent: 1.2, redDay: false, belowEma: false, rsi: 60.2, rsiInRange: false }), put, match: false },
        { symbol: 'HOOD', technicals: technicals(), put: { ...put, yieldPercent: 1.4, meetsYield: false }, match: false },
        { symbol: 'SOXL', error: 'HTTP 500' },
      ],
      runAt,
      RULES
    );

    expect(message).toBe(
      [
        'Put screener · Tue, Sep 22, 9:00 AM CT',
        '',
        '✅ NVDA $95.00 ▼2.1%',
        'RSI 42 · 4.0% below EMA50',
        'Sell Oct 23 $93 put · Δ0.30 · 31 DTE',
        'Bid $2.00 → $200 on $9,300 (2.1%)',
        '',
        'TSLA $380.00 ▲1.2% · green · above EMA50 · RSI 60',
        'HOOD $95.00 ▼2.1% · put 1.4%',
        'SOXL: data unavailable',
        '',
        'Options ~15 min delayed. Not advice.',
      ].join('\n')
    );
  });

  test('says so when nothing matches', () => {
    const message = formatMessage([{ symbol: 'SOXL', error: 'x' }], runAt, RULES);
    expect(message).toContain('No setups today (0/1).');
  });
});
