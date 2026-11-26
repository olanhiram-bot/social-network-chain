<p align="center">
  <img src="./assets/readme/hero.svg" width="100%" alt="Nexo: an onchain social network with wallet identity, where each signed action is anchored on Ethereum Sepolia">
</p>

<p align="center">
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16.2-030B2F?style=flat-square&logo=next.js&logoColor=white">
  <img alt="NestJS 11" src="https://img.shields.io/badge/NestJS-11-1756E3?style=flat-square&logo=nestjs&logoColor=white">
  <img alt="Prisma 5.22" src="https://img.shields.io/badge/Prisma-5.22-030B2F?style=flat-square&logo=prisma&logoColor=white">
  <img alt="Solidity 0.8.28" src="https://img.shields.io/badge/Solidity-0.8.28-3AEBAB?style=flat-square&logo=solidity&logoColor=030B2F">
  <img alt="Node 22" src="https://img.shields.io/badge/Node-22.x-030B2F?style=flat-square&logo=node.js&logoColor=white">
  <img alt="pnpm 10" src="https://img.shields.io/badge/pnpm-10.15-1756E3?style=flat-square&logo=pnpm&logoColor=white">
</p>

**Nexo** is a working social network — feed, stories, live video, groups, pages, messenger, marketplace and events — where the account is a wallet, every write can be signed by an app signer, and activity is anchored by hash on Ethereum Sepolia. The everyday product stays fast and off-chain; the proof layer is real and verifiable.

This repository is the whole system: a Next.js client, a NestJS API, a Prisma/PostgreSQL schema with 37 migrations, five Solidity contracts deployed to Sepolia, and a monorepo that builds all of it.

> **Status:** deployed shape is Vercel (web) + Render (API) + Supabase (Postgres, storage) + Sepolia (contracts). See [`DEPLOY_FREE.md`](./DEPLOY_FREE.md) for the zero-fixed-cost path.

---

## Why it is different

Most “web3 social” projects either put every interaction on-chain, or add a wallet button to a normal app. Nexo splits the two speeds deliberately:

| Concern | Where it lives |
| --- | --- |
| Reading, writing, reacting, chatting | PostgreSQL through the API — no wallet prompt, no gas, no latency |
| Who you are | SIWE login, plus an optional on-chain `SocialIdRegistry` id with a recovery address |
| Proof that an action happened | The API signs the payload with your app signer, stores the signature, then anchors the message hash on `SocialActionRegistry` |
| Attestations | `SocialBadge` — non-transferable, moderator-granted, readable by any contract |
| Media | Supabase Storage in production, local disk in development |

The result: the product never asks the chain for permission, but any action can be proven later.

---

## System map

<p align="center">
  <img src="./assets/readme/architecture.svg" width="100%" alt="System map: Next.js client to NestJS API over REST and SSE, PostgreSQL via Prisma, and Ethereum Sepolia contracts written by the client and the API">
</p>

---

## What is actually built

Every line below maps to code in this repository.

### Identity, auth and custody

- Email + password registration and login (`bcrypt`), issuing a session with short-lived access and refresh tokens.
- **SIWE** wallet login with server-issued nonces, domain allowlist validation, and a local EIP-191 recovery fallback for Rabby/MetaMask connectors.
- JWT access tokens plus **rotating refresh tokens**: refresh values are stored only as bcrypt hashes, and each refresh deletes the old session row.
- Password reset by email (Brevo) with SHA-256 hashed, 30-minute, single-use tokens that also invalidate every session.
- Server-created custody wallet + **app signer** per account, both AES-256-GCM encrypted at rest.
- Private key export behind password re-authentication.
- On-chain identity panel: `register(recovery)`, `addKey`/`removeKey`, `changeRecovery`, `rent(id)` payable, and badge reads — all through wagmi with a wrong-chain guard.

### Feed and content

- Text posts with image, video or stream media, plus `feeling` and `location` metadata.
- Per-post audience: `PUBLIC`, `FRIENDS`, `ONLY_ME`.
- Cursor pagination (`/posts/page`), optimistic reactions across 7 types with rollback on failure, long-press/right-click reaction picker.
- Comments with one level of threaded replies, edit and delete for your own.
- Shares and quote-shares, share counters, and “share by message”.
- Post editing, soft delete, and content reporting.
- Every post carries `signerAddress`, `messageHash` and `signature` when signed; the UI labels it “signed by app signer”.

