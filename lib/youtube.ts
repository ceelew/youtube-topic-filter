import { env } from "@/lib/env";

const API_BASE = "https://www.googleapis.com/youtube/v3";

async function youtubeGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("key", env.YOUTUBE_API_KEY);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API ${path} failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<T>;
}

interface ResolvedChannel {
  channelId: string;
  title: string;
  uploadsPlaylistId: string;
}

/** Resolve a channel handle (e.g. "premierleague", with or without leading "@") or raw channel ID
 *  to its title and uploads playlist ID. Costs 1 quota unit. */
export async function resolveChannel(handleOrId: string): Promise<ResolvedChannel> {
  const isChannelId = /^UC[\w-]{22}$/.test(handleOrId);
  const handle = handleOrId.replace(/^@/, "");

  const data = await youtubeGet<{
    items?: Array<{
      id: string;
      snippet: { title: string };
      contentDetails: { relatedPlaylists: { uploads: string } };
    }>;
  }>("channels", {
    part: "snippet,contentDetails",
    ...(isChannelId ? { id: handleOrId } : { forHandle: handle }),
  });

  const item = data.items?.[0];
  if (!item) {
    throw new Error(`No YouTube channel found for "${handleOrId}"`);
  }

  return {
    channelId: item.id,
    title: item.snippet.title,
    uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads,
  };
}

/** Resolve a playlist ID to its title. Costs 1 quota unit. */
export async function resolvePlaylist(playlistId: string): Promise<{ title: string }> {
  const data = await youtubeGet<{
    items?: Array<{ snippet: { title: string } }>;
  }>("playlists", {
    part: "snippet",
    id: playlistId,
  });

  const item = data.items?.[0];
  if (!item) {
    throw new Error(`No YouTube playlist found for "${playlistId}"`);
  }

  return { title: item.snippet.title };
}

export interface PlaylistVideoStub {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
}

/** List the most recent videos in a playlist (or a channel's uploads playlist).
 *  Costs 1 quota unit per page of up to 50. */
export async function listPlaylistVideos(
  playlistId: string,
  maxResults = 30,
): Promise<PlaylistVideoStub[]> {
  const data = await youtubeGet<{
    items?: Array<{
      snippet: {
        title: string;
        publishedAt: string;
        resourceId: { videoId: string };
        thumbnails: { medium?: { url: string }; default?: { url: string } };
      };
    }>;
  }>("playlistItems", {
    part: "snippet",
    playlistId,
    maxResults: String(Math.min(maxResults, 50)),
  });

  return (data.items ?? []).map((item) => ({
    videoId: item.snippet.resourceId.videoId,
    title: item.snippet.title,
    thumbnailUrl:
      item.snippet.thumbnails.medium?.url ?? item.snippet.thumbnails.default?.url ?? "",
    publishedAt: item.snippet.publishedAt,
  }));
}

export interface VideoDetails {
  videoId: string;
  durationSec: number;
  embeddable: boolean;
}

/** ISO 8601 duration (e.g. "PT4M13S") to whole seconds. */
function parseIsoDuration(iso: string): number {
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  const [, h, m, s] = match;
  return (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);
}

/** Batch-fetch duration + embeddable status for up to 50 video IDs at once.
 *  Costs 1 quota unit per call regardless of batch size. */
export async function getVideoDetails(videoIds: string[]): Promise<VideoDetails[]> {
  if (videoIds.length === 0) return [];

  const data = await youtubeGet<{
    items?: Array<{
      id: string;
      contentDetails: { duration: string };
      status: { embeddable: boolean };
    }>;
  }>("videos", {
    part: "contentDetails,status",
    id: videoIds.slice(0, 50).join(","),
  });

  return (data.items ?? []).map((item) => ({
    videoId: item.id,
    durationSec: parseIsoDuration(item.contentDetails.duration),
    embeddable: item.status.embeddable,
  }));
}
