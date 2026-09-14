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
         AND v."durationSec" >= 60
       LIMIT 1`,
    );
    return result.rows[0]?.id ?? null;
  } finally {
    await client.end();
  }
}

/** Fetch one video ID that's otherwise whitelisted but under the 60s minimum duration —
 *  for asserting the duration gate itself (not just embeddable/hidden/enabled). */
export async function getAnyShortVideoId(): Promise<string | null> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query<{ id: string }>(
      `SELECT v.id
       FROM "Video" v
       JOIN "Source" s ON s.id = v."sourceId"
       WHERE v.embeddable = true AND v."hiddenByAdmin" = false AND s.enabled = true
         AND v."durationSec" < 60
       LIMIT 1`,
    );
    return result.rows[0]?.id ?? null;
  } finally {
    await client.end();
  }
}

/** Fetch a video from a mixed source that the classifier (or admin) confidently excluded —
 *  for asserting EXCLUDED never reaches the viewer even though it's embeddable/long/enabled. */
export async function getAnyExcludedVideoId(): Promise<string | null> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query<{ id: string }>(
      `SELECT v.id
       FROM "Video" v
       JOIN "Source" s ON s.id = v."sourceId"
       WHERE v.classification = 'EXCLUDED' AND s."multiTopic" = true
       LIMIT 1`,
    );
    return result.rows[0]?.id ?? null;
  } finally {
    await client.end();
  }
}

/** Fetch a video from a mixed source still awaiting admin review — for asserting PENDING is
 *  hidden (uncertain content must never be shown, only reviewed content). */
export async function getAnyPendingVideoId(): Promise<string | null> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query<{ id: string }>(
      `SELECT v.id
       FROM "Video" v
       JOIN "Source" s ON s.id = v."sourceId"
       WHERE v.classification = 'PENDING' AND s."multiTopic" = true
       LIMIT 1`,
    );
    return result.rows[0]?.id ?? null;
  } finally {
    await client.end();
  }
}

/** Fetch a video from a mixed source that the classifier confidently assigned to a topic —
 *  for asserting CLASSIFIED videos ARE playable (the whole point of the feature). */
export async function getAnyClassifiedVideoId(): Promise<string | null> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query<{ id: string }>(
      `SELECT v.id
       FROM "Video" v
       JOIN "Source" s ON s.id = v."sourceId"
       WHERE v.classification IN ('CLASSIFIED', 'MANUAL') AND v."topicId" IS NOT NULL
         AND v.embeddable = true AND v."hiddenByAdmin" = false AND s.enabled = true
         AND v."durationSec" >= 60
       LIMIT 1`,
    );
    return result.rows[0]?.id ?? null;
  } finally {
    await client.end();
  }
}
