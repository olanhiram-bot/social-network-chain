# Free Deploy

This repo is prepared for a zero-fixed-cost deployment:

- Web: Vercel Hobby.
- API: Render free web service.
- DB: Supabase free Postgres.
- Media: Supabase free Storage bucket.
- Contracts: Sepolia testnet.

Free tiers can sleep, pause, throttle, or require a card depending on the provider.

## 1. Supabase

Create one Supabase project.

Create a public storage bucket named:

```txt
social-media
```

Copy these values:

```txt
DATABASE_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET=social-media
```

Use the pooler connection string for hosted API runtime if Supabase shows one.

## 2. Backend on Render

Create a Render Blueprint from this repo. It reads `render.yaml`.

Set env vars from `apps/api/.env.production.example`.

Important values:

```txt
SIWE_DOMAIN=your-vercel-app.vercel.app
CORS_ORIGIN=https://your-vercel-app.vercel.app
```

Render will run:

```bash
pnpm --filter api exec prisma migrate deploy
pnpm --filter api start:prod
```

## 3. Contracts on Sepolia

Get free Sepolia ETH from a faucet and set:

```txt
SEPOLIA_RPC_URL=...
DEPLOYER_PRIVATE_KEY=...
```

Deploy:

```bash
pnpm --filter contracts deploy:sepolia
pnpm --filter contracts deploy:sepolia-actions
```

Copy addresses from `apps/contracts/deployments/sepolia.json` and `apps/contracts/deployments/sepolia-actions.json`.

## 4. Frontend on Vercel

Create a Vercel project with root directory:

```txt
apps/web
```

Set env vars from `apps/web/.env.production.example`.

Use:

```txt
NEXT_PUBLIC_API_URL=https://your-api.onrender.com
NEXT_PUBLIC_REOWN_PROJECT_ID=ee2b37a1ddcc88733f9aa6497d28134e
NEXT_PUBLIC_CHAIN_EXPLORER_URL=https://sepolia.etherscan.io
```

Then redeploy the Vercel project.

## 5. Production Checks

Open:

```txt
https://your-api.onrender.com/posts
https://your-vercel-app.vercel.app
```

Check:

- Login with wallet.
- Upload story media.
- Create post with image/video.
- Create live and verify preview frame.
- Open profile and feed.
- Register on Sepolia contract.
