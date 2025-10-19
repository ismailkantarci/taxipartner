import { expect, test } from '@playwright/test';

const NOTIFICATION_STORAGE_KEY = 'tp-admin@notifications';

const seedNotifications = () => {
  const payload = [
    {
      id: 'notif-e2e-1',
      ts: Date.now() - 60_000,
      read: false,
      type: 'info',
      title: 'Background export ready',
      body: 'Download your audit archive.'
    }
  ];
  window.localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(payload));
};

test.describe('Notifications', () => {
  test('persists read state between sessions', async ({ page }) => {
    await page.addInitScript(seedNotifications);
    await page.goto('/program/goals');

    const bell = page.getByRole('button', { name: /notifications/i });
    await bell.click();

    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
    const toggle = page.getByRole('button', { name: /Mark read/i }).first();
    await toggle.click();
    await page.getByRole('button', { name: 'Close notifications' }).click();

    await expect(bell).toHaveAttribute('aria-label', /Notifications/);

    await bell.click();
    await expect(page.getByRole('button', { name: /Mark unread/i })).toBeVisible();
  });
});
