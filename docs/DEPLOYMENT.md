# Deployment — Bill Impact Analyzer

## Environments

| Env | Where | Notes |
| --- | --- | --- |
| Local | `npm run dev` / `npm run build && npm start` | Same code, same headers |
| Preview | Vercel preview per PR | Acts as staging (D-3). Keep Vercel deployment protection on for previews. |
| Production | Vercel, `main` branch, `*.vercel.app` | Quiet tool: no custom domain (D-2) |

## Environment variables

None. If a future change needs one, list it here **by name only** and add it in Vercel, never in the repo.

## First deploy (one time)

1. In Vercel: **Add New → Project → Import** `acts/bill-impact-analyzer`. Framework: Next.js. No env vars.
2. **Settings → Deployment Protection:** keep protection on for preview deployments.
3. **Firewall → Rules → Add rule (S-2):** if path starts with `/api/bill`, rate limit 30 requests per 60 seconds per IP, action: deny (429).
4. **Settings → Functions:** default region is fine (`iad1` or nearest); nothing stateful.
5. Merge to `main` → production deploy.

## Every production deploy

1. CI green on the PR (build, lint, unit, e2e + axe, gitleaks, rubric guard, audit, licenses).
2. After deploy, **verify headers by GET** (not HEAD) and file the output:
   ```bash
   SITE=https://<your-project>.vercel.app
   D=$(date +%F)
   { curl -s -D - -o /dev/null "$SITE/"; echo; curl -s -D - -o /dev/null "$SITE/api/bill?id=202520260AB1"; } > docs/evidence/headers-$D.txt
   ```
3. Smoke test: load one real bill; confirm the version label shows and the warning about missing markers does **not** appear.

## Rollback

Vercel → Deployments → previous production deployment → **Promote to Production**. No database, so nothing else to roll back.
