export const filterSourcesByTopic = (
  topic: string,
  sources: string[],
  matches: any,
  isUrl: (u: unknown) => boolean
) => {
  const tagMap: Record<string, string[]> = {
    dns: ["DNS", "Registrar", "SSL/TLS"],
    security: ["WAF", "DDoS", "Bots", "Firewall", "Zero Trust", "Access"],
    workers: ["Workers", "Pages", "R2", "KV", "D1"],
    performance: ["Caching", "Performance", "Rules"],
    general: [],
  };

  const tags = tagMap[topic] || [];
  if (!matches || !Array.isArray(matches) || !tags.length) {
    return sources.filter(isUrl).slice(0, 5);
  }

  const filtered = matches
    .filter((m: any) => tags.includes(String(m?.product ?? "")))
    .map((m: any) => m.url)
    .filter(isUrl);

  if (filtered.length) return Array.from(new Set(filtered)).slice(0, 5);
  return sources.filter(isUrl).slice(0, 5);
};
