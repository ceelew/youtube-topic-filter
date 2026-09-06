import { prisma } from "@/lib/prisma";
import { getVideoDetails, listPlaylistVideos } from "@/lib/youtube";
import type { Prisma } from "@/app/generated/prisma/client";

const VIDEOS_PER_SOURCE = 30;

export interface SourceRefreshResult {
  sourceId: string;
  sourceTitle: string;
  fetched: number;
  saved: number;
  error?: string;
}

/** Fetch the latest videos for one source and upsert them into the catalog.
 *  Non-embeddable videos are stored but excluded from the viewer by the gallery query. */
export async function refreshSource(sourceId: string): Promise<SourceRefreshResult> {
  const source = await prisma.source.findUniqueOrThrow({ where: { id: sourceId } });

  if (!source.uploadsPlaylistId) {
    return {
      sourceId,
      sourceTitle: source.title,
      fetched: 0,
      saved: 0,
      error: "Source has no uploads/playlist ID resolved yet",
    };
  }

  try {
    const stubs = await listPlaylistVideos(source.uploadsPlaylistId, VIDEOS_PER_SOURCE);
    const details = await getVideoDetails(stubs.map((s) => s.videoId));
    const detailsById = new Map(details.map((d) => [d.videoId, d]));

    let saved = 0;
    for (const stub of stubs) {
      const detail = detailsById.get(stub.videoId);
      if (!detail) continue;

      await prisma.video.upsert({
        where: { id: stub.videoId },
        create: {
          id: stub.videoId,
          sourceId: source.id,
          title: stub.title,
          description: stub.description,
          thumbnailUrl: stub.thumbnailUrl,
          publishedAt: new Date(stub.publishedAt),
          durationSec: detail.durationSec,
          embeddable: detail.embeddable,
        },
        update: {
          title: stub.title,
          description: stub.description,
          thumbnailUrl: stub.thumbnailUrl,
          durationSec: detail.durationSec,
          embeddable: detail.embeddable,
        },
      });
      saved += 1;
    }

    return { sourceId, sourceTitle: source.title, fetched: stubs.length, saved };
  } catch (err) {
    return {
      sourceId,
      sourceTitle: source.title,
      fetched: 0,
      saved: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Refresh every enabled source. Used by both the manual seed step and the refresh route. */
export async function refreshAllSources(): Promise<SourceRefreshResult[]> {
  const sources = await prisma.source.findMany({ where: { enabled: true } });
  const results: SourceRefreshResult[] = [];
  for (const source of sources) {
    results.push(await refreshSource(source.id));
  }
  return results;
}

/** Refresh everything and record the outcome in the singleton RefreshLog row, so the
 *  admin dashboard can show "last refreshed" + any errors regardless of whether the
 *  refresh was triggered by the admin's "Refresh now" button or the hourly cron. */
export async function refreshAllSourcesAndLog(): Promise<SourceRefreshResult[]> {
  const results = await refreshAllSources();
  await prisma.refreshLog.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", results: results as unknown as Prisma.InputJsonValue },
    update: { ranAt: new Date(), results: results as unknown as Prisma.InputJsonValue },
  });
  return results;
}
