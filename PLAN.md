# YouTube Topic-Restricted Player — Implementation Plan

> Follows from `docs-summary.md`. Decisions confirmed 2026-08-30:
> **web app first (kiosk later) · channel/playlist whitelist · soft enforcement first ·
> parent-managed via admin UI · cloud-hosted · primary viewer device: tablet/phone browser.**

## 1. Product summary

A cloud-hosted web app with two faces:

- **Viewer** (`/`): a touch-friendly gallery of videos pulled *only* from
  parent-approved YouTube channels/playlists, grouped by topic (Soccer,
  Baseball, …). Tapping a video plays it in an embedded IFrame player. The
  viewer can never search YouTube or navigate to unvetted content from inside
  the app.
- **Admin** (`/admin`): a password-protected screen where the parent manages
  topics and whitelisted sources, previews what content each source yields,
  and triggers a content refresh.

Enforcement is **soft** in v1: the app only *shows* approved content; it does
not prevent the child from opening youtube.com in another tab. Hardening
(home-screen PWA + OS-level screen pinning, optional kiosk shell) is Phase 4.

## 2. Stack & hosting

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router, TypeScript)** | Viewer, admin UI, and server API routes in one codebase; the YouTube API key stays server-side; first-class Vercel deploys; easy to wrap in Electron/kiosk later. |
| Hosting | **Vercel** (free tier is enough) | One-command deploy, built-in cron for content refresh, HTTPS by default (required for PWA install). |
| Database | **Postgres via Neon** (free tier) + **Prisma** | Serverless-friendly persistence for the whitelist and the cached video catalog. SQLite doesn't survive serverless; a JSON file can't be edited from an admin UI in production. |
| Admin auth | Single admin password (env var, bcrypt-hashed) + **iron-session** signed cookie | One parent, one credential — no user-account system needed. Rate-limit login attempts. |
| Playback | **YouTube IFrame Player API** | The only ToS-compliant embed path; no scraping or re-hosting. |
| Video data | **YouTube Data API v3** | Server-side only, key never shipped to the browser. |

## 3. Architecture

```
Tablet browser ──► Next.js app (Vercel)
                    ├─ /            viewer gallery + player (reads cached catalog)
                    ├─ /admin       whitelist management (cookie-auth)
                    ├─ /api/*       server routes (session-checked where needed)
                    └─ cron (hourly) ─► YouTube Data API ─► catalog refresh
                                             │
                                       Neon Postgres
                                (topics, sources, cached videos)
```

**Key principle: the viewer never talks to YouTube's Data API.** It reads
only the app's own database of pre-fetched, whitelisted videos. YouTube is
contacted (a) server-side on refresh, and (b) by the IFrame player at play
time for an already-approved video ID.

### Data model

```prisma
model Topic {
  id      String   @id @default(cuid())
  name    String   // "Soccer", "Baseball"
  order   Int
  sources Source[]
}

model Source {
  id         String  @id @default(cuid())
  topicId    String
  type       SourceType // CHANNEL | PLAYLIST
  youtubeId  String     // channel ID or playlist ID
  title      String     // resolved display name
  uploadsPlaylistId String? // resolved once for channels
  enabled    Boolean @default(true)
  videos     Video[]
}

model Video {
  id          String   @id            // YouTube video ID
  sourceId    String
  title       String
  thumbnailUrl String
  publishedAt DateTime
  durationSec Int
  embeddable  Boolean                 // from videos.list status.embeddable
  hiddenByAdmin Boolean @default(false) // per-video veto
}
```

### Content refresh (quota-aware)

The Data API gives 10,000 units/day; `search.list` costs 100 units but
`playlistItems.list` costs **1**. So we never use search:

1. When a channel is added: `channels.list` (1 unit) → resolve title +
   `contentDetails.relatedPlaylists.uploads` playlist ID.
2. Hourly cron: for each enabled source, `playlistItems.list` on its
   uploads/playlist ID (1 unit per 50 videos) → upsert the newest N (e.g. 30)
   videos per source.
3. Batch `videos.list` (1 unit per 50 IDs) for duration + `status.embeddable`;
   drop non-embeddable videos and YouTube Shorts if undesired (filter by
   duration).

Even 50 sources refreshed hourly stays under ~150 units/hour — far inside quota.

## 4. Playback gating details (the part that's easy to get wrong)

- **Player params:** `rel=0` (since 2018 this restricts related videos to the
  *same channel* — acceptable, since the channel is whitelisted, but still
  mitigated below), `playsinline=1` (required so iPhones don't hijack into the
  native fullscreen player), `enablejsapi=1`, `origin` set.
