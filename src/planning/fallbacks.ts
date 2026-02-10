export const buildSecurityFallback = (defaultRollout: string[], defaultMetrics: string[]) => ({
  topic: "security",
  chat_response: {
    title: "Security Starter Plan",
    summary: "A safe, staged plan to reduce abuse without breaking users.",
    sections: [
      {
        heading: "1) Start with managed protection",
        bullets: [
          "Enable WAF managed rules in log-only mode first.",
          "Use managed challenge for suspicious traffic (safer than block).",
        ],
        checklist: [
          { text: "WAF managed rules enabled (log mode)", done_by_user: false },
          { text: "Baseline traffic observed for 24–48 hours", done_by_user: false },
        ],
        steps: [
          {
            step: 1,
            title: "Turn on managed rules",
            details: ["Cloudflare Dashboard → Security → WAF → Managed Rules.", "Set to Log."],
          },
        ],
        actions: [{ label: "WAF managed rules", url: "https://developers.cloudflare.com/waf/managed-rules/" }],
      },
      {
        heading: "2) Add rate limiting for critical endpoints",
        bullets: ["Start with login or API endpoints.", "Use managed challenge over block."],
        checklist: [{ text: "Rate limiting rule created for a specific path", done_by_user: false }],
        steps: [
          {
            step: 1,
            title: "Create a rate limit rule",
            details: [
              "Cloudflare Dashboard → Security → WAF → Rate limiting rules.",
              'Scope to an exact path (e.g., http.request.uri.path starts_with "/api/login").',
            ],
          },
        ],
        actions: [{ label: "Rate limiting rules", url: "https://developers.cloudflare.com/waf/rate-limiting-rules/" }],
      },
      {
        heading: "3) Add bot mitigation",
        bullets: ["Use bot features to reduce automated abuse.", "Start with challenges."],
        checklist: [{ text: "Bot protection enabled for sensitive paths", done_by_user: false }],
        steps: [
          {
            step: 1,
            title: "Enable bot protections",
            details: ["Cloudflare Dashboard → Security → Bots.", "Start with managed challenge."],
          },
        ],
        actions: [{ label: "Bots", url: "https://developers.cloudflare.com/bots/" }],
      },
    ],
  },
  dns_plan: { records_to_verify: [], email_dns_notes: [], dnssec_steps: [], proxy_rules_of_thumb: [] },
  summary: "Security starter plan (fallback)",
  assumptions: [],
  recommendations: {
    waf: ["Enable managed rules in log mode, then move to partial enforcement."],
    rate_limiting: ["Add rate limiting on the most critical path."],
    cache_rules: [],
    bot_mitigation: ["Use managed challenge to reduce automated abuse."],
    zero_trust: [],
  },
  cloudflare_config: {
    waf: { managed_rules: "Cloudflare Managed Ruleset", sensitivity: "medium", mode: "log", scope: "" },
    rate_limiting: { threshold: "100", window: "60s", action: "managed_challenge", scope: "" },
    cache_rules: { bypass_paths: [], cache_paths: [] },
  },
  rollout: defaultRollout,
  metrics: defaultMetrics,
  follow_up_questions: [],
});

export const buildPerformanceFallback = (cacheGoal: string) => {
  const goalText = (cacheGoal || "").trim();
  const summary = goalText
    ? `A practical caching plan tailored to: ${goalText}.`
    : "A practical caching plan for improving performance and efficiency.";

  return {
    topic: "performance",
    chat_response: {
      title: "Performance & Caching Plan",
      summary,
      sections: [
        {
          heading: "1) Cache static content",
          bullets: [
            "Cache CSS/JS/images and other static assets.",
            "Bypass cache for login/auth or highly dynamic paths.",
          ],
          checklist: [
            { text: "Static assets cached", done_by_user: false },
            { text: "Dynamic/auth paths bypass cache", done_by_user: false },
          ],
          steps: [
            {
              step: 1,
              title: "Create cache rules",
              details: [
                "Cloudflare Dashboard → Caching → Cache Rules.",
                "Add a rule to cache /assets/*, /static/*, and common file extensions.",
              ],
            },
          ],
          actions: [{ label: "Cache Rules", url: "https://developers.cloudflare.com/cache/how-to/cache-rules/" }],
        },
        {
          heading: "2) Optimize delivery",
          bullets: ["Enable compression to reduce transfer size.", "Use CDN features to reduce latency."],
          checklist: [
            { text: "Brotli enabled", done_by_user: false },
            { text: "Auto Minify enabled where safe", done_by_user: false },
          ],
          steps: [
            {
              step: 1,
              title: "Enable optimizations",
              details: ["Cloudflare Dashboard → Speed → Optimization.", "Turn on Brotli and Auto Minify."],
            },
          ],
          actions: [{ label: "Performance", url: "https://developers.cloudflare.com/speed/" }],
        },
      ],
    },
    dns_plan: { records_to_verify: [], email_dns_notes: [], dnssec_steps: [], proxy_rules_of_thumb: [] },
    summary: "Performance plan (fallback)",
    assumptions: [],
    recommendations: {
      waf: [],
      rate_limiting: [],
      cache_rules: ["Cache static assets, bypass dynamic/auth paths."],
      bot_mitigation: [],
      zero_trust: [],
    },
    cloudflare_config: {
      waf: { managed_rules: "", sensitivity: "", mode: "log", scope: "" },
      rate_limiting: { threshold: "", window: "", action: "managed_challenge", scope: "" },
      cache_rules: { bypass_paths: ["/login", "/api/login", "/auth"], cache_paths: ["/assets/*", "/static/*"] },
    },
    rollout: ["Enable cache rules", "Enable optimizations", "Monitor performance metrics"],
    metrics: ["Cache hit rate", "TTFB", "Origin requests", "Bandwidth"],
    follow_up_questions: [],
  };
};

