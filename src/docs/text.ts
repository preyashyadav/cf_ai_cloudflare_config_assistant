export const stripHtmlToText = (html: string): string => {
  let t = html;

  // rm scripts/styles
  t = t.replace(/<script[\s\S]*?<\/script>/gi, " ");
  t = t.replace(/<style[\s\S]*?<\/style>/gi, " ");

  // rm nav/headers/footers loosely (docs pages often have lots of chrome)
  t = t.replace(/<nav[\s\S]*?<\/nav>/gi, " ");
  t = t.replace(/<header[\s\S]*?<\/header>/gi, " ");
  t = t.replace(/<footer[\s\S]*?<\/footer>/gi, " ");

  // replace tags with spaces
  t = t.replace(/<[^>]+>/g, " ");

  // decpde a few common entities
  t = t
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // rm whitespace
  t = t.replace(/\s+/g, " ").trim();
  return t;
};

export const chunkText = (text: string, chunkSize = 1200, overlap = 200): string[] => {
  if (!text) return [];
  if (text.length <= chunkSize) return [text];

  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + chunkSize, text.length);
    const slice = text.slice(i, end).trim();
    if (slice.length >= 200) chunks.push(slice);
    if (end === text.length) break;
    i = Math.max(0, end - overlap);
  }
  return chunks;
};

export const safeVectorId = (s: string): string =>
  s
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
