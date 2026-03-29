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

### Automatic deploy on every `git push` (recommended)

This is the usual setup: **Vercel watches your Git repo** and builds on each push. No GitHub Actions required.

1. Push this repo to GitHub (or GitLab / Bitbucket).
2. In [Vercel](https://vercel.com/new): **Add New… → Project** → **Import** your repository.
3. **Critical for this monorepo:** open **Configure Project** and set **Root Directory** to `web` (the Next.js app lives there, not the repo root).
4. Add **Environment Variables** (Production): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`).
5. Deploy. After that, every push to your production branch (usually `main`) triggers a new deployment automatically.

If deploys fail, double-check **Root Directory = `web`** in Vercel → Project → Settings → General.

### Manual deploy from CLI (optional)

```bash
cd web
npm ci
vercel login
vercel link
npm run deploy
```
