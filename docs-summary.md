# YouTube Topic-Restricted Playback — Project Summary & Brief

> Handoff document for another model to produce an initial implementation plan.
> Date: 2026-08-30

## 1. Goal (what the user wants)

The user wants to restrict YouTube playback so that **only certain topics of content can be played** — the motivating example is **"only clips from soccer or baseball games."** They asked whether this could be done via a **script** or by **configuring permissions in the YouTube app**.

Think of it as a **topic whitelist / parental-style content gate**, but filtered by *subject matter* (sports → soccer, baseball), not by age-rating.

## 2. Key finding: the official YouTube app cannot be topic-filtered

There is **no supported way** to add permissions/rules to the official YouTube app that restrict playback to a chosen topic:

- **No public API/permission** exists for "allow only topic X." The **YouTube Data API** can *search and list* videos, but it does **not** control what the official app plays.
- **Restricted Mode / Supervised accounts / YouTube Kids** filter by **maturity/age-appropriateness**, not by topic. There is no "sports only" setting.
- The official app is **closed-source and sandboxed** — you cannot inject hooks or custom permissions into it.
- **Category metadata** (e.g. category 17 = "Sports") is **self-assigned by uploaders and unreliable** — it leaks heavily (off-topic videos mis-tagged as Sports, and vice versa), so category-based filtering alone is insufficient.

**Conclusion:** Do not attempt to modify or configure the official YouTube app. Build a **controlled front-end** that only ever surfaces approved content.

## 3. Recommended approaches (build our own gated player)

Ranked by reliability:

1. **Channel / playlist whitelist (most reliable).**
   Pull videos only from a hand-picked set of trusted channels/playlists (e.g. official league or team channels for soccer/baseball). You vet the *source*, not guess the *topic*. Present only those in a custom player.

2. **Curated custom player via YouTube Data API + IFrame Player API.**
   Use the Data API to `search` only allowed terms/channel IDs (e.g. `soccer highlights`, `MLB clips`, specific channel IDs), embed results in your own web page / kiosk app via the **IFrame Player API**. User only sees what your app fetched. You control the whitelist.

3. **Classification layer (advanced, for stricter accuracy).**
   Run each candidate video's title/description/(optionally transcript) through a classifier — keyword rules or an LLM — that scores "is this a soccer/baseball clip?" before allowing playback. More accurate than YouTube's own categories. Adds cost/latency. Must gate **every** video (including recommendations) since recommendation feeds leak off-topic content. Works only inside your own player.

4. **Browser-extension / DNS blocklist (blunt).**
   Block YouTube except approved URLs/channels. Reduces exposure but does not cleanly restrict by topic. Weakest option; note only.

**Recommended combination:** Option 1 or 2 (whitelist-driven custom player) as the backbone, optionally layered with Option 3 (classifier) when topic precision beyond source-trust is required.

## 4. Constraints & things the planner must account for

- **API key + quota:** YouTube Data API requires a Google Cloud project, API key, and has daily quota limits (search is expensive in quota units). Plan for caching results.
- **Terms of Service:** Must use the official IFrame Player API for playback (don't scrape/re-host video). Respect YouTube ToS.
- **Metadata unreliability:** Do not trust `categoryId` alone. Prefer curated channels/playlists and/or a classifier.
- **Recommendation leakage:** In an embedded player, disable/limit related-video suggestions and never auto-navigate to unvetted content. Every playable item must pass the whitelist/classifier.
- **Platform target unknown:** Not yet decided whether this is a **web app, desktop/kiosk app, or mobile**. The custom-player approach is easiest on **web/desktop**; mobile is harder because the native app can't be filtered.
- **Who is it for:** Sounds like a parental/kiosk/controlled-access use case (restrict a viewer to sports-only). Confirm the audience and enforcement level needed (soft guidance vs. hard lockdown).

## 5. Open questions to resolve before/while planning

1. **Platform:** Web, desktop, or mobile? (Recommend starting with a web-based custom player.)
2. **Topics:** Just soccer + baseball, or a configurable topic list?
3. **Curation model:** Whitelisted channels/playlists (simplest) vs. open search + classifier (broader but riskier)?
4. **Enforcement strength:** Soft (only shows approved content) vs. hard (viewer cannot escape to full YouTube)?
5. **Who administers the whitelist** and how (config file, admin UI)?
6. **Accounts/auth:** Single-user/kiosk or multiple viewers?

## 6. Suggested initial MVP (for the planner to expand)

A minimal **web-based curated player**:
- Static HTML/JS page using the **YouTube IFrame Player API** for playback.
- A **channel/playlist whitelist** (config file) for soccer + baseball (e.g. official league channels).
- Use the **Data API** to fetch recent videos from whitelisted sources; render as a gated gallery.
- Playback restricted to fetched items only; disable related/endscreen navigation to unvetted content.
- (Phase 2) Add a keyword/LLM classifier to allow broader search while keeping topic precision.

## 7. Context notes

- Working repo in this session: `ceelew/wispr-local` (current dir `/home/user/wispr-local`). It is **not** obviously related to this YouTube task — confirm whether the new work belongs here or in a new project/repo.
- No code has been written yet; this document is the first artifact.
