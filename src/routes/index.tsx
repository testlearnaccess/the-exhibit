import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  AccentButton,
  Card,
  Chip,
  GhostButton,
  Shell,
  TextInput,
} from "@/components/newsletter/Shell";
import { DraftBlock, SectionInputBlock } from "@/components/newsletter/SectionBlock";
import {
  addRepeatableInstance,
  deriveUpcomingEventsSeed,
  newIssue,
  useIssues,
  useProfile,
} from "@/lib/newsletter/store";
import {
  blockKey,
  wordCount,
  type DraftSection,
  type InputBlock,
  type Issue,
} from "@/lib/newsletter/types";
import { generateDraft, regenerateSection } from "@/lib/newsletter/generate.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Newsletter Draft Desk · The Exhibit" },
      {
        name: "description",
        content:
          "Turn a month of raw museum notes into an on-brand rough draft newsletter, section by section, ready for Canva.",
      },
      { property: "og:title", content: "Newsletter Draft Desk · The Exhibit" },
      {
        property: "og:description",
        content:
          "Turn a month of raw museum notes into an on-brand rough draft newsletter, ready for Canva.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Workspace,
});

function Workspace() {
  const { profile, hydrated } = useProfile();
  const { issues, upsert, hydrated: issuesReady } = useIssues();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busySection, setBusySection] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const runGenerate = useServerFn(generateDraft);
  const runRegenerate = useServerFn(regenerateSection);

  const issue = useMemo(
    () => issues.find((i) => i.id === activeId) ?? issues.find((i) => i.status === "draft") ?? null,
    [issues, activeId],
  );

  useEffect(() => {
    if (issue && activeId !== issue.id) setActiveId(issue.id);
  }, [issue, activeId]);

  const save = (next: Issue) => {
    upsert(next);
    setSavedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
  };

  if (!hydrated || !issuesReady) {
    return (
      <Shell>
        <div className="mt-6 text-[12px] text-mist">Loading your desk…</div>
      </Shell>
    );
  }

  if (!profile) {
    return (
      <Shell>
        <Card className="mt-5">
          <p className="label-eyebrow text-accent">Step one</p>
          <h1 className="font-display mt-2 text-xl font-bold">Set up your style profile</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-mist">
            Paste in a past issue or two and the desk will pull out your recurring sections, their
            types, tone and sign-off. You can edit everything it infers.
          </p>
          <div className="mt-3">
            <Link
              to="/style"
              className="font-display inline-block rounded-lg bg-accent px-3 py-2 text-[11px] font-semibold text-accent-foreground"
            >
              Build style profile
            </Link>
          </div>
        </Card>
      </Shell>
    );
  }

  if (!issue) {
    return (
      <Shell>
        <Card className="mt-5">
          <p className="label-eyebrow text-accent">Ready</p>
          <h1 className="font-display mt-2 text-xl font-bold">Start this month's issue</h1>
          <p className="mt-2 text-[13px] text-mist">
            {profile.sections.length} sections from “{profile.publication}” are waiting.
          </p>
          <div className="mt-3">
            <AccentButton onClick={() => save(newIssue(profile))}>New issue</AccentButton>
          </div>
        </Card>
      </Shell>
    );
  }

  const hasDraft = issue.draft.length > 0;
  const locked = issue.status === "finalized";

  const setBlock = (next: InputBlock) => {
    let input = issue.input.map((b) => (blockKey(b) === blockKey(next) ? next : b));

    // Seed "Upcoming Events"-style narrative blocks from a structured calendar
    // block's rows, unless the editor has hand-edited the target.
    if (next.section_type === "structured" && next.rows) {
      const seed = deriveUpcomingEventsSeed(next.rows);
      const priorSeed = deriveUpcomingEventsSeed(
        issue.input.find((b) => blockKey(b) === blockKey(next))?.rows ?? [],
      );
      input = input.map((b) => {
        if (b.section_type !== "narrative" || b.section_id === next.section_id) return b;
        const meta = profile.sections.find((s) => s.id === b.section_id);
        if (!meta?.tone_notes?.toLowerCase().includes("calendar")) return b;
        const current = b.raw_notes ?? "";
        if (current && current !== priorSeed) return b; // hand-edited — leave it
        return { ...b, raw_notes: seed };
      });
    }

    save({ ...issue, input });
  };

  const mergeDraft = (
    returned: Array<{
      section_id: string;
      instance_id?: string;
      heading?: string;
      text?: string;
      answer_key_text?: string;
    }>,
  ) => {
    const byKey = new Map(
      returned.map((r) => [r.instance_id ? `${r.section_id}:${r.instance_id}` : r.section_id, r]),
    );
    const existing = new Map(issue.draft.map((d) => [blockKey(d), d]));

    const sections: DraftSection[] = issue.input
      .filter((b) => !b.skipped)
      .map((b) => {
        const meta = profile.sections.find((s) => s.id === b.section_id);
        const key = blockKey(b);
        const got = byKey.get(key) ?? byKey.get(b.section_id);
        const prior = existing.get(key);
        const text = got?.text ?? prior?.text ?? "";
        return {
          section_id: b.section_id,
          instance_id: b.instance_id,
          section_name: b.section_name,
          section_type: b.section_type,
          heading: got?.heading ?? prior?.heading,
          text,
          answer_key_text: got?.answer_key_text ?? prior?.answer_key_text ?? b.answer_key_text,
          photo_note: b.photo_note,
          word_count: wordCount(text),
          target_word_count: meta?.avg_word_count,
        };
      });

    save({ ...issue, draft: sections });
  };

  const onGenerate = async () => {
    setError(null);
    setGenerating(true);
    try {
      const result = await runGenerate({
        data: { issue_name: issue.name, profile, blocks: issue.input },
      });
      mergeDraft(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Draft generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const onRegenerate = async (draft: DraftSection) => {
    setError(null);
    const key = blockKey(draft);
    setBusySection(key);
    try {
      const blocks = issue.input.map((b) =>
        blockKey(b) === key
          ? { ...b, previous_text: draft.text, previous_answer_key_text: draft.answer_key_text }
          : b,
      );
      const result = await runRegenerate({
        data: {
          issue_name: issue.name,
          profile,
          blocks,
          section_id: draft.section_id,
          instance_id: draft.instance_id,
        },
      });
      mergeDraft(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That section could not be redrafted.");
    } finally {
      setBusySection(null);
    }
  };

  const fullText = () =>
    issue.draft
      .map((d) => {
        const meta = profile.sections.find((s) => s.id === d.section_id);
        const body =
          d.section_type === "template_slot"
            ? [meta?.template_opener, d.text, meta?.template_closer].filter(Boolean).join("\n\n")
            : d.text;
        return [d.heading ?? d.section_name, body, d.answer_key_text ? `Answer key: ${d.answer_key_text}` : ""]
          .filter(Boolean)
          .join("\n\n");
      })
      .join("\n\n———\n\n");

  const download = (ext: "txt" | "doc") => {
    const body = fullText();
    const blob =
      ext === "txt"
        ? new Blob([body], { type: "text/plain" })
        : new Blob(
            [
              `<html><head><meta charset="utf-8"></head><body>${body
                .split("\n\n")
                .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
                .join("")}</body></html>`,
            ],
            { type: "application/msword" },
          );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${issue.name.replace(/\s+/g, "-").toLowerCase()}.${ext === "doc" ? "doc" : "txt"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const repeatableSections = profile.sections.filter((s) => s.repeatable);

  return (
    <Shell
      status={
        <>
          <p className="label-eyebrow text-mist">
            {issue.status === "finalized" ? "Finalized" : "Draft"} · {issue.name}
          </p>
          {savedAt && (
            <div className="mt-1 flex items-center justify-end gap-1.5">
              <span className="size-1.5 animate-pulse rounded-full bg-accent" />
              <span className="text-[11px] font-medium text-accent">Saved {savedAt}</span>
            </div>
          )}
        </>
      }
    >
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="w-40">
          <TextInput
            value={issue.name}
            onChange={(v) => save({ ...issue, name: v })}
            placeholder="Issue name"
          />
        </div>
        <Chip>
          {issue.input.filter((b) => !b.skipped).length} of {issue.input.length} sections
        </Chip>
        <div className="ml-auto flex gap-2">
          {!locked && (
            <AccentButton onClick={onGenerate} disabled={generating}>
              {generating ? "Drafting…" : hasDraft ? "Regenerate all" : "Generate draft"}
            </AccentButton>
          )}
          <GhostButton onClick={() => save(newIssue(profile))}>New issue</GhostButton>
        </div>
      </div>

      {error && (
        <Card className="mt-3">
          <p className="text-[12px] text-warn">{error}</p>
        </Card>
      )}

      {hasDraft && (
        <>
          <div className="mt-5 flex items-center gap-2">
            <p className="label-eyebrow text-mist">Draft</p>
            <div className="ml-auto flex gap-2">
              <GhostButton onClick={() => navigator.clipboard.writeText(fullText())}>
                Copy full draft
              </GhostButton>
              <GhostButton onClick={() => download("txt")}>.txt</GhostButton>
              <GhostButton onClick={() => download("doc")}>.docx</GhostButton>
              <GhostButton
                onClick={() =>
                  save({ ...issue, status: locked ? "draft" : "finalized" })
                }
              >
                {locked ? "Reopen" : "Finalize"}
              </GhostButton>
            </div>
          </div>
          <div className="mt-3 space-y-3">
            {issue.draft.map((d) => (
              <DraftBlock
                key={blockKey(d)}
                section={d}
                rawInput={issue.input.find((b) => blockKey(b) === blockKey(d))}
                meta={profile.sections.find((s) => s.id === d.section_id)}
                busy={busySection === blockKey(d) || generating}
                onEdit={(text) =>
                  save({
                    ...issue,
                    draft: issue.draft.map((s) =>
                      blockKey(s) === blockKey(d)
                        ? { ...s, text, word_count: wordCount(text) }
                        : s,
                    ),
                  })
                }
                onRegenerate={() => onRegenerate(d)}
              />
            ))}
          </div>
        </>
      )}

      <p className="label-eyebrow mt-6 text-mist">This month's input</p>
      <div className="mt-3 space-y-3">
        {issue.input.map((b) => (
          <SectionInputBlock
            key={blockKey(b)}
            block={b}
            meta={profile.sections.find((s) => s.id === b.section_id)}
            onChange={setBlock}
            onRemove={
              b.instance_id
                ? () =>
                    save({
                      ...issue,
                      input: issue.input.filter((x) => blockKey(x) !== blockKey(b)),
                      draft: issue.draft.filter((x) => blockKey(x) !== blockKey(b)),
                    })
                : undefined
            }
          />
        ))}
        {repeatableSections.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {repeatableSections.map((s) => (
              <GhostButton
                key={s.id}
                onClick={() =>
                  save({ ...issue, input: [...issue.input, addRepeatableInstance(s)] })
                }
              >
                + Add another {s.name}
              </GhostButton>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}
