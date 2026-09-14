import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";

// Videos shorter than this are excluded from every surface (gallery, direct URL, up-next) —
// treated the same as "not embeddable" or "hidden by admin", not as a per-video admin choice.
export const MIN_DURATION_SEC = 60;

// The single definition of "playable" as a Prisma filter. A video is shown to the viewer only
// when it passes the content gates (embeddable, long enough, not vetoed, enabled source) AND
// resolves to a real topic:
//   - INHERITED: single-topic source; effective topic is source.topicId (must be non-null)
//   - CLASSIFIED / MANUAL: mixed source or manual override; effective topic is video.topicId
//   - PENDING / EXCLUDED: never playable (uncertain / confidently off-topic → hidden)
// This is the server-side gate that stops a viewer from reaching a hidden or unclassified
// video by editing the URL. Keep it in lockstep with the raw-SQL copy in searchCatalog below.
const PLAYABLE_WHERE: Prisma.VideoWhereInput = {
  embeddable: true,
  hiddenByAdmin: false,
  durationSec: { gte: MIN_DURATION_SEC },
  AND: [
    { source: { enabled: true } },
    {
      OR: [
        { classification: "INHERITED", source: { topicId: { not: null } } },
        { classification: { in: ["CLASSIFIED", "MANUAL"] }, topicId: { not: null } },
      ],
    },
  ],
};

/** A video's Prisma row, including enough of its source + topic relations to resolve which
 *  topic it effectively belongs to. */
type VideoWithRelations = Prisma.VideoGetPayload<{
  include: { topic: true; source: { include: { topic: true } } };
}>;

interface ResolvedTopic {
  id: string;
  name: string;
  order: number;
}

/** A video's effective topic: its own (CLASSIFIED/MANUAL) or its source's (INHERITED).
 *  Returns null for videos that shouldn't be shown (PENDING/EXCLUDED, or an orphaned
 *  classified video whose topic was deleted) — callers treat null as "not playable". */
function resolveTopic(video: VideoWithRelations): ResolvedTopic | null {
  const topic = video.classification === "INHERITED" ? video.source.topic : video.topic;
  if (!topic) return null;
  return { id: topic.id, name: topic.name, order: topic.order };
}

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

function toCatalogVideo(video: VideoWithRelations): CatalogVideo {
  return {
    id: video.id,
    title: video.title,
    thumbnailUrl: video.thumbnailUrl,
    durationSec: video.durationSec,
    publishedAt: video.publishedAt,
    sourceTitle: video.source.title,
  };
}

/** Everything the viewer is allowed to show, grouped by each video's *effective* topic.
 *  Videos from a mixed source land in different topic groups here even though they share a
 *  source, because grouping follows the resolved topic, not the source. */
export async function getViewerCatalog(): Promise<CatalogTopic[]> {
  const videos = await prisma.video.findMany({
    where: PLAYABLE_WHERE,
    include: { topic: true, source: { include: { topic: true } } },
    orderBy: { publishedAt: "desc" },
  });

  // topicId -> { topic meta, videos } — insertion doesn't matter; we sort topics by order after.
  const groups = new Map<string, { topic: ResolvedTopic; videos: CatalogVideo[] }>();
  for (const video of videos) {
    const topic = resolveTopic(video);
    if (!topic) continue; // defensively skip anything that doesn't resolve to a real topic
    const group = groups.get(topic.id) ?? { topic, videos: [] };
    group.videos.push(toCatalogVideo(video)); // already publishedAt-desc from the query
    groups.set(topic.id, group);
  }

  return [...groups.values()]
    .sort((a, b) => a.topic.order - b.topic.order)
    .map((group) => ({ id: group.topic.id, name: group.topic.name, videos: group.videos }));
}

export interface PlayableVideo extends CatalogVideo {
  topicId: string;
  topicName: string;
}

/** The gating gate. Returns a video ONLY if it is currently allowed to play — passing the
 *  content gates AND resolving to a real topic. Any other ID (unknown, hidden, non-embeddable,
 *  too short, disabled source, PENDING/EXCLUDED, or orphaned) returns null so the player route
 *  404s. This is the single check that stops a viewer from playing an arbitrary/hidden YouTube
 *  ID by editing the URL. */
export async function getPlayableVideo(id: string): Promise<PlayableVideo | null> {
  const video = await prisma.video.findFirst({
    where: { id, ...PLAYABLE_WHERE },
    include: { topic: true, source: { include: { topic: true } } },
  });

  if (!video) return null;
  const topic = resolveTopic(video);
  if (!topic) return null;

  return {
    ...toCatalogVideo(video),
    topicId: topic.id,
    topicName: topic.name,
  };
}

/** A Prisma filter matching playable videos whose *effective* topic is `topicId`. */
function effectiveTopicWhere(topicId: string): Prisma.VideoWhereInput {
  return {
    ...PLAYABLE_WHERE,
    OR: [
      { classification: "INHERITED", source: { topicId } },
      { classification: { in: ["CLASSIFIED", "MANUAL"] }, topicId },
    ],
  };
}

/** Playable videos to offer after the current one ends — same (effective) topic, newest first,
 *  excluding the current video. Every item has already passed the same gates as getPlayableVideo. */
export async function getUpNext(currentId: string, topicId: string, limit = 12): Promise<CatalogVideo[]> {
  const videos = await prisma.video.findMany({
    where: { id: { not: currentId }, ...effectiveTopicWhere(topicId) },
    include: { topic: true, source: { include: { topic: true } } },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });

  return videos.map(toCatalogVideo);
}

/** Full-text search over the same whitelisted, playable set of videos (title + description),
 *  ranked by relevance rather than grouped by topic — a flat list is what a search result
 *  actually is. Uses Postgres's built-in text search (to_tsvector/plainto_tsquery/ts_rank).
 *  The WHERE clause here MUST mirror PLAYABLE_WHERE above — keep the two in sync. */
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
      AND (
        (v.classification = 'INHERITED' AND s."topicId" IS NOT NULL)
        OR (v.classification IN ('CLASSIFIED', 'MANUAL') AND v."topicId" IS NOT NULL)
      )
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
