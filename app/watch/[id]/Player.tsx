"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatDuration } from "@/lib/format";

export interface UpNextVideo {
  id: string;
  title: string;
  thumbnailUrl: string;
  durationSec: number;
  sourceTitle: string;
}

interface PlayerProps {
  videoId: string;
  upNext: UpNextVideo[];
}

// Minimal typing for the parts of the IFrame Player API we use.
interface YTPlayer {
  destroy?: () => void;
}
interface YTPlayerEvent {
  data: number;
}
interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number>;
      events?: {
        onStateChange?: (e: YTPlayerEvent) => void;
        onError?: (e: YTPlayerEvent) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: { ENDED: number; PLAYING: number };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** Load the IFrame Player API once, resolving when window.YT is ready.
 *  Chains onto any existing onYouTubeIframeAPIReady so concurrent callers all resolve. */
function loadYouTubeAPI(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();

  return new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    if (!document.getElementById("youtube-iframe-api")) {
      const tag = document.createElement("script");
      tag.id = "youtube-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
  });
}

function errorMessage(code: number): string {
  switch (code) {
    case 101:
    case 150:
      return "The channel that posted this video doesn't allow it to be played here.";
    case 100:
      return "This video is no longer available.";
    default:
      return "This video can't be played right now.";
  }
}

export default function Player({ videoId, upNext }: PlayerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    setEnded(false);
    setError(null);

    // YT replaces the host node with an iframe; use a throwaway child inside a stable wrapper
    // so re-creation on videoId change never touches a stale/detached node.
    const host = document.createElement("div");
    wrapper.appendChild(host);

    loadYouTubeAPI().then(() => {
      if (cancelled || !window.YT) return;
      playerRef.current = new window.YT.Player(host, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          rel: 0, // limit related videos to the same (whitelisted) channel
          playsinline: 1, // iOS: play inline instead of hijacking into native fullscreen
          modestbranding: 1,
          origin: window.location.origin,
          autoplay: 1,
        },
        events: {
          onStateChange: (e) => {
            if (!window.YT) return;
            if (e.data === window.YT.PlayerState.ENDED) {
              // Take over the moment the video ends so YouTube's related-videos grid
              // never appears; show our own on-topic, whitelisted up-next panel instead.
              setEnded(true);
            } else if (e.data === window.YT.PlayerState.PLAYING) {
              setEnded(false);
            }
          },
          onError: (e) => setError(errorMessage(e.data)),
        },
      });
    });

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy?.();
      } catch {
        // player may already be gone
      }
      playerRef.current = null;
      wrapper.innerHTML = "";
    };
  }, [videoId]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-black [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:h-full [&_iframe]:w-full">
      <div ref={wrapperRef} className="relative aspect-video w-full" />

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90 p-6 text-center">
          <p className="text-base font-medium text-white">{error}</p>
          <Link
            href="/"
            className="flex min-h-[44px] items-center rounded-full bg-white px-5 text-sm font-semibold text-black active:opacity-80"
          >
            Back to videos
          </Link>
        </div>
      )}

      {ended && !error && (
        <div className="absolute inset-0 overflow-y-auto bg-black/95 p-4">
          <p className="mb-3 text-sm font-semibold text-white">Up next</p>
          {upNext.length === 0 ? (
            <Link
              href="/"
              className="inline-flex min-h-[44px] items-center rounded-full bg-white px-5 text-sm font-semibold text-black active:opacity-80"
            >
              Back to videos
            </Link>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {upNext.map((video) => (
                <Link
                  key={video.id}
                  href={`/watch/${video.id}`}
                  className="group flex flex-col overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-zinc-700 active:opacity-80"
                >
                  <div className="relative aspect-video w-full bg-zinc-800">
                    <Image
                      src={video.thumbnailUrl}
                      alt={video.title}
                      fill
                      sizes="(max-width: 640px) 50vw, 33vw"
                      className="object-cover"
                    />
                    <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
                      {formatDuration(video.durationSec)}
                    </span>
                  </div>
                  <p className="line-clamp-2 p-2 text-xs font-medium text-white">{video.title}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
