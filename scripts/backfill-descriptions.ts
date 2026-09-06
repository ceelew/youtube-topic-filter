import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { getVideoDescriptions } from "@/lib/youtube";

// One-time fix: videos stored before the `description` column existed have description = ""
// and always will, since the refresh job only re-touches each source's ~30 most-recently-
// published videos — anything that's scrolled out of that window never gets re-fetched.
// Run once with: npx tsx scripts/backfill-descriptions.ts

const BATCH_SIZE = 50;

async function main() {
  const videos = await prisma.video.findMany({
    where: { description: "" },
    select: { id: true },
  });

  console.log(`Backfilling descriptions for ${videos.length} videos...`);

  let updated = 0;
  for (let i = 0; i < videos.length; i += BATCH_SIZE) {
    const batch = videos.slice(i, i + BATCH_SIZE);
    const descriptions = await getVideoDescriptions(batch.map((v) => v.id));

    for (const video of batch) {
      const description = descriptions.get(video.id);
      if (!description) continue;
      await prisma.video.update({ where: { id: video.id }, data: { description } });
      updated += 1;
    }
    console.log(`  ...${Math.min(i + BATCH_SIZE, videos.length)}/${videos.length}`);
  }

  console.log(`Done. Updated ${updated} of ${videos.length} videos.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
