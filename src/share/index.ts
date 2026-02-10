import type { Env } from "../types";

type ShareMessage = { role: string; text: string };

type SharePayload = {
  title: string;
  messages: ShareMessage[];
  createdAt: number;
  expiresAt: number;
};

const sanitizeTitle = (title: unknown) =>
  typeof title === "string" ? title.slice(0, 120) : "Shared chat";

const sanitizeMessages = (messages: unknown): ShareMessage[] => {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((m: any) => ({
      role: String(m?.role || "user"),
      text: String(m?.text || "").slice(0, 8000),
    }))
    .filter((m: ShareMessage) => m.text.trim().length > 0)
    .slice(0, 200);
};

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderSharePage = (payload: SharePayload) => {
  const title = sanitizeTitle(payload.title);
  const rows = payload.messages
    .map((m) => {
      const role = String(m?.role || "user");
      const text = escapeHtml(String(m?.text || ""));
      return `<div class="row ${role}"><div class="bubble"><div class="role">${role}</div><div class="text">${text}</div></div></div>`;
    })
    .join("");

  const expLine = payload.expiresAt
    ? `<div class="meta">Link expires: ${new Date(payload.expiresAt).toLocaleString()}</div>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        color: #e8eefc;
        background: radial-gradient(1000px 700px at 25% 10%, rgba(255, 138, 0, 0.12), transparent 55%),
                    radial-gradient(1000px 700px at 80% 25%, rgba(255, 77, 77, 0.10), transparent 55%),
                    #0b1220;
      }
      .wrap { max-width: 900px; margin: 0 auto; padding: 24px 16px 40px; }
      .title { font-weight: 900; font-size: 20px; margin-bottom: 6px; }
      .meta { color: rgba(232,238,252,0.7); font-size: 12px; margin-bottom: 16px; }
      .row { display: flex; margin: 10px 0; }
      .row.user { justify-content: flex-end; }
      .bubble {
        max-width: 78%;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.05);
        padding: 10px 12px;
        border-radius: 14px;
        line-height: 1.45;
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 14px;
      }
      .row.user .bubble { border-color: rgba(255, 138, 0, 0.35); background: rgba(255, 138, 0, 0.12); }
      .role { font-size: 11px; text-transform: capitalize; opacity: 0.7; margin-bottom: 4px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="title">${escapeHtml(title)}</div>
      ${expLine}
      ${rows || '<div class="meta">No messages.</div>'}
    </div>
  </body>
</html>`;
};

export const handleShareStore = async (
  storage: DurableObjectStorage,
  request: Request
): Promise<Response> => {
  const body = (await request.json()) as {
    title?: unknown;
    messages?: unknown;
    createdAt?: unknown;
    expiresAt?: unknown;
  };
  const title = sanitizeTitle(body?.title);
  const messages = sanitizeMessages(body?.messages);
  const createdAt = typeof body?.createdAt === "number" ? body.createdAt : Date.now();
  const expiresAt = typeof body?.expiresAt === "number" ? body.expiresAt : createdAt + 24 * 60 * 60 * 1000;

  await storage.put("share", { title, messages, createdAt, expiresAt });

  return new Response(JSON.stringify({ ok: true, expiresAt }), {
    headers: { "content-type": "application/json" },
  });
};

export const handleShareGet = async (storage: DurableObjectStorage): Promise<Response> => {
  const payload = await storage.get<SharePayload>("share");
  if (!payload) {
    return new Response(JSON.stringify({ ok: false, error: "Not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }
  const expiresAt = Number(payload?.expiresAt || 0);
  if (expiresAt && Date.now() > expiresAt) {
    await storage.delete("share");
    return new Response(JSON.stringify({ ok: false, error: "Expired" }), {
      status: 410,
      headers: { "content-type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ ok: true, ...payload }), {
    headers: { "content-type": "application/json" },
  });
};

export const handleShareCreate = async (request: Request, env: Env): Promise<Response> => {
  const body = (await request.json()) as { title?: unknown; messages?: unknown };
  const title = sanitizeTitle(body?.title);
  const messages = sanitizeMessages(body?.messages);
  const createdAt = Date.now();
  const expiresAt = createdAt + 24 * 60 * 60 * 1000;

  const shareId = crypto.randomUUID();
  const id = env.MY_DURABLE_OBJECT.idFromName(`share:${shareId}`);
  const stub = env.MY_DURABLE_OBJECT.get(id);
  const stored = await stub.fetch("https://do/share-store", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title, messages, createdAt, expiresAt }),
  });
  if (!stored.ok) {
    return new Response(JSON.stringify({ ok: false, error: "Share failed" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const url = new URL(request.url);
  return new Response(
    JSON.stringify({
      ok: true,
      id: shareId,
      url: `${url.origin}/share/${shareId}`,
      expiresAt,
    }),
    { headers: { "content-type": "application/json" } }
  );
};

export const handleSharePage = async (request: Request, env: Env): Promise<Response> => {
  const url = new URL(request.url);
  const shareId = url.pathname.split("/")[2] || "";
  if (!/^[a-zA-Z0-9-]+$/.test(shareId)) {
    return new Response("Invalid share id", { status: 400 });
  }
  const id = env.MY_DURABLE_OBJECT.idFromName(`share:${shareId}`);
  const stub = env.MY_DURABLE_OBJECT.get(id);
  const res = await stub.fetch("https://do/share-get");
  if (!res.ok) {
    return new Response("Share not found or expired.", { status: res.status });
  }
  const data = (await res.json()) as SharePayload & { ok?: boolean };

  const html = renderSharePage({
    title: data.title,
    messages: Array.isArray(data.messages) ? data.messages : [],
    createdAt: Number(data.createdAt || 0),
    expiresAt: Number(data.expiresAt || 0),
  });

  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
};
