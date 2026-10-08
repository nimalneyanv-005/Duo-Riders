import { NextResponse } from "next/server";
import { analyzeTrace } from "@/lib/analyze";

// Note: no `runtime` or `dynamic` exports. They are not allowed when
// Cache Components is enabled (Next.js 16). POST handlers are never cached anyway.
export const maxDuration = 30; // embedding + DB can exceed Vercel's default timeout

const MIN_LEN = 20;
const MAX_LEN = 8000;
const MAX_BODY_BYTES = 32 * 1024;

const noStore = { "Cache-Control": "no-store" };

export async function POST(req: Request) {
  // Reject oversized payloads before parsing them
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Request too large." },
      { status: 413, headers: noStore },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: noStore },
    );
  }

  const trace =
    body && typeof body === "object"
      ? (body as { trace?: unknown }).trace
      : undefined;
  const text = typeof trace === "string" ? trace.trim() : "";

  if (text.length < MIN_LEN || text.length > MAX_LEN) {
    return NextResponse.json(
      { error: `Trace must be ${MIN_LEN} to ${MAX_LEN} characters.` },
      { status: 400, headers: noStore },
    );
  }

  try {
    return NextResponse.json(await analyzeTrace(text), { headers: noStore });
  } catch (e) {
    console.error("analyze failed:", e); // details stay in server logs only
    return NextResponse.json(
      { error: "Analysis failed. Please try again." },
      { status: 500, headers: noStore },
    );
  }
}
