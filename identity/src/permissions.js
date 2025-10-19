export const PERM = {
    identity: {
        USER_VIEW: 'identity.user.view',
        USER_CREATE: 'identity.user.create',
        USER_UPDATE: 'identity.user.update',
        SETTINGS_UPDATE: 'identity.settings.update',
        MFA_ENFORCE: 'identity.mfa.enforce'
    },
    finance: {
        VIEW: 'finance.view',
        TAX_READ: 'finance.tax.read',
        TAX_WRITE: 'finance.tax.write'
    },
    docs: {
        UPLOAD: 'docs.upload',
        ARCHIVE: 'docs.archive'
    },
    risk: {
        REVIEW: 'risk.review'
    },
    release: {
        APPROVE: 'release.approve'
    },
    hr: {
        READ: 'hr.read',
        WRITE: 'hr.write'
    },
    vehicle: {
        MANAGE: 'vehicle.manage'
    },
    traffic: {
        REPORT: 'traffic.report'
    },
    contract: {
        READ: 'contract.read',
        WRITE: 'contract.write'
    },
    partner: {
        READ: 'partner.read',
        WRITE: 'partner.write'
    }
};
export const PERM_TENANT = {
    READ: 'tp.tenant.read',
    CREATE: 'tp.tenant.create',
    USER_ASSIGN: 'tp.tenant.user.assign'
};
export const PERM_OU = {
    READ: 'tp.ou.read',
    CREATE: 'tp.ou.create'
};
export const PERM_COMPANY = {
    READ: 'tp.company.read',
    CREATE: 'tp.company.create',
    UPDATE: 'tp.company.update',
    DELETE: 'tp.company.delete'
};
export const TAG = {
    ANY_OPERATIONAL: [
        'Fahrer',
        'Mitarbeiter',
        'HR Manager',
        'Fuhrparkleiter',
        'Data Entry',
        'Recruiter',
        'Handelsrechtliche GF',
        'Gewerberechtliche GF',
        'Gesellschafter',
        'Hauptgesellschafter'
    ],
    ANY_WRITE_PERMS: [
        PERM.identity.USER_CREATE,
        PERM.identity.USER_UPDATE,
        PERM.identity.SETTINGS_UPDATE,
        PERM.docs.UPLOAD,
        PERM.finance.TAX_WRITE,
        PERM.contract.WRITE,
        PERM.partner.WRITE,
        PERM.vehicle.MANAGE,
        PERM.hr.WRITE,
        'Operations-Write',
        'Finance-Write',
        'Identity-Write'
    ]
};
export const ROLE_POLICY_TAGS = {
    Superadmin: ['Identity-Write', 'Finance-Write', 'Operations-Write'],
    'Compliance Officer': ['Identity-Write'],
    'Wirtschaftsprüfer': ['Finance-Write'],
    'Internal Auditor': ['Operations-Write'],
    Kontroller: ['Identity-Write'],
    Steuerberater: ['Finance-Write'],
    Avukat: ['Identity-Write'],
    'Handelsrechtliche GF': ['Identity-Write', 'Operations-Write'],
    'Gewerberechtliche GF': ['Operations-Write'],
    'HR Manager': ['Identity-Write', 'Operations-Write'],
    Fuhrparkleiter: ['Operations-Write'],
    Fahrer: [],
    Mitarbeiter: [],
    Gesellschafter: [],
    Hauptgesellschafter: [],
    'Data Entry': ['Operations-Write'],
    Recruiter: ['Identity-Write'],
    'Bank Viewer': [],
    Versicherungspartner: [],
    Notar: [],
    Betriebsrat: ['Identity-Write']
};
export function roleHasPolicyTag(role, tag) {
    return ROLE_POLICY_TAGS[role]?.includes(tag) ?? false;
}
