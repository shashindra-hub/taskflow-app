import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { TaskStore } from '../src/taskStore.js';
import {
  StockNotFoundError,
  StockValidationError,
  UpstreamError,
  createStockService,
  windowStart,
} from '../src/stocks.js';

const NEW_YORK_OFFSET = -4 * 3600; // EDT

/** Builds a Yahoo-shaped chart result: one bar every 5 minutes, 9:30-16:00 ET. */
function intradayResult(days) {
  const timestamp = [];
  const close = [];
  days.forEach(({ date, price }) => {
    const open = Date.parse(`${date}T13:30:00Z`) / 1000;
    for (let i = 0; i <= 78; i++) {
      timestamp.push(open + i * 300);
      close.push(price + i * 0.01);
    }
  });
  return {
    meta: {
      symbol: 'AMZN',
      longName: 'Amazon.com, Inc.',
      currency: 'USD',
      fullExchangeName: 'NasdaqGS',
      gmtoffset: NEW_YORK_OFFSET,
      regularMarketPrice: close[close.length - 1],
    },
    timestamp,
    indicators: {
      quote: [{ open: close, high: close, low: close, close, volume: close.map(() => 1000) }],
    },
  };
}

function fakeFetch(responses) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const { status = 200, body } = responses(url);
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return { fetchImpl, calls };
}

describe('windowStart', () => {
  const last = Date.parse('2026-09-22T20:00:00Z') / 1000;

  test('1D starts at local midnight of the last bar', () => {
    expect(windowStart('1D', last, NEW_YORK_OFFSET)).toBe(Date.parse('2026-09-22T04:00:00Z') / 1000);
  });

  test('YTD starts on January 1st and 3M goes back three months', () => {
    expect(windowStart('YTD', last, NEW_YORK_OFFSET)).toBe(Date.parse('2026-01-01T04:00:00Z') / 1000);
    expect(windowStart('3M', last, NEW_YORK_OFFSET)).toBe(Date.parse('2026-06-22T04:00:00Z') / 1000);
  });

  test('MAX keeps everything', () => {
    expect(windowStart('MAX', last, NEW_YORK_OFFSET)).toBe(-Infinity);
  });
});

describe('stock service chart', () => {
  test('returns only the last session for 1D, measured from the previous close', async () => {
    const result = intradayResult([
      { date: '2026-09-21', price: 100 },
      { date: '2026-09-22', price: 110 },
    ]);
    const { fetchImpl, calls } = fakeFetch(() => ({ body: { chart: { result: [result] } } }));
    const chart = await createStockService({ fetchImpl }).chart('amzn', '1D');

    expect(calls[0]).toContain('/v8/finance/chart/AMZN?range=5d&interval=5m');
    expect(chart.points).toHaveLength(79);
    expect(chart.points[0].time).toBe(Date.parse('2026-09-22T13:30:00Z') / 1000);
    expect(chart.baseline).toBe(100.78); // last close of Sep 21
    expect(chart.price).toBe(110.78);
    expect(chart.change).toBe(10);
    expect(chart).toMatchObject({ symbol: 'AMZN', name: 'Amazon.com, Inc.', intraday: true });
  });

  test('computes indicators from history before the visible window', async () => {
    const result = intradayResult([
      { date: '2026-09-17', price: 80 },
      { date: '2026-09-18', price: 90 },
      { date: '2026-09-21', price: 100 },
      { date: '2026-09-22', price: 110 },
    ]);
    const { fetchImpl } = fakeFetch(() => ({ body: { chart: { result: [result] } } }));
    const { points } = await createStockService({ fetchImpl }).chart('AMZN', '1D');

    // 237 earlier bars exist, so MA(50) and MA(200) are filled from the first visible bar on.
    expect(points[0].ma50).not.toBeNull();
    expect(points[0].ma200).not.toBeNull();
    expect(points[0].rsi).not.toBeNull();
  });

  test('skips bars with no close price', async () => {
    const result = intradayResult([{ date: '2026-09-22', price: 50 }]);
    result.indicators.quote[0].close[5] = null;
    const { fetchImpl } = fakeFetch(() => ({ body: { chart: { result: [result] } } }));
    const { points } = await createStockService({ fetchImpl }).chart('AMZN', '1D');
    expect(points).toHaveLength(78);
  });

  test('caches repeated requests', async () => {
    const result = intradayResult([{ date: '2026-09-22', price: 50 }]);
    const { fetchImpl, calls } = fakeFetch(() => ({ body: { chart: { result: [result] } } }));
    const service = createStockService({ fetchImpl });
    await service.chart('AMZN', '1D');
    await service.chart('amzn', '1D');
    expect(calls).toHaveLength(1);
  });

  test('rejects bad symbols and ranges without calling the provider', async () => {
    const { fetchImpl, calls } = fakeFetch(() => ({ body: {} }));
    const service = createStockService({ fetchImpl });
    await expect(service.chart('AM ZN', '1D')).rejects.toThrow(StockValidationError);
    await expect(service.chart('AMZN', '2D')).rejects.toThrow(StockValidationError);
    expect(calls).toHaveLength(0);
  });

  test('maps provider 404s to StockNotFoundError and outages to UpstreamError', async () => {
    const notFound = fakeFetch(() => ({ status: 404, body: { chart: { result: null, error: { code: 'Not Found' } } } }));
    await expect(createStockService(notFound).chart('NOPE', '1D')).rejects.toThrow(StockNotFoundError);

    const down = fakeFetch(() => ({ status: 503, body: null }));
    await expect(createStockService(down).chart('AMZN', '1D')).rejects.toThrow(UpstreamError);

    const offline = { fetchImpl: async () => { throw new Error('ENOTFOUND'); } };
    await expect(createStockService(offline).chart('AMZN', '1D')).rejects.toThrow(UpstreamError);
  });
});

