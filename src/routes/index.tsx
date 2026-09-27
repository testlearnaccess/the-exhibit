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
import { newIssue, useIssues, useProfile } from "@/lib/newsletter/store";
import {
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

  const setBlock = (next: InputBlock) =>
    save({
      ...issue,
      input: issue.input.map((b) => (b.section_id === next.section_id ? next : b)),
    });

  const mergeDraft = (
    returned: Array<{ section_id: string; heading?: string; text?: string; answer_key_text?: string }>,
  ) => {
    const byId = new Map(returned.map((r) => [r.section_id, r]));
    const existing = new Map(issue.draft.map((d) => [d.section_id, d]));

    const sections: DraftSection[] = issue.input
      .filter((b) => !b.skipped)
      .map((b) => {
        const meta = profile.sections.find((s) => s.id === b.section_id);
        const got = byId.get(b.section_id);
        const prior = existing.get(b.section_id);
        const text = got?.text ?? prior?.text ?? "";
        return {
          section_id: b.section_id,
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

  const onRegenerate = async (sectionId: string) => {
    setError(null);
    setBusySection(sectionId);
    try {
      const result = await runRegenerate({
        data: { issue_name: issue.name, profile, blocks: issue.input, section_id: sectionId },
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
      .map((d) =>
        [d.heading ?? d.section_name, d.text, d.answer_key_text ? `Answer key: ${d.answer_key_text}` : ""]
          .filter(Boolean)
          .join("\n\n"),
      )
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
                key={d.section_id}
                section={d}
                rawInput={issue.input.find((b) => b.section_id === d.section_id)}
                busy={busySection === d.section_id || generating}
                onEdit={(text) =>
                  save({
                    ...issue,
                    draft: issue.draft.map((s) =>
                      s.section_id === d.section_id
                        ? { ...s, text, word_count: wordCount(text) }
                        : s,
                    ),
                  })
                }
                onRegenerate={() => onRegenerate(d.section_id)}
              />
            ))}
          </div>
        </>
      )}

      <p className="label-eyebrow mt-6 text-mist">This month's input</p>
      <div className="mt-3 space-y-3">
        {issue.input.map((b) => (
          <SectionInputBlock
            key={b.section_id}
            block={b}
            meta={profile.sections.find((s) => s.id === b.section_id)}
            onChange={setBlock}
          />
        ))}
      </div>
    </Shell>
  );
}
