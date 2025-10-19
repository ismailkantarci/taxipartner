import { test, expect, type Page, type Route } from '@playwright/test';

const TENANT_ID = 'TEN-ALPHA-001';
const SECOND_TENANT_ID = 'TEN-BETA-002';

const tenantAlpha = {
  tenantId: TENANT_ID,
  legalName: 'Alpha Logistics GmbH',
  legalForm: 'GmbH',
  seatAddress: 'Leopoldstraße 12, Vienna',
  status: 'Active',
  currentIdentity: {
    legalName: 'Alpha Logistics GmbH',
    legalForm: 'GmbH',
    seatAddress: 'Leopoldstraße 12, Vienna',
    validFrom: '2023-01-01',
    validTo: null
  },
  primaryIdentifier: {
    id: 'identifier-primary',
    tenantId: TENANT_ID,
    idType: 'VAT',
    idValue: 'ATU12345678',
    countryCode: 'AT',
    validFrom: '2023-01-01',
    validTo: null,
    primaryFlag: true,
    target: 'TENANT'
  }
};

const tenantBeta = {
  tenantId: SECOND_TENANT_ID,
  legalName: 'Beta Mobility AG',
  legalForm: 'AG',
  seatAddress: 'Zürichsee 4, Zürich',
  status: 'Pending',
  currentIdentity: {
    legalName: 'Beta Mobility AG',
    legalForm: 'AG',
    seatAddress: 'Zürichsee 4, Zürich',
    validFrom: '2022-05-01',
    validTo: null
  },
  primaryIdentifier: null
};

const listResponse = {
  ok: true,
  status: 200,
  items: [tenantAlpha, tenantBeta],
  total: 2,
  page: 0,
  pageSize: 25,
  sort: 'name',
  order: 'asc'
};

const identityHistoryResponse = {
  ok: true,
  status: 200,
  items: [
    {
      id: 'identity-current',
      tenantId: TENANT_ID,
      currentFlag: true,
      legalName: 'Alpha Logistics GmbH',
      legalForm: 'GmbH',
      seatAddress: 'Leopoldstraße 12, Vienna',
      validFrom: '2023-01-01',
      validTo: null,
      idType: 'VAT',
      idValue: 'ATU12345678'
    },
    {
      id: 'identity-previous',
      tenantId: TENANT_ID,
      currentFlag: false,
      legalName: 'Alpha Transport GmbH',
      legalForm: 'GmbH',
      seatAddress: 'Leopoldstraße 50, Vienna',
      validFrom: '2020-01-01',
      validTo: '2022-12-31',
      idType: 'VAT',
      idValue: 'ATU87654321'
    }
  ]
};

const identifiersResponse = {
  ok: true,
  status: 200,
  items: [
    {
      id: 'identifier-primary',
      tenantId: TENANT_ID,
      idType: 'VAT',
      idValue: 'ATU12345678',
      countryCode: 'AT',
      validFrom: '2023-01-01',
      validTo: null,
      primaryFlag: true,
      target: 'TENANT'
    },
    {
      id: 'identifier-secondary',
      tenantId: TENANT_ID,
      idType: 'EORI',
      idValue: 'EU1234567',
      countryCode: 'EU',
      validFrom: '2021-06-01',
      validTo: null,
      primaryFlag: false,
      target: 'BRANCH'
    }
  ]
};

const shareholdingsResponse = {
  ok: true,
  status: 200,
  items: [
    {
      id: 'shareholding-1',
      tenantId: TENANT_ID,
      partyId: 'party-1',
      roleType: 'Owner',
      quotaPercent: '60',
      einlageAmount: '100000',
      liability: 'Full liability',
      validFrom: '2021-01-01',
      validTo: null,
      party: {
        partyId: 'party-1',
        type: 'PERSON',
        displayName: 'Jane Doe'
      }
    }
  ]
};

const attachmentsResponse = {
  ok: true,
  status: 200,
  items: [
    {
      id: 'attachment-1',
      ownerType: 'TENANT',
      ownerId: TENANT_ID,
      attachmentType: 'Certificate of Incorporation',
      fileRef: 'alpha-certificate.pdf',
      issuedAt: '2024-01-10',
      sourceUrl: 'https://example.com/cert.pdf',
      createdAt: '2024-01-10T08:30:00Z'
    }
  ]
};