export const buildDnsFallback = (defaultRollout: string[], defaultMetrics: string[]) => ({
  topic: "dns",
  chat_response: {
    title: "DNS Hardening Plan",
    summary: "Here’s a practical step-by-step plan to secure DNS without breaking email.",
    sections: [
      {
        heading: "1) Validate your DNS records",
        bullets: [
          "Confirm all A/AAAA/CNAME records point to the right origin.",
          "Verify MX and SPF are present and correct before any changes.",
        ],
        checklist: [
          { text: "A/AAAA/CNAME records match the current origin", done_by_user: false },
          { text: "MX and SPF records are present", done_by_user: false },
        ],
        steps: [
          {
            step: 1,
            title: "Open DNS records",
            details: ["Cloudflare Dashboard → DNS → Records.", "Export current records as a backup."],
          },
          {
            step: 2,
            title: "Validate email DNS",
            details: ["Check MX targets for your mail provider.", "Confirm SPF includes only authorized senders."],
          },
        ],
        actions: [
          { label: "DNS records", url: "https://developers.cloudflare.com/dns/manage-dns-records/" },
        ],
      },
      {
        heading: "2) Proxy only what should be proxied",
        bullets: [
          "Proxy web traffic (A/AAAA/CNAME) when it’s safe.",
          "Keep email-related records DNS-only (MX/SPF/DKIM/DMARC).",
        ],
        checklist: [{ text: "Email records are DNS-only (grey cloud)", done_by_user: false }],
        steps: [
          {
            step: 1,
            title: "Set proxy status",
            details: ["Cloudflare Dashboard → DNS → Records.", "Ensure MX/SPF/DKIM/DMARC are DNS-only."],
          },
        ],
        actions: [{ label: "DNS docs", url: "https://developers.cloudflare.com/dns/" }],
      },
      {
        heading: "3) Enable DNSSEC",
        bullets: ["Turn on DNSSEC to prevent DNS spoofing.", "Add the DS record at your registrar if required."],
        checklist: [{ text: "DNSSEC enabled and DS record added", done_by_user: false }],
        steps: [
          {
            step: 1,
            title: "Enable DNSSEC",
            details: ["Cloudflare Dashboard → DNS → Settings → DNSSEC.", "Copy DS record to your registrar."],
          },
        ],
        actions: [{ label: "DNSSEC", url: "https://developers.cloudflare.com/dns/additional-options/dnssec/" }],
      },
    ],
  },
  dns_plan: {
    records_to_verify: [],
    email_dns_notes: ["Ensure MX and SPF records remain DNS-only."],
    dnssec_steps: ["Enable DNSSEC in Cloudflare.", "Add DS record at your registrar."],
    proxy_rules_of_thumb: ["Proxy web records only; never proxy email records."],
  },
  summary: "DNS hardening plan (fallback)",
  assumptions: [],
  recommendations: { waf: [], rate_limiting: [], cache_rules: [], bot_mitigation: [], zero_trust: [] },
  cloudflare_config: {
    waf: { managed_rules: "", sensitivity: "", mode: "log", scope: "" },
    rate_limiting: { threshold: "", window: "", action: "managed_challenge", scope: "" },
    cache_rules: { bypass_paths: [], cache_paths: [] },
  },
  rollout: defaultRollout,
  metrics: defaultMetrics,
  follow_up_questions: [],
});

export const buildInvalidJsonFallback = (defaultRollout: string[], defaultMetrics: string[]) => ({
  topic: "general",
  chat_response: {
    title: "Plan",
    summary: "Model returned invalid JSON. Please try again.",
    sections: [
      {
        heading: "Next steps",
        bullets: ["Click Generate plan again to retry."],
        checklist: [],
        steps: [
          {
            step: 1,
            title: "Retry plan generation",
            details: ["Click Generate plan.", "If it repeats, rephrase your goal in one sentence."],
          },
        ],
        actions: [],
      },
    ],
  },
  dns_plan: { records_to_verify: [], email_dns_notes: [], dnssec_steps: [], proxy_rules_of_thumb: [] },
  summary: "Model returned invalid JSON",
  assumptions: [],
  recommendations: { waf: [], rate_limiting: [], cache_rules: [], bot_mitigation: [], zero_trust: [] },
  cloudflare_config: {
    waf: { managed_rules: "", sensitivity: "", mode: "log", scope: "" },
    rate_limiting: { threshold: "", window: "", action: "managed_challenge", scope: "" },
    cache_rules: { bypass_paths: [], cache_paths: [] },
  },
  rollout: defaultRollout,
  metrics: defaultMetrics,
  follow_up_questions: [{ key: "format_error", question: "Try /api/plan again." }],
});
