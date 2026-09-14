"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession, requireAdminSession } from "@/lib/session";
import { attemptAdminLogin } from "@/lib/adminAuth";
import { parseSourceInput } from "@/lib/parseSourceInput";
import { resolveChannel, resolvePlaylist, listPlaylistVideos, type PlaylistVideoStub } from "@/lib/youtube";
import { refreshAllSourcesAndLog, refreshSource } from "@/lib/refresh";

export interface LoginFormState {
  error?: string;
}

export async function loginAction(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const password = String(formData.get("password") ?? "");
  const result = await attemptAdminLogin(password);
  if (!result.ok) {
    return { error: result.error ?? "Login failed." };
  }

  const session = await getSession();
  session.isAdmin = true;
  await session.save();
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();
  session.destroy();
  redirect("/admin/login");
}

export async function createTopicAction(formData: FormData): Promise<void> {
  await requireAdminSession();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const maxOrder = await prisma.topic.aggregate({ _max: { order: true } });
  await prisma.topic.create({
    data: { name, order: (maxOrder._max.order ?? -1) + 1 },
  });
  revalidatePath("/admin");
}

export async function renameTopicAction(topicId: string, formData: FormData): Promise<void> {
  await requireAdminSession();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const keywords = String(formData.get("keywords") ?? "").trim();

  await prisma.topic.update({ where: { id: topicId }, data: { name, keywords } });
  revalidatePath("/admin");
}

export async function deleteTopicAction(topicId: string): Promise<void> {
  await requireAdminSession();
  await prisma.topic.delete({ where: { id: topicId } });
  revalidatePath("/admin");
}

export async function moveTopicAction(topicId: string, direction: "up" | "down"): Promise<void> {
  await requireAdminSession();

  const topics = await prisma.topic.findMany({ orderBy: { order: "asc" } });
  const index = topics.findIndex((t) => t.id === topicId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= topics.length) return;

  const a = topics[index];
  const b = topics[swapWith];
  await prisma.$transaction([
    prisma.topic.update({ where: { id: a.id }, data: { order: b.order } }),
    prisma.topic.update({ where: { id: b.id }, data: { order: a.order } }),
  ]);
  revalidatePath("/admin");
}

export type PreviewResult =
  | {
      ok: true;
      type: "CHANNEL";
      resolvedId: string;
      title: string;
      uploadsPlaylistId: string;
      sampleVideos: PlaylistVideoStub[];
    }
  | {
      ok: true;
      type: "PLAYLIST";
      resolvedId: string;
      title: string;
      sampleVideos: PlaylistVideoStub[];
    }
  | { ok: false; error: string };

