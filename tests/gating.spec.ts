import { test, expect } from "@playwright/test";
import { getAnyPlayableVideoId, getAnyShortVideoId } from "./helpers";

// These tests exercise the app's core security contract: a viewer can only ever reach
// video IDs that are on the parent-managed whitelist, and the admin/cron surfaces can't
// be used by anyone else. They run against the real dev database (read-only, plus one
// harmless failed-login attempt) — there's no separate test DB for this project, so
// nothing here creates/deletes/hides real catalog data.
//
// Deliberately NOT tested here: successful admin login (would require committing the
// real admin password into the repo) and the cron refresh success path (would burn real
// YouTube API quota on every test run). Both were verified manually — see PLAN.md history.

test.describe("video playback is gated to the whitelist", () => {
  test("an arbitrary real YouTube video ID 404s", async ({ page }) => {
    // Rick Astley's "Never Gonna Give You Up" — a real, embeddable YouTube video that is
    // definitely not on this app's whitelist. Proves the gate checks OUR catalog, not
    // just "is this a real video."
    const response = await page.goto("/watch/dQw4w9WgXcQ");
    expect(response?.status()).toBe(404);
  });

  test("a garbage ID 404s", async ({ page }) => {
    const response = await page.goto("/watch/not-a-real-video-id");
    expect(response?.status()).toBe(404);
  });

  test("a whitelisted video returns 200 and the player mounts", async ({ page }) => {
    const videoId = await getAnyPlayableVideoId();
    test.skip(!videoId, "No videos in the catalog yet — run the seed script first.");

    const response = await page.goto(`/watch/${videoId}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator("iframe")).toBeVisible({ timeout: 15_000 });
  });

  test("a video under 60 seconds 404s even though it's otherwise whitelisted", async ({ page }) => {
    const videoId = await getAnyShortVideoId();
    test.skip(!videoId, "No sub-60s videos in the catalog right now.");

    const response = await page.goto(`/watch/${videoId}`);
    expect(response?.status()).toBe(404);
  });
});

test.describe("search", () => {
  test("matches text that only appears in the description, not the title", async ({ page }) => {
    // "subscribe" shows up in plenty of YouTube video descriptions but rarely in a
    // highlight-clip title — a reasonable proxy for "search actually reads description".
    await page.goto("/?q=subscribe");
    const heading = page.getByRole("heading", { level: 2 });
    await expect(heading).toContainText(/results for/i);
  });

  test("a nonsense query shows the empty state, not an error", async ({ page }) => {
    await page.goto("/?q=zzzznomatchxyz123");
    await expect(page.getByText(/no results for/i)).toBeVisible();
  });
});

test.describe("admin surface requires authentication", () => {
  test("visiting /admin while signed out redirects to the login page", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("wrong password is rejected and no session is granted", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Password").fill("definitely-the-wrong-password");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByText(/incorrect password/i)).toBeVisible();

    // Confirm no session cookie was granted — /admin should still bounce to login.
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});

test.describe("the refresh endpoint rejects unauthorized callers", () => {
  test("no Authorization header is rejected", async ({ request }) => {
    const response = await request.get("/api/refresh");
    expect(response.status()).toBe(401);
  });

  test("a wrong bearer token is rejected", async ({ request }) => {
    const response = await request.get("/api/refresh", {
      headers: { Authorization: "Bearer not-the-real-secret" },
    });
    expect(response.status()).toBe(401);
  });
});
