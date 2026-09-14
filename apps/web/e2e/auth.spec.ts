import { test, expect } from '@playwright/test';

test('learner can log in and see dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'grace@zimhealthcpd.co.zw');
  await page.fill('input[type="password"]', 'Demo@1234');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText('CPD Progress')).toBeVisible();
});

test('unauthenticated user redirected to login from /dashboard', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});

test('learner cannot access /admin', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'grace@zimhealthcpd.co.zw');
  await page.fill('input[type="password"]', 'Demo@1234');
  await page.click('button[type="submit"]');
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/dashboard$/);
});
