# User Module Rules

- User data must be exported as `export const user = {...}`.
- User must contain: fullName, email, companyTag, language, roles, tenants[].
- This module provides configuration to `Header`, `Sidebar`, and other modules.
- File name must be: `user.data.module.js`.
- Tenants must be an array with `id` and `name` properties.
