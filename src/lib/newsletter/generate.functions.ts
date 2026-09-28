import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const sectionTypeSchema = z.enum([
  "narrative",
  "template_slot",
  "rotating_cta",
  "structured",
  "paired",
  "image_anchored",
  "evergreen",
]);

const blockSchema = z.object({
  section_id: z.string(),
  instance_id: z.string().optional(),
  section_name: z.string(),
  section_type: sectionTypeSchema,
  skipped: z.boolean().optional(),
  raw_notes: z.string().optional(),
  rows: z.array(z.object({ date: z.string(), event: z.string() })).optional(),
  puzzle_text: z.string().optional(),
  answer_key_text: z.string().optional(),
  caption: z.string().optional(),
  photo_note: z.string().optional(),
  carried_text: z.string().optional(),
  variable_text: z.string().optional(),
  previous_text: z.string().optional(),
  previous_answer_key_text: z.string().optional(),
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
      template_opener: z.string().optional(),
      template_closer: z.string().optional(),
      column_labels: z.tuple([z.string(), z.string()]).optional(),
      active_by_default: z.boolean().optional(),
      repeatable: z.boolean().optional(),
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

/**
 * Parses the model's JSON reply defensively. Tries a direct parse first (the
 * common case), then a fenced code block, then falls back to brace-slicing —
 * but brace-slicing only as a last resort, since it breaks if any section's
 * own text legitimately contains "{" or "}". Throws a specific, section-free
 * error rather than silently truncating content.
 */
function parseJson<T>(text: string): T {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // fall through
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]) as T;
    } catch {
      // fall through
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("The writing service returned an unreadable draft (no JSON found).");
  }
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as T;
  } catch (err) {
    throw new Error(
      `The writing service returned malformed JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

const HOUSE_RULES = `You draft a monthly museum newsletter. Rules:
- Match the house style profile exactly: register, person, section conventions, sign-off.
- NEVER invent facts. This includes prices, dates, times, names, statistics, and any other
  specific detail. Use only what raw_notes/variable_text/rows provide. If a section's input
  is empty, return an empty "text" for it — do not fabricate content to fill the gap.
- narrative sections: full prose at roughly the target word count.
- template_slot sections: return ONLY the variable middle part as "text" — never repeat or
  rewrite the section's fixed opener/closer, those are assembled by the app around your output.
- rotating_cta sections: short, punchy prose built around a clear call to action. These are
  NOT evergreen — write fresh copy for this issue's specific offer, don't default to boilerplate.
- image_anchored sections: one short caption-length block (1-2 sentences), not paragraphs.
- structured sections: render the supplied rows as clean "Date — Event" plain-text lines.
  Never turn them into prose and never add, remove, or reorder rows.
- evergreen sections: return the carried text verbatim. No rewriting, ever.
- paired sections: return the puzzle as "text" and its answer key as "answer_key_text", kept matched.
- If a block includes "previous_text", you are regenerating: produce something substantively
  different in angle, opening, or emphasis — do not lightly reword the previous attempt.
- Plain text only: no markdown, asterisks, or bullet characters. Clean text destined for a layout tool.
Respond with JSON only, shaped:
{"sections":[{"section_id":"...","instance_id":"optional","heading":"optional short headline","text":"...","answer_key_text":"optional"}]}`;

function buildInput(payload: z.infer<typeof generateInput>, onlySectionId?: string) {
  const { profile, blocks, issue_name } = payload;
  const active = blocks.filter(
    (b) => !b.skipped && (!onlySectionId || b.section_id === onlySectionId),
  );

  const sectionBrief = active.map((b) => {
    const meta = profile.sections.find((s) => s.id === b.section_id);
    return {
      section_id: b.section_id,
      instance_id: b.instance_id,
      section_name: b.section_name,
      section_type: b.section_type,
      target_word_count: meta?.avg_word_count,
      tone_notes: meta?.tone_notes,
      raw_notes: b.raw_notes,
      rows: b.rows?.filter((r) => r.date || r.event),
      puzzle_text: b.puzzle_text,
      answer_key_text: b.answer_key_text,
      caption: b.caption,
      photo_note: b.photo_note,
      carried_text: b.carried_text,
      variable_text: b.variable_text,
      template_opener: meta?.template_opener,
      template_closer: meta?.template_closer,
      previous_text: b.previous_text,
      previous_answer_key_text: b.previous_answer_key_text,
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
    instance_id?: string;
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
    generateInput.extend({ section_id: z.string(), instance_id: z.string().optional() }).parse(data),
  )
  .handler(async ({ data }) => {
    const text = await callModel(HOUSE_RULES, buildInput(data, data.section_id));
    return parseJson<ModelSections>(text).sections;
  });

export const extractProfile = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ source_text: z.string().min(40) }).parse(data))
  .handler(async ({ data }) => {
    const text = await callModel(
      `You analyse several past newsletter issues together and extract a reusable style profile.
You are given MULTIPLE issues concatenated. Cross-reference them — do not build the profile
from only the first issue you see.
Classify each recurring section with a type: narrative | template_slot | rotating_cta | structured | paired | image_anchored | evergreen.
- evergreen = boilerplate that repeats nearly word-for-word across every issue you were given
  (standing closing paragraph, footer, a blurb repeated verbatim under multiple stories);
  include its current text as last_content.
- template_slot = a section with a fixed opening and/or closing sentence that surrounds ONE
  variable fact that changes issue to issue (e.g. a planetarium schedule note). Capture the
  fixed wording as template_opener/template_closer.
- rotating_cta = a call-to-action section whose SUBJECT changes issue to issue (membership push
  in one issue, field-trip booking in another) — do not classify these as evergreen.
- structured = a 2-column date/event style list. Set column_labels to the two column headers.
- paired = a puzzle with a separate answer key.
- image_anchored = a photo with a caption-length block.
- narrative = prose sections such as the Director's Letter or a feature story.
If a similarly-structured story/spotlight section appears more than once within a single issue,
or its name/topic varies issue to issue, model it as ONE section with repeatable:true rather
than several fixed named sections.
Set active_by_default:false for any section that did NOT appear in every issue you were given
(occasional/rotating content) — true only for sections present in every issue.
Capture register precisely (e.g. "warm but institutional; first-person director's letter; formal
sign-off with name and title"), not just "friendly".
avg_word_count only for narrative and image_anchored sections. Infer nothing you cannot see in the source.
Respond with JSON only:
{"publication":"","organization":"","tone_summary":"","headline_examples":[""],"sign_off":"","sections":[{"name":"","section_type":"narrative","avg_word_count":0,"tone_notes":"","last_content":"","template_opener":"","template_closer":"","column_labels":["",""],"active_by_default":true,"repeatable":false}],"source_notes":[""]}`,
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
        template_opener?: string;
        template_closer?: string;
        column_labels?: [string, string];
        active_by_default?: boolean;
        repeatable?: boolean;
      }>;
      source_notes?: string[];
    }>(text);
  });
