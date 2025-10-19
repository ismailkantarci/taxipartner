export function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector(selector);
  if (!element) {
    throw new Error(`Selector not found: ${selector}`);
  }
  return element as T;
}

export function optionalElement<T extends Element>(root: ParentNode, selector: string): T | null {
  const element = root.querySelector(selector);
  return (element as T | null) ?? null;
}

export function requireElementById<T extends HTMLElement>(id: string, host: Document | DocumentFragment = document): T {
  const element = host.getElementById(id);
  if (!element) {
    throw new Error(`Element with id "${id}" not found`);
  }
  return element as T;
}
