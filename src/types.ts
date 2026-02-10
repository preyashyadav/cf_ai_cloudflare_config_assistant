import type { DurableObject } from "cloudflare:workers";

export type PendingQuestion = { key: string; question: string };

export type ConfigState = {
  goal?: string;
  answers: Record<string, string>;
  lastPlan?: string;
  pendingQuestions?: PendingQuestion[];
  followups?: string[];
};

export interface Env {
  MY_DURABLE_OBJECT: DurableObjectNamespace<DurableObject>;
  AI: Ai;
  CF_DOCS: VectorizeIndex;
  ASSETS: Fetcher;
  AUTH0_DOMAIN?: string;
  AUTH0_AUDIENCE?: string;
  AUTH0_CLIENT_ID?: string;
  AUTH0_ALLOW_GUEST?: string;
}
