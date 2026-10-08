export function normalizeTrace(raw: string): string {
  return raw
    .replace(/\b\d{1,3}(\.\d{1,3}){3}(:\d+)?\b/g, "<ip>")
    .replace(/0x[0-9a-f]+/gi, "<addr>")
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      "<uuid>",
    )
    .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, "<ts>")
    .replace(/:\d+:\d+/g, ":L")
    .replace(/\.(java|py|kt|go):\d+/g, ".$1:L")
    .replace(/line \d+/gi, "line L")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6000);
}
