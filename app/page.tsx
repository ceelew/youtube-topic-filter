import { getViewerCatalog } from "@/lib/catalog";
import VideoCard from "./VideoCard";
import ContinueWatching from "./ContinueWatching";

export const dynamic = "force-dynamic";

export default async function Home() {
  const topics = await getViewerCatalog();
  const hasAnyVideos = topics.some((topic) => topic.videos.length > 0);
  const allVideos = topics.flatMap((topic) => topic.videos);

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

      <ContinueWatching allVideos={allVideos} />

      {topics.map((topic) =>
        topic.videos.length === 0 ? null : (
          <section key={topic.id} className="mt-6">
            <h2 className="px-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {topic.name}
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {topic.videos.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          </section>
        ),
      )}
    </main>
  );
}
