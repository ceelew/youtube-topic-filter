import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { SourceRefreshResult } from "@/lib/refresh";
import {
  createTopicAction,
  renameTopicAction,
  deleteTopicAction,
  moveTopicAction,
  toggleSourceAction,
  deleteSourceAction,
  refreshNowAction,
  logoutAction,
} from "./actions";
import AddSourceForm from "./AddSourceForm";
import ConfirmSubmitButton from "./ConfirmSubmitButton";
import RefreshButton from "./RefreshButton";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const session = await getSession();
  if (!session.isAdmin) {
    redirect("/admin/login");
  }

  const [topics, refreshLog] = await Promise.all([
    prisma.topic.findMany({
      orderBy: { order: "asc" },
      include: {
        sources: {
          orderBy: { title: "asc" },
          include: { _count: { select: { videos: true } } },
        },
      },
    }),
    prisma.refreshLog.findUnique({ where: { id: "singleton" } }),
  ]);

  const refreshResults = (refreshLog?.results as SourceRefreshResult[] | undefined) ?? [];

  return (
    <main className="min-h-screen bg-zinc-50 pb-24 dark:bg-black">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-zinc-200 bg-white/90 px-4 py-4 backdrop-blur dark:border-zinc-800 dark:bg-black/90">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Admin</h1>
          <Link href="/" className="text-xs text-zinc-500 underline dark:text-zinc-400">
            View site
          </Link>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="min-h-[44px] rounded-full border border-zinc-300 px-4 text-sm font-medium text-zinc-700 active:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:active:bg-zinc-800"
          >
            Log out
          </button>
        </form>
      </header>

      <section className="mt-4 px-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {refreshLog
                ? `Last refreshed ${refreshLog.ranAt.toLocaleString()}`
                : "Never refreshed"}
            </p>
            {refreshResults.some((r) => r.error) && (
              <ul className="mt-1 text-xs text-red-600 dark:text-red-400">
                {refreshResults
                  .filter((r) => r.error)
                  .map((r) => (
                    <li key={r.sourceId}>
                      {r.sourceTitle}: {r.error}
                    </li>
                  ))}
              </ul>
            )}
          </div>
          <RefreshButton action={refreshNowAction} />
        </div>
      </section>

      <section className="mt-6 px-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Add a topic</h2>
        <form action={createTopicAction} className="mt-2 flex gap-2">
          <input
            type="text"
            name="name"
            placeholder="e.g. Basketball"
            required
            className="min-h-[44px] flex-1 rounded-lg border border-zinc-300 px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <button
            type="submit"
            className="min-h-[44px] shrink-0 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white active:opacity-80 dark:bg-zinc-50 dark:text-zinc-900"
          >
            Add
          </button>
        </form>
      </section>

      {topics.map((topic, index) => (
        <section key={topic.id} className="mt-8 px-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <form action={renameTopicAction.bind(null, topic.id)} className="flex gap-2 sm:flex-1">
              <input
                type="text"
                name="name"
                defaultValue={topic.name}
                className="min-h-[40px] flex-1 rounded-lg border border-zinc-300 px-3 text-base font-semibold text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <button
                type="submit"
                className="min-h-[40px] rounded-lg bg-zinc-200 px-3 text-sm font-medium text-zinc-900 active:opacity-80 dark:bg-zinc-800 dark:text-zinc-50"
              >
                Save
              </button>
            </form>

            <div className="flex shrink-0 gap-1">
              <form action={moveTopicAction.bind(null, topic.id, "up")}>
                <button
                  type="submit"
                  disabled={index === 0}
                  aria-label="Move topic up"
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-300 text-zinc-700 active:bg-zinc-100 disabled:opacity-30 dark:border-zinc-700 dark:text-zinc-300 dark:active:bg-zinc-800"
                >
                  ↑
                </button>
              </form>
              <form action={moveTopicAction.bind(null, topic.id, "down")}>
                <button
                  type="submit"
                  disabled={index === topics.length - 1}
                  aria-label="Move topic down"
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-300 text-zinc-700 active:bg-zinc-100 disabled:opacity-30 dark:border-zinc-700 dark:text-zinc-300 dark:active:bg-zinc-800"
                >
                  ↓
                </button>
              </form>
              <form action={deleteTopicAction.bind(null, topic.id)}>
                <ConfirmSubmitButton
                  confirmMessage={`Delete "${topic.name}" and all its sources? This can't be undone.`}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-300 text-red-600 active:bg-red-50 dark:border-red-900 dark:text-red-400 dark:active:bg-red-950"
                >
                  ✕
                </ConfirmSubmitButton>
              </form>
            </div>
          </div>

          <div className="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {topic.sources.length === 0 && (
              <p className="p-3 text-sm text-zinc-500 dark:text-zinc-400">
                No sources yet — add one below.
              </p>
            )}
            {topic.sources.map((source) => (
              <div key={source.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {source.title}{" "}
                    <span className="font-normal text-zinc-500 dark:text-zinc-400">
                      ({source.type === "CHANNEL" ? "channel" : "playlist"})
                    </span>
                  </p>
                  <Link
                    href={`/admin/sources/${source.id}`}
                    className="text-xs text-zinc-500 underline dark:text-zinc-400"
                  >
                    Manage videos ({source._count.videos})
                  </Link>
                </div>
                <div className="flex gap-2">
                  <form action={toggleSourceAction.bind(null, source.id, !source.enabled)}>
                    <button
                      type="submit"
                      className={`min-h-[40px] rounded-lg px-3 text-sm font-medium active:opacity-80 ${
                        source.enabled
                          ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      }`}
                    >
                      {source.enabled ? "Enabled" : "Disabled"}
                    </button>
                  </form>
                  <form action={deleteSourceAction.bind(null, source.id)}>
                    <ConfirmSubmitButton
                      confirmMessage={`Remove "${source.title}" from the whitelist?`}
                      className="min-h-[40px] rounded-lg border border-red-300 px-3 text-sm font-medium text-red-600 active:bg-red-50 dark:border-red-900 dark:text-red-400 dark:active:bg-red-950"
                    >
                      Remove
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </div>
            ))}
          </div>

          <AddSourceForm topicId={topic.id} />
        </section>
      ))}
    </main>
  );
}
