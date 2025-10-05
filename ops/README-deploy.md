# Deploy Notes (Placeholder)
- Use CI artifact (`taxipartner-identity-dist`) or GHCR image (`ghcr.io/<owner>/taxipartner-identity:latest`).
- Inject secrets at runtime:
  - `DATABASE_URL` (Postgres)
  - `JWT_SECRET`
  - `EXPORT_SIGN_SECRET`
  - Disable dev bypass in prod: `DEV_BYPASS_AUTH=false`
- Health check endpoint: `/health` (ensure mounted in server).
- For k8s or VM deploy, add `ops/deploy.sh` and environment manifests.
