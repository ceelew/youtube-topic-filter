import { getViewerCatalog, searchCatalog } from "@/lib/catalog";
import VideoCard from "./VideoCard";
import ContinueWatching from "./ContinueWatching";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  return (
    <main className="min-h-screen bg-zinc-50 pb-16 dark:bg-black">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 px-4 py-4 backdrop-blur dark:border-zinc-800 dark:bg-black/90">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Watch</h1>
        <form action="/" method="GET" className="mt-3 flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search videos"
            className="min-h-[44px] flex-1 rounded-lg border border-zinc-300 px-3 text-base text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <button
            type="submit"
            className="min-h-[44px] shrink-0 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white active:opacity-80 dark:bg-zinc-50 dark:text-zinc-900"
          >
            Search
          </button>
        </form>
      </header>

      {query ? <SearchResults query={query} /> : <Browse />}
    </main>
  );
}

async function SearchResults({ query }: { query: string }) {
  const results = await searchCatalog(query);

  return (
    <section className="mt-6">
      <h2 className="px-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        {results.length === 0
          ? `No results for "${query}"`
          : `Results for "${query}"`}
      </h2>
      {results.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {results.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </section>
  );
}

async function Browse() {
  const topics = await getViewerCatalog();
  const hasAnyVideos = topics.some((topic) => topic.videos.length > 0);
  const allVideos = topics.flatMap((topic) => topic.videos);

  return (
    <>
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
    </>
  );
}
