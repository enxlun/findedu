// Small models sometimes wrap JSON in code fences or add a sentence around it.
// extractJson finds the first balanced {...} block and parses it.

export const extractJson = (text: string): unknown => {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // fall through to the scanner
  }

  const start = cleaned.indexOf("{");
  if (start === -1) throw new Error("No JSON object in AI response");

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const candidate = cleaned.slice(start, i + 1);
        // Tolerate trailing commas, a common small-model slip.
        return JSON.parse(candidate.replace(/,\s*([}\]])/g, "$1"));
      }
    }
  }

  throw new Error("Unterminated JSON object in AI response");
};

export const asString = (value: unknown, max = 400): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export const asNumber = (value: unknown, fallback: number): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export const clamp = (n: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, n));
