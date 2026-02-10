export type GoalTopic = "dns" | "security" | "workers" | "performance" | "general";

export type GoalClassification = {
  topic: GoalTopic;
  inScope: boolean;
};

const hasAny = (text: string, patterns: RegExp[]) => patterns.some((r) => r.test(text));

const CF_KEYWORDS: RegExp[] = [
  /\bcloudflare\b/i,
  /\bcdn\b/i,
  /\bwaf\b/i,
  /\bdns\b/i,
  /\bworkers?\b/i,
  /\bpages\b/i,
  /\bkv\b/i,
  /\br2\b/i,
  /\bd1\b/i,
  /\bcache\b/i,
  /\bssl\b/i,
  /\btls\b/i,
  /\bbots?\b/i,
  /\brate limit(ing)?\b/i,
  /\bfirewall\b/i,
  /\bzero trust\b/i,
  /\baccess\b/i,
  /\bzone\b/i,
  /\bnameserver\b/i,
  /\bregistrar\b/i,
  /\bload balanc(ing|er)\b/i,
];

const DNS_KEYWORDS: RegExp[] = [
  /\bdns\b/i,
  /\bnameserver\b/i,
  /\bzone\b/i,
  /\bmx\b/i,
  /\bspf\b/i,
  /\bdkim\b/i,
  /\bdmarc\b/i,
  /\bdnssec\b/i,
  /\brecord\b/i,
  /\bmail\b/i,
  /\bemail\b/i,
  /\bmailbox\b/i,
  /\bgmail\b/i,
  /\bgoogle workspace\b/i,
  /\bmx record\b/i,
];

const WORKERS_KEYWORDS: RegExp[] = [
  /\bworkers?\b/i,
  /\bdurable object\b/i,
  /\bkv\b/i,
  /\bd1\b/i,
  /\br2\b/i,
  /\bpages\b/i,
  /\bqueues?\b/i,
];

const PERF_KEYWORDS: RegExp[] = [
  /\bcache\b/i,
  /\bcaching\b/i,
  /\bcdn\b/i,
  /\blatency\b/i,
  /\bperformance\b/i,
  /\boptimi[sz]e\b/i,
  /\bspeed\b/i,
];

const SECURITY_KEYWORDS: RegExp[] = [
  /\bwaf\b/i,
  /\bbot\b/i,
  /\bddos\b/i,
  /\brate limit(ing)?\b/i,
  /\bfirewall\b/i,
  /\baccess\b/i,
  /\bzero trust\b/i,
  /\bapi abuse\b/i,
  /\bblock\b/i,
  /\bchallenge\b/i,
];

const OUT_OF_SCOPE_KEYWORDS: RegExp[] = [
  /\bgmail\b/i,
  /\bgoogle workspace\b/i,
  /\bgsuite\b/i,
  /\baws\b/i,
  /\bazure\b/i,
  /\bgcp\b/i,
  /\bgithub\b/i,
  /\bnetlify\b/i,
  /\bvercel\b/i,
  /\bshopify\b/i,
  /\bwordpress\b/i,
  /\bsquarespace\b/i,
  /\bwix\b/i,
  /\bmailbox\b/i,
  /\boutlook\b/i,
  /\boffice 365\b/i,
  /\bmicrosoft 365\b/i,
];

export const classifyGoal = (goalText: string): GoalClassification => {
  const g = String(goalText || "").toLowerCase();
  if (!g.trim()) return { topic: "general", inScope: false };

  const dns = hasAny(g, DNS_KEYWORDS);
  const workers = hasAny(g, WORKERS_KEYWORDS);
  const performance = hasAny(g, PERF_KEYWORDS);
  const security = hasAny(g, SECURITY_KEYWORDS);
  const cf = hasAny(g, CF_KEYWORDS);
  const oos = hasAny(g, OUT_OF_SCOPE_KEYWORDS);

  //topic priority
  if (dns) return { topic: "dns", inScope: true };
  if (workers) return { topic: "workers", inScope: true };
  if (performance) return { topic: "performance", inScope: true };
  if (security) return { topic: "security", inScope: true };

  // if it's not clearly CF but mentions outside systems, treat as out-of-scope
  if (!cf && oos) return { topic: "general", inScope: false };

  // unknown/ambiguous
  return { topic: "general", inScope: cf };
};
