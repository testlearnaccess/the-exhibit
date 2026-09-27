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

/** Reference profile derived from "The Exhibit" (UL Lafayette Science Museum). */
export function starterProfile(): StyleProfile {
  const now = new Date().toISOString();
  const s = (
    name: string,
    section_type: ProfileSection["section_type"],
    extra: Partial<ProfileSection> = {},
  ): ProfileSection => ({ id: uid(), name, section_type, ...extra });

  return {
    publication: "The Exhibit",
    organization: "UL Lafayette Science Museum",
    tone_summary:
      "Warm but institutional. First-person Letter from the Director, signed with name and university title. Formal calls to action with phone number and email. Plain, unhurried sentences; no exclamation-heavy marketing voice.",
    headline_examples: [
      "A Month of Light in the Hall",
      "New in the Planetarium: Skies of Winter",
      "Curiosity Corner",
    ],
    sign_off:
      "Warm regards,\n[Director name]\nDirector, UL Lafayette Science Museum",
    sections: [
      s("Letter from the Director", "narrative", {
        avg_word_count: 180,
        tone_notes: "First person, addressed to “Dear friends of the museum”, ends with the sign-off.",
      }),
      s("Feature Story", "narrative", { avg_word_count: 250 }),
      s("Museum Spotlight", "narrative", { avg_word_count: 150 }),
      s("Planetarium Showtimes", "structured", {
        tone_notes: "Day / time / program grid.",
      }),
      s("Calendar of Events", "structured", {
        tone_notes: "Date / event / time list.",
      }),
      s("Curiosity Corner", "paired", {
        tone_notes: "Puzzle up front, answer key printed on a later page.",
      }),
      s("Event Promo", "image_anchored", { avg_word_count: 45 }),
      s("Membership & Pricing", "evergreen", {
        last_content:
          "Individual membership $35 · Family $60 · Patron $150. Members receive unlimited admission, planetarium seating, and preview invitations.",
        last_updated: now,
      }),
      s("Support the Museum", "evergreen", {
        last_content:
          "Your gift keeps our exhibits open to every school group in Acadiana. To give, contact me by email or call (337) 482-1000.",
        last_updated: now,
      }),
    ],
    source_notes: [
      "Planetarium grid and Curiosity Corner are not prose sections.",
      "Membership pricing and the donation call-out repeat nearly verbatim; refresh occasionally.",
      "Several sections are built around a photo with a caption-length block of text.",
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

export function blocksFromProfile(profile: StyleProfile): InputBlock[] {
  return profile.sections.map((s) => ({
    section_id: s.id,
    section_name: s.name,
    section_type: s.section_type,
    rows: s.section_type === "structured" ? [{ a: "", b: "", c: "" }] : undefined,
    carried_text: s.section_type === "evergreen" ? (s.last_content ?? "") : undefined,
  }));
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
