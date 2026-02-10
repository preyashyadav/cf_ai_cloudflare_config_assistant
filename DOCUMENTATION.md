# Cloudflare Config Assistant — Detailed Documentation

> Project: `cf_ai_config_assistant`
> 
> This document is a deep, file-level walkthrough of the project: purpose, architecture, request flow, core modules, UI behavior, and operational details.

---

## 1) Purpose and Scope

This app is a **Cloudflare configuration copilot**. It turns a user’s goal (e.g., “Secure my /api/login” or “Set up DNS”) into a **safe, structured, actionable plan**.

Key goals:
- Provide **goal → follow‑up → plan** flow with a consistent JSON schema.
- Ground recommendations in **Cloudflare documentation** via **Vectorize RAG**.
- Maintain per‑chat state using **Durable Objects**.
- Offer a fast, modern UI with **chat, voice input, share links, and transcript download**.
- Enforce safety guardrails for sensitive endpoints (e.g., `/login`, `/api/login`).

---

## 2) High‑Level Architecture

**Runtime:** Cloudflare Workers + Durable Objects + Workers AI + Vectorize

**Flow summary:**
1. UI sends a user goal or follow‑up question.
2. Worker authenticates (Auth0 or guest) and forwards `/api/*` to a Durable Object instance.
3. Durable Object stores state, pulls doc context from Vectorize, calls Workers AI to generate a JSON plan.
4. Plan is normalized, guarded by policy, and returned to UI.
5. UI renders plan, requests follow‑ups if required, and stores chat history locally.

---

## 3) Project Structure

```
cf_ai_config_assistant/
├── src/
│   ├── worker/handler.ts          # Worker entry: routing, auth, share, assets
│   ├── do/config_assistant_do.ts  # Durable Object: state + planning
│   ├── planning/                  # prompt, parsing, normalization, guardrails
│   ├── docs/                      # ingest, embeddings, retrieval
│   ├── classifiers/               # goal/intent classifiers
│   ├── share/                     # shareable link handlers
│   ├── auth/                      # Auth0 JWT verification
│   └── bootstrap_docs.ts          # docs list for RAG bootstrap
├── public/                        # UI (chat + voice)
├── wrangler.jsonc
├── package.json
├── PROMPTS.md
├── README.md
└── Documentation.md               # (this file)
```

---

## 4) Worker Entry + Routing

**File:** `src/worker/handler.ts`

Responsibilities:
- **Routes** requests to:
  - `/share` and `/share/:id` (public share links)
  - `/auth/config` (Auth0 config + guest mode)
  - `/ping` health check
  - `/api/*` forwarded to Durable Object
  - static assets via `ASSETS`
- **Auth:** checks bearer token (Auth0) or guest mode
- **Forwarding:** all `/api/*` calls go to the DO stub with path stripped of `/api`

Key behaviors:
- Guest mode allowed if `AUTH0_ALLOW_GUEST=true` and `x-guest: 1` header is set.
- Chat routing is per‑user and per‑chat: DO ID is derived from `${userSub}:${chatId}`.

---

## 5) Durable Object (State + Planning)

**File:** `src/do/config_assistant_do.ts`

Responsibilities:
- Persist **per‑chat configuration state** using DO storage.
- Serve API endpoints for goal, answers, plan generation, and ingestion.
- Handle shareable chat payload storage in DO storage.

State model (see `src/types.ts`):
```ts
export type ConfigState = {
  goal?: string;
  answers: Record<string, string>;
  lastPlan?: string;
  pendingQuestions?: PendingQuestion[];
  followups?: string[];
};
```

Key endpoints exposed by DO:
- `POST /set-goal` — save goal and reset state
- `POST /answer` — store follow‑ups or question answers
- `GET /pending-questions` — current follow‑ups needed
- `GET /state` — raw internal state
- `GET /plan` — generate plan via LLM + RAG
- `POST /ingest-bootstrap` — bootstrap doc ingestion
- `POST /ingest-seed` — add minimal seed docs
- `GET /diag` — binding health
- `GET /ping` — DO health check

---

## 6) Planning Pipeline

**File:** `src/planning/generate_plan.ts`

