export const isPlainObject = (x: any) => x && typeof x === "object" && !Array.isArray(x);

export const toText = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (v == null) return "";
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

export const extractFirstJsonObject = (input: unknown): string | null => {
  const text = toText(input);
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{") depth++;
    if (ch === "}") depth--;

    if (depth === 0) return text.slice(start, i + 1);
  }

  return null;
};

export const safeJsonParse = (input: unknown): any | null => {
  const raw = toText(input);

  try {
    const v = JSON.parse(raw);
    return isPlainObject(v) ? v : null;
  } catch {}

  const extracted = extractFirstJsonObject(raw);
  if (!extracted) return null;

  try {
    const v = JSON.parse(extracted);
    return isPlainObject(v) ? v : null;
  } catch {
    return null;
  }
};
