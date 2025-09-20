# AppState Module Rules

- AppState must be a singleton export: `export const AppState = { ... }`
- Must contain `currentUser`, `activeModule`, `language`, `theme`
- Must provide setters for each key: `setUser`, `setActiveModule`, etc.
- AppState should be imported and shared across modules that need runtime state access
- File must be named `app.state.module.js` and live in `core.state/`
