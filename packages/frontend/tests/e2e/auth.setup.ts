/**
 * Authentication setup for E2E tests
 *
 * Creates authenticated sessions for different user tiers:
 * - Free user
 * - Basic user
 * - Pro user
 * - Enterprise user
 * - Admin user
 */

import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../fixtures/.auth/user.json');
const freeUserAuthFile = path.join(__dirname, '../fixtures/.auth/free-user.json');
const proUserAuthFile = path.join(__dirname, '../fixtures/.auth/pro-user.json');
const adminUserAuthFile = path.join(__dirname, '../fixtures/.auth/admin-user.json');

// Test user credentials (should be configured via env vars in real setup)
const TEST_USERS = {
  free: {
    email: process.env.TEST_FREE_USER_EMAIL || 'free@test.propertyiq.com',
    password: process.env.TEST_FREE_USER_PASSWORD || 'TestPassword123!',
  },
  pro: {
    email: process.env.TEST_PRO_USER_EMAIL || 'pro@test.propertyiq.com',
    password: process.env.TEST_PRO_USER_PASSWORD || 'TestPassword123!',
  },
  admin: {
    email: process.env.TEST_ADMIN_USER_EMAIL || 'admin@test.propertyiq.com',
    password: process.env.TEST_ADMIN_USER_PASSWORD || 'TestPassword123!',
  },
};

setup('authenticate as free user', async ({ page }) => {
  // Navigate to login page
  await page.goto('/login');

  // Fill in credentials
  await page.getByLabel('Email').fill(TEST_USERS.free.email);
  await page.getByLabel('Password').fill(TEST_USERS.free.password);

  // Submit login form
  await page.getByRole('button', { name: /sign in|log in/i }).click();

  // Wait for successful login redirect
  await page.waitForURL(/\/(dashboard|map|home)?$/);

  // Verify login was successful
  await expect(page.getByTestId('user-menu')).toBeVisible({ timeout: 10000 });

  // Save authentication state
  await page.context().storageState({ path: freeUserAuthFile });
});

setup('authenticate as pro user', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Email').fill(TEST_USERS.pro.email);
  await page.getByLabel('Password').fill(TEST_USERS.pro.password);

  await page.getByRole('button', { name: /sign in|log in/i }).click();

  await page.waitForURL(/\/(dashboard|map|home)?$/);

  await expect(page.getByTestId('user-menu')).toBeVisible({ timeout: 10000 });

  await page.context().storageState({ path: proUserAuthFile });
});

setup('authenticate as admin user', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Email').fill(TEST_USERS.admin.email);
  await page.getByLabel('Password').fill(TEST_USERS.admin.password);

  await page.getByRole('button', { name: /sign in|log in/i }).click();

  await page.waitForURL(/\/(dashboard|map|home)?$/);

  await expect(page.getByTestId('user-menu')).toBeVisible({ timeout: 10000 });

  await page.context().storageState({ path: adminUserAuthFile });
});

export { TEST_USERS, freeUserAuthFile, proUserAuthFile, adminUserAuthFile };
