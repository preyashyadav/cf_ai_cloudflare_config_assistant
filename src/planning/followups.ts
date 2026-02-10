import type { Env } from "../types";
import type { GoalTopic } from "../classifiers/goal_classifier";

export type PendingQuestion = { key: string; question: string };

const isPlainObject = (x: any) => x && typeof x === "object" && !Array.isArray(x);

const safeJsonParse = (raw: string): any | null => {
  try {
    const v = JSON.parse(raw);
    return isPlainObject(v) ? v : null;
  } catch {
    // attempt extract
    const start = raw.indexOf("{");
    if (start === -1) return null;
    let depth = 0,
      inString = false,
      esc = false;
    for (let i = start; i < raw.length; i++) {
      const ch = raw[i];
      if (inString) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
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
        const slice = raw.slice(start, i + 1);
        try {
          const v2 = JSON.parse(slice);
          return isPlainObject(v2) ? v2 : null;
        } catch {
          return null;
        }
      }
    }
    return null;
  }
};

const normalize = (x: any): PendingQuestion[] => {
  const arr = Array.isArray(x?.follow_up_questions) ? x.follow_up_questions : [];
  return arr
    .map((q: any) => ({
      key: String(q?.key ?? "").trim(),
      question: String(q?.question ?? "").trim(),
    }))
    .filter((q: any) => q.key && q.question)
    .slice(0, 2);
};

export const generateFollowUps = async (
  env: Env,
  args: {
    goal: string;
    topic: GoalTopic;
    answers: Record<string, string>;
    intent: "explain" | "howto" | "configure";
    missing?: string[];
  }
): Promise<PendingQuestion[]> => {
  const { goal, topic, answers, intent } = args;
  const missing = Array.isArray(args.missing) ? args.missing : [];

  // TODO: Reasses follow up logic
  if (intent !== "configure") return [];

  const system = `
You are generating follow-up questions for a Cloudflare configuration assistant.

Rules:
- Output VALID JSON ONLY. No markdown.
- Ask at most 2 questions.
- Questions must be broadly applicable (no "GoDaddy vs Cloudflare" assumptions).
- Questions should only ask for info that is truly required to produce a correct Cloudflare plan.
- If enough info already exists, return an empty array.
- If Missing info is provided, prioritize asking about those items.

Return schema:
{ "follow_up_questions": { "key": string, "question": string }[] }

Key conventions:
- Use snake_case keys.
- Prefer keys like: dns_provider, domain, protected_path, traffic, app_type, routes, cache_goal, mail_provider, has_dnssec.

Topic guidance:
- dns: ask where DNS is hosted (provider/registrar), domain, email provider/records, dnssec status.
- security: ask critical endpoint/path and rough traffic; avoid asking for too much.
- workers: ask what they're deploying + routes.
- performance: ask site type + what they optimize for.
`.trim();

  const user = `
Goal: ${goal}
Topic: ${topic}
Known answers: ${JSON.stringify(answers)}
Missing info: ${JSON.stringify(missing)}
`.trim();

  const res = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const raw =
    typeof res === "object" && res && "response" in res ? String((res as any).response) : String(res);

  const parsed = safeJsonParse(raw);
  return parsed ? normalize(parsed) : [];
};
