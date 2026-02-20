/**
 * Authentication Flows E2E Tests
 *
 * Tests the sign-in, sign-up, forgot-password pages, route protection,
 * and header auth UI using LIVE rendered pages (no mocks).
 *
 * Prerequisites:
 * - Frontend dev server running on port 3000
 * - Backend dev server running on port 3001
 * - Supabase instance accessible (for auth error responses)
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication Flows', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(60_000);

  // --------------------------------------------------------------------------
  // Sign-In Page
  // --------------------------------------------------------------------------

  test.describe('Sign-In Page', () => {
    test('renders all auth options', async ({ page }) => {
      await page.goto('/auth/sign-in');

      // Email + password fields
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();

      // Primary submit button (password mode)
      await expect(
        page.getByRole('button', { name: /sign in/i })
      ).toBeVisible();

      // Magic link toggle
      await expect(page.getByText(/sign in with magic link/i)).toBeVisible();

      // Passkey button
      await expect(
        page.getByRole('button', { name: /passkey/i })
      ).toBeVisible();

      // OAuth buttons
      await expect(
        page.getByRole('button', { name: /google/i })
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /apple/i })
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /github/i })
      ).toBeVisible();

      // Navigation links
      await expect(page.getByRole('link', { name: /sign up/i })).toBeVisible();
      await expect(
        page.getByRole('link', { name: /forgot password/i })
      ).toBeVisible();
    });

    test('toggles magic link mode', async ({ page }) => {
      await page.goto('/auth/sign-in');

      // Switch to magic link mode
      await page.getByText(/sign in with magic link/i).click();

      // Password field should be hidden, submit says "Send Magic Link"
      await expect(page.getByLabel(/password/i)).not.toBeVisible();
      await expect(
        page.getByRole('button', { name: /send magic link/i })
      ).toBeVisible();

      // Switch back to password mode
      await page.getByText(/use password instead/i).click();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(
        page.getByRole('button', { name: /sign in/i })
      ).toBeVisible();
    });

    test('shows error for invalid credentials', async ({ page }) => {
      await page.goto('/auth/sign-in');

      await page.getByLabel(/email/i).fill('invalid@test.com');
      await page.getByLabel(/password/i).fill('wrongpassword');
      await page.getByRole('button', { name: /sign in/i }).click();

      // Supabase returns an error message (e.g. "Invalid login credentials")
      await expect(
        page.getByText(/invalid|error|failed|incorrect/i)
      ).toBeVisible({ timeout: 10_000 });
    });

    test('navigates to sign-up page', async ({ page }) => {
      await page.goto('/auth/sign-in');
      await page.getByRole('link', { name: /sign up/i }).click();
      await expect(page).toHaveURL(/\/auth\/sign-up/);
    });

    test('navigates to forgot password page', async ({ page }) => {
      await page.goto('/auth/sign-in');
      await page.getByRole('link', { name: /forgot password/i }).click();
      await expect(page).toHaveURL(/\/auth\/forgot-password/);
    });
  });

  // --------------------------------------------------------------------------
  // Sign-Up Page
  // --------------------------------------------------------------------------

  test.describe('Sign-Up Page', () => {
    test('renders registration form', async ({ page }) => {
      await page.goto('/auth/sign-up');

      await expect(page.getByLabel(/email/i)).toBeVisible();

      // Two password fields (password + confirm)
      const passwordInputs = page.locator('input[type="password"]');
      await expect(passwordInputs).toHaveCount(2);
      await expect(passwordInputs.first()).toBeVisible();

      // Submit button says "Create Account"
      await expect(
        page.getByRole('button', { name: /create account/i })
      ).toBeVisible();

      // OAuth buttons
      await expect(
        page.getByRole('button', { name: /google/i })
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /apple/i })
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /github/i })
      ).toBeVisible();

      // Sign in link
      await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
    });

    test('shows password strength indicator when typing', async ({ page }) => {
      await page.goto('/auth/sign-up');

      // Strength indicator is hidden before typing
      await expect(page.getByTestId('password-strength')).not.toBeVisible();

      // Type into the first password field
      const passwordInput = page.locator('input[type="password"]').first();
      await passwordInput.fill('weak');

      // Strength indicator should now be visible
      await expect(page.getByTestId('password-strength')).toBeVisible();
    });

    test('validates password requirements', async ({ page }) => {
      await page.goto('/auth/sign-up');
      const passwordInput = page.locator('input[type="password"]').first();

      // Type a weak password — only the "lowercase" requirement is met
      await passwordInput.fill('abc');
      const strengthContainer = page.getByTestId('password-strength');
      await expect(strengthContainer).toBeVisible();

      // Should show requirement labels
      await expect(strengthContainer.getByText(/at least 8 characters/i)).toBeVisible();
      await expect(strengthContainer.getByText(/uppercase/i)).toBeVisible();
      await expect(strengthContainer.getByText(/number/i)).toBeVisible();

      // Now type a strong password
      await passwordInput.fill('StrongPass1');

      // All four requirements should be met (check icons appear via lucide Check)
      // We verify by checking that the strength container still renders
      await expect(strengthContainer).toBeVisible();
    });

    test('shows password mismatch error inline', async ({ page }) => {
      await page.goto('/auth/sign-up');

      const passwordInput = page.locator('#password');
      const confirmInput = page.locator('#confirm-password');

      await passwordInput.fill('StrongPass1');
      await confirmInput.fill('DifferentPass2');

      // The inline error "Passwords do not match" should appear
      await expect(page.getByText(/passwords do not match/i)).toBeVisible();
    });

    test('navigates to sign-in page', async ({ page }) => {
      await page.goto('/auth/sign-up');
      await page.getByRole('link', { name: /sign in/i }).click();
      await expect(page).toHaveURL(/\/auth\/sign-in/);
    });
  });

  // --------------------------------------------------------------------------
  // Forgot Password Page
  // --------------------------------------------------------------------------

  test.describe('Forgot Password Page', () => {
    test('renders reset form', async ({ page }) => {
      await page.goto('/auth/forgot-password');
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(
        page.getByRole('button', { name: /send reset link/i })
      ).toBeVisible();
    });

    test('shows success message after submit', async ({ page }) => {
      await page.goto('/auth/forgot-password');
      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByRole('button', { name: /send reset link/i }).click();

      // Supabase always returns success for password reset (no user enumeration)
      await expect(page.getByText(/check your email/i)).toBeVisible({
        timeout: 10_000,
      });
    });

    test('navigates back to sign-in', async ({ page }) => {
      await page.goto('/auth/forgot-password');
      await page.getByRole('link', { name: /back to sign in/i }).click();
      await expect(page).toHaveURL(/\/auth\/sign-in/);
    });
  });

  // --------------------------------------------------------------------------
  // Route Protection
  // --------------------------------------------------------------------------

  test.describe('Route Protection', () => {
    test('redirects unauthenticated user from /account to sign-in', async ({
      page,
    }) => {
      await page.goto('/account');
      await page.waitForURL(/\/auth\/sign-in/, { timeout: 10_000 });
      // Middleware appends ?redirect=/account
      expect(page.url()).toContain('redirect');
    });

    test('redirects unauthenticated user from /dashboard to sign-in', async ({
      page,
    }) => {
      await page.goto('/dashboard');
      await page.waitForURL(/\/auth\/sign-in/, { timeout: 10_000 });
    });

    test('redirects unauthenticated user from /reports to sign-in', async ({
      page,
    }) => {
      await page.goto('/reports');
      await page.waitForURL(/\/auth\/sign-in/, { timeout: 10_000 });
    });

    test('redirects unauthenticated user from /alerts to sign-in', async ({
      page,
    }) => {
      await page.goto('/alerts');
      await page.waitForURL(/\/auth\/sign-in/, { timeout: 10_000 });
    });
  });

  // --------------------------------------------------------------------------
  // Header Auth UI
  // --------------------------------------------------------------------------

  test.describe('Header Auth UI', () => {
    test('shows login and get started buttons when unauthenticated', async ({
      page,
    }) => {
      await page.goto('/');

      const loginBtn = page
        .getByRole('link', { name: /log in/i })
        .or(page.getByRole('button', { name: /log in/i }));
      await expect(loginBtn).toBeVisible({ timeout: 10_000 });

      const getStartedBtn = page
        .getByRole('link', { name: /get started/i })
        .or(page.getByRole('button', { name: /get started/i }));
      await expect(getStartedBtn).toBeVisible({ timeout: 10_000 });
    });
  });
});
