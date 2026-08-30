import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { resolveChannel } from "@/lib/youtube";
import { refreshAllSources } from "@/lib/refresh";

interface StarterTopic {
  name: string;
  order: number;
  channelHandles: string[];
}

// Starter whitelist. Add/replace via the admin UI once Phase 2 lands (PLAN.md section 5) —
// this is just enough to make the viewer useful on day one.
const STARTER_TOPICS: StarterTopic[] = [
  { name: "Soccer", order: 0, channelHandles: ["premierleague"] },
  { name: "Baseball", order: 1, channelHandles: ["MLB"] },
];

async function main() {
  for (const topicDef of STARTER_TOPICS) {
    const topic = await prisma.topic.upsert({
      where: { id: `seed-${topicDef.name.toLowerCase()}` },
      create: { id: `seed-${topicDef.name.toLowerCase()}`, name: topicDef.name, order: topicDef.order },
      update: { name: topicDef.name, order: topicDef.order },
    });

    for (const handle of topicDef.channelHandles) {
      const existing = await prisma.source.findFirst({
        where: { topicId: topic.id, youtubeId: handle },
      });
      if (existing) {
        console.log(`Skipping ${handle} — already seeded for ${topicDef.name}`);
        continue;
      }

      console.log(`Resolving channel @${handle}...`);
      const resolved = await resolveChannel(handle);

      await prisma.source.create({
        data: {
          topicId: topic.id,
          type: "CHANNEL",
          youtubeId: handle,
          title: resolved.title,
          uploadsPlaylistId: resolved.uploadsPlaylistId,
          enabled: true,
        },
      });
      console.log(`Added source: ${resolved.title} (${topicDef.name})`);
    }
  }

  console.log("Fetching initial video catalog...");
  const results = await refreshAllSources();
  for (const r of results) {
    if (r.error) {
      console.log(`  ${r.sourceTitle}: ERROR — ${r.error}`);
    } else {
      console.log(`  ${r.sourceTitle}: saved ${r.saved} videos`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
