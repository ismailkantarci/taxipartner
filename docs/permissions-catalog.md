# TAXIPartner Permission Catalog (baseline)

_Source of truth_: `identity/seeds/seed_role_permissions.json`  
Use `scripts/audit-permissions.mjs` to list references not present in seeds.

## Namespaces (examples)
- `tp.identity.*` — identity & RBAC
- `tp.finance.*` — finance
- `tp.hr.*` — HR
- `tp.vehicle.*` — fleet/vehicle
- `tp.contract.*` — contracts
- `tp.docs.*` — documents
- `tp.risk.*` — risk management
- `tp.audit.*` — audit logs

> Replace wildcards (`*`) with explicit keys per module as you tighten access.
