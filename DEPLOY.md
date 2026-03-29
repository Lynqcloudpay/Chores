# Deploy Equity Engine (web)

## Push → auto deploy (Vercel + Git)

1. `git push` your repo to GitHub.
2. [vercel.com/new](https://vercel.com/new) → Import the repo.
3. Set **Root Directory** to **`web`** (required — Next.js is under `web/`, not the repo root).
4. Add env vars from `web/.env.example` in the Vercel project.
5. Done — every push to `main` (or your production branch) deploys automatically.

No GitHub Actions workflow is required; Vercel connects to Git and builds for you.