const approvalsResponse = {
  ok: true,
  status: 200,
  items: [
    {
      id: 'approval-1',
      tenantId: TENANT_ID,
      scope: 'identity',
      op: 'create',
      status: 'Approved',
      objectId: 'identity-current',
      idempotencyKey: 'identity#create#alpha',
      payload: {
        idType: 'VAT',
        idValue: 'ATU12345678'
      },
      createdAt: '2024-03-15T09:45:00Z'
    }
  ]
};

const officersResponse = {
  ok: true,
  status: 200,
  items: [
    {
      id: 'officer-1',
      level: 'TENANT',
      tenantId: TENANT_ID,
      companyId: 'company-1',
      partyId: 'party-2',
      officerType: 'Director',
      validFrom: '2021-06-01',
      validTo: null,
      party: {
        partyId: 'party-2',
        type: 'PERSON',
        displayName: 'John Smith'
      }
    }
  ]
};

const vehiclesResponse = {
  ok: true,
  status: 200,
  items: [
    {
      id: 'vehicle-assignment-1',
      vehicleId: 'VHC-1001',
      tenantId: TENANT_ID,
      companyId: 'company-veh',
      assignedFrom: '2023-05-01',
      assignedTo: null,
      approvalId: 'approval-vehicle-1'
    }
  ]
};

const driversResponse = {
  ok: true,
  status: 200,
  items: [
    {
      id: 'driver-assignment-1',
      partyId: 'party-driver-1',
      tenantId: TENANT_ID,
      companyId: 'company-veh',
      assignedFrom: '2023-05-15',
      assignedTo: null,
      approvalId: 'approval-driver-1',
      party: {
        partyId: 'party-driver-1',
        type: 'PERSON',
        displayName: 'Murat Kaya'
      }
    }
  ]
};

const successResponse = { ok: true, status: 200 };

const respondJson = (route: Route, data: unknown) =>
  route.fulfill({
    status: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data)
  });

const stubTenantsApi = async (page: Page) => {
  const interceptList = async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.resourceType() === 'document') {
      await route.continue();
      return;
    }
    if (request.method() === 'GET' && url.pathname === '/tenants') {
      respondJson(route, listResponse);
      return;
    }
    await route.continue();
  };

  await page.route('**/tenants?**', interceptList);
  await page.route('**/tenants', interceptList);

  const detailRoutes = new Map<string, unknown>([
    [`/tenants/${TENANT_ID}/identity-history`, identityHistoryResponse],
    [`/tenants/${TENANT_ID}/identities`, identifiersResponse],
    [`/tenants/${TENANT_ID}/shareholdings`, shareholdingsResponse],
    [`/tenants/${TENANT_ID}/attachments`, attachmentsResponse],
    [`/tenants/${TENANT_ID}/approvals`, approvalsResponse],
    [`/tenants/${TENANT_ID}/officers`, officersResponse],
    [`/tenants/${TENANT_ID}/vehicle-assignments`, vehiclesResponse],
    [`/tenants/${TENANT_ID}/driver-assignments`, driversResponse]
  ]);

  for (const [path, payload] of detailRoutes) {
    await page.route(`**${path}`, async (route: Route) => {
      const method = route.request().method();
      if (method === 'GET') {
        respondJson(route, payload);
        return;
      }
      if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
        respondJson(route, successResponse);
        return;
      }
      await route.continue();
    });
  }
};

const drawerLocator = (page: Page) =>
  page
    .locator('section.relative.flex.flex-1')
    .locator('div.flex.w-full.justify-center')
    .locator('> div.flex.w-full.flex-col');

