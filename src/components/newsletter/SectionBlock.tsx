import { AccentButton, Card, Chip, Field, GhostButton, TextInput } from "./Shell";
import {
  SECTION_TYPE_LABELS,
  STALE_MONTHS,
  monthsSince,
  wordCount,
  type DraftSection,
  type InputBlock,
  type ProfileSection,
} from "@/lib/newsletter/types";

const STRUCTURED_HEADERS: [string, string, string] = [
  "Day / date",
  "Program / event",
  "Time",
];

export function SectionInputBlock({
  block,
  meta,
  onChange,
}: {
  block: InputBlock;
  meta?: ProfileSection | undefined;
  onChange: (next: InputBlock) => void;
}) {
  const set = (patch: Partial<InputBlock>) => onChange({ ...block, ...patch });
  const stale = monthsSince(meta?.last_updated);
  const isStale = block.section_type === "evergreen" && stale !== null && stale >= STALE_MONTHS;

  return (
    <Card className={block.skipped ? "opacity-50" : ""}>
      <div className="flex items-start justify-between gap-2">
        <span className="label-eyebrow text-accent">{block.section_name}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          {isStale && <Chip tone="warn">Stale · {stale} mo</Chip>}
          <Chip>{SECTION_TYPE_LABELS[block.section_type]}</Chip>
        </div>
      </div>

      {!block.skipped && (
        <div className="mt-3 space-y-2">
          {block.section_type === "narrative" && (
            <>
              <Field
                value={block.raw_notes ?? ""}
                onChange={(v) => set({ raw_notes: v })}
                rows={4}
                placeholder="Rough bullet notes — no formatting needed"
              />
              {meta?.avg_word_count && (
                <p className="text-[10px] text-mist">
                  Typical length: {meta.avg_word_count} words
                </p>
              )}
            </>
          )}

          {block.section_type === "image_anchored" && (
            <>
              <Field
                value={block.caption ?? ""}
                onChange={(v) => set({ caption: v })}
                rows={2}
                placeholder="Caption notes (what the photo shows, why it matters)"
              />
              <TextInput
                value={block.photo_note ?? ""}
                onChange={(v) => set({ photo_note: v })}
                placeholder="Photo needed: describe the shot for Canva"
              />
            </>
          )}

          {block.section_type === "paired" && (
            <>
              <p className="label-eyebrow text-mist">Puzzle</p>
              <Field
                value={block.puzzle_text ?? ""}
                onChange={(v) => set({ puzzle_text: v })}
                rows={2}
              />
              <p className="label-eyebrow text-mist">Answer key</p>
              <Field
                value={block.answer_key_text ?? ""}
                onChange={(v) => set({ answer_key_text: v })}
                rows={2}
              />
            </>
          )}

          {block.section_type === "evergreen" && (
            <>
              <Field
                value={block.carried_text ?? ""}
                onChange={(v) => set({ carried_text: v })}
                rows={3}
              />
              <p className="text-[10px] text-mist">
                Carried forward verbatim — not rewritten.{" "}
                {stale !== null && `Last changed ${stale} month${stale === 1 ? "" : "s"} ago.`}
              </p>
            </>
          )}

          {block.section_type === "structured" && (
            <StructuredRows block={block} onChange={onChange} />
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <GhostButton onClick={() => set({ skipped: !block.skipped })}>
          {block.skipped ? "Include this month" : "Skip this month"}
        </GhostButton>
      </div>
    </Card>
  );
}

function StructuredRows({
  block,
  onChange,
}: {
  block: InputBlock;
  onChange: (next: InputBlock) => void;
}) {
  const rows = block.rows ?? [{ a: "", b: "", c: "" }];
  const headers = STRUCTURED_HEADERS;
  const setRows = (next: typeof rows) => onChange({ ...block, rows: next });

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-[1fr_1.4fr_0.8fr] gap-1.5">
        {headers.map((h) => (
          <span key={h} className="text-[9px] uppercase tracking-[0.15em] text-mist">
            {h}
          </span>
        ))}
      </div>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_1.4fr_0.8fr] gap-1.5">
          {(["a", "b", "c"] as const).map((k) => (
            <TextInput
              key={k}
              value={row[k]}
              onChange={(v) =>
                setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
              }
            />
          ))}
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <GhostButton onClick={() => setRows([...rows, { a: "", b: "", c: "" }])}>
          Add row
        </GhostButton>
        {rows.length > 1 && (
          <GhostButton onClick={() => setRows(rows.slice(0, -1))}>Remove last</GhostButton>
        )}
      </div>
    </div>
  );
}

export function DraftBlock({
  section,
  rawInput,
  onEdit,
  onRegenerate,
  busy,
}: {
  section: DraftSection;
  rawInput?: InputBlock | undefined;
  onEdit: (text: string) => void;
  onRegenerate: () => void;
  busy: boolean;
}) {
  const count = wordCount(section.text);
  const target = section.target_word_count;
  const off = target ? Math.abs(count - target) / target > 0.3 : false;

  const copy = () => navigator.clipboard.writeText(section.text);
  const rawSummary = [
    rawInput?.raw_notes,
    rawInput?.caption,
    rawInput?.photo_note && `Photo needed: ${rawInput.photo_note}`,
    rawInput?.puzzle_text,
    rawInput?.rows?.filter((r) => r.a || r.b || r.c).map((r) => `${r.a} — ${r.b} — ${r.c}`).join("\n"),
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <Card className={busy ? "scan" : ""}>
      <div className="flex items-start justify-between gap-2">
        <span className="label-eyebrow text-accent">{section.section_name}</span>
        <Chip>{SECTION_TYPE_LABELS[section.section_type]}</Chip>
      </div>

      {section.heading && (
        <h2 className="font-display mt-2 text-lg leading-tight font-bold">{section.heading}</h2>
      )}

      <textarea
        value={section.text}
        rows={Math.min(14, Math.max(3, Math.ceil(section.text.length / 60)))}
        onChange={(e) => onEdit(e.target.value)}
        className="mt-2 w-full resize-y rounded-lg bg-canvas/40 px-3 py-2 text-[13px] leading-relaxed text-mist outline-1 -outline-offset-1 outline-input focus:text-ink focus:outline-ring"
      />

      {section.answer_key_text && (
        <div className="mt-2">
          <p className="label-eyebrow text-mist">Answer key</p>
          <p className="mt-1 text-[12px] text-mist">{section.answer_key_text}</p>
        </div>
      )}

      {section.photo_note && (
        <p className="mt-2 text-[11px] text-warn">Photo needed: {section.photo_note}</p>
      )}

      {rawSummary && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[11px] text-mist">Raw notes</summary>
          <p className="mt-1 whitespace-pre-line text-[12px] text-mist/80">{rawSummary}</p>
        </details>
      )}

      <div className="mt-3 flex items-center gap-2 text-[11px]">
        {target ? (
          <Chip tone={off ? "warn" : "neutral"}>
            {count} / {target} words
          </Chip>
        ) : (
          <Chip>{count} words</Chip>
        )}
        <GhostButton onClick={copy}>Copy section</GhostButton>
        <AccentButton onClick={onRegenerate} disabled={busy}>
          {busy ? "Working…" : "Regenerate"}
        </AccentButton>
      </div>
    </Card>
  );
}
