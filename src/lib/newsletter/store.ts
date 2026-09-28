import { useCallback, useEffect, useState } from "react";
import {
  type InputBlock,
  type Issue,
  type ProfileSection,
  type StyleProfile,
} from "./types";

const PROFILE_KEY = "nl.profile.v1";
const ISSUES_KEY = "nl.issues.v1";

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event("nl:store"));
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Reference profile derived from "The Exhibit" (UL Lafayette Science Museum),
 * cross-checked against Vol. 8 (2024), Vol. 21 (Apr/May 2026) and Vol. 23
 * (Aug/Sep 2026). Vol. 21 and 23 agree with each other and diverge from the
 * older Vol. 8 in several places (see source_notes) — the newer two issues
 * are weighted as the current format.
 */
export function starterProfile(): StyleProfile {
  const now = new Date().toISOString();
  const s = (
    name: string,
    section_type: ProfileSection["section_type"],
    extra: Partial<ProfileSection> = {},
  ): ProfileSection => ({
    id: uid(),
    name,
    section_type,
    active_by_default: true,
    ...extra,
  });

  return {
    publication: "The Exhibit",
    organization: "UL Lafayette Science Museum",
    tone_summary:
      "Warm but institutional. First-person Letter from the Director, signed with name and university title. Formal calls to action with phone number and email. Plain, unhurried sentences; no exclamation-heavy marketing voice.",
    headline_examples: [
      "Students Bring New Exhibit to Life",
      "Book Now to Secure Your Fall Field Trip Date",
      "Gear Up for Summer with Museum Membership",
    ],
    sign_off: "Best Wishes,\n[Director name], Museum Director",
    sections: [
      s("Letter from the Director", "narrative", {
        avg_word_count: 200,
        tone_notes:
          "Opens \"Greetings from UL Lafayette Science Museum,\"; recaps the recent season, thanks the community, looks ahead, ends with the sign-off.",
      }),
      s("Calendar of Events", "structured", {
        column_labels: ["Date", "Event"],
        tone_notes: "4-6 short date/event lines.",
      }),
      s("Upcoming Events", "narrative", {
        avg_word_count: 120,
        tone_notes:
          "Prose expansion of the Calendar of Events entries — draft the calendar first, then write this from the same facts.",
      }),
      s("Story", "narrative", {
        avg_word_count: 200,
        repeatable: true,
        tone_notes:
          "Appears 2-4 times per issue: new exhibits, student/staff spotlights, program recaps. Headline + one-line subhead + body.",
      }),
      s("In the Planetarium", "template_slot", {
        template_opener:
          "The universe awaits in our state-of-the-art, all-digital, full-dome planetarium!",
        template_closer:
          "As we work to grow our planetarium staff, The Sky Tonight or an alternate program will be shown depending on staff availability.",
        tone_notes:
          "Variable middle names this issue's specific schedule/exceptions around the standing weekly showtimes.",
      }),
      s("Field Trip / Membership CTA", "rotating_cta", {
        avg_word_count: 90,
        tone_notes:
          "Subject rotates by season — membership renewal push in spring, field-trip booking in fall. Not verbatim between issues.",
      }),
      s("Curiosity Corner", "paired", {
        active_by_default: false,
        tone_notes:
          "Puzzle up front, answer key printed on a later page. Did not appear in Vol. 21 or 23 — occasional, not guaranteed.",
      }),
      s("Event Promo", "image_anchored", {
        avg_word_count: 45,
        active_by_default: false,
      }),
      s("Closing Note", "evergreen", {
        last_content:
          "These are just a few highlights and updates from UL Lafayette Science Museum. We invite you to visit our website and follow our social media channels for the latest on upcoming events. With your support, we can continue to provide informative and interactive experiences in STEM fields to the community, K-12 and University students, provide innovative research opportunities, and preserve museum collections for use in exhibits, classrooms and scientific research.",
        last_updated: now,
      }),
      s("Footer", "evergreen", {
        last_content:
          "UL Lafayette Science Museum\n433 Jefferson Street\nLafayette, LA 70501\nPhone: 337-291-5544\nEmail: LafayetteScienceMuseum@louisiana.edu",
        last_updated: now,
      }),
    ],
    source_notes: [
      "Vol. 21 and Vol. 23 agree with each other; Vol. 8 (2024) differs in ways treated as outdated: it used a Planetarium showtime grid (now template_slot) and a fixed Membership/Support pair (now a single rotating_cta).",
      "Curiosity Corner and a standalone donation call-out appeared in neither Vol. 21 nor Vol. 23 — set inactive by default rather than removed, in case they return seasonally.",
      "Story count varies issue to issue (2-4 instances) — modeled as one repeatable section rather than fixed named slots.",
      "Upcoming Events consistently restates the Calendar of Events in prose — draft Calendar first and hand its rows to Upcoming Events as source facts.",
    ],
    updated_at: now,
  };
}

