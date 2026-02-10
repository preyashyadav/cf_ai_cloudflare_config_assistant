export type BootstrapDoc = {
  url: string;
  title: string;
  product: string;
};

export const BOOTSTRAP_DOCS: BootstrapDoc[] = [
  // Fundamentals / Overview
  { product: "Fundamentals", title: "Cloudflare Fundamentals", url: "https://developers.cloudflare.com/fundamentals/" },
  { product: "Fundamentals", title: "What is Cloudflare?", url: "https://developers.cloudflare.com/learning-paths/secure-your-email/concepts/what-is-cloudflare/" },
  { product: "Fundamentals", title: "Get started", url: "https://developers.cloudflare.com/fundamentals/get-started/" },
  { product: "Fundamentals", title: "How Cloudflare works", url: "https://developers.cloudflare.com/learning-paths/get-started/concepts/how-cloudflare-works/" },
  { product: "Fundamentals", title: "Traffic flow through Cloudflare", url: "https://developers.cloudflare.com/fundamentals/concepts/traffic-flow-cloudflare/" },
  { product: "Fundamentals", title: "Accounts, zones, and profiles", url: "https://developers.cloudflare.com/fundamentals/setup/accounts-and-zones/" },
  { product: "Fundamentals", title: "Cloudflare IP addresses", url: "https://developers.cloudflare.com/fundamentals/concepts/cloudflare-ip-addresses/" },
  { product: "Fundamentals", title: "Get started (learning path)", url: "https://developers.cloudflare.com/learning-paths/get-started/" },
  { product: "Fundamentals", title: "Performance (learning path)", url: "https://developers.cloudflare.com/learning-paths/get-started/performance/default-improvements/" },
  { product: "Fundamentals", title: "Security", url: "https://developers.cloudflare.com/fundamentals/security/" },

  // DNS / Domains / Routing
  { product: "DNS", title: "DNS", url: "https://developers.cloudflare.com/dns/" },
  { product: "DNS", title: "DNS records", url: "https://developers.cloudflare.com/dns/manage-dns-records/" },
  { product: "Registrar", title: "Cloudflare Registrar", url: "https://developers.cloudflare.com/registrar/" },

  // SSL/TLS
  { product: "SSL/TLS", title: "SSL/TLS", url: "https://developers.cloudflare.com/ssl/" },
  { product: "SSL/TLS", title: "TLS settings", url: "https://developers.cloudflare.com/ssl/edge-certificates/" },

  // Caching / Performance
  { product: "Caching", title: "Cache", url: "https://developers.cloudflare.com/cache/" },
  { product: "Caching", title: "Cache Rules", url: "https://developers.cloudflare.com/cache/how-to/cache-rules/" },
  { product: "Performance", title: "Performance", url: "https://developers.cloudflare.com/speed/" },

  // WAF / Security / DDoS
  { product: "WAF", title: "WAF", url: "https://developers.cloudflare.com/waf/" },
  { product: "WAF", title: "Managed Rules", url: "https://developers.cloudflare.com/waf/managed-rules/" },
  { product: "WAF", title: "Custom Rules", url: "https://developers.cloudflare.com/waf/custom-rules/" },
  { product: "WAF", title: "Rate limiting rules", url: "https://developers.cloudflare.com/waf/rate-limiting-rules/" },
  { product: "DDoS", title: "DDoS protection", url: "https://developers.cloudflare.com/ddos-protection/" },
  { product: "Bots", title: "Bots", url: "https://developers.cloudflare.com/bots/" },

  // Firewall / Access / Zero Trust
  { product: "Firewall", title: "Firewall rules", url: "https://developers.cloudflare.com/waf/firewall-rules/" },
  { product: "Zero Trust", title: "Zero Trust", url: "https://developers.cloudflare.com/cloudflare-one/" },
  { product: "Access", title: "Access", url: "https://developers.cloudflare.com/cloudflare-one/identity/" },

  // Workers / Pages / R2 / KV / D1
  { product: "Workers", title: "Workers", url: "https://developers.cloudflare.com/workers/" },
  { product: "Workers", title: "Durable Objects", url: "https://developers.cloudflare.com/durable-objects/" },
  { product: "Pages", title: "Pages", url: "https://developers.cloudflare.com/pages/" },
  { product: "R2", title: "R2", url: "https://developers.cloudflare.com/r2/" },
  { product: "KV", title: "Workers KV", url: "https://developers.cloudflare.com/kv/" },
  { product: "D1", title: "D1", url: "https://developers.cloudflare.com/d1/" },

  // Redirects / Rules
  { product: "Rules", title: "Rules", url: "https://developers.cloudflare.com/rules/" },
  { product: "Rules", title: "Redirect Rules", url: "https://developers.cloudflare.com/rules/url-forwarding/" },

  // Observability / Analytics / Logs
  { product: "Logs", title: "Logpush", url: "https://developers.cloudflare.com/logs/logpush/" },
  { product: "Analytics", title: "Analytics", url: "https://developers.cloudflare.com/analytics/" },
];

// TODO: Grow the list.
// TODO: Implement a crawling approach
