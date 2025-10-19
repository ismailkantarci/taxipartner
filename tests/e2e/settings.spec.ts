import { expect, test } from '@playwright/test';

test.describe('System Settings', () => {
  test('quick language switch applies immediately', async ({ page }) => {
    await page.goto('/system/settings');

    await expect(page.getByRole('heading', { name: /Systemeinstellungen|System Settings/i })).toBeVisible();

    const languageButton = page.getByRole('button', { name: /DE-AT|Language|Sprache/i }).first();
    await languageButton.click();
    await page.getByRole('button', { name: /Englisch \(UK\)|English \(UK\)/i }).click();

    await expect(page.getByRole('button', { name: /EN-GB/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /System Settings/i })).toBeVisible();
  });
});
