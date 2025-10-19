import type { IamRole } from './iamTypes';

export const iamSeedRoles = [
  {
    name: 'Superadmin',
    description: 'Full erişim: platform ayarları, IAM ve operasyon modülleri.',
    permissions: ['identity.user.view', 'identity.user.create', 'identity.user.update', 'finance.view', 'tp.tenant.create']
  },
  {
    name: 'Operations Admin',
    description: 'Filolar, tenantlar ve operasyonel kayıtlar için yazma yetkisi.',
    permissions: ['tp.tenant.update', 'tp.assignment.vehicle.create', 'vehicle.manage']
  },
  {
    name: 'Compliance Officer',
    description: 'Uyumluluk modüllerini yönetir, denetimlere hazırlık yapar.',
    permissions: ['Operations-Write', 'risk.review']
  },
  {
    name: 'Risk Analyst',
    description: 'Risk kayıtlarını izler ve raporlar.',
    permissions: ['risk.review']
  },
  {
    name: 'Viewer',
    description: 'Salt-okunur erişim; raporları ve listeleri görüntüler.',
    permissions: ['identity.user.view', 'tp.tenant.read']
  }
] satisfies IamRole[];
