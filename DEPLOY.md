# Deploy Equity Engine (web)

## Push → auto deploy (Vercel + Git)

1. `git push` your repo to GitHub.
2. [vercel.com/new](https://vercel.com/new) → Import the repo.
3. **Root Directory:** use **`.` (repo root)** if this repo’s Next app lives at the root (`package.json`, `src/`). Use **`web`** only if Vercel is pointed at the `web/` subfolder.
4. Add env vars (`NEXT_PUBLIC_SUPABASE_*`, etc.) in the Vercel project → Settings → Environment Variables.
5. Every push to **`main`** triggers a production deployment (Vercel builds on their servers — no local `vercel login` needed).

### Why CI can’t run `vercel deploy` interactively

Automated agents **cannot** finish Vercel’s browser/device OAuth. Deploys from this repo are **push-based**: merge to `main` → Vercel builds.

### Optional: double-trigger with a Deploy Hook

Vercel → Project → **Settings** → **Git** → **Deploy Hooks** → create a hook for `main` → copy the URL → GitHub repo → **Settings** → **Secrets** → add `VERCEL_DEPLOY_HOOK`.  
The workflow `.github/workflows/vercel-deploy-hook.yml` POSTs that URL after each push (if the secret exists).
