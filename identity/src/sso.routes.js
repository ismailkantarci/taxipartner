import crypto from 'node:crypto';
import express from 'express';
import { prisma } from './db.js';
import { sign } from './jwt.js';
const PROVIDER_KEY = 'oidc';
const stateStore = new Map();
const STATE_TTL_MS = 5 * 60 * 1000;
export const ssoRouter = express.Router();
function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} env değişkeni tanımlı değil.`);
    }
    return value;
}
function buildAuthorizeUrl(authority, params) {
    const url = new URL('/authorize', authority);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    return url.toString();
}
ssoRouter.get('/login', (req, res) => {
    try {
        const provider = String(req.query.provider || PROVIDER_KEY);
        if (provider !== PROVIDER_KEY) {
            res.status(400).json({ ok: false, error: 'Desteklenmeyen sağlayıcı.' });
            return;
        }
        const authority = requireEnv('OIDC_AUTHORITY');
        const clientId = requireEnv('OIDC_CLIENT_ID');
        const redirectUri = requireEnv('OIDC_REDIRECT_URI');
        const state = crypto.randomBytes(24).toString('hex');
        stateStore.set(state, Date.now());
        const authorizeUrl = buildAuthorizeUrl(authority, {
            client_id: clientId,
            response_type: 'code',
            scope: 'openid email profile',
            redirect_uri: redirectUri,
            state,
            nonce: crypto.randomBytes(18).toString('hex')
        });
        res.redirect(authorizeUrl);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'SSO yapılandırma hatası';
        res.status(500).json({ ok: false, error: message });
    }
});
ssoRouter.get('/callback', async (req, res) => {
    try {
        const code = req.query.code ? String(req.query.code) : '';
        if (!code) {
            res.status(400).json({ ok: false, error: 'Authorization code eksik.' });
            return;
        }
        const incomingState = req.query.state ? String(req.query.state) : '';
        pruneExpiredStates();
        if (!incomingState || !stateStore.has(incomingState)) {
            res.status(400).json({ ok: false, error: 'State doğrulaması başarısız.' });
            return;
        }
        stateStore.delete(incomingState);
        const authority = requireEnv('OIDC_AUTHORITY');
        const redirectUri = requireEnv('OIDC_REDIRECT_URI');
        const clientId = requireEnv('OIDC_CLIENT_ID');
        const clientSecret = requireEnv('OIDC_CLIENT_SECRET');
        const tokenUrl = new URL('/token', authority);
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
                client_id: clientId,
                client_secret: clientSecret
            })
        });
        if (!response.ok) {
            const text = await response.text();
            res.status(400).json({ ok: false, error: `Token hatası: ${text}` });
            return;
        }
        const tokenPayload = await response.json();
        const idToken = tokenPayload.id_token;
        if (!idToken) {
            res.status(400).json({ ok: false, error: 'id_token bulunamadı.' });
            return;
        }
        const segments = idToken.split('.');
        if (segments.length < 2) {
            res.status(400).json({ ok: false, error: 'Geçersiz id_token.' });
            return;
        }
        const payloadJson = Buffer.from(segments[1], 'base64url').toString('utf8');
        const payload = JSON.parse(payloadJson);
        const subject = payload.sub;
        const email = payload.email ?? null;
        if (!subject) {
            res.status(400).json({ ok: false, error: 'id_token subject eksik.' });
            return;
        }
        const providerId = subject;
        let external = await prisma.userExternalLogin.findUnique({
            where: {
                provider_providerId: {
                    provider: PROVIDER_KEY,
                    providerId
                }
            }
        });
        let userId;
        if (!external) {
            const existingUser = email
                ? await prisma.user.findUnique({ where: { email } }).catch(() => null)
                : null;
            const user = existingUser
                ? existingUser
                : await prisma.user.create({
                    data: {
                        email: email ?? `oidc_${crypto.randomUUID()}@example.com`,
                        password: 'sso-login'
                    }
                });
            userId = user.id;
            await prisma.userExternalLogin.create({
                data: {
                    provider: PROVIDER_KEY,
                    providerId,
                    userId
                }
            });
        }
        else {
            userId = external.userId;
        }
        const jwt = sign({ sub: userId });
        res.json({ ok: true, token: jwt, userId });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'SSO hata verdi.';
        res.status(400).json({ ok: false, error: message });
    }
});
function pruneExpiredStates() {
    const now = Date.now();
    for (const [state, ts] of stateStore.entries()) {
        if (now - ts > STATE_TTL_MS) {
            stateStore.delete(state);
        }
    }
}
