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

const fakeTokens = {
  accessToken: 'fake-access-token',
  refreshToken: 'fake-refresh-token',
};

/**
 * Register routes for an unauthenticated page load.
 *
 * IMPORTANT ordering rule: Playwright checks routes from LAST-registered to
 * FIRST-registered. So the most-specific routes must be registered LAST so
 * they take priority over wildcards.
 *
 * We use route.abort() for /me instead of a 401 to avoid the Axios
 * response interceptor, which converts 401 into window.location.href='/login'
 * and creates an infinite reload loop in tests.
 *
 * React StrictMode invokes effects twice in dev mode, meaning loadUser() is
 * called twice. By registering /me abort LAST, it always wins over any
 * previously registered wildcard.
 */
async function setupUnauthRoutes(page: Page, extraRoutes?: () => Promise<void>) {
  // 1. Catch-all (lowest priority — registered first)
  await page.route('**/api/v1/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
  );
  // 2. Any extra test-specific routes
  if (extraRoutes) await extraRoutes();
  // 3. /me abort (highest priority — registered last)
  await page.route('**/api/v1/auth/me', route => route.abort());
}

/** Mock all API calls and /me to return an authenticated user. */
async function setupAuthRoutes(page: Page) {
  await page.route('**/api/v1/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], total: 0 }) })
  );
  await page.route('**/api/v1/auth/me', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: fakeUser, organization: fakeOrg }),
    })
  );
}

// ============================================================
// Login page
// ============================================================
test.describe('Login page', () => {
  test('renders email, password fields and sign-in button', async ({ page }) => {
    await setupUnauthRoutes(page);
    await page.goto('/login');

    await expect(page.getByTestId('login-email')).toBeVisible();
    await expect(page.getByTestId('login-password')).toBeVisible();
    await expect(page.getByTestId('login-submit')).toBeVisible();
    await expect(page.getByTestId('login-submit')).toHaveText('Sign In');
  });

  test('successful login redirects to dashboard', async ({ page }) => {
    await setupUnauthRoutes(page, async () => {
      await page.route('**/api/v1/auth/login', route =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Login successful.', user: fakeUser, organization: fakeOrg, tokens: fakeTokens }),
        })
      );
    });
    await page.goto('/login');

    await page.getByTestId('login-email').fill('anna@firma.se');
    await page.getByTestId('login-password').fill('SuperSecret1234!');
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL('/');
  });

  test('shows error toast on wrong credentials', async ({ page }) => {
    await setupUnauthRoutes(page, async () => {
      await page.route('**/api/v1/auth/login', route =>
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid email or password.' }),
        })
      );
    });
    await page.goto('/login');

    await page.getByTestId('login-email').fill('anna@firma.se');
    await page.getByTestId('login-password').fill('wrongpassword');
    await page.getByTestId('login-submit').click();

    await expect(page.getByText('Invalid email or password.')).toBeVisible();
  });

  test('shows "Signing in..." while request is in flight', async ({ page }) => {
    await setupUnauthRoutes(page, async () => {
      await page.route('**/api/v1/auth/login', async route => {
        await new Promise(r => setTimeout(r, 500));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: fakeUser, organization: fakeOrg, tokens: fakeTokens }),
        });
      });
    });
    await page.goto('/login');

    await page.getByTestId('login-email').fill('anna@firma.se');
    await page.getByTestId('login-password').fill('SuperSecret1234!');
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-submit')).toHaveText('Signing in...');
  });

  test('"Get started" link navigates to register page', async ({ page }) => {
    await setupUnauthRoutes(page);
    await page.goto('/login');

    await page.getByRole('link', { name: 'Get started' }).click();
    await expect(page).toHaveURL('/register');
  });
});

// ============================================================
// Protected route guard
// ============================================================
test.describe('Protected route guard', () => {
  test('unauthenticated user visiting / is redirected to /login', async ({ page }) => {
    await setupUnauthRoutes(page);
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });

  test('unauthenticated user visiting /clients is redirected to /login', async ({ page }) => {
    await setupUnauthRoutes(page);
    await page.goto('/clients');
    await expect(page).toHaveURL('/login');
  });

  test('authenticated user visiting /login is redirected to dashboard', async ({ page }) => {
    await setupAuthRoutes(page);
    await page.goto('/login');
    await expect(page).toHaveURL('/');
  });
});

// ============================================================
// Register page
// ============================================================
test.describe('Register page', () => {
  test('renders all form fields and submit button', async ({ page }) => {
    await setupUnauthRoutes(page);
    await page.goto('/register');

    await expect(page.getByTestId('register-firstName')).toBeVisible();
    await expect(page.getByTestId('register-lastName')).toBeVisible();
    await expect(page.getByTestId('register-email')).toBeVisible();
    await expect(page.getByTestId('register-firmName')).toBeVisible();
    await expect(page.getByTestId('register-password')).toBeVisible();
    await expect(page.getByTestId('register-confirmPassword')).toBeVisible();
    await expect(page.getByTestId('register-submit')).toHaveText('Start Free Trial');
  });

  test('shows error toast when passwords do not match', async ({ page }) => {
    await setupUnauthRoutes(page);
    await page.goto('/register');

    await page.getByTestId('register-firstName').fill('Anna');
    await page.getByTestId('register-lastName').fill('Svensson');
    await page.getByTestId('register-email').fill('anna@firma.se');
    await page.getByTestId('register-firmName').fill('Firma AB');
    await page.getByTestId('register-password').fill('SuperSecret1234!');
    await page.getByTestId('register-confirmPassword').fill('DifferentPass99!');
    await page.getByTestId('register-submit').click();

    await expect(page.getByText('Passwords do not match')).toBeVisible();
  });

  test('successful registration redirects to dashboard', async ({ page }) => {
    await setupUnauthRoutes(page, async () => {
      await page.route('**/api/v1/auth/register', route =>
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Registration successful.', user: fakeUser, organization: fakeOrg, tokens: fakeTokens }),
        })
      );
    });
    await page.goto('/register');

    await page.getByTestId('register-firstName').fill('Anna');
    await page.getByTestId('register-lastName').fill('Svensson');
    await page.getByTestId('register-email').fill('anna@firma.se');
    await page.getByTestId('register-firmName').fill('Firma AB');
    await page.getByTestId('register-password').fill('SuperSecret1234!');
    await page.getByTestId('register-confirmPassword').fill('SuperSecret1234!');
    await page.getByTestId('register-submit').click();

    await expect(page).toHaveURL('/');
  });

  test('"Sign in" link navigates to login page', async ({ page }) => {
    await setupUnauthRoutes(page);
    await page.goto('/register');

    await page.getByRole('link', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/login');
  });
});
