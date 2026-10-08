import { NextResponse } from "next/server";
import { analyzeTrace } from "@/lib/analyze";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { trace } = (body ?? {}) as { trace?: unknown };
  const text = typeof trace === "string" ? trace.trim() : "";
  if (text.length < 20 || text.length > 8000) {
    return NextResponse.json(
      { error: "Trace must be 20 to 8000 characters." },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(await analyzeTrace(text));
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Analysis failed. Please try again." },
      { status: 500 },
    );
  }
}
