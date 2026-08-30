const STORAGE_KEY = "ytf_recently_played";
const MAX_ENTRIES = 20;

/** Client-only, per-device "continue watching" list. Never throws — storage can be
 *  unavailable (private browsing, disabled cookies) and that should never break playback. */
export function addRecentlyPlayed(videoId: string): void {
  try {
    const existing = getRecentlyPlayedIds();
    const next = [videoId, ...existing.filter((id) => id !== videoId)].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable — continue watching just won't populate this session.
  }
}

// Read-through cache keyed on the raw stored string, so repeated calls return the same
// array reference when nothing changed — required by useSyncExternalStore, which warns
// if getSnapshot() returns a new reference on every call with no underlying change.
let cachedRaw: string | null = null;
let cachedIds: string[] = [];

export function getRecentlyPlayedIds(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedIds;

    cachedRaw = raw;
    if (!raw) {
      cachedIds = [];
      return cachedIds;
    }
    const parsed = JSON.parse(raw);
    cachedIds = Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
    return cachedIds;
  } catch {
    return [];
  }
}
