import { NextResponse } from "next/server";
import { draftPostmortem } from "@/lib/postmortem";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    trace?: unknown;
  } | null;
  const text = typeof body?.trace === "string" ? body.trace.trim() : "";
  if (text.length < 20 || text.length > 8000) {
    return NextResponse.json(
      { error: "Trace must be 20 to 8000 characters." },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(await draftPostmortem(text));
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not draft post-mortem." },
      { status: 500 },
    );
  }
}
