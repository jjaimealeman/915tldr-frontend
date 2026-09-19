import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'design/tests',
  testMatch: '**/*.spec.ts',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: process.env.PW_JSON_OUT ?? 'design/.cache/pw-report.json' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4319',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'node design/scripts/serve-mockups.mjs --port 4319',
    url: 'http://127.0.0.1:4319/__health',
    reuseExistingServer: false,
    timeout: 20000,
  },
});
