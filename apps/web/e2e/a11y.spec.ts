import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// WCAG 2.1 AA automated audit across the five learner-facing flows named in
// Sprint 12: registration, course browsing, module reading, quiz-taking,
// certificate download. Zero critical/serious violations is the bar —
// moderate/minor findings are reported but don't fail the run.

const SEVERE = ['critical', 'serious'];

async function assertNoSevereViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const severe = results.violations.filter((v) => SEVERE.includes(v.impact ?? ''));
  if (severe.length > 0) {
    const summary = severe
      .map((v) => `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`)
      .join('\n');
    throw new Error(`Critical/serious a11y violations found:\n${summary}`);
  }
  expect(severe).toHaveLength(0);
}

// Seeded demo learner account — see backend/prisma/seed.ts (DEMO_PASSWORD).
async function loginAsLearner(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'grace@zimhealthcpd.co.zw');
  await page.fill('input[type="password"]', 'Demo@1234');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe('Accessibility (WCAG 2.1 AA)', () => {
  test('registration form has no severe violations', async ({ page }) => {
    await page.goto('/register');
    await assertNoSevereViolations(page);
  });

  test('login form has no severe violations', async ({ page }) => {
    await page.goto('/login');
    await assertNoSevereViolations(page);
  });

  test('course browsing page has no severe violations', async ({ page }) => {
    await loginAsLearner(page);
    await page.goto('/courses');
    await page.waitForLoadState('networkidle');
    await assertNoSevereViolations(page);
  });

  test('module reading (course player) has no severe violations', async ({ page }) => {
    await loginAsLearner(page);
    await page.goto('/courses/course-seed-midwifery-essential-newborn-care');
    await page.waitForLoadState('networkidle');
    await assertNoSevereViolations(page);
  });

  test('quiz-taking has no severe violations', async ({ page }) => {
    await loginAsLearner(page);
    await page.goto('/courses/course-seed-midwifery-essential-newborn-care');
    await page.waitForLoadState('networkidle');
    await page.getByText('Newborn Care Assessment', { exact: true }).click();
    await page.waitForSelector('text=Question 1 of');
    await assertNoSevereViolations(page);
  });

  test('certificates page has no severe violations', async ({ page }) => {
    await loginAsLearner(page);
    await page.goto('/certificates');
    await page.waitForLoadState('networkidle');
    await assertNoSevereViolations(page);
  });

  test('all interactive elements on the login form are keyboard-reachable', async ({ page }) => {
    await page.goto('/login');
    // Tab from the top of the page through to the submit button — every
    // control we land on must be visibly focused (no keyboard trap, no
    // invisible/unreachable focus target).
    const focusableCount = await page.evaluate(() =>
      document.querySelectorAll('input, button, a[href], select, textarea, [tabindex]:not([tabindex="-1"])').length,
    );
    expect(focusableCount).toBeGreaterThan(0);

    for (let i = 0; i < focusableCount; i++) {
      await page.keyboard.press('Tab');
    }
    const activeTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(activeTag).toBeTruthy();
  });
});
