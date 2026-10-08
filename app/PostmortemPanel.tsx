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
          ? "Saved. This incident is now part of CodePulse's memory."
          : "Saved (search index pending).",
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
    setBusy(false);
  }

  const input =
    "w-full rounded bg-slate-800 border border-slate-700 p-2 text-sm";

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Post-mortem</h2>
        {!pm && (
          <button
            onClick={generate}
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold disabled:opacity-40"
          >
            {busy ? "Drafting..." : "Generate post-mortem"}
          </button>
        )}
      </div>

      {pm && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {TEXT.map(([k, label]) => (
              <label key={k} className="text-sm">
                {label}
                <input
                  className={input}
                  value={String(pm[k])}
                  onChange={(e) => set(k, e.target.value)}
                />
              </label>
            ))}
            <label className="text-sm">
              Severity
              <select
                className={input}
                value={pm.severity}
                onChange={(e) => set("severity", e.target.value)}
              >
                <option>SEV1</option>
                <option>SEV2</option>
                <option>SEV3</option>
              </select>
            </label>
            <label className="text-sm">
              Minutes to resolve
              <input
                type="number"
                min={0}
                className={input}
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
          {AREAS.map(([k, label]) => (
            <label key={k} className="block text-sm">
              {label}
              <textarea
                rows={3}
                className={input}
                value={String(pm[k])}
                onChange={(e) => set(k, e.target.value)}
              />
            </label>
          ))}
          <button
            onClick={save}
            disabled={busy || saved}
            className="rounded-lg bg-indigo-600 px-5 py-2 font-semibold disabled:opacity-40"
          >
            {busy ? "Saving..." : saved ? "Saved" : "Save to memory"}
          </button>
        </div>
      )}
      {msg && (
        <p className={saved ? "text-emerald-400" : "text-red-400"}>{msg}</p>
      )}
    </section>
  );
}
