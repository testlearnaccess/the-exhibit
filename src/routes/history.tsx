import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, Chip, GhostButton, Shell } from "@/components/newsletter/Shell";
import { useIssues } from "@/lib/newsletter/store";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Issue History · Newsletter Draft Desk" },
      {
        name: "description",
        content:
          "Every past issue of the museum newsletter with its final text and the raw monthly input it came from.",
      },
      { property: "og:title", content: "Issue History · Newsletter Draft Desk" },
      {
        property: "og:description",
        content: "Past newsletter issues with their final text and original monthly input.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { issues, remove, hydrated } = useIssues();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <Shell status={<p className="label-eyebrow text-mist">Issue history</p>}>
      {!hydrated && <div className="mt-6 text-[12px] text-mist">Loading…</div>}

      {hydrated && issues.length === 0 && (
        <Card className="mt-5">
          <p className="text-[13px] text-mist">No issues yet. Your first draft will appear here.</p>
        </Card>
      )}

      <div className="mt-5 space-y-3">
        {issues.map((issue) => {
          const open = openId === issue.id;
          return (
            <Card key={issue.id}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-display text-[13px] leading-tight font-semibold">
                    {issue.name}
                  </p>
                  <p className="text-[10px] text-mist">
                    Created {new Date(issue.created_at).toLocaleDateString()} · updated{" "}
                    {new Date(issue.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Chip tone={issue.status === "finalized" ? "ok" : "neutral"}>
                    {issue.status === "finalized" ? "Finalized" : "Draft"}
                  </Chip>
                  <GhostButton onClick={() => setOpenId(open ? null : issue.id)}>
                    {open ? "Hide" : "View"}
                  </GhostButton>
                </div>
              </div>

              {open && (
                <div className="mt-3 space-y-3">
                  {issue.draft.length === 0 && (
                    <p className="text-[12px] text-mist">No generated text for this issue yet.</p>
                  )}
                  {issue.draft.map((d) => (
                    <div key={d.section_id}>
                      <p className="label-eyebrow text-accent">{d.section_name}</p>
                      <p className="mt-1 whitespace-pre-line text-[12px] leading-relaxed text-mist">
                        {d.text}
                      </p>
                    </div>
                  ))}
                  <details>
                    <summary className="cursor-pointer text-[11px] text-mist">
                      Original monthly input
                    </summary>
                    <div className="mt-2 space-y-2">
                      {issue.input.map((b) => (
                        <div key={b.section_id}>
                          <p className="text-[11px] text-ink">{b.section_name}</p>
                          <p className="whitespace-pre-line text-[11px] text-mist/80">
                            {[
                              b.raw_notes,
                              b.caption,
                              b.photo_note && `Photo needed: ${b.photo_note}`,
                              b.puzzle_text,
                              b.answer_key_text,
                              b.carried_text,
                              b.rows
                                ?.filter((r) => r.a || r.b || r.c)
                                .map((r) => `${r.a} — ${r.b} — ${r.c}`)
                                .join("\n"),
                              b.skipped ? "Skipped this month" : "",
                            ]
                              .filter(Boolean)
                              .join("\n") || "—"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </details>
                  <GhostButton onClick={() => remove(issue.id)}>Delete issue</GhostButton>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </Shell>
  );
}