function useStoreValue<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [hydrated, setHydrated] = useState(false);

  const sync = useCallback(() => {
    const stored = read<T>(key);
    setValue(stored ?? fallback);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    sync();
    const onChange = () => sync();
    window.addEventListener("nl:store", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("nl:store", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [sync]);

  const save = useCallback(
    (next: T) => {
      setValue(next);
      write(key, next);
    },
    [key],
  );

  return { value, save, hydrated };
}

export function useProfile() {
  const { value, save, hydrated } = useStoreValue<StyleProfile | null>(PROFILE_KEY, null);
  return {
    profile: value,
    hydrated,
    saveProfile: (p: StyleProfile) => save({ ...p, updated_at: new Date().toISOString() }),
    clearProfile: () => save(null),
  };
}

export function useIssues() {
  const { value, save, hydrated } = useStoreValue<Issue[]>(ISSUES_KEY, []);

  const upsert = (issue: Issue) => {
    const next = { ...issue, updated_at: new Date().toISOString() };
    const exists = value.some((i) => i.id === next.id);
    save(exists ? value.map((i) => (i.id === next.id ? next : i)) : [next, ...value]);
    return next;
  };

  return {
    issues: value,
    hydrated,
    upsert,
    remove: (id: string) => save(value.filter((i) => i.id !== id)),
  };
}

/**
 * Builds the starting Monthly Input blocks for a new issue. Sections marked
 * active_by_default:false are still included so the editor can see and opt
 * into them, but callers should render them collapsed/unchecked — skipped
 * defaults to true for those so a fresh issue doesn't silently draft an
 * occasional section nobody asked for.
 */
export function blocksFromProfile(profile: StyleProfile): InputBlock[] {
  return profile.sections
    .filter((s) => !s.repeatable) // repeatable sections start with zero instances; UI adds them on demand
    .map((s) => ({
      section_id: s.id,
      section_name: s.name,
      section_type: s.section_type,
      skipped: s.active_by_default === false,
      rows: s.section_type === "structured" ? [{ date: "", event: "" }] : undefined,
      carried_text: s.section_type === "evergreen" ? (s.last_content ?? "") : undefined,
    }));
}

/** Adds one new instance of a repeatable section (e.g. another "Story") to an issue's input. */
export function addRepeatableInstance(section: ProfileSection): InputBlock {
  return {
    section_id: section.id,
    instance_id: uid(),
    section_name: section.name,
    section_type: section.section_type,
  };
}

/**
 * Prefills the "Upcoming Events" narrative textarea from Calendar of Events
 * rows, as a starting point the editor can freely rewrite — not a hard
 * binding. Call this when the calendar block changes, only if the target
 * block hasn't been hand-edited yet.
 */
export function deriveUpcomingEventsSeed(rows: { date: string; event: string }[]): string {
  return rows
    .filter((r) => r.date || r.event)
    .map((r) => `${r.date}: ${r.event}`)
    .join("\n");
}

export function newIssue(profile: StyleProfile): Issue {
  const now = new Date();
  const name = now.toLocaleString("en-US", { month: "long", year: "numeric" });
  return {
    id: uid(),
    name,
    status: "draft",
    input: blocksFromProfile(profile),
    draft: [],
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}
