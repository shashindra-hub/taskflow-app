import { Suspense, lazy, useEffect, useState } from 'react';
import App from './App.jsx';

// Loaded on demand so the charting library only downloads when Stocks is opened.
const StocksPage = lazy(() => import('./stocks/StocksPage.jsx'));

const PAGES = [
  { id: 'tasks', label: 'Tasks', href: '#/' },
  { id: 'stocks', label: 'Stocks', href: '#/stocks' },
];

function readPage() {
  return window.location.hash.startsWith('#/stocks') ? 'stocks' : 'tasks';
}

export default function Root() {
  const [page, setPage] = useState(readPage);

  useEffect(() => {
    const onHashChange = () => setPage(readPage());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    document.body.dataset.page = page;
  }, [page]);

  return (
    <>
      <nav className="top-nav" aria-label="Main">
        <span className="top-nav-brand">TaskFlow</span>
        {PAGES.map(({ id, label, href }) => (
          <a key={id} href={href} aria-current={page === id ? 'page' : undefined} data-testid={`nav-${id}`}>
            {label}
          </a>
        ))}
      </nav>
      {page === 'stocks' ? (
        <Suspense fallback={<p className="page-loading">Loading…</p>}>
          <StocksPage />
        </Suspense>
      ) : (
        <App />
      )}
    </>
  );
}
