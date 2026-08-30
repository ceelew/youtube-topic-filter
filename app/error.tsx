"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 px-4 text-center dark:bg-black">
      <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Something went wrong.
      </p>
      <p className="max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
        Give it a moment and try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 flex min-h-[44px] items-center rounded-full bg-zinc-900 px-5 text-sm font-semibold text-white active:opacity-80 dark:bg-zinc-50 dark:text-zinc-900"
      >
        Try again
      </button>
    </main>
  );
}
