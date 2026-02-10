# Cloudflare Config Assistant (cf_ai_config_assistant)

A production-ready Cloudflare configuration copilot that turns goals into safe, actionable plans. It combines chat + voice input, retrieval-augmented generation, and Durable Objects for stateful planning.

## Live Demo
https://cf_ai_config_assistant.preyashyadav.workers.dev/

## Video Demo
https://youtu.be/IjVhEM3NL_c

---

## Project Overview
This app demonstrates an end-to-end Cloudflare AI workflow:
- **LLM**: Llama 3.3 70B via Workers AI
- **Coordination**: Durable Objects for state and multi-chat
- **User Input**: Chat UI + voice input (Web Speech API)
- **Memory**: DO storage + client localStorage
- **RAG**: Vectorize over Cloudflare docs

The assistant specializes in Cloudflare configuration help (DNS, security, performance, Workers) and applies guardrails for sensitive endpoints.

---

## Features
- Goal → follow-ups → plan flow with structured JSON output
- RAG over official Cloudflare docs
- Voice input with Web Speech API
- Shareable chat links (24h)
- Download chat transcript (TXT)
- Guest mode + Auth0 login
- Clean, fast UI with modern icons

---

## Technology Stack
**Platform**
- Cloudflare Workers
- Durable Objects
- Workers AI
- Vectorize

**Frontend**
- Vanilla JS (ES modules)
- CSS with custom properties
- Web Speech API
- Lucide icons

---

## Project Structure
```
cf_ai_config_assistant/
├── src/
│   ├── worker/handler.ts          # Worker entry: routing, auth, share, assets
│   ├── do/config_assistant_do.ts  # Durable Object: state + planning
│   ├── planning/                  # prompt, parsing, normalization, guardrails
│   ├── docs/                      # ingest, embeddings, retrieval
│   └── share/                     # shareable link handlers
├── public/                        # UI (chat + voice)
├── wrangler.jsonc
├── package.json
├── PROMPTS.md
└── README.md
```

---

## Local Setup

### 1) Install
```bash
npm install
```

### 2) Configure env
```bash
cp .dev.vars.example .dev.vars
cp .env.example .env
```

If you want guest-only mode, set:
```
AUTH0_ALLOW_GUEST=true
```

### 3) Create Vectorize index (one-time)
```bash
wrangler vectorize create cf-config-docs --dimensions=768 --metric=cosine
```

### 4) Run locally
```bash
npm run dev
```

---

## Deployment

```bash
wrangler deploy
```

Deployed URL: **https://cf-ai-config-assistant.preyashyadav.workers.dev**

### Auth0 setup (required for login)
Set Worker secrets (no redeploy needed after this):
```bash
npx wrangler secret put AUTH0_DOMAIN
npx wrangler secret put AUTH0_CLIENT_ID
npx wrangler secret put AUTH0_AUDIENCE
npx wrangler secret put AUTH0_ALLOW_GUEST
```

Auth0 dashboard settings:
- Allowed Callback URLs: `https://<YOUR-WORKER-URL>/auth/callback`
- Allowed Logout URLs: `https://<YOUR-WORKER-URL>`
- Allowed Web Origins: `https://<YOUR-WORKER-URL>`

---

## Environment Variables
Auth0 (optional if guest-only):
- `AUTH0_DOMAIN`
- `AUTH0_CLIENT_ID`
- `AUTH0_AUDIENCE`
- `AUTH0_ALLOW_GUEST`

Bindings (see `wrangler.jsonc`):
- `AI`
- `CF_DOCS`
- `MY_DURABLE_OBJECT`
- `ASSETS`

---

## Assignment Requirements Fulfilled
- **LLM**: Workers AI (Llama 3.3 70B)
- **Workflow/Coordination**: Durable Objects
- **User Input**: Chat + voice input
- **Memory/State**: DO storage + localStorage

---

## API Endpoints (minimal)
Worker:
- `GET /ping` — Worker health check
- `GET /auth/config` — Auth0 config (guest fallback)
- `POST /share` — Create shareable chat link
- `GET /share/:id` — Public share page (24h)

Durable Object (via `/api/*`):
- `POST /api/set-goal`
- `POST /api/answer`
- `GET /api/plan`
- `GET /api/pending-questions`
- `GET /api/state`
- `POST /api/ingest-bootstrap`
- `POST /api/ingest-seed`
- `GET /api/diag`
- `GET /api/ping`

---

## Screenshots
- TODO: ADD SS

---

## PROMPTS
All AI prompts used are listed in `PROMPTS.md`.