describe('stock service search', () => {
  test('returns tradable matches and drops other result types', async () => {
    const { fetchImpl, calls } = fakeFetch(() => ({
      body: {
        quotes: [
          { symbol: 'AMZN', longname: 'Amazon.com, Inc.', exchDisp: 'NASDAQ', quoteType: 'EQUITY', typeDisp: 'Equity' },
          { symbol: 'AMZN250101C', shortname: 'Option', quoteType: 'OPTION' },
          { symbol: 'AMZU', shortname: 'Direxion AMZN Bull', exchDisp: 'NASDAQ', quoteType: 'ETF', typeDisp: 'ETF' },
        ],
      },
    }));
    const results = await createStockService({ fetchImpl }).search('  amz ');

    expect(calls[0]).toContain('q=amz');
    expect(results).toEqual([
      { symbol: 'AMZN', name: 'Amazon.com, Inc.', exchange: 'NASDAQ', type: 'Equity' },
      { symbol: 'AMZU', name: 'Direxion AMZN Bull', exchange: 'NASDAQ', type: 'ETF' },
    ]);
  });

  test('returns an empty list for a blank query without calling the provider', async () => {
    const { fetchImpl, calls } = fakeFetch(() => ({ body: {} }));
    expect(await createStockService({ fetchImpl }).search('   ')).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});

describe('stock routes', () => {
  function makeApp(stockService) {
    return createApp(new TaskStore(), { stockService });
  }

  test('GET /api/stocks/search passes the query through', async () => {
    const search = jest.fn().mockResolvedValue([{ symbol: 'AAPL' }]);
    const res = await request(makeApp({ search })).get('/api/stocks/search?q=apple');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ symbol: 'AAPL' }]);
    expect(search).toHaveBeenCalledWith('apple');
  });

  test('GET /api/stocks/:symbol/chart defaults to the 1D range', async () => {
    const chart = jest.fn().mockResolvedValue({ symbol: 'AMZN', points: [] });
    const res = await request(makeApp({ chart })).get('/api/stocks/AMZN/chart');
    expect(res.status).toBe(200);
    expect(chart).toHaveBeenCalledWith('AMZN', '1D');
  });

  test.each([
    [new StockValidationError('bad range'), 400],
    [new StockNotFoundError('NOPE'), 404],
    [new UpstreamError('provider down'), 502],
  ])('maps %s to HTTP %i', async (error, status) => {
    const chart = jest.fn().mockRejectedValue(error);
    const res = await request(makeApp({ chart })).get('/api/stocks/NOPE/chart?range=1D');
    expect(res.status).toBe(status);
    expect(res.body).toEqual({ error: error.message });
  });
});
