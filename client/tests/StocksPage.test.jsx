import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import StocksPage from '../src/stocks/StocksPage.jsx';
import { stockApi } from '../src/stocks/stockApi.js';

vi.mock('../src/stocks/stockApi.js', () => ({
  RANGES: ['1D', '1W', '1M', '3M', 'YTD', '1Y', '5Y', 'MAX'],
  stockApi: { search: vi.fn(), chart: vi.fn() },
}));

// The canvas chart can't render in jsdom; a stub lets tests drive hover events.
vi.mock('../src/stocks/StockChart.jsx', () => ({
  default: ({ data, onHover }) => (
    <button type="button" data-testid="stock-chart" onClick={() => onHover(data.points[0])}>
      chart
    </button>
  ),
}));

function chartData(overrides = {}) {
  return {
    symbol: 'AMZN',
    name: 'Amazon.com, Inc.',
    currency: 'USD',
    exchange: 'NasdaqGS',
    range: '1D',
    intraday: true,
    gmtOffset: -14400,
    price: 254.98,
    baseline: 258.43,
    change: -3.45,
    changePercent: -1.33,
    points: [
      { time: 1790084400, open: 258, high: 258, low: 258, close: 258.0, volume: 1500000, ma50: 255.5, ma200: 254.1, bollUpper: 260, bollMiddle: 256, bollLower: 252, rsi: 40 },
      { time: 1790107200, open: 255, high: 255, low: 255, close: 254.98, volume: 2100000, ma50: 255.02, ma200: 255.77, bollUpper: 256.3, bollMiddle: 255.46, bollLower: 254.61, rsi: 43.2 },
    ],
    ...overrides,
  };
}

describe('StocksPage', () => {
  beforeEach(() => {
    stockApi.chart.mockResolvedValue(chartData());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('loads AMZN for 1 day and shows the quote and latest indicators', async () => {
    render(<StocksPage />);

    expect(await screen.findByTestId('stock-change')).toHaveTextContent('-$3.45 (-1.33%)');
    expect(stockApi.chart).toHaveBeenCalledWith('AMZN', '1D', expect.anything());
    expect(screen.getByTestId('stock-quote')).toHaveTextContent('AMZN $254.98');
    const panel = screen.getByTestId('indicator-panel');
    expect(panel).toHaveTextContent('MA(200)$255.77');
    expect(panel).toHaveTextContent('RSI(14)43.20');
    expect(panel).toHaveTextContent('Volume2.1M');
    expect(screen.getByTestId('range-1D')).toHaveAttribute('aria-pressed', 'true');
  });

  test('switching range refetches the chart', async () => {
    const user = userEvent.setup();
    render(<StocksPage />);
    await screen.findByTestId('indicator-panel');

    stockApi.chart.mockResolvedValue(chartData({ range: '3M', intraday: false, change: 10.59, changePercent: 4.33 }));
    await user.click(screen.getByTestId('range-3M'));

    expect(stockApi.chart).toHaveBeenLastCalledWith('AMZN', '3M', expect.anything());
    expect(await screen.findByText('+$10.59 (+4.33%)')).toBeInTheDocument();
    expect(screen.getByTestId('range-3M')).toHaveAttribute('aria-pressed', 'true');
  });

  test('indicator panel follows the hovered point', async () => {
    const user = userEvent.setup();
    render(<StocksPage />);
    await screen.findByTestId('indicator-panel');

    await user.click(screen.getByTestId('stock-chart'));

    const panel = screen.getByTestId('indicator-panel');
    expect(panel).toHaveTextContent('Price$258.00');
    expect(panel).toHaveTextContent('Change-0.17%');
  });

  test('picking a stock from search loads its chart', async () => {
    const user = userEvent.setup();
    stockApi.search.mockResolvedValue([{ symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', type: 'Equity' }]);
    render(<StocksPage />);
    await screen.findByTestId('indicator-panel');

    await user.type(screen.getByTestId('stock-search-input'), 'micro');
    await user.click(await screen.findByText('Microsoft Corporation'));

    await waitFor(() => expect(stockApi.chart).toHaveBeenLastCalledWith('MSFT', '1D', expect.anything()));
  });

  test('shows an error when the chart cannot be loaded', async () => {
    stockApi.chart.mockRejectedValue(new Error("No data found for symbol 'NOPE'."));
    render(<StocksPage />);

    expect(await screen.findByTestId('stock-error')).toHaveTextContent("No data found for symbol 'NOPE'.");
    expect(screen.queryByTestId('stock-loading')).not.toBeInTheDocument();
  });
});