### Stories and live

- 24-hour stories with client-side expiry, per-author grouping, a full-screen viewer with progress bars, viewer counts and unique view recording.
- Live sessions over **LiveKit**: the host publishes camera/mic tracks, viewers subscribe, chat is timestamped against the stream, and a `MediaRecorder` WebM replay is uploaded when the stream ends.
- Graceful degradation: a periodically pushed preview frame (`/lives/:id/frame`) stands in for the player, and the saved replay plays for ended sessions.

### Communities: pages and groups

- Pages: create, edit, avatar/cover, follow, publish as page, page-filtered posts and events.
- Groups: public/private, join or request to join, owner approval of requests, member promotion/demotion, member removal, and a members-only composer.

### Messenger

- 1:1 conversations, media attachments, read receipts (`readAt`), signed-message labels, “start chat” from friends, and a typing indicator driven by SSE with throttled presence writes.

### Marketplace, events, search

- Marketplace listings with photo, category, price in cents (MXN formatting), location, saved items, `ACTIVE`/`SOLD` lifecycle, and “message seller” with a prefilled draft.
- Events with `startsAt`, images, page or group ownership, `GOING`/`INTERESTED` RSVPs, and friend invites.
- Global search across people, pages, groups, posts and lives, with client-persisted recent history.

### Notifications, realtime, PWA

- Persistent notifications with unread counts, deep links to the exact entity (post, profile, page, group, conversation, friend request), and inline accept/reject.
- **SSE** stream at `/realtime?token=<jwt>` emitting `feed_updated`, `notifications_updated`, `messages_updated`, `message_typing`, `pages_updated`, `groups_updated`, `events_updated` and `lives_updated`.
- Installable PWA: web manifest, icons, standalone display, and a `beforeinstallprompt` install button.

### Safety and moderation

- Blocking, friend-request lifecycle, profile visibility, and audience filters applied in the API queries.
- Content reports surfaced to moderators, soft deletes, and a moderator-only badge grant/revoke endpoint.
- The public schema is sealed against Supabase PostgREST with row-level security enabled on every table, so only Prisma (the DB owner) can read it.

---

## API surface

89 REST routes and one SSE stream across 15 NestJS modules. Interactive reference (Scalar) is served at **`/docs`** with the OpenAPI JSON at **`/docs-json`**.

| Module | Routes | Responsibility |
| --- | ---: | --- |
| `auth` | 10 | register, login, SIWE nonce/verify, refresh, logout, me, password reset |
| `wallets` | 5 | custody wallet, key export, anchors, public action receipts, badges |
| `posts` | 12 | feed, pagination, create, edit, delete, comments, reactions, share, report |
| `groups` | 11 | CRUD, join/leave, join requests, members, roles |
| `friends` | 10 | friends, suggestions, requests, accept/reject, unfriend, block, public profile |
| `lives` | 10 | create, token, chat, frame, end, edit, delete, replay |
| `pages` | 7 | create, follow, detail, edit, delete, mine |
| `marketplace` | 5 | list, create, update, delete, save |
| `messages` | 5 | conversations, thread, send, typing |
| `stories` | 5 | active stories, create, edit, delete, view |
| `events` | 4 | list, create, RSVP, invites |
| `media` | 2 | upload (optimised on the client), serve local files |
| `notifications` | 2 | list, mark read |
| `search` | 1 | global search |
| `realtime` | — | authenticated SSE stream |

---

## Contracts on Sepolia

Solidity `^0.8.28`, deployed and recorded in [`apps/contracts/deployments`](./apps/contracts/deployments).

