export default {
  init(target) {
    target.innerHTML = '<div></div>';
    import('../../frontend/mandates/page.ts')
      .then((mod) => {
        try {
          const result = mod.mountMandatesPage?.(target);
          if (result && typeof result.then === 'function') {
            result.catch(() => {});
          }
        } catch {}
      })
      .catch(() => {});
  }
};
