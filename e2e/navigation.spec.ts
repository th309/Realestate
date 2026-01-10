import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should display the market map on home page', async ({ page }) => {
    await page.goto('/');

    // Check that we're on the map page
    await expect(page.locator('canvas.mapboxgl-canvas')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { level: 1 }).or(page.getByText('Real Estate Investment Platform'))).toBeVisible();
  });

  test('should navigate to property search page', async ({ page }) => {
    await page.goto('/');

    // Click on Search link
    await page.getByRole('button', { name: /search/i }).or(page.getByRole('link', { name: /search/i })).first().click();

    // Should be on the search page
    await expect(page).toHaveURL(/\/search/);
    await expect(page.getByRole('heading', { name: /property search/i })).toBeVisible();
  });

  test('should navigate to properties page', async ({ page }) => {
    await page.goto('/');

    // Click on Properties link
    await page.getByRole('button', { name: /properties/i }).or(page.getByRole('link', { name: /properties/i })).first().click();

    // Should be on the properties page
    await expect(page).toHaveURL(/\/properties/);
  });

  test('should show login page for unauthenticated users', async ({ page }) => {
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('should navigate between pages using navigation buttons', async ({ page }) => {
    await page.goto('/');

    // Navigate to search
    await page.getByRole('button', { name: /search/i }).or(page.getByRole('link', { name: /search/i })).first().click();
    await expect(page).toHaveURL(/\/search/);

    // Navigate back to home using logo
    await page.getByRole('link', { name: /real estate/i }).first().click();
    await expect(page).toHaveURL('/');
  });
});

test.describe('Authentication Flow', () => {
  test('should show login form', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should show register form', async ({ page }) => {
    await page.goto('/register');

    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /sign up|register|create account/i })).toBeVisible();
  });

  test('should navigate between login and register', async ({ page }) => {
    await page.goto('/login');

    // Click on "Sign Up" or "Register" link
    await page.getByRole('link', { name: /sign up|register|create account/i }).click();
    await expect(page).toHaveURL(/\/register/);

    // Click on "Sign In" or "Login" link
    await page.getByRole('link', { name: /sign in|login|already have/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
