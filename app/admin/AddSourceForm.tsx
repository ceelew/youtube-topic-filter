"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { previewSourceAction, confirmAddSourceAction, type PreviewResult } from "./actions";

export default function AddSourceForm({ topicId }: { topicId: string }) {
  const [input, setInput] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handlePreview() {
    setConfirmError(null);
    startTransition(async () => {
      const result = await previewSourceAction(input);
      setPreview(result);
    });
  }

  function handleConfirm() {
    if (!preview || !preview.ok) return;
    setConfirmError(null);
    startTransition(async () => {
      const result = await confirmAddSourceAction({
        topicId,
        type: preview.type,
        resolvedId: preview.resolvedId,
        title: preview.title,
        uploadsPlaylistId: preview.type === "CHANNEL" ? preview.uploadsPlaylistId : undefined,
      });
      if (result.ok) {
        setInput("");
        setPreview(null);
      } else {
        setConfirmError(result.error ?? "Could not add source.");
      }
    });
  }

  return (
    <div className="mt-3 rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setPreview(null);
          }}
          placeholder="Paste a channel or playlist URL, @handle, or ID"
          className="min-h-[44px] flex-1 rounded-lg border border-zinc-300 px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <button
          type="button"
          onClick={handlePreview}
          disabled={isPending || !input.trim()}
          className="min-h-[44px] shrink-0 rounded-lg bg-zinc-200 px-4 text-sm font-semibold text-zinc-900 active:opacity-80 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-50"
        >
          Preview
        </button>
      </div>

      {isPending && !preview && <p className="mt-2 text-sm text-zinc-500">Looking it up...</p>}

      {preview && !preview.ok && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{preview.error}</p>
      )}

      {preview && preview.ok && (
        <div className="mt-3">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {preview.title}{" "}
            <span className="font-normal text-zinc-500 dark:text-zinc-400">
              ({preview.type === "CHANNEL" ? "channel" : "playlist"})
            </span>
          </p>
          {preview.sampleVideos.length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {preview.sampleVideos.map((v) => (
                <div key={v.videoId} className="relative aspect-video overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
                  <Image src={v.thumbnailUrl} alt={v.title} fill sizes="120px" className="object-cover" />
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              className="min-h-[44px] rounded-full bg-zinc-900 px-5 text-sm font-semibold text-white active:opacity-80 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
            >
              {isPending ? "Adding..." : "Add to whitelist"}
            </button>
            {confirmError && <p className="text-sm text-red-600 dark:text-red-400">{confirmError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
