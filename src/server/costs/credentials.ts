import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Env var first. In local dev, fall back to the tokens the provider CLIs
 * already store, so the dashboard runs without minting new credentials.
 */
function fromCliFile(path: string, key: string): string | undefined {
  if (process.env.NODE_ENV === "production") return undefined;
  try {
    return JSON.parse(readFileSync(join(homedir(), path), "utf8"))[key];
  } catch {
    return undefined;
  }
}

export const credentials = {
  vercelToken: () =>
    process.env.VERCEL_TOKEN ?? fromCliFile(".local/share/com.vercel.cli/auth.json", "token"),
  vercelTeamId: () => process.env.VERCEL_TEAM_ID ?? "team_4WuL1BLigiXAWbqGgRd0U1qm",
  aiGatewayKey: () => process.env.AI_GATEWAY_API_KEY,
  convexToken: () => process.env.CONVEX_ACCESS_TOKEN ?? fromCliFile(".convex/config.json", "accessToken"),
  convexTeamId: () => process.env.CONVEX_TEAM_ID ?? "322167",
  planetscaleOrg: () => process.env.PLANETSCALE_ORG ?? "convolution",
  /** Service token as `<id>:<token>`. */
  planetscaleToken: () =>
    process.env.PLANETSCALE_SERVICE_TOKEN_ID && process.env.PLANETSCALE_SERVICE_TOKEN
      ? `${process.env.PLANETSCALE_SERVICE_TOKEN_ID}:${process.env.PLANETSCALE_SERVICE_TOKEN}`
      : undefined,
  postmarkAccountToken: () => process.env.POSTMARK_ACCOUNT_TOKEN,
  env: (name: string) => process.env[name],
};

export class MissingCredential extends Error {
  constructor(what: string) {
    super(`Falta credencial: ${what}`);
  }
}

export function required(value: string | undefined, what: string): string {
  if (!value) throw new MissingCredential(what);
  return value;
}

export async function getJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${new URL(url).host}${new URL(url).pathname} → ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}
