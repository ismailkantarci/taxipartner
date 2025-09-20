# ModuleLoader Rules

- ModuleLoader must expose a `load(name)` function to dynamically import modules.
- ModuleLoader must target the DOM element with id `#modulContent`.
- The loaded module must export a `default` object with an `init(target)` function.
- If module loading fails, a fallback error message must be displayed in `#modulContent`.
- ModuleLoader must include an `init()` function to bind default module triggers (e.g., sidebar links).
- Modules are expected to be located in: `/modules/<ModuleName>/index.module.js`.
- Versioning display and titles must be dynamically injected during `load(name)`.