| Contract | Address | Purpose |
| --- | --- | --- |
| `SocialIdRegistry` | `0xA9bCF69522AABd0172209015cF1aFaeaab6e9472` | One portable social id per wallet, with a recovery address and transfer |
| `SocialKeyRegistry` | not yet recorded on Sepolia | App signer keys registered against an id |
| `SocialStorageRegistry` | `0xb1De92E245362d2b379A9bA6Ab0e59979095319c` | Paid storage windows (`rent(id)`) |
| `SocialBadge` | `0x835B6CEc9275c9403fe70910504f9E7b60598869` | Non-transferable attestations: `EARLY_MEMBER`, `VERIFIED_CREATOR`, `LIVE_HOST`, `TRUSTED_MODERATOR` |
| `SocialActionRegistry` | `0x2eCD7a3245DD03973E190896bE6A5b07B0eE6d06` | `recordAction(actionHash, …)` — the anchor written by the API |

Anchoring is best-effort by design: if the RPC or registry is not configured, the social action still succeeds and a `ChainAnchor` row records `PENDING`/`FAILED` with the reason. Content, media and messages never touch the chain — only their hash and public metadata.

---

## Repository layout

```text
social-network-chain/
├─ apps/
│  ├─ web/            Next.js 16 client (App Router, Tailwind 4, wagmi, LiveKit)
│  ├─ api/            NestJS 11 API, Prisma schema + 37 migrations, Jest specs
│  └─ contracts/      Hardhat project, 5 Solidity contracts, deploy scripts
├─ packages/
│  ├─ types/          Shared TypeScript types
│  └─ ui/             Shared UI surface
├─ docker/            docker-compose: Postgres 15 + Redis 7
├─ assets/readme/     README visuals (hero, system map)
├─ design.md          Design direction and responsive rules
├─ DEPLOY_FREE.md     Vercel + Render + Supabase + Sepolia walkthrough
├─ facebook-clone-roadmap.md   Feature roadmap and what is still open
└─ render.yaml        Render blueprint for the API service
```

---

## Run it locally

**Prerequisites:** Node 22, pnpm 10.15 (`corepack enable`), Docker for Postgres.

```bash
# 1. install the workspace
corepack enable
pnpm install

# 2. local database + redis (optional, if you are not using Supabase)
docker compose -f docker/docker-compose.yml up -d

# 3. api  → http://localhost:3000  (Scalar docs at /docs)
pnpm --filter api exec prisma migrate deploy   # or: prisma migrate dev
pnpm --filter api start:dev

# 4. web  → http://localhost:3001
pnpm --filter web dev -- -p 3001
```

The API reads `apps/api/.env` (or the repo-root `.env`). Start from [`apps/api/.env.production.example`](./apps/api/.env.production.example) — it documents every required key. If you change the web port, keep `CORS_ORIGIN` and `SIWE_DOMAIN` in sync.

### Minimum `.env` to boot

```dotenv
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/social_network"
JWT_SECRET="a-long-random-secret"
CORS_ORIGIN="http://localhost:3001"
SIWE_DOMAIN="localhost:3001"
```

The web client needs `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3000`) and `NEXT_PUBLIC_REOWN_PROJECT_ID` (required by Reown AppKit).

### Environment variables

| Variable | Needed for | Notes |
| --- | --- | --- |
| `DATABASE_URL` / `DIRECT_URL` | API | Pooled runtime URL + direct URL for migrations |
| `JWT_SECRET` | API | Access/refresh signing; also the fallback encryption key |
| `WALLET_ENCRYPTION_KEY` | API | Recommended: separate AES-256-GCM key for custody wallets and app signers |
| `CORS_ORIGIN` | API | Comma-separated allowlist; Vercel preview origins are matched too |
| `SIWE_DOMAIN` | API | Domain accepted in SIWE messages |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_STORAGE_BUCKET` | API | Persistent public media storage (required in production) |
| `BREVO_API_KEY` / `BREVO_SENDER_EMAIL` / `WEB_URL` | API | Password reset email and reset link base |
| `MODERATOR_EMAILS` | API | Comma-separated moderator allowlist |
| `SOCIAL_ACTION_RPC_URL` / `SOCIAL_ACTION_REGISTRY_ADDRESS` / `SOCIAL_ACTION_PUBLIC_URL` | API | Action anchoring |
| `SOCIAL_BADGE_ADDRESS` / `SOCIAL_BADGE_RPC_URL` / `SOCIAL_BADGE_OWNER_PRIVATE_KEY` | API | Badge grant/revoke |
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | API | Live video tokens |
| `NEXT_PUBLIC_API_URL` | Web | API base URL |
| `NEXT_PUBLIC_REOWN_PROJECT_ID` | Web | WalletConnect/AppKit project id |
| `NEXT_PUBLIC_ID_REGISTRY_ADDRESS`, `NEXT_PUBLIC_KEY_REGISTRY_ADDRESS`, `NEXT_PUBLIC_STORAGE_REGISTRY_ADDRESS`, `NEXT_PUBLIC_SOCIAL_BADGE_ADDRESS` | Web | Optional identity panel contracts (validated with `isAddress`) |
| `NEXT_PUBLIC_APP_URL` | Web | Canonical URL for metadata, sitemap and SIWE |

### Contracts

```bash
pnpm --filter contracts compile

