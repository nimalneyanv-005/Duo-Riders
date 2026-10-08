"use client";
import { useState } from "react";

type PM = {
  title: string;
  service: string;
  severity: string;
  category: string;
  summary: string;
  impact: string;
  rootCause: string;
  resolution: string;
  fixCommit: string;
  whyRecurred: string;
  prevention: string;
  resolvedBy: string;
  minutesToResolve: number;
};

const TEXT: [keyof PM, string][] = [
  ["title", "Title"],
  ["service", "Service"],
  ["category", "Root cause category"],
  ["resolvedBy", "Resolved by (your name)"],
];
const AREAS: [keyof PM, string][] = [
  ["summary", "Summary"],
  ["impact", "Impact"],
  ["rootCause", "Root cause"],
  ["resolution", "Resolution"],
  ["fixCommit", "Fix commit"],
  ["whyRecurred", "Why it recurred"],
  ["prevention", "Prevention steps"],
];

const field =
  "mt-1 w-full rounded-lg border border-[#B8C2CE] bg-white px-3 py-2 text-[15px] text-[#0F1A2A] outline-none focus-visible:border-[#0F1A2A] focus-visible:ring-2 focus-visible:ring-[#FF5A4E]";
const label = "block text-sm font-medium text-[#33445A]";

export default function PostmortemPanel({
  trace,
  matchId,
}: {
  trace: string;
  matchId: number | null;
}) {
  const [pm, setPm] = useState<PM | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [saved, setSaved] = useState(false);

  const set = (k: keyof PM, v: string | number) =>
    setPm((p) => (p ? { ...p, [k]: v } : p));

  async function generate() {
    setBusy(true);
    setMsg("");
    setSaved(false);
    try {
      const r = await fetch("/api/postmortem/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trace }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      setPm(d);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
    setBusy(false);
  }

  async function save() {
    if (!pm) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/postmortem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trace, incidentId: matchId, pm }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      setSaved(true);
      setMsg(
        d.searchable
          ? "Saved to memory. Future traces can now match this incident."
          : "Saved. Search index is pending.",
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
    setBusy(false);
  }

  return (
    <section className="mt-14 border-t border-[#CBD3DC] pt-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-[60ch]">
          <h2 className="text-2xl font-bold tracking-tight">Post-mortem</h2>
          {!pm && (
            <p className="mt-1 text-[#33445A]">
              Draft a write-up from this analysis, edit it, then save it to
              memory.
            </p>
          )}
        </div>
        {!pm && (
          <button
            onClick={generate}
            disabled={busy}
            className="rounded-xl bg-[#0F1A2A] px-5 py-2.5 font-semibold text-white transition-colors hover:bg-[#1B2E47] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF5A4E] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Drafting..." : "Generate post-mortem"}
          </button>
        )}
      </div>

      {pm && (
        <div className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {TEXT.map(([k, text]) => (
              <label key={k} className={label}>
                {text}
                <input
                  className={field}
                  value={String(pm[k])}
                  onChange={(e) => set(k, e.target.value)}
                />
              </label>
            ))}
            <label className={label}>
              Severity
              <select
                className={field}
                value={pm.severity}
                onChange={(e) => set("severity", e.target.value)}
              >
                <option>SEV1</option>
                <option>SEV2</option>
                <option>SEV3</option>
              </select>
            </label>
            <label className={label}>
              Minutes to resolve
              <input
                type="number"
                min={0}
                className={field}
                value={pm.minutesToResolve}
                onChange={(e) =>
                  set(
                    "minutesToResolve",
                    Math.max(0, parseInt(e.target.value || "0", 10)),
                  )
                }
              />
            </label>
          </div>

          {AREAS.map(([k, text]) => (
            <label key={k} className={label}>
              {text}
              <textarea
                rows={3}
                className={field}
                value={String(pm[k])}
                onChange={(e) => set(k, e.target.value)}
              />
            </label>
          ))}

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={save}
              disabled={
                busy || saved || !pm.resolvedBy.trim() || !pm.title.trim()
              }
              className="rounded-xl bg-[#FF5A4E] px-5 py-2.5 font-semibold text-[#0A1320] transition-colors hover:bg-[#FF7468] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF5A4E] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Saving..." : saved ? "Saved" : "Save to memory"}
            </button>
            {!pm.resolvedBy.trim() && !saved && (
              <p className="text-sm text-[#5B6B7F]">
                Add your name under Resolved by to save.
              </p>
            )}
          </div>
        </div>
      )}

      {msg && (
        <p
          role="status"
          className={`mt-4 font-medium ${saved ? "text-[#0F766E]" : "text-[#B42318]"}`}
        >
          {msg}
        </p>
      )}
    </section>
  );
}
