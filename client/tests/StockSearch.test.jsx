import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import StockSearch from '../src/stocks/StockSearch.jsx';
import { stockApi } from '../src/stocks/stockApi.js';

vi.mock('../src/stocks/stockApi.js', () => ({
  stockApi: { search: vi.fn(), chart: vi.fn() },
}));

const matches = [
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', type: 'Equity' },
  { symbol: 'APLE', name: 'Apple Hospitality REIT', exchange: 'NYSE', type: 'Equity' },
];

describe('StockSearch', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test('suggests matching stocks as you type and selects one on click', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    stockApi.search.mockResolvedValue(matches);
    render(<StockSearch onSelect={onSelect} />);

    await user.type(screen.getByTestId('stock-search-input'), 'apple');
    const options = await screen.findAllByRole('option');

    expect(options).toHaveLength(2);
    // Debounced: one request for the whole word, not one per keystroke.
    expect(stockApi.search).toHaveBeenCalledTimes(1);
    expect(stockApi.search).toHaveBeenCalledWith('apple', expect.anything());

    await user.click(screen.getByText('Apple Hospitality REIT'));
    expect(onSelect).toHaveBeenCalledWith('APLE');
    expect(screen.getByTestId('stock-search-input')).toHaveValue('APLE');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  test('supports arrow keys and Enter', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    stockApi.search.mockResolvedValue(matches);
    render(<StockSearch onSelect={onSelect} />);

    await user.type(screen.getByTestId('stock-search-input'), 'apple');
    await screen.findAllByRole('option');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('APLE');
  });

  test('Enter without a highlighted suggestion uses the typed ticker', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    stockApi.search.mockResolvedValue([]);
    render(<StockSearch onSelect={onSelect} />);

    await user.type(screen.getByTestId('stock-search-input'), 'tsla{Enter}');
    expect(onSelect).toHaveBeenCalledWith('TSLA');
  });

  test('closes the list on Escape', async () => {
    const user = userEvent.setup();
    stockApi.search.mockResolvedValue(matches);
    render(<StockSearch onSelect={vi.fn()} />);

    await user.type(screen.getByTestId('stock-search-input'), 'apple');
    await screen.findByRole('listbox');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  });
});
