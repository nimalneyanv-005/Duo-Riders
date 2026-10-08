import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

type Totals = { total: number; repeats: number; avg_minutes: number; repeat_minutes: number };
type Group = { label: string; count: number; avg_minutes: number };

const noStore = { "Cache-Control": "no-store" };

// Read-only aggregates. No user input reaches these queries, so there is nothing to inject.
export async function GET() {
  try {
    const [totals, byService, byCategory, resolvers] = await Promise.all([
      sql`
        SELECT count(*)::int AS total,
               count(repeat_of)::int AS repeats,
               coalesce(round(avg(extract(epoch FROM (resolved_at - occurred_at)) / 60)), 0)::int AS avg_minutes,
               coalesce(round(sum(extract(epoch FROM (resolved_at - occurred_at)) / 60)
                              FILTER (WHERE repeat_of IS NOT NULL)), 0)::int AS repeat_minutes
        FROM incidents`,
      sql`
        SELECT service AS label, count(*)::int AS count,
               coalesce(round(avg(extract(epoch FROM (resolved_at - occurred_at)) / 60)), 0)::int AS avg_minutes
        FROM incidents GROUP BY service ORDER BY count DESC, service`,
      sql`
        SELECT root_cause_category AS label, count(*)::int AS count,
               coalesce(round(avg(extract(epoch FROM (resolved_at - occurred_at)) / 60)), 0)::int AS avg_minutes
        FROM incidents GROUP BY root_cause_category ORDER BY count DESC, root_cause_category`,
      sql`
        SELECT resolved_by AS label, count(*)::int AS count,
               coalesce(round(avg(extract(epoch FROM (resolved_at - occurred_at)) / 60)), 0)::int AS avg_minutes
        FROM incidents GROUP BY resolved_by ORDER BY count DESC, resolved_by LIMIT 5`,
    ]);

    return NextResponse.json(
      {
        totals: (totals as unknown as Totals[])[0],
        byService: byService as unknown as Group[],
        byCategory: byCategory as unknown as Group[],
        resolvers: resolvers as unknown as Group[],
      },
      { headers: noStore },
    );
  } catch (e) {
    console.error("dashboard failed:", e);
    return NextResponse.json({ error: "Could not load dashboard." }, { status: 500, headers: noStore });
  }
}
