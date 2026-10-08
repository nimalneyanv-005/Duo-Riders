"use client";
import { useState } from "react";

type Commit = {
  hash: string;
  author: string;
  message: string;
  files_changed: string[];
  committed_at: string;
};
type Result = {
  novel: boolean;
  mode: "vector" | "keyword";
  score: number;
  match?: {
    title: string;
    service: string;
    severity: string;
    root_cause: string;
    root_cause_category: string;
    resolution: string;
    resolved_by: string;
  };
  overlap?: string[];
  explanation?: string;
  fix?: Commit | null;
  relapse?: Commit | null;
  minutesToResolve?: number;
  alternatives?: { id: number; title: string; score: number }[];
};

const DEMO = `JsonWebTokenError: secretOrPrivateKey must have a value
    at Object.module.exports [as sign] (/srv/app/node_modules/jsonwebtoken/sign.js:111:20)
    at TokenService.issue (/srv/app/src/auth/tokenService.js:33:12)
    at LoginController.login (/srv/app/src/routes/login.js:18:25)`;

const fmt = (d: string) => new Date(d).toLocaleDateString();

export default function Home() {
  const [trace, setTrace] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function analyze() {
    setLoading(true);
    setErr("");
    setRes(null);
    try {
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trace }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Request failed");
      setRes(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6 bg-slate-950 min-h-screen text-slate-100">
      <header>
        <h1 className="text-3xl font-bold">CodePulse</h1>
        <p className="text-slate-400">Never debug the same outage twice.</p>
      </header>

      <section className="space-y-3">
        <textarea
          value={trace}
          onChange={(e) => setTrace(e.target.value)}
          rows={9}
          placeholder="Paste a production stack trace here..."
          className="w-full rounded-lg bg-slate-900 border border-slate-700 p-3 font-mono text-sm"
        />
        <div className="flex gap-3">
          <button
            onClick={analyze}
            disabled={loading || trace.trim().length < 20}
            className="rounded-lg bg-indigo-600 px-5 py-2 font-semibold disabled:opacity-40"
          >
            {loading ? "Analyzing..." : "Analyze"}
          </button>
          <button
            onClick={() => setTrace(DEMO)}
            className="rounded-lg border border-slate-600 px-4 py-2"
          >
            Load demo trace
          </button>
        </div>
        {err && <p className="text-red-400">{err}</p>}
      </section>

      {res?.novel && (
        <div className="rounded-lg border border-amber-500 bg-amber-950/40 p-4">
          <b>Novel incident.</b> Nothing similar in memory (best similarity{" "}
          {Math.round(res.score * 100)}%).
        </div>
      )}

      {res && !res.novel && res.match && (
        <div className="space-y-4">
          {res.relapse && res.fix && (
            <div className="rounded-lg border border-red-500 bg-red-950/50 p-4">
              <b>Relapse alert.</b> This was fixed in{" "}
              <code>{res.fix.hash}</code> by {res.fix.author}, but a later
              commit <code>{res.relapse.hash}</code> by{" "}
              <b>{res.relapse.author}</b> ("{res.relapse.message}") changed the
              same files on {fmt(res.relapse.committed_at)} and likely undid the
              fix.
            </div>
          )}

          <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 space-y-2">
            <div className="flex justify-between">
              <h2 className="text-xl font-semibold">{res.match.title}</h2>
              <span className="rounded bg-indigo-600 px-2 py-1 text-sm">
                {Math.round(res.score * 100)}% match
              </span>
            </div>
            <p className="text-sm text-slate-400">
              {res.match.service} · {res.match.severity} ·{" "}
              {res.match.root_cause_category} · resolved in{" "}
              {res.minutesToResolve} min
            </p>
            <p>
              <b>Predicted root cause:</b> {res.match.root_cause}
            </p>
            <p>
              <b>Historical resolution:</b> {res.match.resolution}
            </p>
            <p>
              <b>Resolved by:</b> {res.match.resolved_by}
            </p>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 space-y-2">
            <h3 className="font-semibold">Why this match</h3>
            <p className="text-sm">{res.explanation}</p>
            {!!res.overlap?.length && (
              <div className="flex flex-wrap gap-2">
                {res.overlap.map((f) => (
                  <code
                    key={f}
                    className="rounded bg-slate-800 px-2 py-1 text-xs"
                  >
                    {f}
                  </code>
                ))}
              </div>
            )}
          </div>

          {res.fix && (
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 font-mono text-sm">
              <div className="text-emerald-400">commit {res.fix.hash}</div>
              <div>
                Author: {res.fix.author} · {fmt(res.fix.committed_at)}
              </div>
              <div className="mt-1">{res.fix.message}</div>
              <div className="text-slate-400 mt-1">
                files: {res.fix.files_changed.join(", ")}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
