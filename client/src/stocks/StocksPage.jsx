import { useEffect, useState } from 'react';
import StockChart from './StockChart.jsx';
import StockSearch from './StockSearch.jsx';
import { RANGES, stockApi } from './stockApi.js';
import { COLORS, OVERLAYS } from './series.js';
import { formatChange, formatPercent, formatPrice, formatTime, formatVolume } from './format.js';
import './stocks.css';

const DEFAULT_SYMBOL = 'AMZN';

function IndicatorPanel({ data, point }) {
  const p = point ?? data.points[data.points.length - 1];
  const changePercent = ((p.close - data.baseline) / data.baseline) * 100;
  const rows = [
    // Matches the price line, which is colored by the change over the whole range.
    {
      label: 'Price',
      value: formatPrice(p.close, data.currency),
      color: data.change >= 0 ? COLORS.up : COLORS.down,
    },
    {
      label: 'Change',
      value: formatPercent(changePercent),
      color: changePercent >= 0 ? COLORS.up : COLORS.down,
    },
    { label: 'Volume', value: formatVolume(p.volume), color: COLORS.down },
    ...OVERLAYS.map(({ key, label, color }) => ({
      label,
      value: formatPrice(p[key], data.currency),
      color,
    })),
    { label: 'RSI(14)', value: p.rsi === null ? '—' : p.rsi.toFixed(2), color: COLORS.rsi },
  ];

  return (
    <aside className="indicator-panel" aria-label="Indicators" data-testid="indicator-panel">
      <h2>Indicators</h2>
      <p className="indicator-time" data-testid="indicator-time">
        {formatTime(p.time, data.gmtOffset, data.intraday)}
      </p>
      <dl>
        {rows.map((row) => (
          <div className="indicator-row" key={row.label}>
            <dt>
              <span className="dot" style={{ background: row.color }} aria-hidden="true" />
              {row.label}
            </dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

export default function StocksPage() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [range, setRange] = useState('1D');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hoverPoint, setHoverPoint] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    stockApi
      .chart(symbol, range, { signal: controller.signal })
      .then((result) => {
        setData(result);
        setHoverPoint(null);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [symbol, range]);

  const up = (data?.change ?? 0) >= 0;

  return (
    <div className="stocks-page">
      <header className="stocks-header">
        <div className="quote" data-testid="stock-quote">
          {data ? (
            <>
              <h1>
                {data.symbol} <span className="quote-price">{formatPrice(data.price, data.currency)}</span>{' '}
                <span className={`quote-change ${up ? 'up' : 'down'}`} data-testid="stock-change">
                  {formatChange(data.change, data.currency)} ({formatPercent(data.changePercent)})
                </span>
              </h1>
              <p className="quote-name">
                {data.name} · {data.exchange} · {range}
              </p>
            </>
          ) : (
            <h1>{symbol}</h1>
          )}
        </div>
        <StockSearch onSelect={setSymbol} />
      </header>

      <div className="range-bar" role="group" aria-label="Chart range">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            className={r === range ? 'active' : ''}
            aria-pressed={r === range}
            onClick={() => setRange(r)}
            data-testid={`range-${r}`}
          >
            {r}
          </button>
        ))}
      </div>

      {error && (
        <p className="stocks-error" role="alert" data-testid="stock-error">
          {error}
        </p>
      )}

      <div className="stocks-body">
        {data && <IndicatorPanel data={data} point={hoverPoint} />}
        <div className="chart-area" aria-busy={loading}>
          <div className="chart-labels" aria-hidden="true">
            <span>MA(50, 200) · BOLL(20, 2)</span>
            <span className="rsi-label">RSI(14)</span>
          </div>
          <StockChart data={data} onHover={setHoverPoint} />
          {loading && (
            <div className="chart-loading" data-testid="stock-loading">
              Loading {symbol}…
            </div>
          )}
        </div>
      </div>

      <p className="stocks-footnote">
        Market data from Yahoo Finance, may be delayed. Not investment advice.
      </p>
    </div>
  );
}
