# Release Policy

This policy defines how we plan, approve, build, validate and publish releases.

## Classification
- Major: incompatible changes or large features; requires CAB approval and extended test evidence.
- Minor: backward compatible features; CAB approval required.
- Patch: bug/security fixes; lightweight approval by CODEOWNERS.
- Emergency (Hotfix): security/critical outage; expedited approval with mandatory PIR afterwards.

## Environments & Segregation of Duties
- Environments: development → qa → staging → production.
- Production deployments must use GitHub `environment: production` with required reviewers (SoD).
- Only designated release managers may approve production deployments.

## Risk & Backout
- Risk matrix: see `risk-matrix.yml` for scoring and thresholds.
- Every release requires a backout plan (rollback to previous tag) and a communication plan.

## Release Package
A release must produce a package containing at minimum:
- Built artefacts (e.g. `dist/output.css`)
- SBOM (`sbom.json`, CycloneDX)
- Checksums (`checksums.txt`, SHA256)
- Release notes (`RELEASE_NOTES.md`)
- Manifest (`MANIFEST.json`, versions & commit ref)

## Calendar & Freeze
- Maintenance windows and freeze periods are recorded in `release-calendar.yml`.
- CI validates against the calendar and warns/blocks in freeze windows unless exception label `release-exception` is present.

## Post‑Deployment
- Smoke tests must run after deployment; failures trigger automatic rollback to last successful tag.
- A Post‑Implementation Review (PIR) must be completed for Major/Emergency releases.

## Traceability
- All PRs must reference an Issue (e.g., `Closes #123`).
- Release notes must include the list of merged PRs and issues.

