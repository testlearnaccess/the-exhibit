import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

const tabs = [
  { to: "/", label: "Workspace" },
  { to: "/style", label: "Style" },
  { to: "/history", label: "History" },
] as const;

export function Shell({
  status,
  children,
}: {
  status?: ReactNode;
  children: ReactNode;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="bg-stage min-h-screen w-full">
      <div className="mx-auto w-full max-w-3xl px-4 pt-5 pb-10">
        <header className="flex items-start justify-between gap-3">
          <Link to="/" className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-accent/15 outline-1 -outline-offset-1 outline-accent/40">
              <span className="font-display font-bold text-accent">TE</span>
            </div>
            <div>
              <p className="label-eyebrow text-mist">Science Museum</p>
              <p className="font-display text-sm leading-tight font-semibold">
                Newsletter Draft Desk
              </p>
            </div>
          </Link>
          <div className="text-right">{status}</div>
        </header>

        <nav className="mt-5 flex gap-2">
          {tabs.map((t) => {
            const active = path === t.to;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={
                  active
                    ? "font-display rounded-xl bg-accent px-3 py-1.5 text-[11px] font-semibold text-accent-foreground"
                    : "font-display glass rounded-xl px-3 py-1.5 text-[11px] font-semibold text-mist outline-1 -outline-offset-1 outline-border"
                }
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        {children}
      </div>
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`glass rounded-2xl p-4 outline-1 -outline-offset-1 outline-border ${className}`}
    >
      {children}
    </section>
  );
}

export function Chip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "warn" | "ok" | "accent";
}) {
  const tones = {
    neutral: "bg-glass/60 text-mist outline-border",
    warn: "bg-warn/10 text-warn outline-warn/25",
    ok: "bg-ok/10 text-ok outline-ok/25",
    accent: "bg-accent/15 text-accent outline-accent/30",
  } as const;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] outline-1 -outline-offset-1 ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-glass/60 px-3 py-1.5 text-[11px] font-semibold text-ink outline-1 -outline-offset-1 outline-border disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function AccentButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-accent/15 px-3 py-1.5 text-[11px] font-semibold text-accent outline-1 -outline-offset-1 outline-accent/30 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function Field({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full resize-y rounded-lg bg-canvas/50 px-3 py-2 text-[13px] leading-relaxed text-ink outline-1 -outline-offset-1 outline-input placeholder:text-mist/60 focus:outline-ring"
    />
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg bg-canvas/50 px-3 py-2 text-[12px] text-ink outline-1 -outline-offset-1 outline-input placeholder:text-mist/60 focus:outline-ring"
    />
  );
}
