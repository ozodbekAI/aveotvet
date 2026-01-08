function truncate(s: string, maxLen: number): string {
  const clean = s.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, Math.max(0, maxLen - 1)) + "…";
}

export function toText(value: unknown, maxLen: number = 180): string {
  if (value === null || value === undefined) return "";

  if (typeof value === "string") return truncate(value, maxLen);
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;

    const candidates: unknown[] = [
      obj.text,
      obj.message,
      obj.body,
      obj.content,
      obj.comment,
      // nested
      typeof obj.message === "object" && obj.message !== null ? (obj.message as Record<string, unknown>).text : undefined,
    ];

    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) return truncate(c, maxLen);
    }

    try {
      return truncate(JSON.stringify(value), maxLen);
    } catch {
      return "[object]";
    }
  }

  return "";
}