Pipeline overview:
1. Validate goal; return a “Set a goal first” plan if missing.
2. Build context query = goal + followups + answers.
3. Retrieve docs via Vectorize (`retrieveContext`).
4. Run intent classification (LLM + heuristics) and topic classification (keyword rules).
5. Call Workers AI to produce **JSON‑only** plan via system prompt.
6. If JSON invalid, retry once, then attempt repair.
7. If still invalid, use fallback plan.
8. Normalize and enforce policy.
9. Ask follow‑up questions if needed.
10. Return plan + pending questions.

Key planning modules:
- **System prompt & schema:** `src/planning/system_prompt.ts`
- **Normalization:** `src/planning/normalize.ts`
- **Policy enforcement:** `src/planning/policy.ts`
- **Follow‑up generation:** `src/planning/followups.ts`
- **Topic‑based source filtering:** `src/planning/sources.ts`
- **Fallback plans:** `src/planning/fallbacks.ts`
- **JSON helpers:** `src/planning/json_utils.ts`

---

## 7) Safety and Guardrails

**File:** `src/planning/policy.ts`

Hard rules applied after LLM output:
- WAF defaults to **log** mode (safe start).
- For `/login` or `/api/login`:
  - Force **security** topic.
  - WAF + rate limiting scope must target login path.
  - Rate limiting action **must be managed_challenge** (not block).
  - Cache bypass enforced for `/api/login`.
- Rollout and metrics arrays are normalized for configure‑intent.

**System prompt also enforces:**
- JSON output only, no markdown.
- Login/auth endpoints must **never be cached**.
- Scope must be exact path expression.
- “explain” intent should avoid config steps.

---

## 8) Goal + Intent Classification

**Files:**
- `src/classifiers/goal_classifier.ts`
- `src/classifiers/intent_classifier.ts`

### Goal classifier (keyword‑based)
- Topics: `dns`, `security`, `workers`, `performance`, `general`.
- Uses keyword patterns to infer topic and scope suitability.

### Intent classifier (LLM + fallback)
- Intents: `explain`, `configure`, `troubleshoot`, `unknown`.
- LLM JSON response used if valid; fallback heuristic is applied otherwise.

---

## 9) RAG / Docs Pipeline

**Files:**
- `src/docs/ingest.ts`
- `src/docs/embeddings.ts`
- `src/docs/text.ts`
- `src/bootstrap_docs.ts`

### Ingestion
- Bootstrap docs list in `bootstrap_docs.ts`.
- Fetches HTML from **developers.cloudflare.com** only (allowlist).
- Strips HTML, chunks text, embeds via Workers AI, and upserts into Vectorize.

### Retrieval
- Given a query, embeds it and runs Vectorize `topK` search.
- Builds a context string of top matches (title, URL, excerpt).
- If low confidence, falls back to **Foundation** docs and merges.

### Embeddings
- Model: `@cf/baai/bge-base-en-v1.5`.

---

## 10) Shareable Links

**File:** `src/share/index.ts`

How it works:
- `POST /share` generates a share ID, stores payload in DO storage, returns URL.
- `GET /share/:id` renders a public HTML page with messages.
- Share data expires after 24 hours (enforced in DO).

---

## 11) Frontend UI

**Files:**
- `public/index.html`
- `public/css/app.css`
- `public/js/app.js`
- `public/js/modules/*`

### UI features
- Chat UI with sidebar and multi‑chat list (localStorage).
- Voice input via Web Speech API.
- Share and download chat transcript.
- Settings drawer with status, sources, latest plan JSON.
- Auth0 login and guest mode.

### Core modules
- `api.js`: fetch wrapper that adds `chatId`, auth token, guest header.
- `auth.js`: Auth0 SDK loading, login/logout, token retrieval.
- `state.js`: client state + chat persistence.
- `plan.js`: plan JSON → HTML rendering.
- `ui.js`: rendering, chat list, status indicators, drawer.
- `dom.js`: HTML helpers and linkification.

---

## 12) API Endpoints

### Worker‑level
- `GET /ping` — Worker health
- `GET /auth/config` — Auth0 config + guest flag
- `POST /share` — create shareable link
- `GET /share/:id` — public share page

### Durable Object
- `POST /set-goal`
- `POST /answer`
- `GET /plan`
- `GET /pending-questions`
- `GET /state`
- `POST /ingest-bootstrap`
- `POST /ingest-seed`
- `GET /diag`
- `GET /ping`

