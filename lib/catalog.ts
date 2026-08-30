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
