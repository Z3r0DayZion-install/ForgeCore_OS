import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 1,
  workers: process.env.CI ? 2 : 8,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  expect: {
    timeout: 10_000,
  },
  use: {
    trace: 'retain-on-failure',
  },
});
