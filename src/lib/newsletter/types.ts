export type SectionType =
  | "narrative" // prose: Director's Letter, one instance of a Story
  | "template_slot" // fixed opener/closer text wrapping one variable note, e.g. planetarium schedule
  | "rotating_cta" // a call-to-action that rotates issue to issue (membership, field trips) — NOT verbatim
  | "structured" // a 2-column date/event style list
  | "paired" // a puzzle with a separate answer key — occasional, not every issue
  | "image_anchored" // a photo with a caption-length block of text
  | "evergreen"; // true boilerplate carried forward verbatim (footer, standing closing paragraph)

export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  narrative: "Narrative",
  template_slot: "Template w/ variable slot",
  rotating_cta: "Rotating call-to-action",
  structured: "Structured list",
  paired: "Paired (occasional)",
  image_anchored: "Image block",
  evergreen: "Evergreen (verbatim)",
};

export type ProfileSection = {
  id: string;
  name: string;
  section_type: SectionType;
  avg_word_count?: number | undefined;
  tone_notes?: string | undefined;
  /** evergreen only: text carried forward verbatim each issue */
  last_content?: string | undefined;
  /** evergreen only: ISO date it was last edited, for staleness flags */
  last_updated?: string | undefined;
  /** template_slot only: fixed text before the variable part (not regenerated) */
  template_opener?: string | undefined;
  /** template_slot only: fixed text after the variable part (not regenerated) */
  template_closer?: string | undefined;
  /** structured only: column headers, e.g. ["Date", "Event"] */
  column_labels?: [string, string] | undefined;
  /**
   * Whether this section should be pre-enabled when starting a new issue.
   * false for sections observed to be occasional/optional across source issues
   * (e.g. a puzzle or a donation call-out that didn't appear in every issue) —
   * the editor opts them in per-issue rather than un-skipping them every time.
   */
  active_by_default: boolean;
  /**
   * True for section templates that can appear 0-N times per issue (e.g. "Story"),
   * rather than representing a single fixed slot. Monthly Input renders an
   * "add another" control for repeatable sections instead of one fixed block.
   */
  repeatable?: boolean | undefined;
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

export type StructuredRow = { date: string; event: string };

export type InputBlock = {
  section_id: string;
  /**
   * Distinguishes multiple entries of the same repeatable section_id within
   * one issue (e.g. two "Story" instances). Undefined for non-repeatable sections.
   */
  instance_id?: string | undefined;
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
  /** template_slot only: just the variable middle part the editor fills in */
  variable_text?: string | undefined;
  /**
   * Sent only on regenerate: the previously generated text/answer key, so the
   * model has something concrete to diverge from instead of guessing blind.
   */
  previous_text?: string | undefined;
  previous_answer_key_text?: string | undefined;
};

export type DraftSection = {
  section_id: string;
  instance_id?: string | undefined;
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

export function monthsSince(iso?: string | undefined) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24 * 30.44));
}

/** Stable identity for a block or draft section: repeatable instances share a section_id. */
export function blockKey(b: { section_id: string; instance_id?: string | undefined }) {
  return b.instance_id ? `${b.section_id}:${b.instance_id}` : b.section_id;
}
