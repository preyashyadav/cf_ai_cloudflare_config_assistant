import { BOOTSTRAP_DOCS } from "../bootstrap_docs";
import type { Env } from "../types";
import { embedText } from "./embeddings";
import { chunkText, safeVectorId, stripHtmlToText } from "./text";

type SeedDoc = { id: string; title: string; product: string; url: string; text: string };

type FallbackDoc = { title: string; product: string; url: string };

export const FALLBACK_DOCS: FallbackDoc[] = [
  {
    product: "Fundamentals",
    title: "Cloudflare Fundamentals",
    url: "https://developers.cloudflare.com/fundamentals/",
  },
  {
    product: "Fundamentals",
    title: "What is Cloudflare?",
    url: "https://developers.cloudflare.com/learning-paths/secure-your-email/concepts/what-is-cloudflare/",
  },
  {
    product: "Fundamentals",
    title: "Get started",
    url: "https://developers.cloudflare.com/fundamentals/get-started/",
  },
  {
    product: "Fundamentals",
    title: "How Cloudflare works",
    url: "https://developers.cloudflare.com/learning-paths/get-started/concepts/how-cloudflare-works/",
  },
  {
    product: "Fundamentals",
    title: "Traffic flow through Cloudflare",
    url: "https://developers.cloudflare.com/fundamentals/concepts/traffic-flow-cloudflare/",
  },
  {
    product: "Fundamentals",
    title: "Accounts, zones, and profiles",
    url: "https://developers.cloudflare.com/fundamentals/setup/accounts-and-zones/",
  },
  {
    product: "Fundamentals",
    title: "Cloudflare IP addresses",
    url: "https://developers.cloudflare.com/fundamentals/concepts/cloudflare-ip-addresses/",
  },
  {
    product: "Fundamentals",
    title: "Get started (learning path)",
    url: "https://developers.cloudflare.com/learning-paths/get-started/",
  },
  {
    product: "Fundamentals",
    title: "Performance (learning path)",
    url: "https://developers.cloudflare.com/learning-paths/get-started/performance/default-improvements/",
  },
  {
    product: "Fundamentals",
    title: "Security",
    url: "https://developers.cloudflare.com/fundamentals/security/",
  },
];

const seedDocs = (): SeedDoc[] => [
  {
    id: "waf-managed-rules",
    title: "WAF Managed Rules",
    product: "WAF",
    url: "https://developers.cloudflare.com/waf/managed-rules/",
    text:
      "Cloudflare WAF Managed Rules protect apps from common vulns. Start by logging, then enforce after tuning.",
  },
  {
    id: "rate-limiting-rules",
    title: "Rate limiting rules",
    product: "WAF / Rate Limiting",
    url: "https://developers.cloudflare.com/waf/rate-limiting-rules/",
    text:
      "Rate limiting mitigates abusive traffic with thresholds and actions. Scope to endpoints like /api/login; prefer challenge actions first.",
  },
  {
    id: "cache-rules",
    title: "Cache Rules",
    product: "Caching",
    url: "https://developers.cloudflare.com/cache/how-to/cache-rules/",
    text:
      "Cache Rules control caching and bypass. Authentication endpoints should bypass cache; static assets are good to cache.",
  },
  {
    id: "bots",
    title: "Bots",
    product: "Bots",
    url: "https://developers.cloudflare.com/bots/",
    text:
      "Bot features detect and mitigate automated traffic. Use challenges to reduce abuse with minimal user impact.",
  },
  {
    id: "custom-rules-actions",
    title: "Custom Rules actions",
    product: "WAF",
    url: "https://developers.cloudflare.com/waf/custom-rules/actions/",
    text:
      "Security rules support actions like managed challenge, JS challenge, or block. Managed Challenge is a good first enforcement step.",
  },
];

