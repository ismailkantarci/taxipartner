export function getActiveTenantId(): string {
  const raw =
    localStorage.getItem('selectedTenantId') ?? localStorage.getItem('tp_tenantId');
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return '';
  return trimmed;
}

export function setActiveTenantId(tenantId: string) {
  if (tenantId && tenantId !== 'undefined' && tenantId !== 'null') {
    localStorage.setItem('selectedTenantId', tenantId);
    localStorage.setItem('tp_tenantId', tenantId);
  }
}
