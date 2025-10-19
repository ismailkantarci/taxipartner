export function companyGuard() {
  return function companyGuardMiddleware(req, res, next) {
    const normalize = (raw) => {
      if (Array.isArray(raw) && raw.length) {
        const [first] = raw;
        return typeof first === "string" ? first.trim() : undefined;
      }
      if (typeof raw === "string") {
        const value = raw.trim();
        return value.length ? value : undefined;
      }
      return undefined;
    };

    const tenantHeader = normalize(req.headers["x-tenant-id"]) ?? normalize(req.headers["X-Tenant-Id"]);
    const companyHeader = normalize(req.headers["x-company-id"]) ?? normalize(req.headers["X-Company-Id"]);

    if (!tenantHeader) {
      res.status(400).json({ ok: false, error: "x-tenant-id header is required" });
      return;
    }
    if (!companyHeader) {
      res.status(400).json({ ok: false, error: "x-company-id header is required" });
      return;
    }

    const bodyTenant = typeof req.body?.tenantId === "string" ? req.body.tenantId.trim() : undefined;
    const queryTenant = typeof req.query?.tenantId === "string" ? req.query.tenantId.trim() : undefined;
    if (bodyTenant && bodyTenant !== tenantHeader) {
      res.status(400).json({ ok: false, error: "tenantId mismatch between header and body/query" });
      return;
    }
    if (queryTenant && queryTenant !== tenantHeader) {
      res.status(400).json({ ok: false, error: "tenantId mismatch between header and body/query" });
      return;
    }

    const bodyCompany = typeof req.body?.companyId === "string" ? req.body.companyId.trim() : undefined;
    const queryCompany = typeof req.query?.companyId === "string" ? req.query.companyId.trim() : undefined;
    const paramCompany = typeof req.params?.companyId === "string" ? req.params.companyId.trim() : undefined;
    const paramId = typeof req.params?.id === "string" ? req.params.id.trim() : undefined;
    const expectedCompany = paramCompany ?? paramId;

    if (bodyCompany && bodyCompany !== companyHeader) {
      res.status(400).json({ ok: false, error: "companyId mismatch between header and body/query" });
      return;
    }
    if (queryCompany && queryCompany !== companyHeader) {
      res.status(400).json({ ok: false, error: "companyId mismatch between header and body/query" });
      return;
    }
    if (expectedCompany && expectedCompany !== companyHeader) {
      res.status(400).json({ ok: false, error: "companyId mismatch between header and params" });
      return;
    }

    if (req.body) {
      req.body.companyId = companyHeader;
      req.body.tenantId = tenantHeader;
    }
    if (req.query) {
      req.query.companyId = companyHeader;
      req.query.tenantId = tenantHeader;
    }

    req.tenantId = tenantHeader;
    req.companyId = companyHeader;

    next();
  };
}
