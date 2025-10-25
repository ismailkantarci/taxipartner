import type { Request, Response, NextFunction } from 'express';
import { createHash } from 'node:crypto';
import * as jose from 'jose';

type Decoded = Record<string, any>;

const VALID_ALG = new Set<jose.JWSAlgorithm>([
  'HS256',
  'HS384',
  'HS512',
  'RS256',
  'RS384',
  'RS512',
  'ES256',
  'ES384',
  'ES512'
]);

const ALLOW_UNVERIFIED_VALUES = new Set(['1', 'true', 'yes']);

function allowUnverified(): boolean {
  const raw = String(process.env.JWT_ALLOW_UNVERIFIED ?? '').toLowerCase();
  return ALLOW_UNVERIFIED_VALUES.has(raw);
}

function b64urlDecode(input: string) {
  const str = input.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(str, 'base64').toString('utf8');
}

function decodeWithoutVerify(token: string): Decoded {
  const parts = token.split('.');
  if (parts.length < 2) {
    throw new Error('bad token format');
  }
  try {
    return JSON.parse(b64urlDecode(parts[1]));
  } catch (err) {
    throw new Error('failed to decode token payload');
  }
}

function normalizePrincipal(claims: Decoded) {
  const principal: Record<string, any> = {};
  if (claims?.sub) principal.sub = String(claims.sub);
  if (claims?.email) principal.email = String(claims.email);
  const tenant =
    claims?.tenant_id ??
    claims?.tenant ??
    claims?.['https://claims/tenant'] ??
    claims?.['tenantId'];
  if (tenant) principal.tenant_id = String(tenant);
  if (claims?.scope) principal.scope = claims.scope;
  return principal;
}

function buildUser(current: any, payload: Decoded, tokenHash: string) {
  const permissions = Array.isArray(payload.permissions)
    ? payload.permissions
    : current?.permissions ?? [];

  return {
    ...current,
    id: payload.sub ?? current?.id,
    email: payload.email ?? current?.email,
    tenant_id: payload.tenant_id ?? payload.tenant ?? current?.tenant_id,
    sid: payload.sid ?? current?.sid,
    permissions,
    _token: {
      ...(current?._token ?? {}),
      iss: payload.iss ?? current?._token?.iss,
      aud: payload.aud ?? current?._token?.aud,
      sub: payload.sub ?? current?._token?.sub,
      jti: payload.jti ?? current?._token?.jti,
      hash: tokenHash,
    },
  };
}

function resolveAlgorithm(): jose.JWSAlgorithm {
  const envAlg = (process.env.JWT_ALG ?? '').toUpperCase();
  if (envAlg && VALID_ALG.has(envAlg as jose.JWSAlgorithm)) {
    return envAlg as jose.JWSAlgorithm;
  }
  if (process.env.JWT_SECRET) return 'HS256';
  if (process.env.JWT_PUBLIC_KEY) return 'RS256';
  return 'RS256';
}

async function verifyBearerToken(token: string): Promise<{ payload: Decoded; header: jose.JWTHeaderParameters | null }> {
  let header: jose.JWTHeaderParameters | null = null;
  try {
    header = jose.decodeProtectedHeader(token);
  } catch {
    header = null;
  }

  if (allowUnverified()) {
    return { payload: decodeWithoutVerify(token), header };
  }

  const issuer = process.env.JWT_ISSUER;
  const audience = process.env.JWT_AUDIENCE;
  if (!issuer || !audience) {
    throw new Error('JWT_ISSUER and JWT_AUDIENCE are required when JWT_ALLOW_UNVERIFIED is not true');
  }

  const alg = resolveAlgorithm();
  const verifyOptions = { issuer, audience, algorithms: [alg] } as jose.JWTVerifyOptions;

  if (process.env.JWT_JWKS_URL) {
    const jwkSet = jose.createRemoteJWKSet(new URL(process.env.JWT_JWKS_URL));
    const { payload } = await jose.jwtVerify(token, jwkSet, verifyOptions);
    return { payload: payload as Decoded, header };
  }

  if (process.env.JWT_PUBLIC_KEY) {
    const normalized = process.env.JWT_PUBLIC_KEY.replace(/\r/g, '').replace(/\\n/g, '\n');
    const key = await jose.importSPKI(normalized, alg);
    const { payload } = await jose.jwtVerify(token, key, verifyOptions);
    return { payload: payload as Decoded, header };
  }

  if (process.env.JWT_SECRET) {
    const key = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, key, verifyOptions);
    return { payload: payload as Decoded, header };
  }

  throw new Error('No JWT verifier configured (set JWT_JWKS_URL, JWT_PUBLIC_KEY, or JWT_SECRET)');
}

export async function jwtMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers?.authorization;
  if (!authHeader) return next();

  const match = /Bearer\s+(.+)/i.exec(Array.isArray(authHeader) ? authHeader[0] : authHeader);
  if (!match) return next();

  const rawToken = match[1].trim();
  if (!rawToken) return next();

  try {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const { payload, header } = await verifyBearerToken(rawToken);

    const baseUser = (req as any).user ?? {};
    (req as any).user = buildUser(baseUser, payload, tokenHash);

    const basePrincipal = (req as any).principal ?? {};
    (req as any).principal = {
      ...normalizePrincipal(payload),
      ...basePrincipal,
    };

    (req as any).jwt = {
      header,
      payload,
      tokenHash,
      sid: typeof payload.sid === 'string' ? payload.sid : undefined,
      subject: typeof payload.sub === 'string' ? payload.sub : undefined,
      issuer: typeof payload.iss === 'string' ? payload.iss : undefined,
      audience: payload.aud,
    };
  } catch (err: any) {
    if (allowUnverified()) {
      return next();
    }
    return res.status(401).json({ ok: false, error: 'invalid_token', detail: String(err?.message || err) });
  }

  next();
}
