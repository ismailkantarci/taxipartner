export default {
  init(target) {
    target.innerHTML = '<div></div>';
    import('../../frontend/ous/page.ts')
      .then((mod) => {
        try {
          const result = mod.mountOUsPage?.(target);
          if (result && typeof result.then === 'function') {
            result.catch(() => {});
          }
        } catch {}
      })
      .catch(() => {});
  }
};