# identity + keys + storage, then action registry, then badges
SEPOLIA_RPC_URL=... DEPLOYER_PRIVATE_KEY=... pnpm --filter contracts deploy:sepolia
SEPOLIA_RPC_URL=... DEPLOYER_PRIVATE_KEY=... pnpm --filter contracts deploy:sepolia-actions
SOCIAL_ID_REGISTRY_ADDRESS=0x... SEPOLIA_RPC_URL=... DEPLOYER_PRIVATE_KEY=... \
  pnpm --filter contracts deploy:sepolia-badges
```

Addresses are written to `apps/contracts/deployments/sepolia*.json` (`sepolia-storage`, `sepolia-actions`, `sepolia-badges`). Never commit keys.

---

## Tests and checks

```bash
pnpm test                       # API unit specs (Jest, runInBand)
pnpm --filter api test:e2e      # supertest e2e
pnpm --filter api lint
pnpm --filter web lint
pnpm --filter api exec prisma validate
```

The current suite covers the app controller, auth controller/service, media controller and post service, plus an e2e bootstrap test. It is a starting suite, not full coverage.

---

## Design and product principles

A few rules the implementation actually follows:

- **Off-chain by default.** Nothing in the normal loop opens a wallet prompt.
- **Sign, then prove.** Writes are signed by an app signer you control, not by your browser wallet on every click.
- **Degrade visibly, not silently.** Missing LiveKit, RPC, storage or API connectivity produces a readable state, never a blank screen.
- **Small, honest trust surface.** Only hashes and public metadata are anchored; the social graph stays private in Postgres.
- **A11y and layout basics.** 44px touch targets, visible focus rings, `object-contain` media containment, no horizontal overflow, reduced-motion support on the landing surface.

The visual direction (palette, macrostructure, responsive rules) lives in [`design.md`](./design.md); the app's real tokens are in [`apps/web/app/tokens.css`](./apps/web/app/tokens.css) — midnight navy `#030B2F`, electric blue `#1756E3`, mint `#3AEBAB`.

---

## Known limits

Being explicit is part of the deal:

- The client is currently one large component file (`apps/web/app/page.tsx`, ~6.4k lines). It is deliberate fast iteration, not a claim of ideal structure; extracting it into modules is the next cleanup.
- Realtime is server-sent events, not bidirectional WebSockets — typing presence is POSTed and pushed, not socket-native.
- Live replay is a client-recorded WebM upload; there is no HLS/DVR pipeline and no continuous recording of viewers.
- No service worker or offline cache; the PWA installs but requires connectivity.
- Unit/e2e coverage is thin relative to the feature surface.
- Marketplace has no payments, notification preferences are not user-configurable, and there is no blocklist management screen.

Open work is tracked in [`facebook-clone-roadmap.md`](./facebook-clone-roadmap.md).

---

## Deployment

One monorepo, three moving parts:

- **Web → Vercel** (root `apps/web`, `vercel.json` sets the pnpm install/build commands).
- **API → Render** (`render.yaml` blueprint; runs `prisma migrate deploy` then `start:prod`).
- **DB + storage → Supabase**; **contracts → Sepolia**.

Full step-by-step, including bucket setup and the exact environment values: [`DEPLOY_FREE.md`](./DEPLOY_FREE.md).

---

## License

The root `package.json` declares ISC; `apps/api` is marked `UNLICENSED` and no `LICENSE` file exists yet. Treat this repository as source-available until an explicit license is added.

---

<p align="center">
  <sub>Designed and built by Daniel Olan · Nexo</sub>
</p>
