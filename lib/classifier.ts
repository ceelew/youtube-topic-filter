import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

// A mixed-content channel (e.g. USA Network posts Premier League soccer, NASCAR, women's
// basketball, WWE) can't be trusted at the source level — each video has to be placed on its
// own. This module reads title + description and returns one of three outcomes per video:
//   match     → confidently belongs to one of the parent's topics
//   no_match  → confidently a topic the parent has NOT created (NASCAR, WWE, ...) → excluded
//   uncertain → too generic/ambiguous to tell → held for admin review, never auto-shown
//
// Design note (deviation from the original "keyword-first, LLM-fallback" sketch): keywords are
// passed to the model as HINTS rather than used as a bypassing pre-filter. A naive keyword
// pre-filter is exactly what mishandles the Soccer-vs-Football collision ("football" means
// soccer everywhere except the US), silently making a confident-but-wrong call. Letting the
// model see the keywords plus an explicit disambiguation is both safer and still cheap.

const MODEL = "claude-haiku-4-5";
const BATCH_SIZE = 20; // videos per API call — keeps each request small and cheap

export type ClassificationDecision =
  | { decision: "match"; topicId: string }
  | { decision: "no_match" }
  | { decision: "uncertain" };

export interface TopicChoice {
  id: string;
  name: string;
  keywords: string; // comma-separated hints; may be empty
}

export interface VideoInput {
  id: string;
  title: string;
  description: string;
}

interface ClassificationResult {
  index: number;
  decision: "match" | "no_match" | "uncertain";
  topicName: string | null;
}

const CLASSIFY_TOOL: Anthropic.Tool = {
  name: "submit_classifications",
  description: "Return exactly one classification for every video, keyed by its index.",
  // strict guarantees the returned input validates against this schema exactly.
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["results"],
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["index", "decision", "topicName"],
          properties: {
            index: { type: "integer" },
            decision: { type: "string", enum: ["match", "no_match", "uncertain"] },
            topicName: {
              type: ["string", "null"],
              description: "The matched topic's exact name when decision is 'match'; null otherwise.",
            },
          },
        },
      },
    },
  },
};

function buildSystemPrompt(topics: TopicChoice[]): string {
  const topicLines = topics
    .map((t) => {
      const hints = t.keywords.trim() ? ` (hints: ${t.keywords.trim()})` : "";
      return `- ${t.name}${hints}`;
    })
    .join("\n");

  return `You sort short sports video clips into a parent's chosen topics, based on each video's title and description. The parent's topics are:

${topicLines}

For each video, choose exactly one outcome:
- "match": the video clearly belongs to ONE of the topics above. Set topicName to that topic's exact name.
- "no_match": the video is clearly about a sport or subject that is NOT one of the topics above (for example NASCAR, motor racing, WWE/wrestling, tennis, golf, or a basketball clip when there is no basketball topic). Set topicName to null.
- "uncertain": the title and description are too generic or ambiguous to tell what it is about (e.g. "Incredible Finish!" with no useful description). Set topicName to null.

Critical disambiguation:
- "Soccer" means association football — the Premier League, La Liga, MLS, the World Cup, UEFA, Champions League, clubs like Man City / Arsenal / Real Madrid, goals, keepers. Outside the US, "football" USUALLY means soccer.
- "Football" (as a topic) means AMERICAN football — the NFL, college football, touchdowns, quarterbacks, the Super Bowl.
- The bare word "football" is therefore ambiguous. Decide from context (team names, league names, "goal" vs "touchdown"). If you genuinely cannot tell, use "uncertain" rather than guessing.

Only choose "match" when you are confident. When in doubt between match and uncertain, choose uncertain — a wrong confident match shows a child the wrong content, while uncertain is safely reviewed by the parent.`;
}

function buildUserContent(videos: VideoInput[]): string {
  const lines = videos.map((v, i) => {
    const desc = v.description.trim().slice(0, 500);
    return `[${i}] Title: ${v.title}\nDescription: ${desc || "(none)"}`;
  });
  return `Classify these ${videos.length} videos:\n\n${lines.join("\n\n")}`;
}

async function classifyBatch(
  client: Anthropic,
  videos: VideoInput[],
  topics: TopicChoice[],
): Promise<Map<string, ClassificationDecision>> {
  const topicByName = new Map(topics.map((t) => [t.name, t.id]));
  const result = new Map<string, ClassificationDecision>();

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: buildSystemPrompt(topics),
    tools: [CLASSIFY_TOOL],
    tool_choice: { type: "tool", name: "submit_classifications" },
    messages: [{ role: "user", content: buildUserContent(videos) }],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    // Model didn't return the tool call — fail safe: everything stays uncertain (→ PENDING).
    for (const v of videos) result.set(v.id, { decision: "uncertain" });
    return result;
  }

  const results = (toolUse.input as { results?: ClassificationResult[] }).results ?? [];
  const byIndex = new Map(results.map((r) => [r.index, r]));

  videos.forEach((video, index) => {
    const r = byIndex.get(index);
    if (!r) {
      result.set(video.id, { decision: "uncertain" });
      return;
    }
    if (r.decision === "match" && r.topicName && topicByName.has(r.topicName)) {
      result.set(video.id, { decision: "match", topicId: topicByName.get(r.topicName)! });
    } else if (r.decision === "no_match") {
      result.set(video.id, { decision: "no_match" });
    } else {
      // "uncertain", or a "match" that named a topic we don't recognize → treat as uncertain.
      result.set(video.id, { decision: "uncertain" });
    }
  });

  return result;
}

/** Classify a set of videos against the parent's current topics. Batches the calls, and never
 *  throws for a single bad batch — a failed batch resolves its videos as "uncertain" so they
 *  land in the review queue rather than being lost or wrongly shown. */
export async function classifyVideos(
  videos: VideoInput[],
  topics: TopicChoice[],
): Promise<Map<string, ClassificationDecision>> {
  const decisions = new Map<string, ClassificationDecision>();
  if (videos.length === 0 || topics.length === 0) return decisions;

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  for (let i = 0; i < videos.length; i += BATCH_SIZE) {
    const batch = videos.slice(i, i + BATCH_SIZE);
    try {
      const batchResult = await classifyBatch(client, batch, topics);
      for (const [id, decision] of batchResult) decisions.set(id, decision);
    } catch {
      for (const v of batch) decisions.set(v.id, { decision: "uncertain" });
    }
  }

  return decisions;
}
