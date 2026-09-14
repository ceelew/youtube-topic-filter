import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatDuration } from "@/lib/format";
import { setVideoHiddenAction } from "@/app/admin/actions";
import { MIN_DURATION_SEC } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function SourceVideosPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isAdmin) {
    redirect("/admin/login");
  }

  const { id } = await params;
  const source = await prisma.source.findUnique({
    where: { id },
    include: { topic: true, videos: { orderBy: { publishedAt: "desc" } } },
  });

  if (!source) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-zinc-50 pb-16 dark:bg-black">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 px-4 py-4 backdrop-blur dark:border-zinc-800 dark:bg-black/90">
        <Link href="/admin" className="text-xs text-zinc-500 underline dark:text-zinc-400">
          ← Back to admin
        </Link>
        <h1 className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-50">{source.title}</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {source.multiTopic ? "Mixed content" : (source.topic?.name ?? "No topic")}
        </p>
      </header>

      <div className="mt-4 grid grid-cols-1 gap-3 px-4 sm:grid-cols-2 lg:grid-cols-3">
        {source.videos.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No videos fetched yet — trigger a refresh from the admin dashboard.
          </p>
        )}
        {source.videos.map((video) => (
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
            <div className="flex flex-1 flex-col justify-between">
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
              </div>
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
        ))}
      </div>
    </main>
  );
}
