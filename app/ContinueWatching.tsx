"use client";

import { useSyncExternalStore } from "react";
import VideoCard from "./VideoCard";
import { getRecentlyPlayedIds } from "@/lib/recentlyPlayed";
import type { CatalogVideo } from "@/lib/catalog";

const EMPTY_IDS: string[] = [];
function subscribe() {
  // No cross-tab/live sync needed — this reads fresh on every mount, which is
  // exactly when it matters (arriving at or returning to the gallery).
  return () => {};
}
function getServerSnapshot() {
  return EMPTY_IDS;
}

// Renders nothing during SSR/hydration — recently-played is per-device (localStorage),
// so it only populates once the client snapshot (real localStorage) is read post-hydration.
export default function ContinueWatching({ allVideos }: { allVideos: CatalogVideo[] }) {
  const ids = useSyncExternalStore(subscribe, getRecentlyPlayedIds, getServerSnapshot);
  const byId = new Map(allVideos.map((v) => [v.id, v]));
  const recent = ids.map((id) => byId.get(id)).filter((v): v is CatalogVideo => Boolean(v));

  if (recent.length === 0) return null;

  return (
    <section className="mt-6">
      <h2 className="px-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Continue watching
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {recent.slice(0, 10).map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>
    </section>
  );
}
