import type { Env } from "../types";

export type IntentLabel = "explain" | "configure" | "troubleshoot" | "unknown";

export type IntentResult = {
  intent: IntentLabel;
  needs_clarification: boolean;
  clarifying_question?: string;
};

const heuristicIntent = (goalText: string): IntentLabel => {
  const g = String(goalText || "").toLowerCase();
  if (!g.trim()) return "unknown";

  if (
    /\bwhat is\b|\bwhat's\b|\bdefine\b|\bexplain\b|\bmeaning of\b|\bhow does\b|\bwhat does\b/i.test(
      g
    )
  ) {
    return "explain";
  }

  if (/\bfix\b|\btroubleshoot\b|\bdebug\b|\bissue\b|\berror\b|\bfailing\b/i.test(g)) {
    return "troubleshoot";
  }

  if (
    /\bset up\b|\bconfigure\b|\benable\b|\bdisable\b|\bmigrate\b|\bchange\b|\bmove\b|\bsecure\b|\bprotect\b/i.test(
      g
    )
  ) {
    return "configure";
  }

  return "unknown";
};

const safeJsonParse = (raw: string): any | null => {
  try {
    return JSON.parse(raw);
  } catch {}
  const start = raw.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
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
    if (depth === 0) {
      try {
        return JSON.parse(raw.slice(start, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
};

export const classifyIntent = async (
  env: Env,
  goalText: string,
  answers: Record<string, string>
): Promise<IntentResult> => {
  const fallback: IntentResult = { intent: heuristicIntent(goalText), needs_clarification: false };

  try {
    const messages = [
      {
        role: "system" as const,
        content:
          "Classify the user's intent for a Cloudflare assistant. " +
          'Return ONLY JSON: {"intent":"explain|configure|troubleshoot|unknown","needs_clarification":boolean,"clarifying_question":string?}. ' +
          "Use needs_clarification when the request is ambiguous or out of Cloudflare scope.",
      },
      {
        role: "user" as const,
        content: `Goal: ${goalText}\nAnswers: ${JSON.stringify(answers)}`,
      },
    ];

    const res = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", { messages });
    const raw =
      typeof res === "object" && res && "response" in res ? String((res as any).response) : String(res);
    const parsed = safeJsonParse(raw);

    const intent = String(parsed?.intent || "").toLowerCase();
    const needs = Boolean(parsed?.needs_clarification);
    const question = typeof parsed?.clarifying_question === "string" ? parsed.clarifying_question : undefined;

    if (intent === "explain" || intent === "configure" || intent === "troubleshoot" || intent === "unknown") {
      return { intent, needs_clarification: needs, clarifying_question: question };
    }
  } catch {}

  return fallback;
};
