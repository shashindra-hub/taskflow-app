import { defineConfig, devices } from '@playwright/test';

const PORT_CLIENT = 4173;
const PORT_SERVER = 4000;

// This sandbox (and some other environments) ships a pre-installed Chromium
// under PLAYWRIGHT_BROWSERS_PATH instead of one matching this exact
// @playwright/test version. When that env var is set, point directly at it;
// otherwise Playwright manages/downloads its own browser as usual (the
// normal path for GitHub Actions: `npx playwright install --with-deps chromium`).
const chromiumExecutablePath = process.env.PLAYWRIGHT_BROWSERS_PATH
  ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium`
  : undefined;

export default defineConfig({
  testDir: './tests',
  // The two web servers below share one in-memory backend, so keep runs
  // single-worker/serial to avoid tests racing on shared task state.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT_CLIENT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(chromiumExecutablePath
          ? { launchOptions: { executablePath: chromiumExecutablePath } }
          : {}),
      },
    },
  ],
  webServer: [
    {
      command: 'npm start',
      cwd: '../server',
      port: PORT_SERVER,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'npm run build && npm run preview',
      cwd: '../client',
      port: PORT_CLIENT,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { API_TARGET: `http://localhost:${PORT_SERVER}` },
    },
  ],
});
