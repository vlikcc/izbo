import { test, expect } from '@playwright/test';

const appUrl = process.env.SMOKE_APP_URL;

test.describe('public smoke', () => {
  test.skip(!appUrl, 'SMOKE_APP_URL is not set; skipping browser smoke.');

  test('landing page loads and login is reachable', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('EduPlatform').first()).toBeVisible();
    await page.getByRole('link', { name: /giriş/i }).first().click();
    await expect(page).toHaveURL(/login/);
    await expect(page.getByLabel('E-posta')).toBeVisible();
  });
});
