import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayableVideo, getUpNext } from "@/lib/catalog";
import Player from "./Player";

export const dynamic = "force-dynamic";

// Do not add a loading.tsx to this route (or to app/loading.tsx at the root — it cascades
// here too). A loading.tsx wraps the page in a Suspense boundary, which starts streaming a
// 200 response before notFound() below can resolve; the HTTP status can't change once
// streaming has begun, so gated requests would report 200 while still correctly rendering
// the not-found UI. Confirmed via Next.js's own docs (notFound() "Calling after streaming
// has started") and by curl: this exact regression happened once already in this project.
// Covered by tests/gating.spec.ts.
export default async function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Gating gate: only videos that pass the whitelist filters are playable. Any other
  // ID (unknown, hidden, non-embeddable, disabled source) 404s instead of embedding.
  const video = await getPlayableVideo(id);
  if (!video) {
    notFound();
  }

  const upNext = await getUpNext(video.id, video.topicId);

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-black/90">
        <Link
          href="/"
          aria-label="Back to videos"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-700 active:bg-zinc-100 dark:text-zinc-300 dark:active:bg-zinc-800"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {video.topicName}
        </span>
      </header>

      <div className="mx-auto w-full max-w-4xl px-4 py-4">
        <Player videoId={video.id} upNext={upNext} />

        <h1 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {video.title}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{video.sourceTitle}</p>
      </div>
    </main>
  );
}
