export type SectionType =
  | "narrative"
  | "evergreen"
  | "structured"
  | "paired"
  | "image_anchored";

export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  narrative: "Narrative",
  evergreen: "Evergreen",
  structured: "Structured grid",
  paired: "Paired",
  image_anchored: "Image block",
};

export type ProfileSection = {
  id: string;
  name: string;
  section_type: SectionType;
  avg_word_count?: number | undefined;
  tone_notes?: string | undefined;
  /** evergreen only: text carried forward each issue */
  last_content?: string | undefined;
  /** evergreen only: ISO date it was last edited, for staleness flags */
  last_updated?: string | undefined;
};

export type StyleProfile = {
  publication: string;
  organization: string;
  tone_summary: string;
  headline_examples: string[];
  sign_off: string;
  sections: ProfileSection[];
  source_notes: string[];
  updated_at: string;
};

export type StructuredRow = { a: string; b: string; c: string };

export type InputBlock = {
  section_id: string;
  section_name: string;
  section_type: SectionType;
  skipped?: boolean | undefined;
  raw_notes?: string | undefined;
  rows?: StructuredRow[] | undefined;
  puzzle_text?: string | undefined;
  answer_key_text?: string | undefined;
  caption?: string | undefined;
  photo_note?: string | undefined;
  carried_text?: string | undefined;
};

export type DraftSection = {
  section_id: string;
  section_name: string;
  section_type: SectionType;
  heading?: string | undefined;
  text: string;
  answer_key_text?: string | undefined;
  photo_note?: string | undefined;
  word_count: number;
  target_word_count?: number | undefined;
};

export type Issue = {
  id: string;
  name: string;
  status: "draft" | "finalized";
  input: InputBlock[];
  draft: DraftSection[];
  created_at: string;
  updated_at: string;
};

export const STALE_MONTHS = 6;

export function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function monthsSince(iso?: string) {
  if (!iso) return null | undefined;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24 * 30.44));
}
