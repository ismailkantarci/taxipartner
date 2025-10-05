export default {
  init(target) {
    target.innerHTML = '<div></div>';
    import('../../frontend/tenants/page.ts')
      .then((mod) => {
        try {
          const result = mod.mountTenantsPage?.(target);
          if (result && typeof result.then === 'function') {
            result.catch(() => {});
          }
        } catch {}
      })
      .catch(() => {});
  }
};
