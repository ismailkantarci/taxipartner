/**
 * Accept-Language hint middleware (no behavior change).
 * Attaches req.localeHint = "tr" | "de" | "en" | undefined for logging/analytics purposes.
 */
export function langHint(req: any, _res: any, next: any) {
  try {
    const header = String(req?.headers?.['accept-language'] || '').toLowerCase();
    const match = header.match(/^(tr|de|en)/);
    if (match) {
      req.localeHint = match[1];
    }
  } catch {
    // ignore parsing issues
  }
  next();
}