---

## 13) Auth and Guest Mode

**File:** `src/auth/jwt.ts`

- Auth uses Auth0 RS256 JWTs with JWKS fetch + cache.
- Auth is optional if guest mode is enabled.
- Guest is triggered when:
  - No bearer token provided
  - `AUTH0_ALLOW_GUEST=true`
  - Header `x-guest: 1` is present

Client side uses `public/js/modules/auth.js` to load Auth0 and request tokens.

---

## 14) Environment Variables

**Files:** `.env.example`, `.dev.vars.example`

- `AUTH0_DOMAIN`
- `AUTH0_CLIENT_ID`
- `AUTH0_AUDIENCE`
- `AUTH0_ALLOW_GUEST`

Bindings (via `wrangler.jsonc`):
- `AI` (Workers AI)
- `CF_DOCS` (Vectorize index)
- `MY_DURABLE_OBJECT` (DO binding)
- `ASSETS` (static assets)

---

## 15) Wrangler Configuration

**File:** `wrangler.jsonc`

Notable settings:
- `compatibility_date`: `2026-02-05`
- `compatibility_flags`: `nodejs_compat`
- Durable Object uses SQLite‑backed class migration (`new_sqlite_classes`).
- Cron trigger: `0 16 * * *` (daily scheduled ingestion via DO).

---

## 16) Deployment & Local Dev

**Scripts (package.json):**
- `npm run dev` — run worker locally
- `npm run deploy` — deploy
- `npm run cf-typegen` — generate types

**Local setup:**
1. `npm install`
2. `cp .dev.vars.example .dev.vars`
3. `cp .env.example .env`
4. `wrangler vectorize create cf-config-docs --dimensions=768 --metric=cosine`
5. `npm run dev`

---

## 17) Data Storage & Persistence

- Durable Object stores per‑chat `ConfigState` and share payloads.
- UI stores chat history in browser `localStorage` by user/guest key.
- Plan JSON is returned by DO and cached in UI state.

---

## 18) Known Constraints / Assumptions

- LLM output must be valid JSON to parse; fallback plans used otherwise.
- Doc ingestion uses HTML scraping; complex docs may require improved parsing.
- Local chat history is not synced server‑side (client‑side only).
- Auth0 requires correct dashboard configuration for callback/logout URLs.

---

## 19) File Index (by purpose)

**Core runtime**
- `src/index.ts`
- `src/types.ts`

**Worker / routing**
- `src/worker/handler.ts`

**Durable Object**
- `src/do/config_assistant_do.ts`

**Planning**
- `src/planning/generate_plan.ts`
- `src/planning/system_prompt.ts`
- `src/planning/normalize.ts`
- `src/planning/policy.ts`
- `src/planning/followups.ts`
- `src/planning/sources.ts`
- `src/planning/fallbacks.ts`
- `src/planning/json_utils.ts`

**Docs / RAG**
- `src/docs/ingest.ts`
- `src/docs/embeddings.ts`
- `src/docs/text.ts`
- `src/bootstrap_docs.ts`

**Classifiers**
- `src/classifiers/goal_classifier.ts`
- `src/classifiers/intent_classifier.ts`

**Auth**
- `src/auth/jwt.ts`

**Share**
- `src/share/index.ts`

**Frontend**
- `public/index.html`
- `public/css/app.css`
- `public/js/app.js`
- `public/js/modules/api.js`
- `public/js/modules/auth.js`
- `public/js/modules/state.js`
- `public/js/modules/plan.js`
- `public/js/modules/ui.js`
- `public/js/modules/dom.js`

**Config / Docs**
- `wrangler.jsonc`
- `package.json`
- `PROMPTS.md`
- `.env.example`
- `.dev.vars.example`
- `tsconfig.json`
- `worker-configuration.d.ts`

---

## 20) Suggested Next Improvements (Optional)

If you want to extend the project, these are natural directions:
1. Add server‑side chat persistence to replace localStorage only.
2. Add a structured evaluator for plan quality/consistency.
3. Expand docs ingestion with a crawler or incremental update pipeline.
4. Provide UI/UX for follow‑up question threads and history across sessions.

---

## 21) Related Docs

- `README.md` — main project overview and setup steps
- `PROMPTS.md` — AI prompts used during development

---

*End of documentation.*