- **End-of-video takeover:** listen for `onStateChange → ENDED` and
  immediately overlay a custom "up next" panel from the whitelisted catalog
  (or autoplay the next approved video). The viewer never gets an idle
  end-screen with YouTube's related grid.
- **No outbound paths:** the app renders no links to youtube.com; video titles
  are plain text; the player is sized/overlaid so the "Watch on YouTube"
  affordance is minimized (it cannot be fully removed under ToS — document
  this as accepted v1 leakage, closed properly in the kiosk phase).
- **Embed failures:** handle player errors 101/150 (embedding disabled by
  uploader) by marking the video `embeddable=false` and hiding it.

### Mobile/tablet specifics

- Autoplay requires a user gesture on iOS/Android — playback always starts
  from a tap, so this is naturally satisfied; don't build autoplaying rows.
- PWA manifest + icons so the app installs to the home screen full-screen
  (no browser chrome) — this is also the on-ramp for Phase 4 lockdown.
- Touch targets ≥ 44 px, large thumbnails, no hover-dependent UI.

## 5. Admin UI scope

- Login page (password → session cookie; logout; rate limiting).
- Topics: create/rename/reorder/delete.
- Sources: add by pasting any YouTube channel URL, handle (`@name`), or
  playlist URL — the server resolves it via the Data API and shows a preview
  of its latest videos *before* the parent confirms. Enable/disable toggle.
- Catalog: per-video hide/unhide (veto a specific video without dropping the
  channel); "Refresh now" button; last-refresh status + API error surfacing.
- Starter seed: official league channels (e.g. Premier League, FIFA, MLB,
  and team channels of choice) so the app is useful on day one.

## 6. Phases

**Phase 0 — Setup (½ day)**
Google Cloud project + YouTube Data API key; Vercel project; Neon database;
repo scaffolding (Next.js, TypeScript, Prisma, Tailwind); env wiring
(`YOUTUBE_API_KEY`, `DATABASE_URL`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`).

**Phase 1 — Gated viewer MVP (2–3 days)**
Seed whitelist directly in the DB (no admin UI yet). Refresh job as a manual
API route. Viewer gallery grouped by topic; player page with end-of-video
takeover; mobile-friendly layout. *Exit criteria: a child on a tablet can
browse and watch only whitelisted soccer/baseball videos.*

**Phase 2 — Admin UI (2–3 days)**
Auth, topic/source CRUD with URL-resolution + preview, per-video veto,
refresh-now, Vercel cron for hourly refresh. *Exit criteria: parent manages
everything from the browser; no code edits needed.*

**Phase 3 — Polish (1–2 days)**
PWA install flow; empty/error states; loading skeletons; basic
watch-continuity ("recently played"); Playwright smoke tests for the gating
invariants (no unvetted video ID can reach the player).

**Phase 4 — Hardening (later, as decided)**
Written setup guide for iOS **Guided Access** / Android **screen pinning** on
the child's tablet (locks the device to the installed PWA — this is the
realistic "hard mode" on mobile). Optional Electron kiosk wrapper for a
computer/TV. Optionally block youtube.com at home DNS as a belt-and-braces
measure.

**Phase 5 (optional) — Classifier layer**
Only if source-trust proves insufficient: score title/description of each
fetched video with keyword rules first, LLM (Claude Haiku) second, and hide
low-confidence items pending admin review. Designed as a filter on the
refresh pipeline, so it bolts on without touching the viewer.

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Related-video/"Watch on YouTube" leakage in the iframe | `rel=0`, end-screen takeover, kiosk phase; accepted as soft-enforcement gap in v1. |
| Whitelisted channel posts off-topic/unwanted video | Per-video admin veto; optional Phase 5 classifier. |
| API quota exhaustion | No `search.list`; playlist-based fetching; hourly (not per-request) refresh; catalog served from our DB. |
| Uploader disables embedding | Detect via `status.embeddable` + player errors; auto-hide. |
| Admin UI exposed on public internet | Strong password hash, signed sessions, login rate limiting, no admin data readable without session. |
| ToS compliance | IFrame API only; no downloading, scraping, or ad-stripping; attribution/thumbnails via API as permitted. |

## 8. Open items (non-blocking, decide during build)

- Exact starter channel list for soccer + baseball (parent to pick; seed
  suggestions provided in Phase 1).
- Whether Shorts are included or filtered out by duration.
- Whether viewer needs a "request a channel" flow (child suggests, parent
  approves) — cheap to add in Phase 2 if wanted.
