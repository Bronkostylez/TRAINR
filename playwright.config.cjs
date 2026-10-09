// Playwright-Konfiguration. Browser: lokal installiertes Chrome (CHROME_CHANNEL=msedge für Edge) oder CHROME_PATH.
const { defineConfig } = require('@playwright/test');
const launch = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: process.env.CHROME_CHANNEL || 'chrome' };
module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: { baseURL: 'http://127.0.0.1:8765', launchOptions: launch, viewport: { width: 390, height: 844 }, locale: 'de-DE', acceptDownloads: true, trace: 'retain-on-failure' },
  webServer: { command: 'node serve.cjs', url: 'http://127.0.0.1:8765', reuseExistingServer: true, timeout: 20_000 },
});
