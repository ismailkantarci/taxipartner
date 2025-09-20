# Sidebar Module Rules

- The sidebar must be initially hidden (`-translate-x-full`).
- When toggled open, it should apply `ml-72` to `#modulContent`.
- Sidebar must close when clicking outside or on any menu link.
- Module items must be loaded using `import(...).then(mod.init())`.
- Sidebar content is managed via `loadSidebar(target, user)`.
