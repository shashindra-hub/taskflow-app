# TaskFlow

A small, fully functional full-stack task manager, built to showcase an automated
code pipeline with unit tests, integration/E2E tests, and CI on every push/PR.
It also has a **Stocks** page (`#/stocks`): search any ticker or company name
with autocomplete and chart it from 1 day to MAX with MA(50), MA(200),
Bollinger Bands (20, 2), volume and RSI(14).

- **Backend**: Node.js + Express REST API (in-memory task store)
- **Frontend**: React + Vite single-page app
- **Unit tests**: Jest + Supertest (server), Vitest + React Testing Library (client)
- **Integration/E2E tests**: Playwright, driving the real built frontend against the real backend
- **CI**: GitHub Actions — lint, unit tests, build, and E2E tests run automatically

## Project layout

```
taskflow-app/
├── server/            Express API
│   ├── src/
│   │   ├── taskStore.js   In-memory data layer + validation
│   │   ├── app.js         Express app / routes (exported for testing)
│   │   ├── stocks.js      Yahoo Finance client: search, chart ranges, caching
│   │   ├── indicators.js  SMA, Bollinger Bands, RSI
│   │   └── server.js      Entry point (starts the HTTP server)
│   └── tests/             Jest unit tests
├── client/            React + Vite frontend
│   ├── src/               Components, API client, styles
│   │   └── stocks/        Stocks page: search box, chart (lightweight-charts)
│   └── tests/             Vitest + Testing Library unit tests
├── e2e/               Playwright integration/E2E tests
│   └── tests/tasks.spec.js
└── .github/workflows/ci.yml   GitHub Actions pipeline
```

## Prerequisites

- Node.js 20+ and npm 10+
- Internet access (to install npm packages and, for the E2E suite, a Playwright browser)

## Getting started

Install all dependencies for every workspace (server, client, e2e) in one go:

```bash
npm install
```

### Run the app locally

```bash
# terminal 1
npm run dev:server     # API on http://localhost:4000

# terminal 2
npm run dev:client     # UI on http://localhost:5173 (proxies /api to the server)
```

Open http://localhost:5173 in your browser.

### Run the tests

```bash
npm run lint           # ESLint across server + client
npm run test:unit      # Jest (server) + Vitest (client)
npm run build          # Production build of the client (client/dist)

# One-time setup for the E2E suite:
npx playwright install --with-deps chromium --prefix e2e

npm run test:e2e       # Playwright: builds the client, boots both servers, drives a real browser
```

Or run everything the CI pipeline runs, in order:

```bash
npm test
```

### Test coverage

- `npm run test:unit:server` writes coverage to `server/coverage/`
- `npm run test:unit:client` writes coverage to `client/coverage/`

## API reference

| Method | Path                     | Description                          |
|--------|--------------------------|---------------------------------------|
| GET    | `/api/health`            | Health check                          |
| GET    | `/api/tasks`             | List tasks (`?status=active|completed`) |
| GET    | `/api/tasks/:id`         | Get a single task                     |
| POST   | `/api/tasks`             | Create a task `{ title, description? }` |
| PUT    | `/api/tasks/:id`         | Update a task                         |
| PATCH  | `/api/tasks/:id/toggle`  | Toggle a task's completed state       |
| DELETE | `/api/tasks/:id`         | Delete a task                         |
| GET    | `/api/stocks/search?q=`  | Autocomplete stock symbols / names    |
| GET    | `/api/stocks/:symbol/chart?range=` | Price history + indicators (`1D`, `1W`, `1M`, `3M`, `YTD`, `1Y`, `5Y`, `MAX`) |

## Continuous Integration

`.github/workflows/ci.yml` runs on every push and pull request to `main`:

1. **Lint** — ESLint on both `server` and `client`
2. **Unit tests** — Jest (server) and Vitest (client), run in parallel via a matrix, with coverage uploaded as artifacts
3. **Build** — production Vite build of the client (only runs if lint + unit tests pass)
4. **E2E tests** — installs a Playwright browser, then runs the full integration suite against the real backend and the real built frontend; the HTML report is uploaded as an artifact on every run (pass or fail)

To use it: push this project to a GitHub repository (with `main` as the default
branch, or update the workflow's branch filters) and Actions will run automatically.
No secrets or extra configuration are required.

## Design notes

- Stock data comes from Yahoo Finance's public (unofficial, keyless) endpoints
  via the backend, which avoids browser CORS limits and caches responses
  (30s for charts, 5 min for search). It is fine for personal use but has no
  uptime guarantee; `createStockService` is the one place to swap in a paid
  provider. Each range fetches extra history so MA(200) is populated at the
  left edge of the chart. Tests inject a fake `fetch` and never hit the network.

- The backend uses a small in-memory `TaskStore` (see `server/src/taskStore.js`)
  rather than a database, so the whole pipeline runs with zero external services
  and stays fast and deterministic in CI. `app.js` accepts a store instance,
  which is how tests get a fresh, isolated store per test.
- The E2E suite runs Playwright's `webServer` option to boot the backend and a
  production preview of the frontend automatically — no manual setup needed to
  run `npm run test:e2e`.
- `e2e/playwright.config.js` looks for `PLAYWRIGHT_BROWSERS_PATH` and points
  directly at a pre-installed Chromium there if it's set (useful for sandboxed
  environments that ship a browser under a fixed path); otherwise Playwright
  manages/downloads its own browser, which is what happens in GitHub Actions.
