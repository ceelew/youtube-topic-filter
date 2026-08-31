# Locking the app down on iPhone/iPad

This is the Phase 4 hardening guide from [PLAN.md](../PLAN.md). It turns the
soft-enforcement web app into something a child can't casually back out of
on their iPhone or iPad. Two parts: install it like a real app, then lock
the device to it with Guided Access.

Apple TV is intentionally not covered here — see the note in PLAN.md's
Phase 4 section for why.

## Part 1 — Install as a home-screen app

Do this once, on the child's device:

1. Open **Safari** (must be Safari — Chrome/other browsers on iOS can't
   install home-screen apps) and go to the site
   (`https://youtube-topic-filter.vercel.app`, or your custom domain).
2. Tap the **Share** button (square with an arrow pointing up).
3. Scroll down and tap **Add to Home Screen**.
4. Confirm the name (defaults to "Watch") and tap **Add**.

This uses the PWA manifest and icons already built in Phase 3
(`app/manifest.ts`, `app/icon.tsx`, `app/apple-icon.tsx`). Opening the app
from this new home-screen icon launches it full-screen, with no Safari
address bar or browser chrome — that full-screen mode is what makes Guided
Access below actually lock the child *inside* the app instead of leaving
them able to swipe up to a browser tab bar.

## Part 2 — Lock the device with Guided Access

Guided Access is Apple's built-in single-app-lock feature. Once turned on
for a session, the device physically cannot leave the current app — no
Home button, no App Switcher, no Control Center — until the parent enters
a passcode to exit.

### One-time setup

1. **Settings → Accessibility → Guided Access.**
2. Turn on **Guided Access**.
3. Tap **Passcode Settings → Set Guided Access Passcode**. Pick a passcode
   the child doesn't know (different from the device's own unlock code, if
   they know that one).
4. Optional but recommended: turn on **Face ID** / **Touch ID** here too,
   so you can end a session biometrically instead of typing the passcode
   in front of the child.

### Starting a session (do this each time)

1. Open the **Watch** app from the home screen (the icon added in Part 1).
2. Triple-click the **side button** (Face ID iPads/iPhones) or the **Home
   button** (Touch ID devices).
3. Guided Access starts. You can circle areas of the screen to disable
   touch there if needed (not necessary for this app), then tap **Start**
   in the top-right.
4. The device is now locked to the Watch app. The child can browse and
   watch videos, but cannot leave the app, open Safari, or reach any other
   app or setting.

### Ending a session

Triple-click the same button again, enter the Guided Access passcode (or
use Face ID/Touch ID if enabled), then tap **End** in the top-left.

### Good to know

- Guided Access is **per-session**, not permanent — it needs to be
  re-started (triple-click) each time the child picks up the device. It
  does not survive a full device restart.
- If you want it to auto-lock the device to this app on every use without
  you starting it manually each time, look at **Settings →
  Screen Time → App Limits** as a complementary (softer) layer — but
  Screen Time limits are time-based and can usually be worked around more
  easily than Guided Access, so Guided Access is the real lock.
- The volume buttons, side button (for locking the screen — not exiting),
  and rotation still work normally during a Guided Access session unless
  you specifically disable them in the session's options.

## Optional: DNS-level blocking (belt-and-braces)

Guided Access already prevents leaving the app, so this is optional
redundancy, not required. If you want an extra layer at the network level
(e.g. in case a session ends unexpectedly), you can block `youtube.com` and
`m.youtube.com` for the child's device specifically at your router or via a
filtered DNS service (e.g. NextDNS, a router-level allow/block list, or
iOS's own **Screen Time → Content & Privacy Restrictions → Content
Restrictions → Web Content → Limit Adult Websites → Add Website** to
block `youtube.com` by name). This app's own domain still needs to stay
reachable, obviously.

This is a one-time router/device setting, not something this repo
configures — set it up however fits your home network.
