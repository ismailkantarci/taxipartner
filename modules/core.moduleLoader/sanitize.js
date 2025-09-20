export function sanitizeHTML(raw) {
  const tpl = document.createElement('template');
  tpl.innerHTML = raw;

  const walk = (node) => {
    if (node.nodeType === 1) {
      const tag = node.tagName.toLowerCase();
      // Drop risky elements entirely
      if (['script', 'iframe', 'object', 'embed', 'link', 'style'].includes(tag)) {
        node.remove();
        return;
      }
      // Drop risky attributes
      [...node.attributes].forEach((attr) => {
        const name = attr.name;
        const value = String(attr.value || '');
        // Remove event handlers and inline styles
        if (/^on/i.test(name) || name === 'style') {
          node.removeAttribute(name);
          return;
        }
        // Disallow javascript: URLs
        if ((name === 'href' || name === 'src' || name === 'srcset') && /^\s*javascript:/i.test(value)) {
          node.removeAttribute(name);
        }
      });
    }
    [...node.childNodes].forEach(walk);
  };

  [...tpl.content.childNodes].forEach(walk);
  return tpl.innerHTML;
}
