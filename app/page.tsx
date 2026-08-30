import Image from "next/image";
import Link from "next/link";
import { getViewerCatalog } from "@/lib/catalog";
import { formatDuration } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const topics = await getViewerCatalog();
  const hasAnyVideos = topics.some((topic) => topic.videos.length > 0);

  return (
    <main className="min-h-screen bg-zinc-50 pb-16 dark:bg-black">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 px-4 py-4 backdrop-blur dark:border-zinc-800 dark:bg-black/90">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          Watch
        </h1>
      </header>

      {!hasAnyVideos && (
        <p className="px-4 py-12 text-center text-zinc-500 dark:text-zinc-400">
          No videos yet. Run the seed script or trigger a refresh to populate the catalog.
        </p>
      )}

      {topics.map((topic) =>
        topic.videos.length === 0 ? null : (
          <section key={topic.id} className="mt-6">
            <h2 className="px-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {topic.name}
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {topic.videos.map((video) => (
                <Link
                  key={video.id}
                  href={`/watch/${video.id}`}
                  className="group flex min-h-[44px] flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200 active:opacity-80 dark:bg-zinc-900 dark:ring-zinc-800"
                >
                  <div className="relative aspect-video w-full bg-zinc-200 dark:bg-zinc-800">
                    <Image
                      src={video.thumbnailUrl}
                      alt={video.title}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
                      className="object-cover"
                    />
                    <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
                      {formatDuration(video.durationSec)}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-2.5">
                    <p className="line-clamp-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {video.title}
                    </p>
                    <p className="mt-auto text-xs text-zinc-500 dark:text-zinc-400">
                      {video.sourceTitle}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ),
      )}
    </main>
  );
}
