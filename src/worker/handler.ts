import type { Env } from "../types";
import { verifyAuth0Jwt } from "../auth/jwt";
import { handleShareCreate, handleSharePage } from "../share";

const handler: ExportedHandler<Env> = {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        const id = env.MY_DURABLE_OBJECT.idFromName("indexer");
        const stub = env.MY_DURABLE_OBJECT.get(id);
        await stub.fetch("https://do/ingest-bootstrap", { method: "POST" });
      })()
    );
  },
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (url.pathname === "/share" && method === "POST") {
      return await handleShareCreate(request, env);
    }

    if (url.pathname.startsWith("/share/") && method === "GET") {
      return await handleSharePage(request, env);
    }

    if (url.pathname === "/auth/config") {
      const allowGuest =
        env.AUTH0_ALLOW_GUEST == null
          ? true
          : String(env.AUTH0_ALLOW_GUEST || "").toLowerCase() === "true";
      if (!env.AUTH0_DOMAIN || !env.AUTH0_CLIENT_ID || !env.AUTH0_AUDIENCE) {
        if (allowGuest) {
          return new Response(JSON.stringify({ allowGuest }), {
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: false, error: "Auth0 not configured" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          domain: env.AUTH0_DOMAIN,
          clientId: env.AUTH0_CLIENT_ID,
          audience: env.AUTH0_AUDIENCE,
          allowGuest,
        }),
        { headers: { "content-type": "application/json" } }
      );
    }

    if (url.pathname === "/ping") {
      return new Response(JSON.stringify({ ok: true, where: "Worker" }), {
        headers: { "content-type": "application/json" },
      });
    }

    //  /api/* to Durable Object
    if (url.pathname.startsWith("/api/")) {
      try {
        const auth = request.headers.get("authorization") || "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        const allowGuest =
          env.AUTH0_ALLOW_GUEST == null
            ? true
            : String(env.AUTH0_ALLOW_GUEST || "").toLowerCase() === "true";
        const isGuest = !token && allowGuest && request.headers.get("x-guest") === "1";

        let userSub = "";
        if (!token) {
          if (!isGuest) {
            return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
              status: 401,
              headers: { "content-type": "application/json" },
            });
          }
          userSub = "guest";
        } else {
          const payload = await verifyAuth0Jwt(token, env);
          userSub = String(payload.sub || "").trim();
          if (!userSub) {
            return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
              status: 401,
              headers: { "content-type": "application/json" },
            });
          }
        }

        const chatId = url.searchParams.get("chatId")?.trim() || "default";
        const id = env.MY_DURABLE_OBJECT.idFromName(`${userSub}:${chatId}`);
        const stub = env.MY_DURABLE_OBJECT.get(id);

        const forwardUrl = new URL(request.url);
        forwardUrl.pathname = url.pathname.replace("/api", "");

        let body: ArrayBuffer | undefined = undefined;
        if (request.method !== "GET" && request.method !== "HEAD") {
          body = await request.clone().arrayBuffer();
        }

        const forwarded = new Request(forwardUrl.toString(), {
          method: request.method,
          headers: request.headers,
          body,
        });

        return await stub.fetch(forwarded);
      } catch (e: any) {
        return new Response(
          JSON.stringify({
            ok: false,
            where: "Worker/api-forward",
            error: e?.message ?? String(e),
            stack: e?.stack ? String(e.stack).slice(0, 1200) : undefined,
          }),
          { status: 500, headers: { "content-type": "application/json" } }
        );
      }
    }

    if (url.pathname.startsWith("/auth/")) {
      const assetUrl = new URL(request.url);
      assetUrl.pathname = "/index.html";
      return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
    }

    return env.ASSETS.fetch(request);
  },
};

export default handler;
