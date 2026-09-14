import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatDuration } from "@/lib/format";
import {
  setVideoHiddenAction,
  assignVideoTopicAction,
  excludeVideoAction,
  resetVideoToPendingAction,
} from "@/app/admin/actions";
import { MIN_DURATION_SEC } from "@/lib/catalog";

export const dynamic = "force-dynamic";

const CLASSIFICATION_ORDER = { PENDING: 0, CLASSIFIED: 1, MANUAL: 1, EXCLUDED: 2, INHERITED: 3 };

export default async function SourceVideosPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isAdmin) {
    redirect("/admin/login");
  }

  const { id } = await params;
  const [source, topics] = await Promise.all([
    prisma.source.findUnique({
      where: { id },
      include: { topic: true, videos: { include: { topic: true }, orderBy: { publishedAt: "desc" } } },
    }),
    prisma.topic.findMany({ orderBy: { order: "asc" } }),
  ]);

  if (!source) {
    notFound();
  }

  // For mixed sources, surface what needs a decision first.
  const videos = source.multiTopic
    ? [...source.videos].sort((a, b) => CLASSIFICATION_ORDER[a.classification] - CLASSIFICATION_ORDER[b.classification])
    : source.videos;

  return (
    <main className="min-h-screen bg-zinc-50 pb-16 dark:bg-black">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 px-4 py-4 backdrop-blur dark:border-zinc-800 dark:bg-black/90">
        <Link href="/admin" className="text-xs text-zinc-500 underline dark:text-zinc-400">
          ← Back to admin
        </Link>
        <h1 className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-50">{source.title}</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {source.multiTopic ? "Mixed content — sorted per video" : (source.topic?.name ?? "No topic")}
        </p>
      </header>

      <div className="mt-4 grid grid-cols-1 gap-3 px-4 sm:grid-cols-2 lg:grid-cols-3">
        {videos.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No videos fetched yet — trigger a refresh from the admin dashboard.
          </p>
        )}
        {videos.map((video) => (
          <div
            key={video.id}
            className="flex gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
              <Image src={video.thumbnailUrl} alt={video.title} fill sizes="128px" className="object-cover" />
              <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[10px] font-medium text-white">
                {formatDuration(video.durationSec)}
              </span>
            </div>
            <div className="flex flex-1 flex-col justify-between gap-2">
              <div>
                <p className="line-clamp-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {video.title}
                </p>
                {!video.embeddable && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    Not embeddable — hidden from the viewer automatically
                  </p>
                )}
                {video.durationSec < MIN_DURATION_SEC && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    Under {MIN_DURATION_SEC}s — hidden from the viewer automatically
                  </p>
                )}
                {source.multiTopic && (
                  <p className="mt-1 text-xs font-medium">
                    {video.classification === "PENDING" && (
                      <span className="text-amber-600 dark:text-amber-400">Needs review</span>
                    )}
                    {video.classification === "EXCLUDED" && (
                      <span className="text-zinc-500 dark:text-zinc-400">Excluded (not a match)</span>
                    )}
                    {(video.classification === "CLASSIFIED" || video.classification === "MANUAL") && (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {video.classification === "MANUAL" ? "Manually set: " : "Classified: "}
                        {video.topic?.name}
                      </span>
                    )}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {source.multiTopic && (
                  <div className="flex flex-wrap gap-1.5">
                    <form action={assignVideoTopicAction.bind(null, video.id)} className="flex gap-1">
                      <select
                        name="topicId"
                        defaultValue=""
                        required
                        className="min-h-[36px] rounded-lg border border-zinc-300 bg-white px-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                      >
                        <option value="" disabled>
                          Assign to…
                        </option>
                        {topics.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="min-h-[36px] rounded-lg bg-zinc-200 px-2 text-xs font-medium text-zinc-900 active:opacity-80 dark:bg-zinc-800 dark:text-zinc-50"
                      >
                        Set
                      </button>
                    </form>
                    {video.classification !== "EXCLUDED" && (
                      <form action={excludeVideoAction.bind(null, video.id)}>
                        <button
                          type="submit"
                          className="min-h-[36px] rounded-lg border border-zinc-300 px-2 text-xs font-medium text-zinc-700 active:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:active:bg-zinc-800"
                        >
                          Exclude
                        </button>
                      </form>
                    )}
                    {video.classification !== "PENDING" && (
                      <form action={resetVideoToPendingAction.bind(null, video.id)}>
                        <button
                          type="submit"
                          className="min-h-[36px] rounded-lg border border-zinc-300 px-2 text-xs font-medium text-zinc-700 active:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:active:bg-zinc-800"
                        >
                          Reset
                        </button>
                      </form>
                    )}
                  </div>
                )}

                <form action={setVideoHiddenAction.bind(null, video.id, !video.hiddenByAdmin)}>
                  <button
                    type="submit"
                    className={`min-h-[40px] rounded-lg px-3 text-sm font-medium active:opacity-80 ${
                      video.hiddenByAdmin
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                    }`}
                  >
                    {video.hiddenByAdmin ? "Hidden — unhide" : "Hide from viewer"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
