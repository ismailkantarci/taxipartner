import type { Request, Response, NextFunction } from "express";

type RequestWithCompanyContext = Request & {
  tenantId?: string;
  companyId?: string;
};

function normalizeHeaderValue(raw: unknown): string | undefined {
  if (Array.isArray(raw) && raw.length) {
    const [first] = raw;
    return typeof first === "string" ? first.trim() : undefined;
  }
  if (typeof raw === "string") {
    const value = raw.trim();
    return value.length ? value : undefined;
  }
  return undefined;
}

export function companyGuard() {
  return function companyGuardMiddleware(req: RequestWithCompanyContext, res: Response, next: NextFunction) {
    const tenantHeader =
      normalizeHeaderValue(req.headers["x-tenant-id"]) ?? normalizeHeaderValue((req.headers as any)["X-Tenant-Id"]);
    const companyHeader =
      normalizeHeaderValue(req.headers["x-company-id"]) ?? normalizeHeaderValue((req.headers as any)["X-Company-Id"]);

    if (!tenantHeader) {
      res.status(400).json({ ok: false, error: "x-tenant-id header is required" });
      return;
    }
    if (!companyHeader) {
      res.status(400).json({ ok: false, error: "x-company-id header is required" });
      return;
    }

    const bodyTenant = typeof req.body?.tenantId === "string" ? req.body.tenantId.trim() : undefined;
    const queryTenant = typeof req.query?.tenantId === "string" ? (req.query.tenantId as string).trim() : undefined;
    if (bodyTenant && bodyTenant !== tenantHeader) {
      res.status(400).json({ ok: false, error: "tenantId mismatch between header and body/query" });
      return;
    }
    if (queryTenant && queryTenant !== tenantHeader) {
      res.status(400).json({ ok: false, error: "tenantId mismatch between header and body/query" });
      return;
    }

    const bodyCompany = typeof req.body?.companyId === "string" ? req.body.companyId.trim() : undefined;
    const queryCompany = typeof req.query?.companyId === "string" ? (req.query.companyId as string).trim() : undefined;
    const paramCompany = typeof req.params?.companyId === "string" ? req.params.companyId.trim() : undefined;
    const paramId = typeof req.params?.id === "string" ? req.params.id.trim() : undefined;

    const expectedCompanyFromParams = paramCompany ?? paramId;

    if (bodyCompany && bodyCompany !== companyHeader) {
      res.status(400).json({ ok: false, error: "companyId mismatch between header and body/query" });
      return;
    }
    if (queryCompany && queryCompany !== companyHeader) {
      res.status(400).json({ ok: false, error: "companyId mismatch between header and body/query" });
      return;
    }
    if (expectedCompanyFromParams && expectedCompanyFromParams !== companyHeader) {
      res.status(400).json({ ok: false, error: "companyId mismatch between header and params" });
      return;
    }

    if (req.body) {
      req.body.companyId = companyHeader;
      req.body.tenantId = tenantHeader;
    }
    if (req.query) {
      (req.query as Record<string, unknown>).companyId = companyHeader;
      (req.query as Record<string, unknown>).tenantId = tenantHeader;
    }

    req.tenantId = tenantHeader;
    req.companyId = companyHeader;

    next();
  };
}
