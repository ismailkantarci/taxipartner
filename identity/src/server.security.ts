import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

export function applySecurity(app: any) {
  app.use(helmet());
  const raw = (process.env.DEV_CORS_ORIGINS || "").trim();
  const allow = raw ? raw.split(/\s+/) : [];
  const allowAll = allow.includes('*');
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (allowAll) return cb(null, true);
        if (allow.length && allow.includes(origin)) return cb(null, true);
        if (!allow.length && process.env.NODE_ENV === 'production') {
          console.warn('[cors] blocked origin in prod:', origin);
          return cb(new Error('Origin not allowed'), false);
        }
        if (/^https?:\/\/localhost(:\d+)?$/.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
          return cb(null, true);
        }
        console.warn('[cors] blocked origin (not in DEV_CORS_ORIGINS):', origin);
        return cb(new Error('Origin not allowed'), false);
      },
      credentials: true
    })
  );
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));
}
