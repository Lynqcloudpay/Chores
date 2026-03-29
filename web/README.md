This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

### One-time: CLI from this folder

```bash
cd web
npm ci
vercel login          # browser login once
vercel link           # attach to a Vercel project (or create new)
npm run deploy        # production — same as: vercel deploy --prod
```

Set **Environment Variables** in the Vercel project (Production): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`).

### GitHub Actions (deploy on every push to `main`)

The repo workflow `.github/workflows/deploy-vercel.yml` deploys the `web/` app when you push. Add these **repository secrets** (GitHub → Settings → Secrets and variables → Actions):

| Secret | Where to find it |
|--------|------------------|
| `VERCEL_TOKEN` | [Vercel → Account Settings → Tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | Project → Settings → General → **Team / Personal** ID |
| `VERCEL_PROJECT_ID` | Project → Settings → General → **Project ID** |

Push your repo to GitHub first; the workflow only runs when `main` includes these secrets.
