import { test, expect } from '@playwright/test';

const appUrl = process.env.SMOKE_APP_URL;

test.describe('public smoke', () => {
  test.skip(!appUrl, 'SMOKE_APP_URL is not set; skipping browser smoke.');

  test('landing page loads and login is reachable', async ({ page }) => {
    // Anasayfa YZ Kampüs (ilkokul) arayüzüdür; girişi T.C. kimlik no ile yapılır.
    await page.goto('/');
    await expect(page.getByText('YZ Kampüs').first()).toBeVisible();
    await page.getByRole('link', { name: /giriş/i }).first().click();
    await expect(page).toHaveURL(/giris/);
    await expect(page.getByLabel('T.C. Kimlik No')).toBeVisible();
  });

  test('a grade page lists its subjects for signed-out visitors', async ({ page }) => {
    // Eski seviye adresi /seviye/… altına yönlendirilir; /sinif/1–4 YZ Kampüs sınıf sayfalarıdır.
    await page.goto('/sinif/5-sinif');
    await expect(page).toHaveURL(/\/seviye\/5-sinif/);
    await expect(page.getByRole('heading', { level: 1, name: /5\. Sınıf/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Matematik' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Veli olarak üye ol/ })).toHaveAttribute('href', '/register?rol=veli');
  });

  test('robots.txt points crawlers at the sitemap', async ({ request }) => {
    const robots = await request.get('/robots.txt');
    expect(robots.ok()).toBeTruthy();
    expect(await robots.text()).toContain('/sitemap.xml');
    const sitemap = await request.get('/sitemap.xml');
    expect(await sitemap.text()).toContain('/seviye/12-sinif');
  });
});
