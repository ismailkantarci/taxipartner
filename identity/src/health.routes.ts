import express from 'express';

export const healthRouter = express.Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'taxipartner-identity',
    version: process.env.APP_VERSION || 'dev',
    now: new Date().toISOString()
  });
});
