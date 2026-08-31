# youtube-topic-filter

A curated, topic-restricted YouTube player. Videos come only from a
parent-managed channel/playlist whitelist — the viewer can never search or
browse full YouTube.

Live at: https://youtube-topic-filter.vercel.app

## Status

Phases 0–4 of [`PLAN.md`](./PLAN.md) are complete: gated viewer, admin UI
(whitelist management, per-video veto, refresh), PWA install support, and
the [iOS hardening guide](./docs/ios-hardening.md) for locking a child's
device to the app with Guided Access.

See `PLAN.md` for the full architecture, phase history, and what's left
(the optional Phase 5 classifier layer).

## Development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and fill in the values described there
(Neon Postgres URL, YouTube Data API key, admin password hash, session and
cron secrets).

```bash
npx prisma migrate dev   # apply the schema to your database
npx prisma db seed       # seed starter topics/channels
npm run test:e2e         # Playwright smoke suite (tests/gating.spec.ts)
```

## Background

See [`docs-summary.md`](./docs-summary.md) for the original problem
statement and why the official YouTube app can't be topic-filtered.
