import type { Env } from "../types";

export const embedText = async (env: Env, text: string): Promise<number[]> => {
  const res = await env.AI.run("@cf/baai/bge-base-en-v1.5", { text: [text] });
  const anyRes = res as any;

  if (Array.isArray(anyRes?.data) && Array.isArray(anyRes.data[0])) {
    return anyRes.data[0] as number[];
  }

  throw new Error(`Unexpected embedding response`);
};
