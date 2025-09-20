# UserManagement Module Rules

- Module must export `default` object with `init(target)` method.
- Must display current user from AppState.
- All user actions (view, edit, role) will be scoped by AppState.role in future.
- Module must live in `modules/UserManagement/`.
- Entry point: `index.module.js`.
