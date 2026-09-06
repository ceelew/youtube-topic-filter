import { prisma } from "@/lib/prisma";

// Videos shorter than this are excluded from every surface (gallery, direct URL, up-next) —
// treated the same as "not embeddable" or "hidden by admin", not as a per-video admin choice.
export const MIN_DURATION_SEC = 60;

// Shared with every query below so "playable" has exactly one definition across the app.
const PLAYABLE_VIDEO_WHERE = {
  embeddable: true,
  hiddenByAdmin: false,
  durationSec: { gte: MIN_DURATION_SEC },
} as const;

export interface CatalogVideo {
  id: string;
  title: string;
  thumbnailUrl: string;
  durationSec: number;
  publishedAt: Date;
  sourceTitle: string;
}

export interface CatalogTopic {
  id: string;
  name: string;
  videos: CatalogVideo[];
}

/** Everything the viewer is allowed to show: videos from enabled sources that are
 *  embeddable, long enough, and haven't been vetoed by the admin, grouped by topic. */
export async function getViewerCatalog(): Promise<CatalogTopic[]> {
  const topics = await prisma.topic.findMany({
    orderBy: { order: "asc" },
    include: {
      sources: {
        where: { enabled: true },
        include: {
          videos: {
            where: PLAYABLE_VIDEO_WHERE,
            orderBy: { publishedAt: "desc" },
          },
        },
      },
    },
  });

  return topics.map((topic) => ({
    id: topic.id,
    name: topic.name,
    videos: topic.sources
      .flatMap((source) =>
        source.videos.map((video) => ({
          id: video.id,
          title: video.title,
          thumbnailUrl: video.thumbnailUrl,
          durationSec: video.durationSec,
          publishedAt: video.publishedAt,
          sourceTitle: source.title,
        })),
      )
      .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()),
  }));
}

export interface PlayableVideo extends CatalogVideo {
  topicId: string;
  topicName: string;
}

/** The gating gate. Returns a video ONLY if it is currently allowed to play:
 *  from an enabled source, embeddable, long enough, and not vetoed by the admin. Any other
 *  ID (unknown, hidden, non-embeddable, too short, or from a disabled source) returns null
 *  so the player route can 404. This is the single server-side check that stops a viewer
 *  from playing an arbitrary YouTube ID by editing the URL. */
export async function getPlayableVideo(id: string): Promise<PlayableVideo | null> {
  const video = await prisma.video.findFirst({
    where: {
      id,
      ...PLAYABLE_VIDEO_WHERE,
      source: { enabled: true },
    },
    include: { source: { include: { topic: true } } },
  });

  if (!video) return null;

  return {
    id: video.id,
    title: video.title,
    thumbnailUrl: video.thumbnailUrl,
    durationSec: video.durationSec,
    publishedAt: video.publishedAt,
    sourceTitle: video.source.title,
    topicId: video.source.topicId,
    topicName: video.source.topic.name,
  };
}

/** Playable videos to offer after the current one ends — same topic first, then
 *  anything else in the catalog, excluding the current video. Every item here has
 *  already passed the same whitelist filters as getPlayableVideo. */
export async function getUpNext(currentId: string, topicId: string, limit = 12): Promise<CatalogVideo[]> {
  const videos = await prisma.video.findMany({
    where: {
      id: { not: currentId },
      ...PLAYABLE_VIDEO_WHERE,
      source: { enabled: true, topicId },
    },
    include: { source: true },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });

  return videos.map((video) => ({
    id: video.id,
    title: video.title,
    thumbnailUrl: video.thumbnailUrl,
    durationSec: video.durationSec,
    publishedAt: video.publishedAt,
    sourceTitle: video.source.title,
  }));
}

/** Full-text search over the same whitelisted, playable set of videos (title + description),
 *  ranked by relevance rather than grouped by topic — a flat list is what a search result
 *  actually is. Uses Postgres's built-in text search (to_tsvector/plainto_tsquery/ts_rank);
 *  the catalog is small (low hundreds of rows at most for a household whitelist), so this
 *  runs the ranking on the fly rather than maintaining a generated tsvector column + index. */
export async function searchCatalog(query: string, limit = 50): Promise<CatalogVideo[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      title: string;
      thumbnailUrl: string;
      durationSec: number;
      publishedAt: Date;
      sourceTitle: string;
    }>
  >`
    SELECT v.id, v.title, v."thumbnailUrl", v."durationSec", v."publishedAt", s.title AS "sourceTitle"
    FROM "Video" v
    JOIN "Source" s ON s.id = v."sourceId"
    WHERE v.embeddable = true
      AND v."hiddenByAdmin" = false
      AND v."durationSec" >= ${MIN_DURATION_SEC}
      AND s.enabled = true
      AND to_tsvector('english', v.title || ' ' || coalesce(v.description, ''))
          @@ plainto_tsquery('english', ${trimmed})
    ORDER BY ts_rank(
      to_tsvector('english', v.title || ' ' || coalesce(v.description, '')),
      plainto_tsquery('english', ${trimmed})
    ) DESC
    LIMIT ${limit}
  `;

  return rows;
}
