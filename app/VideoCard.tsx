import Image from "next/image";
import Link from "next/link";
import { formatDuration } from "@/lib/format";
import type { CatalogVideo } from "@/lib/catalog";

export default function VideoCard({ video }: { video: CatalogVideo }) {
  return (
    <Link
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
        <p className="mt-auto text-xs text-zinc-500 dark:text-zinc-400">{video.sourceTitle}</p>
      </div>
    </Link>
  );
}
