import { useEffect, useId, useRef, useState } from 'react';
import { stockApi } from './stockApi.js';

const DEBOUNCE_MS = 250;

export default function StockSearch({ onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = useId();
  const skipNextSearch = useRef(false);

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return undefined;
    }
    const q = query.trim();
    if (!q) {
      setResults([]);
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const found = await stockApi.search(q, { signal: controller.signal });
        setResults(found);
        setActiveIndex(-1);
        setOpen(true);
      } catch (err) {
        if (err.name !== 'AbortError') setResults([]);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function choose(symbol) {
    // Filling the box with the chosen symbol shouldn't trigger another search.
    if (symbol !== query) skipNextSearch.current = true;
    setQuery(symbol);
    setOpen(false);
    setResults([]);
    onSelect(symbol);
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown' && results.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp' && results.length > 0) {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && activeIndex >= 0) choose(results[activeIndex].symbol);
      else if (query.trim()) choose(query.trim().toUpperCase());
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const showList = open && results.length > 0;

  return (
    <div className="stock-search">
      <svg className="stock-search-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="text"
        role="combobox"
        placeholder="Search stocks, e.g. AMZN or Apple"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label="Stock symbol or company name"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        autoComplete="off"
        spellCheck={false}
        data-testid="stock-search-input"
      />
      {showList && (
        <ul className="stock-search-results" id={listId} role="listbox" data-testid="stock-search-results">
          {results.map((item, i) => (
            <li
              key={item.symbol}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className={i === activeIndex ? 'active' : ''}
              // mousedown (not click) so the choice lands before the input's blur closes the list
              onMouseDown={(e) => {
                e.preventDefault();
                choose(item.symbol);
              }}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <span className="result-symbol">{item.symbol}</span>
              <span className="result-name">{item.name}</span>
              <span className="result-meta">
                {item.exchange} · {item.type}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
