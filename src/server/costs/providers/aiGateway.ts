import { projectByAiKey } from "@/server/costs/catalog";
import { credentials, getJson, required } from "@/server/costs/credentials";
import type { CostLine, Period, ProviderResult } from "@/server/costs/types";

type ReportRow = { total_cost: number; user?: string; api_key_name?: string };

const ymd = (d: Date) => d.toISOString().slice(0, 10);

async function report(period: Period, groupBy: "user" | "api_key_name"): Promise<ReportRow[]> {
  const key = required(credentials.aiGatewayKey(), "AI_GATEWAY_API_KEY");
  const url = new URL("https://ai-gateway.vercel.sh/v1/report");
  url.searchParams.set("start_date", ymd(period.from));
  url.searchParams.set("end_date", ymd(new Date(period.to.getTime() - 1)));
  url.searchParams.set("group_by", groupBy);
  const { results } = await getJson<{ results: ReportRow[] }>(url.toString(), {
    headers: { Authorization: `Bearer ${key}` },
  });
  return results;
}

/**
 * Requests tagged with `user = clerkOrgId` are measured per org; the org's
 * project is resolved later from the Clerk org list. Untagged spend is split
 * by API key name, which maps to a project but not to an org.
 */
export async function aiGatewayCosts(period: Period): Promise<ProviderResult> {
  const [byUser, byKey] = await Promise.all([report(period, "user"), report(period, "api_key_name")]);
  const lines: CostLine[] = [];
  const warnings: string[] = [];

  for (const row of byUser) {
    if (!row.user || row.total_cost === 0) continue;
    lines.push({
      provider: "ai-gateway",
      category: "Inferencia",
      projectId: null, // resolved from orgId
      orgId: row.user === "no-org" ? null : row.user,
      basis: "measured",
      usd: row.total_cost,
    });
  }

  const untagged = byUser.find((row) => !row.user)?.total_cost ?? 0;
  const keyTotal = byKey.reduce((sum, row) => sum + row.total_cost, 0);
  if (untagged > 0 && keyTotal > 0) {
    // byKey covers tagged and untagged spend; scale it down to the untagged share.
    const share = untagged / keyTotal;
    for (const row of byKey) {
      if (row.total_cost === 0) continue;
      const name = row.api_key_name || "(OIDC / sin key)";
      const projectId = projectByAiKey.get(name) ?? null;
      if (!projectId) warnings.push(`AI Gateway: key "${name}" no está en el catálogo`);
      lines.push({
        provider: "ai-gateway",
        category: `Inferencia sin etiqueta (${name})`,
        projectId,
        orgId: null,
        basis: "measured",
        usd: row.total_cost * share,
        note: "Sin org: falta providerOptions.gateway.user en la llamada",
      });
    }
  }

  return { lines, warnings };
}
