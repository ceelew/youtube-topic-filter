import { prisma } from "@/lib/prisma";
import { getVideoDetails, listPlaylistVideos } from "@/lib/youtube";
import { classifyVideos, type TopicChoice, type VideoInput } from "@/lib/classifier";
import type { Prisma } from "@/app/generated/prisma/client";

const VIDEOS_PER_SOURCE = 30;

export interface SourceRefreshResult {
  sourceId: string;
  sourceTitle: string;
  fetched: number;
  saved: number;
  classified?: number; // for mixed sources: how many PENDING videos got a decision this run
  error?: string;
}

/** For a mixed (multiTopic) source, classify every video still in PENDING and write the
 *  result: match → CLASSIFIED with a topic, no_match → EXCLUDED, uncertain → stays PENDING
 *  (surfaced to the admin review queue). Videos already CLASSIFIED/MANUAL/EXCLUDED are left
 *  alone — we never re-classify a settled or admin-decided video. Returns how many were
 *  (re)decided this run. */
export async function classifyPendingForSource(sourceId: string): Promise<number> {
  const pending = await prisma.video.findMany({
    where: { sourceId, classification: "PENDING" },
    select: { id: true, title: true, description: true },
  });
  if (pending.length === 0) return 0;

  const topicRows = await prisma.topic.findMany({
    select: { id: true, name: true, keywords: true },
  });
  const topics: TopicChoice[] = topicRows;
  const videos: VideoInput[] = pending;

  const decisions = await classifyVideos(videos, topics);

  let decided = 0;
  for (const [videoId, decision] of decisions) {
    if (decision.decision === "match") {
      await prisma.video.update({
        where: { id: videoId },
        data: { classification: "CLASSIFIED", topicId: decision.topicId },
      });
      decided += 1;
    } else if (decision.decision === "no_match") {
      await prisma.video.update({
        where: { id: videoId },
        data: { classification: "EXCLUDED", topicId: null },
      });
      decided += 1;
    }
    // "uncertain" → leave as PENDING for admin review; not counted as decided
  }

  return decided;
}

/** Fetch the latest videos for one source and upsert them into the catalog.
 *  Single-topic sources: videos stay INHERITED and take the source's topic.
 *  Mixed sources: new videos are created PENDING (hidden until classified), then the
 *  classifier assigns/excludes them. Existing videos keep their classification & topic on
 *  update, so admin overrides and prior decisions survive a refresh. */
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

    // New videos from a mixed source start hidden (PENDING) until the classifier runs;
    // from a single-topic source they inherit the source's topic (INHERITED).
    const createClassification = source.multiTopic ? "PENDING" : "INHERITED";

    let saved = 0;
    for (const stub of stubs) {
      const detail = detailsById.get(stub.videoId);
      if (!detail) continue;

      await prisma.video.upsert({
        where: { id: stub.videoId },
        create: {
          id: stub.videoId,
          sourceId: source.id,
          classification: createClassification,
          title: stub.title,
          description: stub.description,
          thumbnailUrl: stub.thumbnailUrl,
          publishedAt: new Date(stub.publishedAt),
          durationSec: detail.durationSec,
          embeddable: detail.embeddable,
        },
        // Intentionally does NOT touch classification/topicId — a re-fetch must not undo a
        // prior classification or an admin's manual assignment.
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

    const classified = source.multiTopic ? await classifyPendingForSource(source.id) : undefined;

    return { sourceId, sourceTitle: source.title, fetched: stubs.length, saved, classified };
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
