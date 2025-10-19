import { expect, test } from '@playwright/test';

test.describe('Audit center', () => {
  test('filters events and downloads a CSV export', async ({ page }) => {
    await page.goto('/audit');

    await expect(page.getByRole('heading', { name: /Audit/i })).toBeVisible();

    const search = page.getByPlaceholder(/Ereignisse durchsuchen|Search events/i);
    await search.fill('login');
    await search.press('Enter');

    await expect(page.getByRole('cell', { name: /Successful login/i })).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Export CSV|CSV exportieren/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/audit-events.*\.csv/);
  });
});
