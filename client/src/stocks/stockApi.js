import { handleResponse } from '../api.js';

const BASE_URL = '/api/stocks';

export const RANGES = ['1D', '1W', '1M', '3M', 'YTD', '1Y', '5Y', 'MAX'];

export const stockApi = {
  async search(query, { signal } = {}) {
    const res = await fetch(`${BASE_URL}/search?q=${encodeURIComponent(query)}`, { signal });
    return handleResponse(res);
  },

  async chart(symbol, range, { signal } = {}) {
    const res = await fetch(
      `${BASE_URL}/${encodeURIComponent(symbol)}/chart?range=${encodeURIComponent(range)}`,
      { signal }
    );
    return handleResponse(res);
  },
};
