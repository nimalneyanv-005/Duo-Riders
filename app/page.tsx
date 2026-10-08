"use client";
import { useState } from "react";
import type { ReactNode } from "react";
import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import PostmortemPanel from "./PostmortemPanel";
import Link from "next/link";
const sans = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-sans",
});
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

type Commit = {
  hash: string;
  author: string;
  message: string;
  files_changed: string[];
  committed_at: string;
};
type Match = {
  id: number;
  title: string;
  service: string;
  severity: string;
  root_cause: string;
  root_cause_category: string;
  resolution: string;
  resolved_by: string;
  occurred_at: string;
  resolved_at: string;
};
type Result = {
  novel: boolean;
  mode: "vector" | "keyword";
  score: number;
  match?: Match;
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

const MIN = 20;
const MAX = 8000;
const MONO = { fontFamily: "var(--font-mono), ui-monospace, monospace" };
const fmt = (d: string) =>
  new Date(d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const CSS = `
.cp-run{stroke-dasharray:.28 .72;animation:cp-sweep 1.2s linear infinite}
@keyframes cp-sweep{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@media (prefers-reduced-motion:reduce){.cp-run{animation:none;stroke-dasharray:none}}
`;

const LINE = "M0 24 H130 L142 24 L150 8 L162 42 L172 14 L180 24 H400";

function Pulse({ active }: { active: boolean }) {
  const common = {
    d: LINE,
    pathLength: 1,
    fill: "none",
    stroke: "#FF5A4E",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    vectorEffect: "non-scaling-stroke" as const,
  };
  return (
    <svg
      viewBox="0 0 400 48"
      preserveAspectRatio="none"
      className="mt-4 h-10 w-full"
      aria-hidden="true"
    >
      <path {...common} opacity={active ? 0.25 : 0.55} />
      {active && <path {...common} className="cp-run" />}
    </svg>
  );
}

function Step({
  color,
  title,
  when,
  children,
}: {
  color: string;
  title: string;
  when: string;
  children: ReactNode;
}) {
  return (
    <li className="relative">
      <span
        className="absolute -left-[30px] top-1.5 h-3 w-3 rounded-full ring-4 ring-[#EDF0F3]"
        style={{ background: color }}
      />
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h4 className="font-semibold">{title}</h4>
        <span className="text-sm text-[#5B6B7F]">{when}</span>
      </div>
      <div className="mt-1 text-[#33445A]">{children}</div>
    </li>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-[#5B6B7F]">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value}</dd>
    </div>
  );
}

export default function Home() {
  const [trace, setTrace] = useState("");
  const [analyzed, setAnalyzed] = useState("");
  const [runId, setRunId] = useState(0);
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const len = trace.trim().length;
  const valid = len >= MIN && len <= MAX;

  async function analyze() {
    const text = trace.trim();
    setLoading(true);
    setErr("");
    setRes(null);
    try {
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trace: text }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? "Request failed");
      setRes(data);
      setAnalyzed(text); // post-mortem uses exactly what was analyzed
      setRunId((n) => n + 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const m = res?.match;
  const pct = res ? Math.min(100, Math.max(0, Math.round(res.score * 100))) : 0;

  return (
    <main
      className={`${sans.variable} ${mono.variable} min-h-screen w-full bg-[#EDF0F3] text-[#0F1A2A]`}
      style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}
    >
      <style>{CSS}</style>
      <div
        className="mx-auto w-full px-5 py-8 sm:px-8"
        style={{ maxWidth: 1240 }}
      >
        <header className="mb-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
          <div className="flex items-center gap-3">
            <span
              className="h-3 w-3 rounded-full bg-[#FF5A4E]"
              aria-hidden="true"
            />
            <h1 className="text-2xl font-bold tracking-tight">CodePulse</h1>
          </div>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <p className="text-[#5B6B7F]">Never debug the same outage twice.</p>
            <Link
              href="/dashboard"
              className="font-semibold underline underline-offset-4 hover:text-[#FF5A4E]"
            >
              Dashboard
            </Link>
          </nav>
        </header>

        <div className="grid gap-10 lg:grid-cols-[5fr_7fr] lg:gap-14">
          {/* Workbench */}
          <div className="self-start lg:sticky lg:top-6">
            <div className="rounded-[20px] bg-[#0A1320] p-5 text-[#D6E2F0]">
              <label
                htmlFor="trace"
                className="text-sm font-medium text-[#9FB2C8]"
              >
                Stack trace
              </label>
              <textarea
                id="trace"
                value={trace}
                onChange={(e) => setTrace(e.target.value)}
                rows={14}
                wrap="off"
                spellCheck={false}
                placeholder="Paste a production stack trace here..."
                className="mt-2 block w-full resize-y overflow-x-auto whitespace-pre rounded-xl bg-[#101C2E] p-4 text-[13px] leading-6 text-[#D6E2F0] outline-none placeholder:text-[#6F8199] focus-visible:ring-2 focus-visible:ring-[#FF5A4E]"
                style={MONO}
              />
              <div className="mt-2 flex justify-between text-xs text-[#8499B0]">
                <span>
                  {len > 0 && len < MIN
                    ? `Needs at least ${MIN} characters`
                    : "\u00A0"}
                </span>
                <span className={len > MAX ? "text-[#FF8A80]" : ""}>
                  {len}/{MAX}
                </span>
              </div>

              <Pulse active={loading} />

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={analyze}
                  disabled={loading || !valid}
                  className="rounded-xl bg-[#FF5A4E] px-5 py-2.5 font-semibold text-[#0A1320] transition-colors hover:bg-[#FF7468] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF5A4E] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? "Analyzing..." : "Analyze"}
                </button>
                <button
                  onClick={() => setTrace(DEMO)}
                  className="rounded-xl border border-[#2A3B52] px-5 py-2.5 font-medium text-[#D6E2F0] transition-colors hover:bg-[#101C2E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF5A4E]"
                >
                  Load demo trace
                </button>
              </div>
            </div>
          </div>

          {/* Findings */}
          <section aria-live="polite" className="min-w-0">
            {!res && !loading && !err && (
              <div className="max-w-xl pt-2">
                <h2 className="text-[clamp(2rem,4.5vw,3.5rem)] font-bold leading-[1.05] tracking-tight">
                  Paste a stack trace. Find who fixed it last time.
                </h2>
                <p className="mt-5 text-lg leading-relaxed text-[#33445A]">
                  CodePulse searches past incidents and fix commits, then shows
                  the likely root cause, the fix, and the engineer who resolved
                  it.
                </p>
                <p className="mt-6 text-sm text-[#5B6B7F]">
                  No trace handy? Use the demo trace button.
                </p>
              </div>
            )}

            {loading && (
              <p className="pt-2 text-lg text-[#33445A]">
                Searching past incidents...
              </p>
            )}

            {err && (
              <p
                role="alert"
                className="border-l-4 border-[#C2362B] bg-[#FBE9E7] px-5 py-4 text-[#8E1B12]"
              >
                {err}
              </p>
            )}

            {res?.novel && (
              <div className="max-w-xl">
                <h2 className="text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.05] tracking-tight">
                  Nothing like this in memory.
                </h2>
                <p className="mt-4 text-lg leading-relaxed text-[#33445A]">
                  The closest past incident is only {pct}% similar. Write the
                  post-mortem below and save it, so the next engineer who hits
                  this finds your fix.
                </p>
              </div>
            )}

            {res && !res.novel && m && (
              <article className="space-y-10">
                {res.relapse && res.fix && (
                  <div
                    role="alert"
                    className="border-l-4 border-[#C2362B] bg-[#FBE9E7] px-5 py-4 text-[#5C1A14]"
                  >
                    <p className="font-semibold text-[#8E1B12]">
                      Likely regression
                    </p>
                    <p className="mt-1 leading-relaxed">
                      Fixed in <code style={MONO}>{res.fix.hash}</code> by{" "}
                      {res.fix.author}. Then{" "}
                      <code style={MONO}>{res.relapse.hash}</code> by{" "}
                      <b>{res.relapse.author}</b> (“{res.relapse.message}”)
                      changed the same files on {fmt(res.relapse.committed_at)}{" "}
                      and probably undid the fix.
                    </p>
                  </div>
                )}

                <header>
                  <h2 className="text-[clamp(2rem,4vw,3.25rem)] font-bold leading-[1.05] tracking-tight">
                    {m.resolved_by} fixed this before.
                  </h2>
                  <p className="mt-3 text-lg text-[#33445A]">{m.title}</p>
                  <div className="mt-5 max-w-sm">
                    <div className="h-1.5 rounded-full bg-[#CBD3DC]">
                      <div
                        className="h-1.5 rounded-full bg-[#0F1A2A]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-2 text-sm text-[#5B6B7F]">
                      {pct}% similar, found by{" "}
                      {res.mode === "vector"
                        ? "meaning search"
                        : "keyword search"}
                    </p>
                  </div>
                </header>

                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-[#CBD3DC] py-5 sm:grid-cols-4">
                  <Fact label="Service" value={m.service} />
                  <Fact label="Severity" value={m.severity} />
                  <Fact label="Root cause type" value={m.root_cause_category} />
                  <Fact
                    label="Time to resolve"
                    value={`${res.minutesToResolve ?? 0} min`}
                  />
                </dl>

                <div className="grid gap-8 md:grid-cols-2">
                  <div>
                    <h3 className="font-semibold">Root cause</h3>
                    <p className="mt-2 leading-relaxed text-[#33445A]">
                      {m.root_cause}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold">How it was fixed</h3>
                    <p className="mt-2 leading-relaxed text-[#33445A]">
                      {m.resolution}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="mb-5 text-xl font-semibold">Timeline</h3>
                  <ol className="relative ml-2 space-y-6 border-l border-[#B8C2CE] pl-6">
                    <Step
                      color="#0F1A2A"
                      title="Incident"
                      when={fmt(m.occurred_at)}
                    >
                      {m.title} hit {m.service}.
                    </Step>
                    {res.fix && (
                      <Step
                        color="#0F766E"
                        title="Fix shipped"
                        when={fmt(res.fix.committed_at)}
                      >
                        <p>
                          <code style={MONO} className="text-sm">
                            {res.fix.hash}
                          </code>{" "}
                          by {res.fix.author}: {res.fix.message}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {res.fix.files_changed.map((f) => (
                            <code
                              key={f}
                              style={MONO}
                              className="rounded bg-[#DDE3EA] px-2 py-1 text-xs"
                            >
                              {f}
                            </code>
                          ))}
                        </div>
                      </Step>
                    )}
                    {res.relapse && (
                      <Step
                        color="#C2362B"
                        title="Same files changed again"
                        when={fmt(res.relapse.committed_at)}
                      >
                        <p>
                          <code style={MONO} className="text-sm">
                            {res.relapse.hash}
                          </code>{" "}
                          by {res.relapse.author}: {res.relapse.message}
                        </p>
                      </Step>
                    )}
                  </ol>
                </div>

                <div>
                  <h3 className="font-semibold">Why this match</h3>
                  <p className="mt-2 max-w-[65ch] leading-relaxed text-[#33445A]">
                    {res.explanation}
                  </p>
                  {!!res.overlap?.length && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {res.overlap.map((f) => (
                        <code
                          key={f}
                          style={MONO}
                          className="rounded bg-[#DDE3EA] px-2 py-1 text-xs"
                        >
                          {f}
                        </code>
                      ))}
                    </div>
                  )}
                </div>

                {!!res.alternatives?.length && (
                  <div>
                    <h3 className="font-semibold">Other close matches</h3>
                    <ul className="mt-2 divide-y divide-[#CBD3DC] border-y border-[#CBD3DC]">
                      {res.alternatives.map((a) => (
                        <li
                          key={a.id}
                          className="flex justify-between gap-4 py-2 text-[#33445A]"
                        >
                          <span>{a.title}</span>
                          <span className="text-[#5B6B7F]">
                            {Math.round(a.score * 100)}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            )}

            {res && (
              <PostmortemPanel
                key={runId}
                trace={analyzed}
                matchId={m?.id ?? null}
              />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
