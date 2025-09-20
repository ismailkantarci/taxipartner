# Dashboard Module Rules

- Module must export default object with init(target) method.
- Must read from AppState: currentUser, activeModule, language, tenant.
- Should not mutate any AppState values.
- Must be listed in modules.config.json as default visible module.
