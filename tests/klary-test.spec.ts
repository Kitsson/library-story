import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';

const BASE    = 'http://localhost:5173';
const API     = 'http://localhost:4000/api/v1';
const PASS    = 'securepassword123456';

// Register once per test via API — no UI round-trip, no rate-limit pressure
async function apiRegister(email: string) {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName: 'Anna', lastName: 'Svensson', orgName: 'Test Firm AB', email, password: PASS }),
  });
  const data = await res.json();
  if (!data.tokens) throw new Error(`Registration failed: ${JSON.stringify(data)}`);
  return data.tokens.accessToken as string;
}

// Inject token BEFORE the page loads so the app boots already authenticated
async function loginWithToken(page: Page, token: string) {
  await page.addInitScript((t) => {
    localStorage.setItem('accessToken', t);
  }, token);
  await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 30000 });
  await page.locator('h1').filter({ hasText: 'Dashboard' }).waitFor({ timeout: 20000 });
}

function uid() { return `${Date.now()}_${Math.random().toString(36).slice(2)}`; }

test.use({ timeout: 90000 });

test.describe('Klary E2E', () => {

  test('1 - Dashboard renders after login', async ({ page }) => {
    const token = await apiRegister(`t1_${uid()}@klary.se`);
    await loginWithToken(page, token);
    await expect(page.locator('h1').filter({ hasText: 'Dashboard' })).toBeVisible();
    await expect(page.locator('.card').first()).toBeVisible({ timeout: 8000 });
  });

  test('2 - Login page accepts credentials and shows dashboard', async ({ page }) => {
    const email = `t2_${uid()}@klary.se`;
    await apiRegister(email);

    // Go to login page — bug fixed: 401 interceptor no longer loops when already on /login
    await page.goto(`${BASE}/login`, { waitUntil: 'load', timeout: 30000 });
    await page.locator('input[type="email"]').waitFor({ timeout: 10000 });
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(PASS);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.locator('h1').filter({ hasText: 'Dashboard' }).waitFor({ timeout: 15000 });
    await expect(page.locator('h1').filter({ hasText: 'Dashboard' })).toBeVisible();
  });

  test('3 - Transactions page has Load Demo Data and Export CSV buttons', async ({ page }) => {
    const token = await apiRegister(`t3_${uid()}@klary.se`);
    await loginWithToken(page, token);
    await page.goto(`${BASE}/transactions`, { waitUntil: 'load', timeout: 30000 });
    await page.locator('h1').filter({ hasText: 'Transactions' }).waitFor({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /load demo data/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /export csv/i })).toBeVisible();
  });

  test('4 - Load Demo Data fills table with 20 Swedish transactions', async ({ page }) => {
    const token = await apiRegister(`t4_${uid()}@klary.se`);
    await loginWithToken(page, token);
    await page.goto(`${BASE}/transactions`, { waitUntil: 'load', timeout: 30000 });
    await page.locator('h1').filter({ hasText: 'Transactions' }).waitFor({ timeout: 10000 });

    await page.getByRole('button', { name: /load demo data/i }).click();
    await expect(page.getByText(/20 transactions ready/i)).toBeVisible({ timeout: 15000 });

    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 5000 });
    const count = await page.locator('tbody tr').count();
    expect(count).toBeGreaterThanOrEqual(20);
    await expect(page.getByText(/Zoom videokonferens|Hyra kontor|Fortnox/i).first()).toBeVisible();
  });

  test('5 - Load Demo Data is idempotent (no duplicates on second call)', async ({ page }) => {
    const token = await apiRegister(`t5_${uid()}@klary.se`);
    await loginWithToken(page, token);
    await page.goto(`${BASE}/transactions`, { waitUntil: 'load', timeout: 30000 });
    await page.locator('h1').filter({ hasText: 'Transactions' }).waitFor({ timeout: 10000 });

    await page.getByRole('button', { name: /load demo data/i }).click();
    await expect(page.getByText(/20 transactions ready/i)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /load demo data/i }).click();
    await expect(page.getByText(/20 transactions ready/i)).toBeVisible({ timeout: 15000 });

    const count = await page.locator('tbody tr').count();
    expect(count).toBe(20);
  });

  test('6 - Export CSV triggers a file download', async ({ page }) => {
    const token = await apiRegister(`t6_${uid()}@klary.se`);
    await loginWithToken(page, token);
    await page.goto(`${BASE}/transactions`, { waitUntil: 'load', timeout: 30000 });
    await page.locator('h1').filter({ hasText: 'Transactions' }).waitFor({ timeout: 10000 });

    await page.getByRole('button', { name: /load demo data/i }).click();
    await expect(page.getByText(/20 transactions ready/i)).toBeVisible({ timeout: 15000 });

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.getByRole('button', { name: /export csv/i }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('klary-transactions.csv');
  });

  test('7 - Status filter tabs work', async ({ page }) => {
    const token = await apiRegister(`t7_${uid()}@klary.se`);
    await loginWithToken(page, token);
    await page.goto(`${BASE}/transactions`, { waitUntil: 'load', timeout: 30000 });
    await page.locator('h1').filter({ hasText: 'Transactions' }).waitFor({ timeout: 10000 });

    await page.getByRole('button', { name: /load demo data/i }).click();
    await expect(page.getByText(/20 transactions ready/i)).toBeVisible({ timeout: 15000 });

    // AI SUGGESTED tab — nothing categorized yet, so empty
    await page.getByRole('button', { name: /ai suggested/i }).click();
    await expect(page.getByText(/no transactions found/i)).toBeVisible({ timeout: 8000 });

    // All tab — rows return
    await page.getByRole('button', { name: /^all$/i }).click();
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 5000 });
  });

  test('8 - Clients page loads via sidebar nav', async ({ page }) => {
    const token = await apiRegister(`t8_${uid()}@klary.se`);
    await loginWithToken(page, token);
    await page.locator('nav').getByRole('link', { name: 'Clients', exact: true }).click();
    await page.locator('h1').filter({ hasText: 'Clients' }).waitFor({ timeout: 10000 });
    await expect(page.locator('h1').filter({ hasText: 'Clients' })).toBeVisible();
  });

  test('9 - Backend health check passes', async ({ request }) => {
    const res = await request.get('http://localhost:4000/health');
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.status).toBe('healthy');
  });

});
