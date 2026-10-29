import { projects } from "@/server/costs/catalog";
import { credentials, getJson } from "@/server/costs/credentials";
import type { OrgInfo, OrgWeights, Period, ProviderResult } from "@/server/costs/types";

type Org = { id: string; name: string; slug?: string };
type Membership = { public_user_data: { user_id: string } };
type User = { id: string; last_active_at: number | null };

async function listAll<T>(secret: string, path: string): Promise<T[]> {
  const items: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const sep = path.includes("?") ? "&" : "?";
    const page = await getJson<T[] | { data: T[] }>(
      `https://api.clerk.com/v1/${path}${sep}limit=500&offset=${offset}`,
      { headers: { Authorization: `Bearer ${secret}` } },
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

  await Promise.all(
    projects.map(async (project) => {
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
    }),
  );

  // Dev instances only contribute org names, so their org-tagged costs reach a client.
  await Promise.all(
    projects.map(async (project) => {
      if (!project.clerkDevSecretEnv) return;
      const secret = credentials.env(project.clerkDevSecretEnv);
      if (!secret) {
        warnings.push(`Clerk: falta ${project.clerkDevSecretEnv} (dev de ${project.label})`);
        return;
      }
      for (const org of await listAll<Org>(secret, "organizations")) {
        orgs.push({ orgId: org.id, projectId: project.id, name: org.name, slug: org.slug, activeUsers: 0, dev: true });
      }
    }),
  );

  return { lines: [], orgs, weights, warnings };
}
