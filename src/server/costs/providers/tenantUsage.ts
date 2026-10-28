import { projects } from "@/server/costs/catalog";
import { credentials, getJson } from "@/server/costs/credentials";
import type { OrgWeights, ProviderResult } from "@/server/costs/types";

type Tenant = { clerkOrgId?: string; clerkOrganizationId?: string; approxBytes: number };
type UsageResponse = { workspaces?: Tenant[]; organizations?: Tenant[] };

// The endpoints scan every row of every table, which costs database bandwidth:
// call each one at most once a day.
const TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; byOrg: Record<string, number> }>();

/**
 * Reads the `/internal/cost-usage` endpoint each app exposes: bytes stored per
 * Clerk org. A snapshot of today, not a monthly average.
 */
export async function tenantStorage(): Promise<ProviderResult> {
  const weights: OrgWeights[] = [];
  const warnings: string[] = [];

  await Promise.all(
    projects.map(async (project) => {
      if (!project.usageEndpoint) return;
      const url = credentials.env(project.usageEndpoint.urlEnv);
      const secret = credentials.env(project.usageEndpoint.secretEnv);
      if (!url || !secret) {
        warnings.push(`Uso por org: falta ${project.usageEndpoint.urlEnv} (${project.label})`);
        return;
      }
      const hit = cache.get(project.id);
      if (hit && Date.now() - hit.at < TTL_MS) {
        weights.push({ projectId: project.id, metric: "almacenamiento", byOrg: hit.byOrg });
        return;
      }
      try {
        const body = await getJson<UsageResponse>(url, { headers: { Authorization: `Bearer ${secret}` } });
        const byOrg: Record<string, number> = {};
        for (const t of body.workspaces ?? body.organizations ?? []) {
          const orgId = t.clerkOrgId ?? t.clerkOrganizationId;
          if (orgId) byOrg[orgId] = (byOrg[orgId] ?? 0) + t.approxBytes;
        }
        cache.set(project.id, { at: Date.now(), byOrg });
        weights.push({ projectId: project.id, metric: "almacenamiento", byOrg });
      } catch (err) {
        warnings.push(`Uso por org (${project.label}): ${(err as Error).message}`);
      }
    }),
  );

  return { lines: [], weights, warnings };
}
