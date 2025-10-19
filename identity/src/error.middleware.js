/**
 * Minimal error handler to produce consistent JSON responses.
 * { ok: false, error: string, code?: string }
 */
export function errorMiddleware(err, _req, res, _next) {
    const status = Number(err?.status || err?.statusCode || 400);
    const message = typeof err === 'string'
        ? err
        : err?.message || 'İşlem sırasında bir hata oluştu';
    const code = err?.code;
    res.status(Number.isFinite(status) ? status : 400).json({
        ok: false,
        error: message,
        ...(code ? { code } : {})
    });
}
