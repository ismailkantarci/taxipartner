import type { IamPermission } from './iamTypes';

export const iamSeedPermissions = [
  {
    key: 'identity.user.view',
    scope: 'Identity',
    description: 'Kullanıcı kayıtlarını görüntüleme izni.'
  },
  {
    key: 'identity.user.create',
    scope: 'Identity',
    description: 'Yeni kullanıcı oluşturma ve davet gönderme izni.'
  },
  {
    key: 'identity.settings.update',
    scope: 'Identity',
    description: 'IAM genel ayarlarını ve MFA politikalarını değiştirme izni.'
  },
  {
    key: 'vehicle.manage',
    scope: 'Operations',
    description: 'Araç atamalarını ve yetkilendirmelerini yönetme izni.'
  },
  {
    key: 'tp.tenant.user.assign',
    scope: 'Tenants',
    description: 'Tenant bazlı rol ve kullanıcı atamalarını düzenleme.'
  },
  {
    key: 'tp.ou.create',
    scope: 'Org Units',
    description: 'Yeni organizasyon birimleri tanımlama veya hiyerarşi güncelleme.'
  },
  {
    key: 'risk.review',
    scope: 'Risk',
    description: 'Risk kayıtlarını değerlendirme ve raporlama izni.'
  },
  {
    key: 'release.approve',
    scope: 'Release',
    description: 'Yeni sürüm planlarını onaylama yetkisi.'
  }
] satisfies IamPermission[];
