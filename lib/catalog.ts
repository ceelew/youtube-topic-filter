import { prisma } from "@/lib/prisma";

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
 *  embeddable and haven't been vetoed by the admin, grouped by topic. */
export async function getViewerCatalog(): Promise<CatalogTopic[]> {
  const topics = await prisma.topic.findMany({
    orderBy: { order: "asc" },
    include: {
      sources: {
        where: { enabled: true },
        include: {
          videos: {
            where: { embeddable: true, hiddenByAdmin: false },
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
 *  from an enabled source, embeddable, and not vetoed by the admin. Any other ID
 *  (unknown, hidden, non-embeddable, or from a disabled source) returns null so the
 *  player route can 404. This is the single server-side check that stops a viewer
 *  from playing an arbitrary YouTube ID by editing the URL. */
export async function getPlayableVideo(id: string): Promise<PlayableVideo | null> {
  const video = await prisma.video.findFirst({
    where: {
      id,
      embeddable: true,
      hiddenByAdmin: false,
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
      embeddable: true,
      hiddenByAdmin: false,
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
