import { classifyGoal } from "../classifiers/goal_classifier";
import { classifyIntent } from "../classifiers/intent_classifier";
import { retrieveContext } from "../docs/ingest";
import type { ConfigState, Env, PendingQuestion } from "../types";
import { generateFollowUps } from "./followups";
import { safeJsonParse, toText } from "./json_utils";
import { normalizePlan } from "./normalize";
import { enforcePolicy, isValidScope } from "./policy";
import { filterSourcesByTopic } from "./sources";
import {
  buildDnsFallback,
  buildInvalidJsonFallback,
  buildPerformanceFallback,
  buildSecurityFallback,
} from "./fallbacks";
import { SYSTEM_PROMPT } from "./system_prompt";

export type GeneratePlanResult = {
  plan: any;
  pendingQuestions: PendingQuestion[];
  lastPlanJson: string;
};

export const generatePlan = async (env: Env, state: ConfigState): Promise<GeneratePlanResult> => {
  const goal = (state.goal ?? "").trim();
  const answers = state.answers ?? {};
  const followups = Array.isArray(state.followups) ? state.followups : [];
  const lastFollowup = followups.length ? followups[followups.length - 1] : "";

  const defaultRollout = ["Log/observe", "Partial enforcement", "Full enforcement"];
  const defaultMetrics = ["Error rate", "Latency", "Rate-limit hits", "WAF actions"];

  const inferTopic = (goalText: string) => {
    const c = classifyGoal(goalText);
    return c.topic === "general" ? null : c.topic;
  };

  if (!goal) {
    const empty = {
      topic: "general",
      chat_response: {
        title: "Cloudflare Config Assistant",
        summary: "Set a goal first.",
        sections: [
          {
            heading: "Next",
            bullets: ["Type what you want to do on Cloudflare (e.g., migrate DNS, secure /api/login)."],
            checklist: [],
            steps: [],
            actions: [],
          },
        ],
      },
      dns_plan: { records_to_verify: [], email_dns_notes: [], dnssec_steps: [], proxy_rules_of_thumb: [] },
      summary: "Set a goal first via /api/set-goal",
      assumptions: [],
      recommendations: {
        waf: [],
        rate_limiting: [],
        cache_rules: [],
        bot_mitigation: [],
        zero_trust: [],
      },
      cloudflare_config: {
        waf: { managed_rules: "", sensitivity: "", mode: "log", scope: "" },
        rate_limiting: { threshold: "", window: "", action: "managed_challenge", scope: "" },
        cache_rules: { bypass_paths: [], cache_paths: [] },
      },
      rollout: defaultRollout,
      metrics: defaultMetrics,
      follow_up_questions: [{ key: "goal", question: "What are you trying to do on Cloudflare?" }],
      sources: [],
    };

    return {
      plan: empty,
      pendingQuestions: empty.follow_up_questions,
      lastPlanJson: JSON.stringify(empty, null, 2),
    };
  }

  const contextQuery = [goal, ...followups, JSON.stringify(answers)].filter(Boolean).join("\n");
  const { context, sources, matches } = await retrieveContext(env, contextQuery);

  const intentFocus = lastFollowup || goal;
  const intent = await classifyIntent(env, intentFocus, answers);
  const classification = classifyGoal([goal, ...followups].filter(Boolean).join("\n"));

  const isUrl = (u: unknown) => typeof u === "string" && /^https?:\/\/\S+$/i.test(u);

  const runOnce = async (extraSystemNote?: string) => {
    const messages = [
      { role: "system" as const, content: extraSystemNote ? `${SYSTEM_PROMPT}\n\n${extraSystemNote}` : SYSTEM_PROMPT },
      {
        role: "user" as const,
        content:
          `Intent: ${intent.intent}\n` +
          `Goal: ${goal}\n` +
          `Answers: ${JSON.stringify({ ...answers, followups })}\n\n` +
          `SOURCES:\n${context}`,
      },
    ];

    const res = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
      messages,
      max_tokens: 1400,
      temperature: 0.2,
    });
    const raw =
      typeof res === "object" && res && "response" in res
        ? toText((res as any).response)
        : toText(res);

    const parsed = safeJsonParse(raw);
    return { raw, parsed };
  };

  const runRepair = async (rawText: string) => {
    const messages = [
      {
        role: "system" as const,
        content:
          "You are a JSON repair assistant. Return ONLY a valid JSON object that matches the schema. " +
          "Do not include markdown or extra text.",
      },
      { role: "user" as const, content: rawText },
    ];
    const res = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
      messages,
      max_tokens: 1400,
      temperature: 0.2,
    });
    const raw =
      typeof res === "object" && res && "response" in res
        ? toText((res as any).response)
        : toText(res);
    const parsed = safeJsonParse(raw);
    return { raw, parsed };
  };

  // ONE retry only
  let attempt = await runOnce();
  let usedRetry = false;

  if (!attempt.parsed) {
    usedRetry = true;
    attempt = await runOnce("RETRY: Return ONLY valid JSON object. No extra text.");
  }

  let finalPlan: any;

  let repairAttempt: { raw: string; parsed: any } | null = null;
  if (!attempt.parsed) {
    repairAttempt = await runRepair(String(attempt.raw ?? ""));
  }

  const normalizeOpts = {
    intent: intent.intent,
    defaultRollout,
    defaultMetrics,
    sources,
    isUrl,
  };

  if (attempt.parsed) {
    finalPlan = normalizePlan(attempt.parsed, normalizeOpts);
  } else if (repairAttempt?.parsed) {
    finalPlan = normalizePlan(repairAttempt.parsed, normalizeOpts);
  } else {
    const forcedTopic = classification.topic !== "general" ? classification.topic : inferTopic(intentFocus) ?? "general";
    const cacheGoalText = String(answers.cache_goal ?? "");
    const fallback =
      forcedTopic === "dns"
        ? buildDnsFallback(defaultRollout, defaultMetrics)
        : forcedTopic === "security"
        ? buildSecurityFallback(defaultRollout, defaultMetrics)
        : forcedTopic === "performance"
        ? buildPerformanceFallback(cacheGoalText)
        : buildInvalidJsonFallback(defaultRollout, defaultMetrics);

    finalPlan = normalizePlan(fallback, normalizeOpts);
    finalPlan.raw = String(attempt.raw ?? "").slice(0, 1200);
  }

  finalPlan.usedRetry = usedRetry;

  finalPlan = enforcePolicy(finalPlan, {
    goal,
    intent: intent.intent,
    defaultRollout,
    defaultMetrics,
    sources,
    isUrl,
  });

  // force inferred topic
  const forced = inferTopic(goal);
  if (forced) finalPlan.topic = forced;

  // prefer topic-relevant sources after topic is determined
  finalPlan.sources = filterSourcesByTopic(finalPlan.topic, sources, matches, isUrl);

  //  wipe model follow-ups first
  finalPlan.follow_up_questions = [];

  const missing: string[] = [];
  if (finalPlan.topic === "dns") {
    if (!String(answers.dns_provider ?? "").trim()) missing.push("dns_provider");
    if (!String(answers.email_dns ?? "").trim()) missing.push("email_dns");
  } else if (finalPlan.topic === "workers") {
    if (!String(answers.app_type ?? "").trim()) missing.push("app_type");
    if (!String(answers.routes ?? "").trim()) missing.push("routes");
  } else if (finalPlan.topic === "performance") {
    if (!String(answers.site_type ?? "").trim()) missing.push("site_type");
    if (!String(answers.cache_goal ?? "").trim()) missing.push("cache_goal");
  } else if (finalPlan.topic === "security") {
    if (!String(answers.protected_path ?? "").trim()) missing.push("protected_path");
    if (!String(answers.traffic ?? "").trim()) missing.push("traffic");
  }

  // Scope validation ONLY when relevant (prevents DNS asking for WAF scope)
  const shouldValidateScopes =
    finalPlan.topic === "security" ||
    (finalPlan.cloudflare_config?.waf?.managed_rules || "").trim().length > 0 ||
    (finalPlan.cloudflare_config?.rate_limiting?.threshold || "").trim().length > 0;

  if (shouldValidateScopes) {
    const wafScope = finalPlan.cloudflare_config?.waf?.scope;
    const rlScope = finalPlan.cloudflare_config?.rate_limiting?.scope;

    if (!isValidScope(wafScope)) {
      finalPlan.cloudflare_config.waf.scope = "";
      missing.push("waf_scope");
    }
    if (!isValidScope(rlScope)) {
      finalPlan.cloudflare_config.rate_limiting.scope = "";
      missing.push("rate_scope");
    }
  }

  const shouldAsk =
    intent.intent !== "explain" &&
    (intent.needs_clarification || !classification.inScope || classification.topic === "general" || missing.length > 0);

  if (shouldAsk) {
    const followups = await generateFollowUps(env, {
      goal: intentFocus,
      topic: finalPlan.topic as any,
      answers,
      intent: "configure",
      missing,
    });
    finalPlan.follow_up_questions = followups.slice(0, 2);
  }

  const pendingQuestions = Array.isArray(finalPlan.follow_up_questions) ? finalPlan.follow_up_questions : [];

  return {
    plan: finalPlan,
    pendingQuestions,
    lastPlanJson: JSON.stringify(finalPlan, null, 2),
  };
};
