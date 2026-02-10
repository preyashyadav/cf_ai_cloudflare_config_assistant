import type { Env } from "../types";

type JwtHeader = { alg?: string; kid?: string };
type JwtPayload = {
  sub?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  [k: string]: any;
};

const textEncoder = new TextEncoder();

const base64UrlToBytes = (input: string): Uint8Array => {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 ? "=".repeat(4 - (base64.length % 4)) : "";
  const str = atob(base64 + pad);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
};

const decodeJson = (b64: string) => JSON.parse(new TextDecoder().decode(base64UrlToBytes(b64)));

const parseJwt = (token: string): { header: JwtHeader; payload: JwtPayload; signingInput: string; signature: Uint8Array } => {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token");
  const [h, p, s] = parts;
  return {
    header: decodeJson(h),
    payload: decodeJson(p),
    signingInput: `${h}.${p}`,
    signature: base64UrlToBytes(s),
  };
};

let jwksCache: { fetchedAt: number; keys: JsonWebKey[] } = { fetchedAt: 0, keys: [] };
const JWKS_TTL_MS = 60 * 60 * 1000;

const fetchJwks = async (domain: string): Promise<JsonWebKey[]> => {
  const now = Date.now();
  if (jwksCache.keys.length && now - jwksCache.fetchedAt < JWKS_TTL_MS) return jwksCache.keys;
  const res = await fetch(`https://${domain}/.well-known/jwks.json`);
  if (!res.ok) throw new Error("Failed to fetch JWKS");
  const json = await res.json();
  const keys = Array.isArray(json?.keys) ? json.keys : [];
  jwksCache = { fetchedAt: now, keys };
  return keys;
};

const getKey = async (domain: string, kid?: string): Promise<CryptoKey> => {
  const keys = await fetchJwks(domain);
  const jwk = keys.find((k) => k.kid === kid);
  if (!jwk) throw new Error("JWKS kid not found");
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
};

const audOk = (aud: string | string[] | undefined, expected: string): boolean => {
  if (!aud) return false;
  if (Array.isArray(aud)) return aud.includes(expected);
  return aud === expected;
};

export const verifyAuth0Jwt = async (token: string, env: Env): Promise<JwtPayload> => {
  const domain = env.AUTH0_DOMAIN;
  const audience = env.AUTH0_AUDIENCE;
  if (!domain || !audience) throw new Error("Auth0 not configured");

  const { header, payload, signingInput, signature } = parseJwt(token);
  if (header.alg !== "RS256") throw new Error("Unsupported alg");

  const key = await getKey(domain, header.kid);
  const ok = await crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    signature,
    textEncoder.encode(signingInput)
  );
  if (!ok) throw new Error("Invalid signature");

  const issuer = `https://${domain}/`;
  if (payload.iss !== issuer) throw new Error("Bad issuer");
  if (!audOk(payload.aud, audience)) throw new Error("Bad audience");
  if (payload.exp && Date.now() / 1000 > payload.exp) throw new Error("Token expired");

  return payload;
};