test.describe('Tenants module (React)', () => {
  test.beforeEach(async ({ page }) => {
    await stubTenantsApi(page);
  });

  test.describe('desktop (1280px)', () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test('list to detail flow and dialog validations', async ({ page }) => {
      await page.goto('/tenants');

      const tenantsHeading = page.getByRole('heading', { level: 1, name: 'Tenants' });
      await expect(tenantsHeading).toBeVisible();

      const alphaRow = page.getByRole('button', { name: /Alpha Logistics GmbH/i });
      const betaRow = page.getByRole('button', { name: /Beta Mobility AG/i });
      await expect(alphaRow).toBeVisible();
      await expect(betaRow).toBeVisible();
      const alphaRadio = page.getByRole('radio', { name: /Select Alpha Logistics GmbH/i });
      await expect(alphaRadio).toBeChecked();

      const assignFromList = page.getByRole('button', { name: 'Assign user' }).first();
      await expect(assignFromList).toBeEnabled();
      await assignFromList.click();

      const assignDialog = page.getByRole('dialog', { name: 'Assign user' });
      await expect(assignDialog).toBeVisible();
      const assignSubmit = assignDialog.getByRole('button', { name: 'Assign user' });
      await expect(assignSubmit).toBeEnabled();
      await assignDialog.locator('input[name="userId"]').fill(' ');
      await assignSubmit.click();
      await expect(assignDialog.getByText('User ID is required.')).toBeVisible();
      await assignDialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(assignDialog).not.toBeVisible();

      const newTenantButton = page.getByRole('button', { name: 'New tenant' });
      await newTenantButton.click();

      const createDialog = page.getByRole('dialog', { name: 'Create tenant' });
      await expect(createDialog).toBeVisible();
      await createDialog.locator('input[name="legalName"]').fill(' ');
      await createDialog.getByRole('button', { name: 'Save tenant' }).click();
      await expect(createDialog.getByText('Legal name is required.')).toBeVisible();
      await createDialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(createDialog).not.toBeVisible();

      await alphaRow.click();
      await expect(page).toHaveURL(/\/tenants\/TEN-ALPHA-001$/);

      const detailHeading = page.getByRole('heading', {
        level: 1,
        name: 'Alpha Logistics GmbH'
      });
      await expect(detailHeading).toBeVisible();
      await expect(detailHeading).toBeFocused();
      await expect(page.getByText(/^TEN-ALPHA-001$/)).toBeVisible();
      await expect(page.getByText('Active')).toBeVisible();

      const detailDrawer = drawerLocator(page);
      const drawerWidth = await detailDrawer.evaluate(element =>
        Math.round(element.getBoundingClientRect().width)
      );
      expect(drawerWidth).toBeLessThanOrEqual(800);
      expect(drawerWidth).toBeGreaterThan(740);

      const detailContainer = page.locator('section.relative.flex.flex-1');
      const desktopBackground = await detailContainer.evaluate(element =>
        getComputedStyle(element).backgroundColor
      );
      expect(desktopBackground).not.toBe('rgba(0, 0, 0, 0)');
      const desktopBorder = await detailDrawer.evaluate(element =>
        getComputedStyle(element).borderLeftWidth
      );
      expect(desktopBorder).toBe('1px');

      await expect(page.getByRole('heading', { level: 2, name: 'Identity history' })).toBeVisible();
      await expect(
        page.getByRole('heading', { level: 2, name: 'Identifiers' })
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { level: 2, name: 'Shareholdings' })
      ).toBeVisible();
      await expect(page.getByText('Jane Doe')).toBeVisible();
      await expect(page.getByText('Certificate of Incorporation')).toBeVisible();
      await expect(page.getByText('John Smith')).toBeVisible();
      await expect(page.getByText('VHC-1001')).toBeVisible();
      await expect(page.getByText('Murat Kaya')).toBeVisible();

      const overviewSection = detailDrawer.locator('section').first();
      const detailAssignButton = overviewSection.getByRole('button', { name: 'Assign user' });
      await detailAssignButton.click();
      const detailAssignDialog = page.getByRole('dialog', { name: 'Assign user' });
      await detailAssignDialog.locator('input[name="userId"]').fill(' ');
      await detailAssignDialog.getByRole('button', { name: 'Assign user' }).click();
      await expect(detailAssignDialog.getByText('User ID is required.')).toBeVisible();
      await detailAssignDialog.getByRole('button', { name: 'Cancel' }).click();

      const newIdentityButton = overviewSection.getByRole('button', { name: 'New identity' });
      await newIdentityButton.click();
      const identifierDialog = page.getByRole('dialog', { name: 'Add identifier' });
      await identifierDialog.locator('input[name="idType"]').fill(' ');
      await identifierDialog.locator('input[name="idValue"]').fill(' ');
      await identifierDialog.getByRole('button', { name: 'Save identifier' }).click();
      await expect(
        identifierDialog.getByText('Identifier type and value are required.')
      ).toBeVisible();
      await identifierDialog.getByRole('button', { name: 'Cancel' }).click();

      const shareholdingsSection = page
        .locator('section')
        .filter({ has: page.getByRole('heading', { level: 2, name: 'Shareholdings' }) });
      await shareholdingsSection.getByRole('button', { name: 'Add shareholding' }).click();
      const shareholdingDialog = page.getByRole('dialog', { name: 'Add shareholding' });
      await shareholdingDialog.locator('input[name="roleType"]').fill(' ');
      await shareholdingDialog.getByRole('button', { name: 'Save shareholding' }).click();
      await expect(
        shareholdingDialog.getByText('Role and either party ID or party details are required.')
      ).toBeVisible();
      await shareholdingDialog.getByRole('button', { name: 'Cancel' }).click();

      const attachmentsSection = page
        .locator('section')
        .filter({ has: page.getByRole('heading', { level: 2, name: 'Attachments' }) });
      await attachmentsSection.getByRole('button', { name: 'Add attachment' }).click();
      const attachmentDialog = page.getByRole('dialog', { name: 'Add attachment' });
      await attachmentDialog.locator('input[name="ownerId"]').fill(' ');
      await attachmentDialog.locator('input[name="attachmentType"]').fill(' ');
      await attachmentDialog.locator('input[name="fileRef"]').fill(' ');
      await attachmentDialog.getByRole('button', { name: 'Save attachment' }).click();
      await expect(
        attachmentDialog.getByText('Owner, attachment type and file reference are required.')
      ).toBeVisible();
      await attachmentDialog.getByRole('button', { name: 'Cancel' }).click();

      const approvalsSection = page
        .locator('section')
        .filter({ has: page.getByRole('heading', { level: 2, name: 'Approvals' }) });
      await expect(
        approvalsSection.getByRole('cell', { name: 'identity', exact: true })
      ).toBeVisible();
      await approvalsSection.getByRole('button', { name: 'Add approval' }).click();
      const approvalDialog = page.getByRole('dialog', { name: 'Create approval' });
      const approvalScopeInput = approvalDialog.locator('input[name="scope"]');
      const approvalOpInput = approvalDialog.locator('input[name="op"]');
      await approvalScopeInput.waitFor({ state: 'visible' });
      await approvalScopeInput.fill(' ');
      await approvalOpInput.fill(' ');
      await approvalDialog.getByRole('button', { name: 'Save approval' }).click();
      await expect(
        approvalDialog.getByText('Scope and operation are required.')
      ).toBeVisible();
      await approvalDialog.getByRole('button', { name: 'Cancel' }).click();

      const officersSection = page
        .locator('section')
        .filter({ has: page.getByRole('heading', { level: 2, name: 'Officers' }) });
      await officersSection.getByRole('button', { name: 'Add officer' }).click();
      const officerDialog = page.getByRole('dialog', { name: 'Add officer' });
      await officerDialog.locator('input[name="officerType"]').fill(' ');
      await officerDialog.getByRole('button', { name: 'Save officer' }).click();
      await expect(officerDialog.getByText('Officer type is required.')).toBeVisible();
      await officerDialog.getByRole('button', { name: 'Cancel' }).click();

      const vehiclesSection = page
        .locator('section')
        .filter({ has: page.getByRole('heading', { level: 2, name: 'Vehicle assignments' }) });
      await vehiclesSection.getByRole('button', { name: 'Add vehicle' }).click();
      const vehicleDialog = page.getByRole('dialog', { name: 'Assign vehicle' });
      await vehicleDialog.locator('input[name="vehicleId"]').fill(' ');
      await vehicleDialog.locator('input[name="companyId"]').fill(' ');
      await vehicleDialog.locator('input[name="assignedFrom"]').fill('2024-01-01');
      await vehicleDialog.getByRole('button', { name: 'Save assignment' }).click();
      await expect(
        vehicleDialog.getByText('Vehicle, company and start date are required.')
      ).toBeVisible();
      await vehicleDialog.getByRole('button', { name: 'Cancel' }).click();

      const driversSection = page
        .locator('section')
        .filter({ has: page.getByRole('heading', { level: 2, name: 'Driver assignments' }) });
      await driversSection.getByRole('button', { name: 'Add driver' }).click();
      const driverDialog = page.getByRole('dialog', { name: 'Assign driver' });
      await driverDialog.locator('input[name="companyId"]').fill(' ');
      await driverDialog.locator('input[name="assignedFrom"]').fill('2024-01-01');
      await driverDialog.getByRole('button', { name: 'Save assignment' }).click();
      await expect(
        driverDialog.getByText('Company, start date and party details are required.')
      ).toBeVisible();
      await driverDialog.getByRole('button', { name: 'Cancel' }).click();

      await attachmentsSection
        .getByRole('row', { name: /Certificate of Incorporation/i })
        .getByRole('button', { name: 'Remove' })
        .click();
      const attachmentConfirm = page.getByRole('dialog', { name: 'Remove attachment' });
      await expect(
        attachmentConfirm
          .getByText('This removes Certificate of Incorporation from the attachment list.', { exact: true })
          .first()
      ).toBeVisible();
      await attachmentConfirm.getByRole('button', { name: 'Cancel' }).click();

      await approvalsSection
        .getByRole('row', { name: /identity/i })
        .getByRole('button', { name: 'Remove' })
        .click();
      const approvalsConfirm = page.getByRole('dialog', { name: 'Remove approval' });
      await expect(
        approvalsConfirm.getByText('This removes approval identity.', { exact: true }).first()
      ).toBeVisible();
      await approvalsConfirm.getByRole('button', { name: 'Cancel' }).click();

      await officersSection
        .getByRole('row', { name: /John Smith/i })
        .getByRole('button', { name: 'Remove' })
        .click();
      const officerConfirm = page.getByRole('dialog', { name: 'Remove officer' });
      await expect(
        officerConfirm
          .getByText('This removes John Smith from the officer list.', { exact: true })
          .first()
      ).toBeVisible();
      await officerConfirm.getByRole('button', { name: 'Cancel' }).click();

      await vehiclesSection
        .getByRole('row', { name: /VHC-1001/i })
        .getByRole('button', { name: 'Remove' })
        .click();
      const vehicleConfirm = page.getByRole('dialog', { name: 'Remove vehicle assignment' });
      await expect(
        vehicleConfirm
          .getByText('This removes vehicle VHC-1001 from this tenant.', { exact: true })
          .first()
      ).toBeVisible();
      await vehicleConfirm.getByRole('button', { name: 'Cancel' }).click();

      await driversSection
        .getByRole('row', { name: /Murat Kaya/i })
        .getByRole('button', { name: 'Remove' })
        .click();
      const driverConfirm = page.getByRole('dialog', { name: 'Remove driver assignment' });
      await expect(
        driverConfirm.getByText('This removes Murat Kaya from this tenant.', { exact: true }).first()
      ).toBeVisible();
      await driverConfirm.getByRole('button', { name: 'Cancel' }).click();

      await page.getByRole('button', { name: 'Back to list' }).click();
      await expect(page).toHaveURL('/tenants');
      await expect(page.getByRole('heading', { level: 1, name: 'Tenants' })).toBeVisible();
    });
  });

  test.describe('tablet (1023px)', () => {
    test.use({ viewport: { width: 1023, height: 900 } });

    test('detail view stays full-width without drawer styling', async ({ page }) => {
      await page.goto(`/tenants/${TENANT_ID}`);

      const detailHeading = page.getByRole('heading', {
        level: 1,
        name: 'Alpha Logistics GmbH'
      });
      await expect(detailHeading).toBeVisible();

      const detailDrawer = drawerLocator(page);

      const detailContainer = page.locator('section.relative.flex.flex-1');
      const tabletBackground = await detailContainer.evaluate(element =>
        getComputedStyle(element).backgroundColor
      );
      expect(tabletBackground).toBe('rgba(0, 0, 0, 0)');
      const tabletBorder = await detailDrawer.evaluate(element =>
        getComputedStyle(element).borderLeftWidth
      );
      expect(tabletBorder).toBe('0px');
    });
  });

  test.describe('mobile (390px)', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('detail view fills viewport and keeps back navigation accessible', async ({ page }) => {
      await page.goto(`/tenants/${TENANT_ID}`);

      const detailHeading = page.getByRole('heading', {
        level: 1,
        name: 'Alpha Logistics GmbH'
      });
      await expect(detailHeading).toBeVisible();

      const detailDrawer = drawerLocator(page);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(viewportWidth).toBe(390);
      const mobileBorder = await detailDrawer.evaluate(element =>
        getComputedStyle(element).borderLeftWidth
      );
      expect(mobileBorder).toBe('0px');
      const backButton = page.getByRole('button', { name: 'Back to list' });
      await expect(backButton).toBeVisible();
      await backButton.click();
      await expect(page).toHaveURL('/tenants');
    });
  });
});
