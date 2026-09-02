import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'test/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 30_000,
  use: {
    browserName: 'chromium',
    viewport: { width: 1280, height: 1000 },
    launchOptions: { args: ['--allow-file-access-from-files'] },
  },
  outputDir: 'test/.artefacts/playwright',
});
