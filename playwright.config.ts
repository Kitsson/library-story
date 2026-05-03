import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL
  || 'https://klaryproject-git-claude-docume-a33a39-kitmedia01-7501s-projects.vercel.app';

export default defineConfig({
  testDir: './tests',
  timeout: 90000,
  fullyParallel: false,
  retries: 1,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 15000,
    navigationTimeout: 45000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
