"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bricolage_Grotesque } from "next/font/google";

const sans = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-sans" });

type Group = { label: string; count: number; avg_minutes: number };
type Data = {
  totals: { total: number; repeats: number; avg_minutes: number; repeat_minutes: number };
  byService: Group[];
  byCategory: Group[];
  resolvers: Group[];
};

const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`);

function Bars({ rows, format }: { rows: { label: string; v: number }[]; format: (n: number) => string }) {
  const max = Math.max(...rows.map((r) => r.v), 1);
  if (!rows.length) return <p className="text-[#5B6B7F]">No data yet.</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.label} className="grid grid-cols-[minmax(90px,32%)_1fr_auto] items-center gap-3">
          <span className="truncate text-[#33445A]" title={r.label}>
            {r.label}
          </span>
          <div className="h-3 rounded-full bg-[#DDE3EA]">
            <div
              className="h-3 rounded-full"
              style={{ width: `${(r.v / max) * 100}%`, background: i === 0 ? "#FF5A4E" : "#0F1A2A" }}
            />
          </div>
          <span className="w-16 text-right font-semibold tabular-nums">{format(r.v)}</span>
        </li>
      ))}
    </ul>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l-2 border-[#0F1A2A] pl-4">
      <dt className="text-sm text-[#5B6B7F]">{label}</dt>
      <dd className="mt-1 text-3xl font-bold tracking-tight">{value}</dd>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/dashboard")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Request failed");
        setData(d);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Something went wrong"));
  }, []);

  const t = data?.totals;

  return (
    <main
      className={`${sans.variable} min-h-screen w-full bg-[#EDF0F3] text-[#0F1A2A]`}
      style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}
    >
      <div className="mx-auto w-full px-5 py-8 sm:px-8" style={{ maxWidth: 1240 }}>
        <header className="mb-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-[#FF5A4E]" aria-hidden="true" />
            <h1 className="text-2xl font-bold tracking-tight">CodePulse</h1>
          </div>
          <Link href="/" className="font-semibold underline underline-offset-4 hover:text-[#FF5A4E]">
            Analyze a trace
          </Link>
        </header>

        {err && (
          <p role="alert" className="border-l-4 border-[#C2362B] bg-[#FBE9E7] px-5 py-4 text-[#8E1B12]">
            {err}
          </p>
        )}
        {!data && !err && <p className="text-lg text-[#33445A]">Loading incident data...</p>}

        {data && t && (
          <div className="space-y-12">
            <section className="max-w-3xl">
              <h2 className="text-[clamp(2rem,4.5vw,3.5rem)] font-bold leading-[1.05] tracking-tight">
                {t.repeats > 0
                  ? `${t.repeats} repeat ${t.repeats === 1 ? "incident" : "incidents"}. ${fmtMin(t.repeat_minutes)} spent debugging the same outage again.`
                  : "No repeat incidents recorded yet."}
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-[#33445A]">
                {t.repeats > 0
                  ? "This is the cost of forgetting. Each repeat was saved after CodePulse matched it to a known incident."
                  : "Analyze a trace that matches a past incident, then save its post-mortem. It will be counted here as a repeat."}
              </p>
            </section>

            <dl className="grid grid-cols-2 gap-6 border-y border-[#CBD3DC] py-6 lg:grid-cols-4">
              <Stat label="Incidents in memory" value={String(t.total)} />
              <Stat label="Repeat incidents" value={String(t.repeats)} />
              <Stat label="Average time to resolve" value={fmtMin(t.avg_minutes)} />
              <Stat label="Time lost to repeats" value={fmtMin(t.repeat_minutes)} />
            </dl>

            <div className="grid gap-12 lg:grid-cols-2">
              <section>
                <h3 className="mb-5 text-xl font-semibold">Incidents by service</h3>
                <Bars rows={data.byService.map((r) => ({ label: r.label, v: r.count }))} format={String} />
              </section>
              <section>
                <h3 className="mb-5 text-xl font-semibold">Incidents by root cause</h3>
                <Bars rows={data.byCategory.map((r) => ({ label: r.label, v: r.count }))} format={String} />
              </section>
              <section>
                <h3 className="mb-5 text-xl font-semibold">Average time to resolve, by service</h3>
                <Bars
                  rows={[...data.byService]
                    .sort((a, b) => b.avg_minutes - a.avg_minutes)
                    .map((r) => ({ label: r.label, v: r.avg_minutes }))}
                  format={fmtMin}
                />
              </section>
              <section>
                <h3 className="mb-5 text-xl font-semibold">Top resolvers</h3>
                <Bars rows={data.resolvers.map((r) => ({ label: r.label, v: r.count }))} format={String} />
                <p className="mt-3 text-sm text-[#5B6B7F]">Incidents resolved per engineer.</p>
              </section>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
