import { DurableObject } from "cloudflare:workers";
import { ingestBootstrapDocs, ingestSeedDocs } from "../docs/ingest";
import type { ConfigState, Env } from "../types";
import { generatePlan } from "../planning/generate_plan";
import { handleShareGet, handleShareStore } from "../share";

export class ConfigAssistantDO extends DurableObject {
  private stateData: ConfigState = { answers: {} };

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    state.blockConcurrencyWhile(async () => {
      const saved = await state.storage.get<ConfigState>("state");
      if (saved) this.stateData = saved;
    });
  }

  private async persist() {
    await this.ctx.storage.put("state", this.stateData);
  }

  async setGoal(goal: string) {
    this.stateData.goal = goal;
    this.stateData.answers = {};
    this.stateData.pendingQuestions = [];
    this.stateData.followups = [];
    this.stateData.lastPlan = undefined;
    await this.persist();
    return { ok: true, goal };
  }

  async setAnswer(key: string, value: string) {
    if (key === "followup") {
      if (!Array.isArray(this.stateData.followups)) this.stateData.followups = [];
      this.stateData.followups.push(value);
      if (this.stateData.followups.length > 10) {
        this.stateData.followups = this.stateData.followups.slice(-10);
      }
      this.stateData.answers[key] = value;
    } else {
      this.stateData.answers[key] = value;
    }
    await this.persist();
    return { ok: true };
  }

  async getPendingQuestions() {
    return { questions: this.stateData.pendingQuestions ?? [] };
  }

  async getState() {
    return this.stateData;
  }

  async generatePlan(env: Env) {
    const { plan, pendingQuestions, lastPlanJson } = await generatePlan(env, this.stateData);
    this.stateData.pendingQuestions = pendingQuestions;
    this.stateData.lastPlan = lastPlanJson;
    await this.persist();
    return plan;
  }

  async fetch(request: Request) {
    try {
      const url = new URL(request.url);
      const method = request.method.toUpperCase();
      const env = this.env as Env;

      if (url.pathname === "/share-store" && method === "POST") {
        return await handleShareStore(this.ctx.storage, request);
      }

      if (url.pathname === "/share-get" && method === "GET") {
        return await handleShareGet(this.ctx.storage);
      }

      if (url.pathname === "/ping") {
        return new Response(JSON.stringify({ ok: true, where: "DO" }), {
          headers: { "content-type": "application/json" },
        });
      }

      if (url.pathname === "/diag") {
        return new Response(
          JSON.stringify({
            hasDO: true,
            hasAI: !!env.AI,
            hasVectorize: !!env.CF_DOCS,
          }),
          { headers: { "content-type": "application/json" } }
        );
      }

      if (url.pathname === "/ingest-seed" && method === "POST") {
        return new Response(JSON.stringify(await ingestSeedDocs(env)), {
          headers: { "content-type": "application/json" },
        });
      }

      if (url.pathname === "/ingest-bootstrap" && method === "POST") {
        return new Response(JSON.stringify(await ingestBootstrapDocs(env)), {
          headers: { "content-type": "application/json" },
        });
      }

      if (url.pathname === "/set-goal" && method === "POST") {
        const body = (await request.json()) as { goal?: unknown };
        if (typeof body.goal !== "string" || !body.goal.trim()) {
          return new Response(JSON.stringify({ ok: false, error: "Missing goal" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify(await this.setGoal(body.goal.trim())), {
          headers: { "content-type": "application/json" },
        });
      }

      if (url.pathname === "/answer" && method === "POST") {
        const body = (await request.json()) as { key?: unknown; value?: unknown };
        if (typeof body.key !== "string" || !body.key.trim()) {
          return new Response(JSON.stringify({ ok: false, error: "Missing key" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        if (typeof body.value !== "string" || !body.value.trim()) {
          return new Response(JSON.stringify({ ok: false, error: "Missing value" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify(await this.setAnswer(body.key.trim(), body.value.trim())), {
          headers: { "content-type": "application/json" },
        });
      }

      if (url.pathname === "/pending-questions" && method === "GET") {
        return new Response(JSON.stringify(await this.getPendingQuestions()), {
          headers: { "content-type": "application/json" },
        });
      }

      if (url.pathname === "/state" && method === "GET") {
        return new Response(JSON.stringify(await this.getState()), {
          headers: { "content-type": "application/json" },
        });
      }

      if (url.pathname === "/plan" && method === "GET") {
        return new Response(JSON.stringify(await this.generatePlan(env)), {
          headers: { "content-type": "application/json" },
        });
      }

      return new Response("Not found", { status: 404 });
    } catch (e: any) {
      return new Response(
        JSON.stringify({
          ok: false,
          where: "DO.fetch",
          error: e?.message ?? String(e),
          stack: e?.stack ? String(e.stack).slice(0, 1200) : undefined,
        }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }
  }
}
