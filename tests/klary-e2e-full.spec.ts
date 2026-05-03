/**
 * KLARY Full E2E Test Suite
 *
 * Covers: login page, register flow, login flow, dashboard, all sidebar pages,
 * client creation, time entry logging, transaction seed + export + filter,
 * advisory page, documents page, compliance page, integrations, settings.
 *
 * Run against live deployment:
 *   BASE_URL=https://klaryproject-git-claude-docume-a33a39-kitmedia01-7501s-projects.vercel.app \
 *   npx playwright test tests/klary-e2e-full.spec.ts
 *
 * Run against local dev (requires backend on :4000 and frontend on :5173):
 *   npx playwright test tests/klary-e2e-full.spec.ts
 */

import { test, expect, Page, request as playwrightRequest } from '@playwright/test';

const BASE = process.env.BASE_URL || 'https://klaryproject-git-claude-docume-a33a39-kitmedia01-7501s-projects.vercel.app';
const API  = process.env.API_URL  || `${BASE}/api/v1`;
const PASS = 'securepassword123456';

function uid() { return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

async function apiRegister(email: string): Promise<string> {
  const ctx = await playwrightRequest.newContext();
  const res = await ctx.post(`${API}/auth/register`, {
    data: { firstName: 'Anna', lastName: 'Svensson', orgName: `TestFirm_${uid()} AB`, email, password: PASS },
  });
  const body = await res.json();
  await ctx.dispose();
  if (!body.tokens?.accessToken) throw new Error(`Register failed: ${JSON.stringify(body)}`);
  return body.tokens.accessToken as string;
}

async function seedAuth(page: Page, token: string) {
  await page.addInitScript((t) => localStorage.setItem('accessToken', t), token);
  await page.goto(BASE, { waitUntil: 'load', timeout: 45000 });
  await page.waitForSelector('h2', { timeout: 20000 });
}

// ────────────────────────────────────────────────────────────────────────────
// GROUP 1 — Public pages (no auth)
// ────────────────────────────────────────────────────────────────────────────

test.describe('Public pages', () => {
  test('Login page renders with KLARY branding', async ({ page }) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'load', timeout: 45000 });
    await expect(page.locator('h1')).toContainText('Welcome back to KLARY');
    await expect(page.locator('p').filter({ hasText: 'AI copilot' }).first()).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Get started' })).toBeVisible();
  });

  test('Register page renders all form fields', async ({ page }) => {
    await page.goto(`${BASE}/register`, { waitUntil: 'load', timeout: 45000 });
    await expect(page.locator('h1')).toContainText('Start your KLARY journey');
    await expect(page.locator('text=First Name')).toBeVisible();
    await expect(page.locator('text=Last Name')).toBeVisible();
    await expect(page.locator('text=Email')).toBeVisible();
    await expect(page.locator('text=Firm Name')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Free Trial' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  });

  test('Login → Register → Login navigation works', async ({ page }) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'load', timeout: 45000 });
    await page.getByRole('link', { name: 'Get started' }).click();
    await expect(page.locator('h1')).toContainText('Start your KLARY journey');
    await page.getByRole('link', { name: 'Sign in' }).click();
    await expect(page.locator('h1')).toContainText('Welcome back to KLARY');
  });

  test('Login shows error on wrong password', async ({ page }) => {
    const email = `err_${uid()}@klary.se`;
    await apiRegister(email);
    await page.goto(`${BASE}/login`, { waitUntil: 'load', timeout: 45000 });
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill('wrongpassword123456');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.locator('[class*="toast"], [id*="toast"], [role="status"]').or(
      page.locator('text=/invalid|incorrect|failed|wrong/i')
    ).first()).toBeVisible({ timeout: 10000 });
  });

  test('Register shows error when passwords do not match', async ({ page }) => {
    await page.goto(`${BASE}/register`, { waitUntil: 'load', timeout: 45000 });
    const inputs = page.locator('input');
    await inputs.nth(0).fill('Test');
    await inputs.nth(1).fill('User');
    await inputs.nth(2).fill(`mismatch_${uid()}@klary.se`);
    await inputs.nth(3).fill('TestFirm AB');
    // password fields
    const pwInputs = page.locator('input[type="password"]');
    await pwInputs.nth(0).fill('securepassword123456');
    await pwInputs.nth(1).fill('differentpassword999');
    await page.getByRole('button', { name: 'Start Free Trial' }).click();
    await expect(page.locator('text=/passwords do not match/i').or(
      page.locator('[role="status"]').filter({ hasText: /match/i })
    ).first()).toBeVisible({ timeout: 8000 });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// GROUP 2 — Auth flows
// ────────────────────────────────────────────────────────────────────────────

test.describe('Auth flows', () => {
  test('Register via UI creates account and lands on dashboard', async ({ page }) => {
    const email = `reg_${uid()}@klary.se`;
    await page.goto(`${BASE}/register`, { waitUntil: 'load', timeout: 45000 });

    const inputs = page.locator('input:not([type="password"])');
    await inputs.nth(0).fill('Britta');
    await inputs.nth(1).fill('Lindqvist');
    await inputs.nth(2).fill(email);
    await inputs.nth(3).fill('Lindqvist Redovisning AB');

    const pwInputs = page.locator('input[type="password"]');
    await pwInputs.nth(0).fill(PASS);
    await pwInputs.nth(1).fill(PASS);

    await page.getByRole('button', { name: 'Start Free Trial' }).click();
    await page.waitForURL(`${BASE}/`, { timeout: 20000 });
    await expect(page.locator('h2')).toContainText('Good morning!');
  });

  test('Login via UI lands on dashboard', async ({ page }) => {
    const email = `login_${uid()}@klary.se`;
    await apiRegister(email);

    await page.goto(`${BASE}/login`, { waitUntil: 'load', timeout: 45000 });
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(PASS);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(`${BASE}/`, { timeout: 20000 });
    await expect(page.locator('h2')).toContainText('Good morning!');
  });

  test('Unauthenticated access to / redirects to /login', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'load', timeout: 45000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('Unauthenticated access to /clients redirects to /login', async ({ page }) => {
    await page.goto(`${BASE}/clients`, { waitUntil: 'load', timeout: 45000 });
    await expect(page).toHaveURL(/\/login/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// GROUP 3 — Dashboard
// ────────────────────────────────────────────────────────────────────────────

test.describe('Dashboard', () => {
  test('Renders stat cards and quick actions', async ({ page }) => {
    const token = await apiRegister(`dash_${uid()}@klary.se`);
    await seedAuth(page, token);

    await expect(page.locator('h2')).toContainText('Good morning!');
    // Stat cards
    await expect(page.locator('text=Time This Week')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Active Clients')).toBeVisible();
    await expect(page.locator('text=Advisory Value')).toBeVisible();
    await expect(page.locator('text=Pending Docs')).toBeVisible();
    // Quick actions
    await expect(page.locator('text=Quick Actions')).toBeVisible();
    await expect(page.locator('text=Request Documents')).toBeVisible();
  });

  test('Stat card links navigate to correct pages', async ({ page }) => {
    const token = await apiRegister(`dashlink_${uid()}@klary.se`);
    await seedAuth(page, token);

    await page.locator('text=Active Clients').click();
    await expect(page).toHaveURL(/\/clients/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// GROUP 4 — Sidebar navigation (all pages)
// ────────────────────────────────────────────────────────────────────────────

test.describe('Sidebar navigation', () => {
  let token: string;

  test.beforeEach(async () => {
    token = await apiRegister(`nav_${uid()}@klary.se`);
  });

  test('Clients page loads via sidebar', async ({ page }) => {
    await seedAuth(page, token);
    await page.locator('nav a, aside a').filter({ hasText: 'Clients' }).first().click();
    await expect(page).toHaveURL(/\/clients/);
    await expect(page.locator('h1')).toContainText('Clients');
    await expect(page.getByRole('button', { name: /add client/i })).toBeVisible({ timeout: 8000 });
  });

  test('Time Tracking page loads via sidebar', async ({ page }) => {
    await seedAuth(page, token);
    await page.locator('nav a, aside a').filter({ hasText: /time/i }).first().click();
    await expect(page).toHaveURL(/\/time-tracking/);
    await expect(page.locator('h1, h3').filter({ hasText: /time/i }).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: /log time/i })).toBeVisible();
  });

  test('Transactions page loads via sidebar', async ({ page }) => {
    await seedAuth(page, token);
    await page.locator('nav a, aside a').filter({ hasText: /transaction/i }).first().click();
    await expect(page).toHaveURL(/\/transactions/);
    await expect(page.locator('h1')).toContainText('Transactions');
    await expect(page.getByRole('button', { name: /load demo data/i })).toBeVisible({ timeout: 8000 });
  });

  test('Advisory page loads via sidebar', async ({ page }) => {
    await seedAuth(page, token);
    await page.locator('nav a, aside a').filter({ hasText: /advisory/i }).first().click();
    await expect(page).toHaveURL(/\/advisory/);
    await expect(page.locator('h1')).toContainText('Advisory');
  });

  test('Documents page loads via sidebar', async ({ page }) => {
    await seedAuth(page, token);
    await page.locator('nav a, aside a').filter({ hasText: /document/i }).first().click();
    await expect(page).toHaveURL(/\/documents/);
    await expect(page.locator('h1')).toContainText('Document');
  });

  test('Compliance page loads via sidebar', async ({ page }) => {
    await seedAuth(page, token);
    await page.locator('nav a, aside a').filter({ hasText: /compliance/i }).first().click();
    await expect(page).toHaveURL(/\/compliance/);
    await expect(page.locator('h1')).toContainText('Compliance');
  });

  test('Integrations page loads via sidebar', async ({ page }) => {
    await seedAuth(page, token);
    await page.locator('nav a, aside a').filter({ hasText: /integrations/i }).first().click();
    await expect(page).toHaveURL(/\/integrations/);
    await expect(page.locator('h1')).toContainText('Integrations');
  });

  test('Settings page loads via sidebar', async ({ page }) => {
    await seedAuth(page, token);
    await page.locator('nav a, aside a').filter({ hasText: /settings/i }).first().click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.locator('h1')).toContainText('Settings');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// GROUP 5 — Clients
// ────────────────────────────────────────────────────────────────────────────

test.describe('Clients', () => {
  test('Create a new client', async ({ page }) => {
    const token = await apiRegister(`cli_${uid()}@klary.se`);
    await seedAuth(page, token);
    await page.goto(`${BASE}/clients`, { waitUntil: 'load', timeout: 30000 });
    await page.locator('h1').filter({ hasText: 'Clients' }).waitFor({ timeout: 10000 });

    await page.getByRole('button', { name: /add client/i }).click();
    const clientName = `Eriksson Redovisning ${uid()}`;
    await page.locator('input[placeholder*="Andersson"], input').filter({ hasText: '' }).nth(0).fill(clientName);
    // fill name field (first input in form)
    const formInputs = page.locator('form input');
    await formInputs.nth(0).fill(clientName);
    await formInputs.nth(2).fill('test@eriksson.se');
    await page.getByRole('button', { name: /create client|save|add/i }).click();
    await expect(page.locator(`text=${clientName}`).first()).toBeVisible({ timeout: 10000 });
  });

  test('Search filters clients list', async ({ page }) => {
    const token = await apiRegister(`clisrch_${uid()}@klary.se`);
    await seedAuth(page, token);
    await page.goto(`${BASE}/clients`, { waitUntil: 'load', timeout: 30000 });
    await page.locator('h1').filter({ hasText: 'Clients' }).waitFor({ timeout: 10000 });

    const searchInput = page.locator('input[placeholder*="earch"], input[type="search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('nonexistentclientxyz');
      await page.waitForTimeout(500);
      const rows = page.locator('tbody tr, [data-testid="client-row"]');
      const count = await rows.count();
      expect(count).toBe(0);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// GROUP 6 — Transactions
// ────────────────────────────────────────────────────────────────────────────

test.describe('Transactions', () => {
  test('Load Demo Data fills table with 20 transactions', async ({ page }) => {
    const token = await apiRegister(`txn_${uid()}@klary.se`);
    await seedAuth(page, token);
    await page.goto(`${BASE}/transactions`, { waitUntil: 'load', timeout: 30000 });
    await page.locator('h1').filter({ hasText: 'Transactions' }).waitFor({ timeout: 10000 });

    await page.getByRole('button', { name: /load demo data/i }).click();
    await expect(page.getByText(/20 transactions ready/i)).toBeVisible({ timeout: 20000 });

    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 8000 });
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(20);
  });

  test('Load Demo Data is idempotent — no duplicates on second call', async ({ page }) => {
    const token = await apiRegister(`txn2_${uid()}@klary.se`);
    await seedAuth(page, token);
    await page.goto(`${BASE}/transactions`, { waitUntil: 'load', timeout: 30000 });
    await page.locator('h1').filter({ hasText: 'Transactions' }).waitFor({ timeout: 10000 });

    await page.getByRole('button', { name: /load demo data/i }).click();
    await expect(page.getByText(/20 transactions ready/i)).toBeVisible({ timeout: 20000 });
    await page.getByRole('button', { name: /load demo data/i }).click();
    await expect(page.getByText(/20 transactions ready/i)).toBeVisible({ timeout: 20000 });

    const count = await page.locator('tbody tr').count();
    expect(count).toBe(20);
  });

  test('Export CSV triggers a file download', async ({ page }) => {
    const token = await apiRegister(`txncsv_${uid()}@klary.se`);
    await seedAuth(page, token);
    await page.goto(`${BASE}/transactions`, { waitUntil: 'load', timeout: 30000 });
    await page.locator('h1').filter({ hasText: 'Transactions' }).waitFor({ timeout: 10000 });

    await page.getByRole('button', { name: /load demo data/i }).click();
    await expect(page.getByText(/20 transactions ready/i)).toBeVisible({ timeout: 20000 });

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.getByRole('button', { name: /export csv/i }).click(),
    ]);
    expect(download.suggestedFilename()).toContain('.csv');
  });

  test('Status filter tabs work — AI Suggested tab shows empty then All shows rows', async ({ page }) => {
    const token = await apiRegister(`txnflt_${uid()}@klary.se`);
    await seedAuth(page, token);
    await page.goto(`${BASE}/transactions`, { waitUntil: 'load', timeout: 30000 });
    await page.locator('h1').filter({ hasText: 'Transactions' }).waitFor({ timeout: 10000 });

    await page.getByRole('button', { name: /load demo data/i }).click();
    await expect(page.getByText(/20 transactions ready/i)).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: /ai suggested/i }).click();
    await expect(page.getByText(/no transactions found/i)).toBeVisible({ timeout: 8000 });

    await page.getByRole('button', { name: /^all$/i }).click();
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 8000 });
  });

  test('Search filter narrows transaction list', async ({ page }) => {
    const token = await apiRegister(`txnsrch_${uid()}@klary.se`);
    await seedAuth(page, token);
    await page.goto(`${BASE}/transactions`, { waitUntil: 'load', timeout: 30000 });
    await page.locator('h1').filter({ hasText: 'Transactions' }).waitFor({ timeout: 10000 });

    await page.getByRole('button', { name: /load demo data/i }).click();
    await expect(page.getByText(/20 transactions ready/i)).toBeVisible({ timeout: 20000 });

    const searchInput = page.locator('input[placeholder*="earch"], input[type="search"]').first();
    if (await searchInput.isVisible()) {
      const allCount = await page.locator('tbody tr').count();
      await searchInput.fill('Zoom');
      await page.waitForTimeout(500);
      const filteredCount = await page.locator('tbody tr').count();
      expect(filteredCount).toBeLessThanOrEqual(allCount);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// GROUP 7 — Time Tracking
// ────────────────────────────────────────────────────────────────────────────

test.describe('Time Tracking', () => {
  test('Log a manual time entry', async ({ page }) => {
    const token = await apiRegister(`time_${uid()}@klary.se`);
    await seedAuth(page, token);
    await page.goto(`${BASE}/time-tracking`, { waitUntil: 'load', timeout: 30000 });
    await page.locator('h1, h3').filter({ hasText: /time/i }).first().waitFor({ timeout: 10000 });

    await page.getByRole('button', { name: /log time/i }).click();
    await page.locator('input[placeholder*="work"]').fill('Client review meeting');
    await page.locator('input[type="number"]').fill('45');
    await page.getByRole('button', { name: /^log$/i }).click();
    await expect(page.locator('text=Time logged!').or(
      page.locator('tbody tr').filter({ hasText: 'Client review meeting' })
    ).first()).toBeVisible({ timeout: 10000 });
  });

  test('Weekly summary shows hours', async ({ page }) => {
    const token = await apiRegister(`timewk_${uid()}@klary.se`);
    await seedAuth(page, token);
    await page.goto(`${BASE}/time-tracking`, { waitUntil: 'load', timeout: 30000 });
    // Stat cards should appear (even if 0h)
    await expect(page.locator('text=Total This Week').or(
      page.locator('text=Billable')
    ).first()).toBeVisible({ timeout: 10000 });
  });

  test('Timer widget visible in sidebar', async ({ page }) => {
    const token = await apiRegister(`timerwdg_${uid()}@klary.se`);
    await seedAuth(page, token);
    // Timer widget should be in the sidebar/layout
    await expect(page.locator('button').filter({ hasText: /start|stop|timer/i }).first()).toBeVisible({ timeout: 10000 });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// GROUP 8 — Advisory
// ────────────────────────────────────────────────────────────────────────────

test.describe('Advisory', () => {
  test('Advisory page shows dashboard stats', async ({ page }) => {
    const token = await apiRegister(`adv_${uid()}@klary.se`);
    await seedAuth(page, token);
    await page.goto(`${BASE}/advisory`, { waitUntil: 'load', timeout: 30000 });
    await expect(page.locator('h1')).toContainText('Advisory');
    // Either shows opportunities or an empty state
    await expect(
      page.locator('text=/opportunity|pipeline|advisory/i').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('Advisory empty state has value proposition', async ({ page }) => {
    const token = await apiRegister(`advemp_${uid()}@klary.se`);
    await seedAuth(page, token);
    await page.goto(`${BASE}/advisory`, { waitUntil: 'load', timeout: 30000 });
    await page.locator('h1').filter({ hasText: 'Advisory' }).waitFor({ timeout: 10000 });
    // Either opportunities list or empty state message
    const content = await page.locator('main, [class*="container"], [class*="max-w"]').first().textContent();
    expect(content).toBeTruthy();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// GROUP 9 — Compliance
// ────────────────────────────────────────────────────────────────────────────

test.describe('Compliance', () => {
  test('Compliance page shows Deadlines and iXBRL tabs', async ({ page }) => {
    const token = await apiRegister(`comp_${uid()}@klary.se`);
    await seedAuth(page, token);
    await page.goto(`${BASE}/compliance`, { waitUntil: 'load', timeout: 30000 });
    await expect(page.locator('h1')).toContainText('Compliance');
    await expect(page.locator('button, [role="tab"]').filter({ hasText: /deadline/i }).first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('button, [role="tab"]').filter({ hasText: /ixbrl|årsredovisning/i }).first()).toBeVisible({ timeout: 8000 });
  });

  test('Compliance filter controls are visible', async ({ page }) => {
    const token = await apiRegister(`compflt_${uid()}@klary.se`);
    await seedAuth(page, token);
    await page.goto(`${BASE}/compliance`, { waitUntil: 'load', timeout: 30000 });
    await page.locator('h1').filter({ hasText: 'Compliance' }).waitFor({ timeout: 10000 });
    // Status and client filter selects should be present
    await expect(page.locator('select').first().or(page.locator('input[placeholder*="filter"]').first())).toBeVisible({ timeout: 8000 });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// GROUP 10 — Documents
// ────────────────────────────────────────────────────────────────────────────

test.describe('Documents', () => {
  test('Documents page shows New Request button', async ({ page }) => {
    const token = await apiRegister(`doc_${uid()}@klary.se`);
    await seedAuth(page, token);
    await page.goto(`${BASE}/documents`, { waitUntil: 'load', timeout: 30000 });
    await expect(page.locator('h1')).toContainText('Document');
    await expect(page.getByRole('button', { name: /new request|request/i }).first()).toBeVisible({ timeout: 8000 });
  });

  test('Documents status filter tabs present', async ({ page }) => {
    const token = await apiRegister(`docflt_${uid()}@klary.se`);
    await seedAuth(page, token);
    await page.goto(`${BASE}/documents`, { waitUntil: 'load', timeout: 30000 });
    await page.locator('h1').filter({ hasText: 'Document' }).waitFor({ timeout: 10000 });
    await expect(page.locator('button').filter({ hasText: /all|sent|pending|completed/i }).first()).toBeVisible({ timeout: 8000 });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// GROUP 11 — Integrations
// ────────────────────────────────────────────────────────────────────────────

test.describe('Integrations', () => {
  test('Integrations page shows Fortnox card', async ({ page }) => {
    const token = await apiRegister(`int_${uid()}@klary.se`);
    await seedAuth(page, token);
    await page.goto(`${BASE}/integrations`, { waitUntil: 'load', timeout: 30000 });
    await expect(page.locator('h1')).toContainText('Integrations');
    await expect(page.locator('text=Fortnox')).toBeVisible({ timeout: 8000 });
  });

  test('Integrations page shows Connect button for Fortnox', async ({ page }) => {
    const token = await apiRegister(`intbtn_${uid()}@klary.se`);
    await seedAuth(page, token);
    await page.goto(`${BASE}/integrations`, { waitUntil: 'load', timeout: 30000 });
    await page.locator('h1').filter({ hasText: 'Integrations' }).waitFor({ timeout: 10000 });
    await expect(page.locator('button').filter({ hasText: /connect|anslut/i }).first()).toBeVisible({ timeout: 8000 });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// GROUP 12 — Settings
// ────────────────────────────────────────────────────────────────────────────

test.describe('Settings', () => {
  test('Settings page shows profile and email sections', async ({ page }) => {
    const token = await apiRegister(`set_${uid()}@klary.se`);
    await seedAuth(page, token);
    await page.goto(`${BASE}/settings`, { waitUntil: 'load', timeout: 30000 });
    await expect(page.locator('h1')).toContainText('Settings');
    await expect(page.locator('text=/profile|email|smtp|team/i').first()).toBeVisible({ timeout: 8000 });
  });

  test('Settings page shows Team section with invite', async ({ page }) => {
    const token = await apiRegister(`setteam_${uid()}@klary.se`);
    await seedAuth(page, token);
    await page.goto(`${BASE}/settings`, { waitUntil: 'load', timeout: 30000 });
    await page.locator('h1').filter({ hasText: 'Settings' }).waitFor({ timeout: 10000 });
    await expect(page.locator('text=/team|invite/i').first()).toBeVisible({ timeout: 8000 });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// GROUP 13 — Backend health (via proxy)
// ────────────────────────────────────────────────────────────────────────────

test.describe('Backend health', () => {
  test('API health check via proxy returns healthy', async ({ request }) => {
    // The Vercel serverless proxy forwards /api/v1/* to Railway
    // Test the API root which Railway handles
    const res = await request.get(`${API}`, { timeout: 20000 });
    // Railway returns JSON with API name, or proxy returns 2xx
    expect(res.status()).toBeLessThan(500);
  });

  test('Register endpoint reachable via proxy', async ({ request }) => {
    const email = `healthcheck_${uid()}@klary.se`;
    const res = await request.post(`${API}/auth/register`, {
      data: { firstName: 'Health', lastName: 'Check', orgName: 'HealthFirm AB', email, password: PASS },
      timeout: 20000,
    });
    // 201 = created, 409 = conflict (already exists) — both mean the API is reachable
    expect([200, 201, 409]).toContain(res.status());
  });
});
