export const isValidScope = (s: unknown) => {
  if (typeof s !== "string") return false;
  const t = s.trim();
  if (!t) return true;
  return (
    /^http\.request\.uri\.path\s+starts_with\s+"\/[^"]*"$/.test(t) ||
    /^http\.request\.uri\.path\s+eq\s+"\/[^"]*"$/.test(t)
  );
};

export const enforcePolicy = (
  plan: any,
  opts: {
    goal: string;
    intent: string;
    defaultRollout: string[];
    defaultMetrics: string[];
    sources: string[];
    isUrl: (u: unknown) => boolean;
  }
) => {
  const { goal, intent, defaultRollout, defaultMetrics, sources, isUrl } = opts;
  const g = goal.toLowerCase();
  const isAuth = /\/api\/login|\/login|auth/i.test(g);
  const loginScope = 'http.request.uri.path starts_with "/api/login"';

  // safety default: start in log
  plan.cloudflare_config.waf.mode = "log";

  if (isAuth) {
    plan.topic = "security";
    plan.cloudflare_config.waf.scope = loginScope;
    plan.cloudflare_config.rate_limiting.scope = loginScope;

    const action = String(plan.cloudflare_config.rate_limiting.action || "").toLowerCase();
    if (!action || action === "block") plan.cloudflare_config.rate_limiting.action = "managed_challenge";

    const bp = Array.isArray(plan.cloudflare_config.cache_rules.bypass_paths)
      ? plan.cloudflare_config.cache_rules.bypass_paths
      : [];
    plan.cloudflare_config.cache_rules.bypass_paths = Array.from(new Set([...bp, "/api/login"]));
  }

  if (intent !== "explain") {
    if (!Array.isArray(plan.rollout) || plan.rollout.length !== 3) plan.rollout = defaultRollout;
    if (!Array.isArray(plan.metrics) || plan.metrics.length !== 4) plan.metrics = defaultMetrics;
  } else {
    plan.rollout = [];
    plan.metrics = [];
  }
  if (!Array.isArray(plan.sources)) plan.sources = sources.filter(isUrl).slice(0, 5);
  if (!Array.isArray(plan.follow_up_questions)) plan.follow_up_questions = [];

  return plan;
};