export const fetchDocText = async (url: string): Promise<string> => {
  // Allowlist: Cloudflare docs only
  const u = new URL(url);
  if (u.hostname !== "developers.cloudflare.com") {
    throw new Error(`Blocked non-docs host: ${u.hostname}`);
  }

  const res = await fetch(url, {
    headers: {
      "user-agent": "cf-ai-config-assistant/phase1",
      accept: "text/html",
    },
  });

  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  const html = await res.text();
  return stripHtmlToText(html);
};

export const ingestBootstrapDocs = async (env: Env) => {
  const docs = BOOTSTRAP_DOCS;
  const vectors: VectorizeVector[] = [];
  let fetched = 0;
  const failed: { url: string; error: string }[] = [];

  for (const d of docs) {
    let text = "";
    try {
      text = await fetchDocText(d.url);
      fetched++;
    } catch (e: any) {
      failed.push({ url: d.url, error: e?.message ?? String(e) });
      continue;
    }

    // coverage, not perfect indexing
    const chunks = chunkText(text, 1200, 200).slice(0, 20);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const values = await embedText(env, chunk);
      vectors.push({
        id: `${safeVectorId(d.url)}-${i}`,
        values,
        metadata: {
          url: d.url,
          title: d.title,
          product: d.product,
          chunk: i,
          excerpt: chunk.slice(0, 320),
        },
      });
    }
  }

  if (vectors.length) await env.CF_DOCS.upsert(vectors);

  return {
    ok: true,
    pages: docs.length,
    fetched,
    vectors: vectors.length,
    sample: vectors.slice(0, 5).map((v) => v.id),
    failed,
  };
};

export const ingestSeedDocs = async (env: Env) => {
  const docs = seedDocs();
  const vectors: VectorizeVector[] = [];

  for (const d of docs) {
    const values = await embedText(env, d.text);
    vectors.push({
      id: d.id,
      values,
      metadata: { url: d.url, title: d.title, product: d.product, excerpt: d.text.slice(0, 320) },
    });
  }

  await env.CF_DOCS.upsert(vectors);
  return { ok: true, count: vectors.length, ids: vectors.map((v) => v.id) };
};

export const retrieveContext = async (env: Env, query: string) => {
  const embedding = await embedText(env, query);
  const results = await env.CF_DOCS.query(embedding, {
    topK: 5,
    returnMetadata: "all",
  });

  const matches = (results?.matches ?? []).map((m: any) => ({
    score: m.score,
    url: m.metadata?.url,
    title: m.metadata?.title,
    product: m.metadata?.product,
    excerpt: m.metadata?.excerpt,
  }));

  const context = matches
    .filter((m) => m.url && m.title)
    .map(
      (m, i) =>
        `Source ${i + 1}: ${m.title} (${m.product})\nURL: ${m.url}\nExcerpt: ${m.excerpt ?? ""}`
    )
    .join("\n\n");

  const sources = matches.map((m) => m.url).filter(Boolean);

  const maxScore = matches.reduce((acc, m) => Math.max(acc, Number(m.score || 0)), 0);
  const needsFallback = matches.length === 0 || maxScore < 0.15;

  if (!needsFallback) return { context, sources, matches };

  const fallbackTexts: {
    title: string;
    product: string;
    url: string;
    excerpt: string;
  }[] = [];

  for (const d of FALLBACK_DOCS) {
    try {
      const text = await fetchDocText(d.url);
      const chunk = chunkText(text, 1200, 200)[0] || text.slice(0, 1200);
      fallbackTexts.push({
        title: d.title,
        product: d.product,
        url: d.url,
        excerpt: chunk.slice(0, 320),
      });
    } catch {
      // skip broken fallback URLs
    }
  }

  const fallbackContext = fallbackTexts
    .map(
      (m, i) =>
        `Fallback ${i + 1}: ${m.title} (${m.product})\nURL: ${m.url}\nExcerpt: ${m.excerpt ?? ""}`
    )
    .join("\n\n");

  const mergedContext = [context, fallbackContext].filter(Boolean).join("\n\n");
  const mergedSources = Array.from(new Set([...sources, ...fallbackTexts.map((f) => f.url)]));

  return { context: mergedContext, sources: mergedSources, matches };
};
