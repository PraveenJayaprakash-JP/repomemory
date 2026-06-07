```yaml
---
trigger: /deploy [environment]
title: Deployment Checklist
description: |
  Run a production-ready deployment workflow with pre-checks, build verification,
  environment validation, platform-aware deployment, and post-deploy verification.
  Supports `--dry-run` to check without deploying and `--force` to skip non-critical steps.
parameters:
  - name: environment
    description: Target deployment environment (e.g., staging, production). If omitted, defaults to production.
    required: false
  - name: dry-run
    description: Perform all checks but do not execute the actual deployment.
    type: boolean
    default: false
  - name: force
    description: Skip non-critical checks (e.g., bundle size warnings, minor test failures). Use with caution.
    type: boolean
    default: false
---
```

# Deployment Workflow

> **Target environment:** `{{environment | default('production')}}`  
> **Dry-run:** `{{dry-run | default(false)}}`  
> **Force mode:** `{{force | default(false)}}`

---

## 1. Pre-Deploy Checks

- [ ] **Tests pass**: Run the project’s test suite (e.g., `npm test`, `pytest`, `go test ./...`).  
      If tests fail and `--force` is **not** set → **abort**. If `--force` is set → warn and continue.
- [ ] **No uncommitted changes**: `git status --porcelain` should be empty.  
      If dirty → abort (unless `--force` is set, then stash or warn).
- [ ] **Branch is up-to-date**: `git fetch origin && git status -sb` shows `ahead` only if you have local commits you intend to push.  
      If behind → abort (merge/rebase first).

## 2. Build Verification

- [ ] **Production build succeeds**: Run the build command (`npm run build`, `vite build`, `docker build …`, etc.).  
      If it fails → abort (even with `--force`).
- [ ] **Bundle size within limits**: Check the output size of assets.  
      If size exceeds project-specific thresholds (e.g., >300 kB gzipped for JS) → warn.  
      If `--force` is set → skip this warning, otherwise prompt for confirmation.
- [ ] **No new warnings/errors**: Review build output for any unexpected warnings.

## 3. Environment Validation

- [ ] **Required env vars present**:  
      Compare the active environment (`.env.{{environment}}` or system env) against a whitelist (e.g., `DATABASE_URL`, `API_KEY`, `SENTRY_DSN`).  
      Missing critical vars → abort.
- [ ] **Secrets configured**:  
      If using a secret manager (AWS Secrets Manager, Doppler, etc.), verify secrets are accessible and correct for this environment.
- [ ] **Current branch matches deployment target**:  
      e.g., `main` → production, `develop` → staging. If mismatch → warn (or abort if not forced).

## 4. Deployment Steps (Platform Detection)

Detect the platform by scanning project files in order:

| Platform  | Detection file / indicator          |
|-----------|-------------------------------------|
| **Vercel**  | `vercel.json`, `.vercel` directory  |
| **Netlify** | `netlify.toml`, `.netlify`          |
| **Docker**  | `Dockerfile`, `docker-compose.yml`  |
| **Kubernetes** | `k8s/` or `deploy/` with YAML    |
| **Cloud Run** | `cloudbuild.yaml` or `Dockerfile` |
| **Generic**  | Fallback (use project’s `deploy` script) |

- [ ] **Detect platform**: Based on detected platform, set build/push/deploy commands.
- [ ] **Build** (if not already done in step 2):  
      - Vercel: `vercel build`  
      - Netlify: `netlify build`  
      - Docker: `docker build -t myapp:{{environment}} .`  
- [ ] **Push** (if applicable):  
      - Docker: `docker push myapp:{{environment}}`  
      - Container images: push to registry.
- [ ] **Deploy**:  
      - Vercel: `vercel deploy --prod` (or `--preview` for staging)  
      - Netlify: `netlify deploy --prod` (or `--alias staging`)  
      - Docker/K8s: update manifests and apply.

If `--dry-run` is set, output the commands that *would* be executed but do not run them.

## 5. Post-Deploy Verification

- [ ] **Health check**: Poll the deployment URL’s health endpoint (`/health`, `/api/health`, etc.).  
      Must return HTTP 200/202 within 60 seconds.
- [ ] **Smoke test**: Execute a lightweight smoke test suite (e.g., check homepage loads, login works, key API returns data).  
      If smoke tests fail → trigger rollback plan (see below).
- [ ] **Rollback plan**:  
      - Document the rollback strategy (e.g., revert commit, re-run previous deploy, scale up old version).  
      - Ensure rollback can be executed within 5 minutes.  
      - If deployment fails verification → **rollback immediately** (unless `--dry-run`).

---

## Decision Table

| Condition                          | Action                              |
|------------------------------------|-------------------------------------|
| `--dry-run`                        | All checks pass? Output summary. No deploy. |
| `--dry-run` + `--force`            | Show warnings but no abort. No deploy.       |
| Normal (no flags)                  | Block on any critical failure; prompt on warnings. Execute deploy. |
| `--force`                          | Skip non-critical checks; critical failures still abort. Deploy.   |

---

**End of checklist. Proceed with deployment only if all mandatory items are checked (or overridden by `--force`).**