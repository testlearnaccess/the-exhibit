import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const sectionTypeSchema = z.enum([
  "narrative",
  "evergreen",
  "structured",
  "paired",
  "image_anchored",
]);

const blockSchema = z.object({
  section_id: z.string(),
  section_name: z.string(),
  section_type: sectionTypeSchema,
  skipped: z.boolean().optional(),
  raw_notes: z.string().optional(),
  rows: z.array(z.object({ a: z.string(), b: z.string(), c: z.string() })).optional(),
  puzzle_text: z.string().optional(),
  answer_key_text: z.string().optional(),
  caption: z.string().optional(),
  photo_note: z.string().optional(),
  carried_text: z.string().optional(),
});

const profileSchema = z.object({
  publication: z.string(),
  organization: z.string(),
  tone_summary: z.string(),
  headline_examples: z.array(z.string()),
  sign_off: z.string(),
  sections: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      section_type: sectionTypeSchema,
      avg_word_count: z.number().optional(),
      tone_notes: z.string().optional(),
      last_content: z.string().optional(),
      last_updated: z.string().optional(),
    }),
  ),
});

const generateInput = z.object({
  issue_name: z.string(),
  profile: profileSchema,
  blocks: z.array(blockSchema),
});

const MODEL = "openai/gpt-6-astra";

async function callModel(instructions: string, input: string) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI service is not configured.");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, instructions, input }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("The writing service is busy. Try again shortly.");
    if (res.status === 402) throw new Error("AI credits are exhausted for this workspace.");
    throw new Error(`Draft generation failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }>;
    output_text?: string;
  };

  const text =
    data.output_text ??
    (data.output ?? [])
      .filter((o) => o.type === "message")
      .flatMap((o) => o.content ?? [])
      .map((c) => c.text ?? "")
      .join("\n");

  return text.trim();
}

function parseJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("The writing service returned an unreadable draft.");
  return JSON.parse(raw.slice(start, end + 1)) as T;
}

const HOUSE_RULES = `You draft a monthly museum newsletter. Rules:
- Match the house style profile exactly: register, person, section conventions, sign-off.
- NEVER invent facts. Use only what the raw notes provide. If a section's input is empty, return an empty "text" for it — do not fabricate content.
- narrative sections: full prose at roughly the target word count.
- image_anchored sections: one short caption-length block (1-2 sentences), not paragraphs.
- structured sections: render the supplied rows as clean plain-text lines ("Saturday — 2:00 PM — Skies of Winter"). Never turn them into prose and never add rows.
- evergreen sections: return the carried text verbatim. No rewriting.
- paired sections: return the puzzle as "text" and its answer key as "answer_key_text", kept matched.
- Plain text only: no markdown, asterisks, or bullet characters. Clean text destined for a layout tool.
Respond with JSON only, shaped:
{"sections":[{"section_id":"...","heading":"optional short headline","text":"...","answer_key_text":"optional"}]}`;

function buildInput(payload: z.infer<typeof generateInput>, onlySectionId?: string) {
  const { profile, blocks, issue_name } = payload;
  const active = blocks.filter(
    (b) => !b.skipped && (!onlySectionId || b.section_id === onlySectionId),
  );

  const sectionBrief = active.map((b) => {
    const meta = profile.sections.find((s) => s.id === b.section_id);
    return {
      section_id: b.section_id,
      section_name: b.section_name,
      section_type: b.section_type,
      target_word_count: meta?.avg_word_count,
      tone_notes: meta?.tone_notes,
      raw_notes: b.raw_notes,
      rows: b.rows?.filter((r) => r.a || r.b || r.c),
      puzzle_text: b.puzzle_text,
      answer_key_text: b.answer_key_text,
      caption: b.caption,
      photo_note: b.photo_note,
      carried_text: b.carried_text,
    };
  });

  return JSON.stringify(
    {
      issue_name,
      publication: profile.publication,
      organization: profile.organization,
      tone_summary: profile.tone_summary,
      headline_examples: profile.headline_examples,
      sign_off: profile.sign_off,
      sections: sectionBrief,
    },
    null,
    2,
  );
}

type ModelSections = {
  sections: Array<{
    section_id: string;
    heading?: string;
    text?: string;
    answer_key_text?: string;
  }>;
};

export const generateDraft = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => generateInput.parse(data))
  .handler(async ({ data }) => {
    const text = await callModel(HOUSE_RULES, buildInput(data));
    return parseJson<ModelSections>(text).sections;
  });

export const regenerateSection = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    generateInput.extend({ section_id: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const text = await callModel(
      `${HOUSE_RULES}\nDraft only the single section supplied. Take a fresh angle from the previous attempt.`,
      buildInput(data, data.section_id),
    );
    return parseJson<ModelSections>(text).sections;
  });

export const extractProfile = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ source_text: z.string().min(40) }).parse(data))
  .handler(async ({ data }) => {
    const text = await callModel(
      `You analyse past newsletter issues and extract a reusable style profile.
Classify each recurring section with a type: narrative | evergreen | structured | paired | image_anchored.
- evergreen = boilerplate that repeats nearly verbatim (pricing, donation call-out, contact info); include its current text as last_content.
- structured = day/time/program grids or date/event lists.
- paired = a puzzle with a separate answer key.
- image_anchored = a photo with a caption-length block.
- narrative = prose sections.
Capture register precisely (e.g. "warm but institutional; first-person director's letter; formal sign-off with name and title"), not just "friendly".
avg_word_count only for narrative and image_anchored sections. Infer nothing you cannot see in the source.
Respond with JSON only:
{"publication":"","organization":"","tone_summary":"","headline_examples":[""],"sign_off":"","sections":[{"name":"","section_type":"narrative","avg_word_count":0,"tone_notes":"","last_content":""}],"source_notes":[""]}`,
      data.source_text.slice(0, 120000),
    );
    return parseJson<{
      publication?: string;
      organization?: string;
      tone_summary?: string;
      headline_examples?: string[];
      sign_off?: string;
      sections?: Array<{
        name: string;
        section_type: string;
        avg_word_count?: number;
        tone_notes?: string;
        last_content?: string;
      }>;
      source_notes?: string[];
    }>(text);
  });
