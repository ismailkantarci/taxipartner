import { expect, test } from '@playwright/test';

const SHAREHOLDER_HEADING = /Shareholders|Beteiligungen|Hissedarlar|Акціонери/i;

test.describe('Shareholders workspace', () => {
  test('is reachable through tenants navigation', async ({ page }) => {
    await page.goto('/tenants');

    const navLink = page.getByRole('link', { name: SHAREHOLDER_HEADING });
    await expect(navLink).toBeVisible();

    await navLink.click();
    await expect(page).toHaveURL(/\/tenants\/shareholders/);
    await expect(page.getByRole('heading', { name: SHAREHOLDER_HEADING })).toBeVisible();
  });

  test('renders filter controls and tenant placeholder', async ({ page }) => {
    await page.goto('/tenants/shareholders');

    await expect(page.getByRole('heading', { name: SHAREHOLDER_HEADING })).toBeVisible();
    await expect(
      page.getByPlaceholder(/Search tenants…|Mandanten durchsuchen…|Kiracılarda ara…|Пошук орендарів…/i)
    ).toBeVisible();
    await expect(
      page.getByText(/Select a tenant|Mandanten auswählen|Kiracı seç|Виберіть орендаря/i).first()
    ).toBeVisible();
  });
});

