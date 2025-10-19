import type { ShareholdingItem } from '../../api/tenants/types';

type ShareholdingSummaryArgs = {
  referenceDate?: Date;
};

export type ShareholdingSummary = {
  total: number;
  active: number;
  uniqueParties: number;
  totalQuota: number;
  withQuota: number;
  withoutQuota: number;
};

const parseQuota = (value?: string | null): number => {
  if (!value) return 0;
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const isActive = (item: ShareholdingItem, reference: Date): boolean => {
  const from = item.validFrom ? new Date(item.validFrom) : null;
  const to = item.validTo ? new Date(item.validTo) : null;
  const afterStart = from ? from.getTime() <= reference.getTime() : true;
  const beforeEnd = to ? to.getTime() >= reference.getTime() : true;
  return afterStart && beforeEnd;
};

export const summarizeShareholdings = (
  items: ShareholdingItem[],
  { referenceDate = new Date() }: ShareholdingSummaryArgs = {}
): ShareholdingSummary => {
  const uniquePartyIds = new Set<string>();
  let totalQuota = 0;
  let withQuota = 0;

  items.forEach(item => {
    if (item.partyId) {
      uniquePartyIds.add(item.partyId);
    } else if (item.party?.partyId) {
      uniquePartyIds.add(item.party.partyId);
    }

    const quota = parseQuota(item.quotaPercent);
    if (quota > 0) {
      totalQuota += quota;
      withQuota += 1;
    }
  });

  const active = items.reduce(
    (count, item) => (isActive(item, referenceDate) ? count + 1 : count),
    0
  );

  return {
    total: items.length,
    active,
    uniqueParties: uniquePartyIds.size,
    totalQuota,
    withQuota,
    withoutQuota: Math.max(0, items.length - withQuota)
  };
};

export const formatQuotaPercentage = (value: number): string => {
  if (!Number.isFinite(value) || value === 0) {
    return '0%';
  }
  return `${Number(value.toFixed(2))}%`;
};

