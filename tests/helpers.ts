import "dotenv/config";
import { Client } from "pg";

/** Fetch one currently-playable video ID from the real catalog, for tests that need to
 *  assert a whitelisted video actually plays. Read-only.
 *
 *  Uses `pg` directly rather than the app's Prisma client: the generated Prisma client
 *  (app/generated/prisma) uses `import.meta`, which Playwright's default test transform
 *  can't load. A raw query avoids needing to reconfigure the project's module system
 *  just for this one read. */
export async function getAnyPlayableVideoId(): Promise<string | null> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query<{ id: string }>(
      `SELECT v.id
       FROM "Video" v
       JOIN "Source" s ON s.id = v."sourceId"
       WHERE v.embeddable = true AND v."hiddenByAdmin" = false AND s.enabled = true
       LIMIT 1`,
    );
    return result.rows[0]?.id ?? null;
  } finally {
    await client.end();
  }
}
