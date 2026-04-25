import { test, expect, Page } from '@playwright/test';

const fakeUser = {
  id: 'user-1',
  email: 'anna@firma.se',
  firstName: 'Anna',
  lastName: 'Svensson',
  role: 'ADMIN',
  organizationId: 'org-1',
};

const fakeOrg = {
  id: 'org-1',
  name: 'Firma AB',
  tier: 'KLARSTART',
  maxUsers: 3,
  maxClients: 10,
};

/**
 * Set up routes for an authenticated session and navigate to path.
 *
 * Route ordering: Playwright checks routes from LAST-registered to
 * FIRST-registered. The /me fulfillment is registered last so it wins
 * over the wildcard catch-all for all /me requests (including the second
 * invocation caused by React StrictMode double-firing effects in dev mode).
 */
async function goAuthenticated(page: Page, path = '/') {
  // Catch-all first (lowest priority)
  await page.route('**/api/v1/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], total: 0 }) })
  );
  // /me last (highest priority — overrides wildcard)
  await page.route('**/api/v1/auth/me', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: fakeUser, organization: fakeOrg }),
    })
  );
  await page.goto(path);
  await expect(page).toHaveURL(path);
}

// ============================================================
// Sidebar navigation
// ============================================================
test.describe('Sidebar navigation', () => {
  test('shows user name in sidebar after login', async ({ page }) => {
    await goAuthenticated(page);
    await expect(page.getByText('Anna Svensson')).toBeVisible();
  });

  test('shows user email in sidebar', async ({ page }) => {
    await goAuthenticated(page);
    await expect(page.getByText('anna@firma.se')).toBeVisible();
  });

  test('all nav items are visible', async ({ page }) => {
    await goAuthenticated(page);
    await expect(page.getByTestId('nav-dashboard')).toBeVisible();
    await expect(page.getByTestId('nav-clients')).toBeVisible();
    await expect(page.getByTestId('nav-time-tracking')).toBeVisible();
    await expect(page.getByTestId('nav-transactions')).toBeVisible();
    await expect(page.getByTestId('nav-advisory')).toBeVisible();
    await expect(page.getByTestId('nav-documents')).toBeVisible();
    await expect(page.getByTestId('nav-integrations')).toBeVisible();
    await expect(page.getByTestId('nav-settings')).toBeVisible();
  });

  test('clicking Clients navigates to /clients', async ({ page }) => {
    await goAuthenticated(page);
    await page.getByTestId('nav-clients').click();
    await expect(page).toHaveURL('/clients');
  });

  test('clicking Time Tracking navigates to /time-tracking', async ({ page }) => {
    await goAuthenticated(page);
    await page.getByTestId('nav-time-tracking').click();
    await expect(page).toHaveURL('/time-tracking');
  });

  test('clicking Transactions navigates to /transactions', async ({ page }) => {
    await goAuthenticated(page);
    await page.getByTestId('nav-transactions').click();
    await expect(page).toHaveURL('/transactions');
  });

  test('clicking Settings navigates to /settings', async ({ page }) => {
    await goAuthenticated(page);
    await page.getByTestId('nav-settings').click();
    await expect(page).toHaveURL('/settings');
  });
});

// ============================================================
// Logout
// ============================================================
test.describe('Logout', () => {
  test('clicking logout redirects to /login', async ({ page }) => {
    await goAuthenticated(page);
    await page.getByTestId('logout-button').click();
    await expect(page).toHaveURL('/login');
  });

  test('after logout, visiting / redirects back to /login', async ({ page }) => {
    await goAuthenticated(page);
    await page.getByTestId('logout-button').click();
    await expect(page).toHaveURL('/login');

    // Now visiting dashboard should redirect to login again
    await page.route('**/api/v1/auth/me', route =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Unauthorized' }) })
    );
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });
});
