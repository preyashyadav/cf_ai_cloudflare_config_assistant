import type { PendingQuestion } from "../types";

type NormalizeOptions = {
  intent: string;
  defaultRollout: string[];
  defaultMetrics: string[];
  sources: string[];
  isUrl: (u: unknown) => boolean;
};

const ensureStrings = (arr: any) => (Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : []);
const clamp = (arr: any, n: number) => (Array.isArray(arr) ? arr.slice(0, n) : []);

const normalizeFollowUps = (fu: any): PendingQuestion[] => {
  if (Array.isArray(fu)) {
    return fu
      .map((x) => ({ key: String(x?.key ?? ""), question: String(x?.question ?? "") }))
      .filter((x) => x.key && x.question)
      .slice(0, 2);
  }
  return [];
};

const normalizeTopic = (t: any) => {
  const s = typeof t === "string" ? t : "general";
  return ["dns", "security", "workers", "performance", "general"].includes(s) ? s : "general";
};

const normalizeChat = (c: any) => ({
  title: typeof c?.title === "string" ? c.title : "Plan",
  summary: typeof c?.summary === "string" ? c.summary : "",
  sections: Array.isArray(c?.sections) ? c.sections.slice(0, 4) : [],
});

const normalizeDnsPlan = (d: any) => ({
  records_to_verify: Array.isArray(d?.records_to_verify) ? d.records_to_verify.slice(0, 10) : [],
  email_dns_notes: Array.isArray(d?.email_dns_notes) ? d.email_dns_notes.slice(0, 8) : [],
  dnssec_steps: Array.isArray(d?.dnssec_steps) ? d.dnssec_steps.slice(0, 8) : [],
  proxy_rules_of_thumb: Array.isArray(d?.proxy_rules_of_thumb) ? d.proxy_rules_of_thumb.slice(0, 8) : [],
});

export const normalizePlan = (p: any, opts: NormalizeOptions) => {
  const { intent, defaultRollout, defaultMetrics, sources, isUrl } = opts;

  const out: any = {
    topic: normalizeTopic(p?.topic),
    chat_response: normalizeChat(p?.chat_response),
    dns_plan: normalizeDnsPlan(p?.dns_plan),

    summary: typeof p?.summary === "string" ? p.summary : "Cloudflare configuration recommendations",
    assumptions: clamp(ensureStrings(p?.assumptions), 3),

    recommendations: {
      waf: clamp(ensureStrings(p?.recommendations?.waf), 2),
      rate_limiting: clamp(ensureStrings(p?.recommendations?.rate_limiting), 2),
      cache_rules: clamp(ensureStrings(p?.recommendations?.cache_rules), 2),
      bot_mitigation: clamp(ensureStrings(p?.recommendations?.bot_mitigation), 2),
      zero_trust: clamp(ensureStrings(p?.recommendations?.zero_trust), 2),
    },

    cloudflare_config: {
      waf: {
        managed_rules: String(p?.cloudflare_config?.waf?.managed_rules ?? ""),
        sensitivity: String(p?.cloudflare_config?.waf?.sensitivity ?? ""),
        mode: String(p?.cloudflare_config?.waf?.mode ?? "log"),
        scope: String(p?.cloudflare_config?.waf?.scope ?? ""),
      },
      rate_limiting: {
        threshold: String(p?.cloudflare_config?.rate_limiting?.threshold ?? ""),
        window: String(p?.cloudflare_config?.rate_limiting?.window ?? ""),
        action: String(p?.cloudflare_config?.rate_limiting?.action ?? "managed_challenge"),
        scope: String(p?.cloudflare_config?.rate_limiting?.scope ?? ""),
      },
      cache_rules: {
        bypass_paths: Array.isArray(p?.cloudflare_config?.cache_rules?.bypass_paths)
          ? p.cloudflare_config.cache_rules.bypass_paths.map((x: any) => String(x))
          : [],
        cache_paths: Array.isArray(p?.cloudflare_config?.cache_rules?.cache_paths)
          ? p.cloudflare_config.cache_rules.cache_paths.map((x: any) => String(x))
          : [],
      },
    },

    rollout: ensureStrings(p?.rollout),
    metrics: ensureStrings(p?.metrics),
    follow_up_questions: normalizeFollowUps(p?.follow_up_questions),
    sources: sources.filter(isUrl).slice(0, 5),
  };

  if (intent === "explain") {
    out.chat_response.sections = out.chat_response.sections.map((s: any) => ({
      ...s,
      steps: [],
      checklist: [],
    }));
  }

  if (intent !== "explain") {
    out.rollout = out.rollout.length === 3 ? out.rollout : defaultRollout;
    out.metrics = out.metrics.length === 4 ? out.metrics : defaultMetrics;
  } else {
    out.rollout = [];
    out.metrics = [];
  }
  return out;
};
