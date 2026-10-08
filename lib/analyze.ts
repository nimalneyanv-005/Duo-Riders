import { sql } from "./db";
import { normalizeTrace } from "./normalize";
import { embedText, toVector } from "./embed";

type Incident = {
  id: number;
  title: string;
  service: string;
  severity: string;
  stack_trace: string;
  root_cause: string;
  root_cause_category: string;
  resolution: string;
  resolved_by: string;
  occurred_at: string;
  resolved_at: string;
  score: number;
};

const COLS = sql`id, title, service, severity, stack_trace, root_cause, root_cause_category, resolution, resolved_by, occurred_at, resolved_at`;

// Function names from each stack frame (JS/Java "at X", Python ", in X")
const symbols = (trace: string) => {
  const out = new Set<string>();
  for (const line of trace.split("\n")) {
    const m =
      line.match(/\bat\s+(?:async\s+)?([\w$.<>]+)/) ??
      line.match(/,\s*in\s+([\w<>]+)/);
    if (m) out.add(m[1].toLowerCase());
  }
  return out;
};

const tokens = (s: string) =>
  new Set(s.toLowerCase().match(/[a-z_][a-z0-9_.]{2,}/g) ?? []);
const jaccard = (a: Set<string>, b: Set<string>) => {
  let inter = 0;
  a.forEach((x) => {
    if (b.has(x)) inter++;
  });
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
};

async function search(
  clean: string,
): Promise<{ rows: Incident[]; mode: "vector" | "keyword" }> {
  try {
    const vec = toVector(await embedText(clean));
    const rows = (await sql`
      SELECT id, title, service, severity, stack_trace, root_cause, root_cause_category,
             resolution, resolved_by, occurred_at, resolved_at,
             1 - (embedding <=> ${vec}::vector) AS score
      FROM incidents WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${vec}::vector LIMIT 3`) as unknown as Incident[];
    return {
      rows: rows.map((r) => ({ ...r, score: Number(r.score) })),
      mode: "vector",
    };
  } catch (e) {
    console.error("Vector search failed, using keyword fallback:", e);
    const all = (await sql`
      SELECT id, title, service, severity, stack_trace, root_cause, root_cause_category,
             resolution, resolved_by, occurred_at, resolved_at FROM incidents`) as unknown as Incident[];
    const q = tokens(clean);
    const rows = all
      .map((r) => ({
        ...r,
        score: jaccard(q, tokens(normalizeTrace(r.stack_trace))),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    return { rows, mode: "keyword" };
  }
}

export async function analyzeTrace(raw: string) {
  const clean = normalizeTrace(raw);
  const { rows, mode } = await search(clean);
  const best = rows[0];
  const threshold = mode === "vector" ? 0.55 : 0.2; // tune after testing
  if (!best || best.score < threshold) {
    return {
      novel: true,
      mode,
      score: best ? best.score : 0,
      normalized: clean,
    };
  }

  const q = symbols(raw);
  const h = symbols(best.stack_trace);
  const overlap = Array.from(q).filter((s) => h.has(s));

  const fixRows = (await sql`
    SELECT hash, author, message, files_changed, committed_at
    FROM commits WHERE incident_id = ${best.id} ORDER BY committed_at LIMIT 1`) as unknown as {
    hash: string;
    author: string;
    message: string;
    files_changed: string[];
    committed_at: string;
  }[];
  const fix = fixRows[0] ?? null;

  let relapse = null;
  if (fix && fix.files_changed?.length) {
    const later = (await sql`
      SELECT hash, author, message, files_changed, committed_at
      FROM commits
      WHERE incident_id IS NULL AND committed_at > ${fix.committed_at}
        AND files_changed && string_to_array(${fix.files_changed.join(",")}, ',')
      ORDER BY committed_at DESC LIMIT 1`) as unknown as typeof fixRows;
    relapse = later[0] ?? null;
  }

  const pct = Math.round(best.score * 100);
  const explanation =
    `Closest past incident is "${best.title}" (${pct}% similar, ${mode} search). ` +
    (overlap.length
      ? `${overlap.length} stack frame(s) overlap: ${overlap.join(", ")}. `
      : "No stack frames overlap exactly, so this match is by meaning. ") +
    `There, the cause was: ${best.root_cause}`;

  return {
    novel: false,
    mode,
    score: best.score,
    normalized: clean,
    match: best,
    overlap,
    explanation,
    fix,
    relapse,
    minutesToResolve: Math.round(
      (+new Date(best.resolved_at) - +new Date(best.occurred_at)) / 60000,
    ),
    alternatives: rows
      .slice(1)
      .map((r) => ({ id: r.id, title: r.title, score: r.score })),
  };
}
