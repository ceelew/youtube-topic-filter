export type ParsedSourceInput =
  | { type: "CHANNEL"; handleOrId: string }
  | { type: "PLAYLIST"; playlistId: string };

/** Best-effort parse of whatever a parent pastes into the "add source" box:
 *  a full YouTube URL (channel, @handle, or playlist), a bare @handle, a bare
 *  channel ID, or a bare playlist ID. Returns null if nothing recognizable. */
export function parseSourceInput(raw: string): ParsedSourceInput | null {
  const input = raw.trim();
  if (!input) return null;

  // Full URL forms.
  try {
    const url = new URL(input.startsWith("http") ? input : `https://${input}`);
    if (url.hostname.includes("youtube.com") || url.hostname.includes("youtu.be")) {
      const listParam = url.searchParams.get("list");
      if (listParam) {
        return { type: "PLAYLIST", playlistId: listParam };
      }

      const channelMatch = url.pathname.match(/\/channel\/(UC[\w-]{22})/);
      if (channelMatch) {
        return { type: "CHANNEL", handleOrId: channelMatch[1] };
      }

      const handleMatch = url.pathname.match(/\/@([\w.-]+)/);
      if (handleMatch) {
        return { type: "CHANNEL", handleOrId: handleMatch[1] };
      }
    }
  } catch {
    // Not a URL — fall through to the bare-token checks below.
  }

  // Bare tokens.
  if (input.startsWith("@")) {
    return { type: "CHANNEL", handleOrId: input.slice(1) };
  }
  if (/^UC[\w-]{22}$/.test(input)) {
    return { type: "CHANNEL", handleOrId: input };
  }
  if (/^(PL|UU|FL|LL)[\w-]{10,}$/.test(input)) {
    return { type: "PLAYLIST", playlistId: input };
  }
  // Fall back to treating it as a bare handle (e.g. "premierleague").
  if (/^[\w.-]+$/.test(input)) {
    return { type: "CHANNEL", handleOrId: input };
  }

  return null;
}
