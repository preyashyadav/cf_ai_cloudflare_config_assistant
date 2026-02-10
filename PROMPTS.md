# AI Prompts Used

This file lists prompts used for AI-assisted coding:

## Development Prompts (AI-assisted coding)
Short, representative prompts used during development and refactor.

- **Initial build/ suggestions**
  - “Set up a basic roadmap to build Cloudflare Workers app with Durable Objects, Workers AI (Llama 3.3), Vectorize for RAG, and a chat UI.”
  - TODO: Add the tradeoffs Prompt
- **Features**
  - “Help me refactor the shareable chat link feature that expires in 24 hours and works without auth.”
  - “Add a download chat transcript feature (TXT) from the UI”
  - “Suggest some good icon support libraries for the UI (mic, gear, actions)”
- **Bug fixes**
  - “Fix guest mode so goals can be set without auth and preserve chats on reload.”
  - “Ensure the welcome suggestions are clickable and persist after refresh.”
- **Refactor**
  - “Split `index.ts` into worker handler, DO logic, share logic, and planning modules. Keep behavior the same. Stick to my refacto files, just improve the modularity”
  - “Extract the system prompt and JSON helpers into their own files.”
- **Docs**
  - “Analyze my README with setup, local dev, deployment steps - provide suggestions of improvement”

---

## Deployment Prompts (AI-assisted ops)
Short, representative prompts used when deploying and configuring the app.

- “Getting some deployment errors, suggest fixes”
- “Sugegst a fix for Durable Object deployment for free plan by switching to `new_sqlite_classes` migration”
- “Auth0 login fails in prod—list required Worker secrets and Auth0 dashboard callback URLs”

---
