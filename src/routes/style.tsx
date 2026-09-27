import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  AccentButton,
  Card,
  Chip,
  Field,
  GhostButton,
  Shell,
  TextInput,
} from "@/components/newsletter/Shell";
import { starterProfile, uid, useProfile } from "@/lib/newsletter/store";
import {
  SECTION_TYPE_LABELS,
  monthsSince,
  STALE_MONTHS,
  type ProfileSection,
  type SectionType,
  type StyleProfile,
} from "@/lib/newsletter/types";
import { extractProfile } from "@/lib/newsletter/generate.functions";

export const Route = createFileRoute("/style")({
  head: () => ({
    meta: [
      { title: "Style Profile · Newsletter Draft Desk" },
      {
        name: "description",
        content:
          "Capture the newsletter's house style once: recurring sections, section types, tone, headline conventions and sign-off.",
      },
      { property: "og:title", content: "Style Profile · Newsletter Draft Desk" },
      {
        property: "og:description",
        content: "Recurring sections, section types, tone and sign-off for the monthly newsletter.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StylePage,
});

const TYPES: SectionType[] = [
  "narrative",
  "evergreen",
  "structured",
  "paired",
  "image_anchored",
];

function StylePage() {
  const { profile, saveProfile, clearProfile, hydrated } = useProfile();
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runExtract = useServerFn(extractProfile);

  const analyse = async () => {
    setError(null);
    setBusy(true);
    try {
      const out = await runExtract({ data: { source_text: source } });
      const now = new Date().toISOString();
      const next: StyleProfile = {
        publication: out.publication ?? "Untitled newsletter",
        organization: out.organization ?? "",
        tone_summary: out.tone_summary ?? "",
        headline_examples: out.headline_examples ?? [],
        sign_off: out.sign_off ?? "",
        source_notes: out.source_notes ?? [],
        sections: (out.sections ?? []).map((s) => ({
          id: uid(),
          name: s.name,
          section_type: (TYPES as string[]).includes(s.section_type)
            ? (s.section_type as SectionType)
            : "narrative",
          avg_word_count: s.avg_word_count || undefined,
          tone_notes: s.tone_notes,
          last_content: s.last_content,
          last_updated: s.last_content ? now : undefined,
        })),
        updated_at: now,
      };
      saveProfile(next);
      setSource("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read those issues.");
    } finally {
      setBusy(false);
    }
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const texts = await Promise.all(Array.from(files).map((f) => f.text()));
    setSource((s) => [s, ...texts].filter(Boolean).join("\n\n———\n\n"));
  };

  if (!hydrated) {
    return (
      <Shell>
        <div className="mt-6 text-[12px] text-mist">Loading…</div>
      </Shell>
    );
  }

  const setSection = (next: ProfileSection) =>
    profile &&
    saveProfile({
      ...profile,
      sections: profile.sections.map((s) => (s.id === next.id ? next : s)),
    });

  return (
    <Shell status={<p className="label-eyebrow text-mist">Style profile</p>}>
      {!profile && (
        <Card className={`mt-5 ${busy ? "scan" : ""}`}>
          <p className="label-eyebrow text-accent">Past issues</p>
          <h1 className="font-display mt-2 text-xl font-bold">Learn the house style</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-mist">
            Paste the text of one or more past issues, or drop in .txt / .md files. For a PDF, copy
            its text and paste it here.
          </p>
          <div className="mt-3">
            <Field
              value={source}
              onChange={setSource}
              rows={8}
              placeholder="Paste past newsletter text…"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="rounded-lg bg-glass/60 px-3 py-1.5 text-[11px] font-semibold text-ink outline-1 -outline-offset-1 outline-border">
              <input
                type="file"
                multiple
                accept=".txt,.md,.markdown,text/plain"
                className="hidden"
                onChange={(e) => onFiles(e.target.files)}
              />
              Add files
            </label>
            <AccentButton onClick={analyse} disabled={busy || source.trim().length < 40}>
              {busy ? "Analyzing…" : "Analyze issues"}
            </AccentButton>
            <GhostButton onClick={() => saveProfile(starterProfile())}>
              Use “The Exhibit” starter
            </GhostButton>
          </div>
          {error && <p className="mt-3 text-[12px] text-warn">{error}</p>}
        </Card>
      )}

      {profile && (
        <div className="mt-5 space-y-3">
          <Card>
            <p className="label-eyebrow text-accent">Publication</p>
            <div className="mt-2 space-y-2">
              <TextInput
                value={profile.publication}
                onChange={(v) => saveProfile({ ...profile, publication: v })}
              />
              <TextInput
                value={profile.organization}
                onChange={(v) => saveProfile({ ...profile, organization: v })}
              />
            </div>
            <p className="label-eyebrow mt-4 text-mist">Tone &amp; register</p>
            <div className="mt-2">
              <Field
                value={profile.tone_summary}
                onChange={(v) => saveProfile({ ...profile, tone_summary: v })}
                rows={4}
              />
            </div>
            <p className="label-eyebrow mt-4 text-mist">Sign-off</p>
            <div className="mt-2">
              <Field
                value={profile.sign_off}
                onChange={(v) => saveProfile({ ...profile, sign_off: v })}
                rows={3}
              />
            </div>
            {profile.headline_examples.length > 0 && (
              <>
                <p className="label-eyebrow mt-4 text-mist">Headline examples</p>
                <ul className="mt-1 space-y-1 text-[12px] text-mist">
                  {profile.headline_examples.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </>
            )}
            {profile.source_notes.length > 0 && (
              <>
                <p className="label-eyebrow mt-4 text-mist">Notes from past issues</p>
                <ul className="mt-1 space-y-1 text-[12px] text-mist">
                  {profile.source_notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          {profile.sections.map((s, i) => {
            const stale = monthsSince(s.last_updated);
            return (
              <Card key={s.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <TextInput value={s.name} onChange={(v) => setSection({ ...s, name: v })} />
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Chip>#{i + 1}</Chip>
                    {s.section_type === "evergreen" &&
                      stale !== null &&
                      stale >= STALE_MONTHS && <Chip tone="warn">Stale · {stale} mo</Chip>}
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSection({ ...s, section_type: t })}
                      className={
                        s.section_type === t
                          ? "rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent outline-1 -outline-offset-1 outline-accent/30"
                          : "rounded-full bg-glass/60 px-2 py-0.5 text-[10px] text-mist outline-1 -outline-offset-1 outline-border"
                      }
                    >
                      {SECTION_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>

                {(s.section_type === "narrative" || s.section_type === "image_anchored") && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[11px] text-mist">Typical words</span>
                    <input
                      type="number"
                      value={s.avg_word_count ?? ""}
                      onChange={(e) =>
                        setSection({ ...s, avg_word_count: Number(e.target.value) || undefined })
                      }
                      className="w-20 rounded-lg bg-canvas/50 px-2 py-1 text-[12px] outline-1 -outline-offset-1 outline-input focus:outline-ring"
                    />
                  </div>
                )}

                <div className="mt-2">
                  <Field
                    value={s.tone_notes ?? ""}
                    onChange={(v) => setSection({ ...s, tone_notes: v })}
                    rows={2}
                    placeholder="Conventions for this section"
                  />
                </div>

                {s.section_type === "evergreen" && (
                  <div className="mt-2">
                    <p className="label-eyebrow text-mist">Carried text</p>
                    <div className="mt-1">
                      <Field
                        value={s.last_content ?? ""}
                        onChange={(v) =>
                          setSection({
                            ...s,
                            last_content: v,
                            last_updated: new Date().toISOString(),
                          })
                        }
                        rows={3}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  <GhostButton
                    onClick={() =>
                      saveProfile({
                        ...profile,
                        sections: profile.sections.filter((x) => x.id !== s.id),
                      })
                    }
                  >
                    Remove
                  </GhostButton>
                </div>
              </Card>
            );
          })}

          <div className="flex flex-wrap gap-2">
            <AccentButton
              onClick={() =>
                saveProfile({
                  ...profile,
                  sections: [
                    ...profile.sections,
                    { id: uid(), name: "New section", section_type: "narrative" },
                  ],
                })
              }
            >
              Add section
            </AccentButton>
            <GhostButton onClick={clearProfile}>Start over</GhostButton>
          </div>
        </div>
      )}
    </Shell>
  );
}
