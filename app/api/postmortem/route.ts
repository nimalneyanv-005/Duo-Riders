import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { normalizeTrace } from "@/lib/normalize";
import { embedText, toVector } from "@/lib/embed";
import { PostmortemSchema } from "@/lib/postmortem";

const Body = z.object({
  trace: z.string().min(20).max(8000),
  incidentId: z.number().int().positive().nullable(),
  pm: PostmortemSchema,
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fill in all required fields." },
      { status: 400 },
    );
  }
  const { trace, incidentId, pm } = parsed.data;

  let vec: string | null = null;
  try {
    vec = toVector(
      await embedText(`${pm.title}\n${normalizeTrace(trace)}\n${pm.rootCause}`),
    );
  } catch (e) {
    console.error("Embedding failed, saving without vector:", e);
  }

  try {
    const mins = pm.minutesToResolve;
    const [inc] = await sql`
      INSERT INTO incidents (title, service, severity, stack_trace, root_cause, root_cause_category,
                             resolution, resolved_by, occurred_at, resolved_at, repeat_of, embedding)
      VALUES (${pm.title}, ${pm.service}, ${pm.severity}, ${trace}, ${pm.rootCause}, ${pm.category},
              ${pm.resolution}, ${pm.resolvedBy}, now() - (${mins}::int * interval '1 minute'), now(),
              ${incidentId}, ${vec}::vector)
      RETURNING id`;
    const [row] = await sql`
      INSERT INTO postmortems (title, incident_id, trace, content)
      VALUES (${pm.title}, ${inc.id}, ${trace}, ${JSON.stringify(pm)}::jsonb)
      RETURNING id`;
    return NextResponse.json({
      ok: true,
      postmortemId: row.id,
      searchable: vec !== null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
}