/** Resolves whatever the parent pasted and shows a preview WITHOUT writing to the DB yet. */
export async function previewSourceAction(rawInput: string): Promise<PreviewResult> {
  await requireAdminSession();

  const parsed = parseSourceInput(rawInput);
  if (!parsed) {
    return { ok: false, error: "That doesn't look like a YouTube channel or playlist." };
  }

  try {
    if (parsed.type === "CHANNEL") {
      const resolved = await resolveChannel(parsed.handleOrId);
      const sampleVideos = await listPlaylistVideos(resolved.uploadsPlaylistId, 6);
      return {
        ok: true,
        type: "CHANNEL",
        resolvedId: resolved.channelId,
        title: resolved.title,
        uploadsPlaylistId: resolved.uploadsPlaylistId,
        sampleVideos,
      };
    }

    const resolved = await resolvePlaylist(parsed.playlistId);
    const sampleVideos = await listPlaylistVideos(parsed.playlistId, 6);
    return {
      ok: true,
      type: "PLAYLIST",
      resolvedId: parsed.playlistId,
      title: resolved.title,
      sampleVideos,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Lookup failed." };
  }
}

export interface ConfirmAddSourceInput {
  topicId: string;
  type: "CHANNEL" | "PLAYLIST";
  resolvedId: string;
  title: string;
  uploadsPlaylistId?: string;
}

export async function confirmAddSourceAction(
  input: ConfirmAddSourceInput,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdminSession();

  const existing = await prisma.source.findFirst({
    where: { topicId: input.topicId, youtubeId: input.resolvedId },
  });
  if (existing) {
    return { ok: false, error: "This source is already on the whitelist for this topic." };
  }

  const source = await prisma.source.create({
    data: {
      topicId: input.topicId,
      type: input.type,
      youtubeId: input.resolvedId,
      title: input.title,
      uploadsPlaylistId: input.type === "CHANNEL" ? input.uploadsPlaylistId : input.resolvedId,
      enabled: true,
    },
  });

  await refreshSource(source.id);
  revalidatePath("/admin");
  return { ok: true };
}

export async function toggleSourceAction(sourceId: string, enabled: boolean): Promise<void> {
  await requireAdminSession();
  await prisma.source.update({ where: { id: sourceId }, data: { enabled } });
  revalidatePath("/admin");
  revalidatePath("/");
}

/** Flip a source into "mixed content" mode: it no longer has one source-level topic — every
 *  video gets classified on its own instead. Existing videos (currently INHERITED, since the
 *  source used to be single-topic) go to PENDING so the next refresh classifies them; nothing
 *  is shown to the viewer until that happens. */
export async function enableMixedModeAction(sourceId: string): Promise<void> {
  await requireAdminSession();
  await prisma.$transaction([
    prisma.source.update({ where: { id: sourceId }, data: { multiTopic: true, topicId: null } }),
    prisma.video.updateMany({
      where: { sourceId, classification: "INHERITED" },
      data: { classification: "PENDING" },
    }),
  ]);
  revalidatePath("/admin");
  revalidatePath("/");
}

/** Flip a mixed source back to single-topic. Every video reverts to INHERITED (following the
 *  chosen topic), discarding any prior per-video classification — the admin is now trusting the
 *  whole channel for one topic again, same as any other single-topic source. */
export async function disableMixedModeAction(sourceId: string, formData: FormData): Promise<void> {
  await requireAdminSession();
  const topicId = String(formData.get("topicId") ?? "");
  if (!topicId) return;

  await prisma.$transaction([
    prisma.source.update({ where: { id: sourceId }, data: { multiTopic: false, topicId } }),
    prisma.video.updateMany({
      where: { sourceId },
      data: { classification: "INHERITED", topicId: null },
    }),
  ]);
  revalidatePath("/admin");
  revalidatePath("/");
}

/** Admin manually assigns a video to a topic — locks it as MANUAL so refresh never
 *  re-classifies or overwrites the decision. Used both to resolve the PENDING review queue
 *  and to correct a CLASSIFIED/EXCLUDED video the classifier got wrong. */
export async function assignVideoTopicAction(videoId: string, formData: FormData): Promise<void> {
  await requireAdminSession();
  const topicId = String(formData.get("topicId") ?? "");
  if (!topicId) return;

  await prisma.video.update({
    where: { id: videoId },
    data: { classification: "MANUAL", topicId },
  });
  revalidatePath("/admin");
  revalidatePath("/");
}

/** Admin confirms a video doesn't belong to any topic — same effect as the classifier's
 *  no_match, but locked in (won't be re-classified). */
export async function excludeVideoAction(videoId: string): Promise<void> {
  await requireAdminSession();
  await prisma.video.update({
    where: { id: videoId },
    data: { classification: "EXCLUDED", topicId: null },
  });
  revalidatePath("/admin");
  revalidatePath("/");
}

/** Undo a MANUAL or EXCLUDED call — puts the video back in the PENDING review queue. */
export async function resetVideoToPendingAction(videoId: string): Promise<void> {
  await requireAdminSession();
  await prisma.video.update({
    where: { id: videoId },
    data: { classification: "PENDING", topicId: null },
  });
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function deleteSourceAction(sourceId: string): Promise<void> {
  await requireAdminSession();
  await prisma.source.delete({ where: { id: sourceId } });
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function setVideoHiddenAction(videoId: string, hidden: boolean): Promise<void> {
  await requireAdminSession();
  await prisma.video.update({ where: { id: videoId }, data: { hiddenByAdmin: hidden } });
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function refreshNowAction(): Promise<void> {
  await requireAdminSession();
  await refreshAllSourcesAndLog();
  revalidatePath("/admin");
  revalidatePath("/");
}
