import { projects } from "@/server/costs/catalog";
import { credentials } from "@/server/costs/credentials";
import type { OrgInfo, OrgWeights, Period, ProviderResult } from "@/server/costs/types";

type Org = { id: string; name: string; slug?: string };
type Membership = { public_user_data: { user_id: string } };
type User = { id: string; last_active_at: number | null };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Clerk rate-limits per instance; one membership call per org adds up, so back off on 429. */
async function clerkGet<T>(secret: string, url: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${secret}` } });
    if (res.status === 429 && attempt < 4) {
      await sleep(Number(res.headers.get("retry-after") ?? 1) * 1000 * (attempt + 1));
      continue;
    }
    if (!res.ok) {
      throw new Error(`GET ${new URL(url).pathname} → ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
  }
}

async function listAll<T>(secret: string, path: string): Promise<T[]> {
  const items: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const sep = path.includes("?") ? "&" : "?";
    const page = await clerkGet<T[] | { data: T[] }>(
      secret,
      `https://api.clerk.com/v1/${path}${sep}limit=500&offset=${offset}`,
    );
    const data = Array.isArray(page) ? page : page.data;
    items.push(...data);
    if (data.length < 500) return items;
  }
}

/**
 * Lists every org of every app and counts its active users in the period.
 * Clerk only exposes each user's *latest* activity, so for past months the
 * count undercounts users that were also active later — exact for the current month.
 */
export async function clerkOrgs(period: Period): Promise<ProviderResult> {
  const orgs: OrgInfo[] = [];
  const weights: OrgWeights[] = [];
  const warnings: string[] = [];

  // One app failing (bad key, outage) must not hide every other app's orgs.
  const guarded = (label: string, fn: () => Promise<void>) =>
    fn().catch((err: Error) => {
      console.error(`[costos] Clerk ${label}:`, err.message);
      warnings.push(`Clerk (${label}): ${err.message}`);
    });

  await Promise.all(
    projects.map((project) => guarded(project.label, async () => {
      if (!project.clerkSecretEnv) return;
      const secret = credentials.env(project.clerkSecretEnv);
      if (!secret) {
        warnings.push(`Clerk: falta ${project.clerkSecretEnv} (${project.label})`);
        return;
      }
      if (secret.startsWith("sk_test_")) {
        warnings.push(`Clerk: ${project.clerkSecretEnv} es una key de desarrollo`);
      }

      const users = await listAll<User>(secret, "users");
      const active = new Set(
        users
          .filter((u) => u.last_active_at && u.last_active_at >= period.from.getTime())
          .map((u) => u.id),
      );

      if (project.singleTenant) {
        orgs.push({ orgId: project.id, projectId: project.id, name: project.label, activeUsers: active.size });
        return;
      }

      const projectOrgs = await listAll<Org>(secret, "organizations");
      const byOrg: Record<string, number> = {};
      for (const org of projectOrgs) {
        const members = await listAll<Membership>(secret, `organizations/${org.id}/memberships`);
        const count = members.filter((m) => active.has(m.public_user_data.user_id)).length;
        orgs.push({ orgId: org.id, projectId: project.id, name: org.name, slug: org.slug, activeUsers: count });
        byOrg[org.id] = count;
      }
      weights.push({ projectId: project.id, metric: "usuarios activos", byOrg });
    })),
  );

  // Dev instances only contribute org names, so their org-tagged costs reach a client.
  await Promise.all(
    projects.map((project) => guarded(`${project.label} dev`, async () => {
      if (!project.clerkDevSecretEnv) return;
      const secret = credentials.env(project.clerkDevSecretEnv);
      if (!secret) {
        warnings.push(`Clerk: falta ${project.clerkDevSecretEnv} (dev de ${project.label})`);
        return;
      }
      for (const org of await listAll<Org>(secret, "organizations")) {
        orgs.push({ orgId: org.id, projectId: project.id, name: org.name, slug: org.slug, activeUsers: 0, dev: true });
      }
    })),
  );

  return { lines: [], orgs, weights, warnings };
}
