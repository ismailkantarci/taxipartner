export default {
  init(target) {
    target.innerHTML = '<div></div>';
    import('../../frontend/organizations/page.ts')
      .then((mod) => {
        try {
          const result = mod.mountOrganizationsPage?.(target);
          if (result && typeof result.then === 'function') {
            result.catch(() => {});
          }
        } catch {}
      })
      .catch(() => {});
  }
};
