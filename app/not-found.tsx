import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 px-4 text-center dark:bg-black">
      <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        That page isn&apos;t here.
      </p>
      <p className="max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
        It may not exist, or it isn&apos;t on the approved list.
      </p>
      <Link
        href="/"
        className="mt-2 flex min-h-[44px] items-center rounded-full bg-zinc-900 px-5 text-sm font-semibold text-white active:opacity-80 dark:bg-zinc-50 dark:text-zinc-900"
      >
        Back to videos
      </Link>
    </main>
  );
}
