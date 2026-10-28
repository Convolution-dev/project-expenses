import { projectByVercelName } from "@/server/costs/catalog";
import { credentials, required } from "@/server/costs/credentials";
import type { CostLine, Period, ProviderResult } from "@/server/costs/types";

type Charge = {
  ServiceName: string;
  EffectiveCost: number;
  BilledCost: number;
  Tags: { ProjectName?: string };
};

/** Midnight in Los Angeles on the given UTC date: Vercel's billing day boundary. */
function laMidnight(date: Date): Date {
  for (const hour of [7, 8]) {
    const candidate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour));
    const laHour = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hourCycle: "h23" }).format(candidate);
    if (Number(laHour) === 0) return candidate;
  }
  throw new Error(`No LA midnight for ${date.toISOString()}`);
}

/**
 * Usage charges carry a project tag and are measured. Untagged charges (plan,
 * seats) are fixed. The included plan credit absorbs usage, so the fixed line
 * is whatever is billed beyond measured usage — the total always equals the bill.
 */
export async function vercelCosts(period: Period): Promise<ProviderResult> {
  const token = required(credentials.vercelToken(), "VERCEL_TOKEN");
  const url = new URL("https://api.vercel.com/v1/billing/charges");
  // Billed amounts depend on the window; LA-midnight bounds match the Vercel invoice and CLI.
  url.searchParams.set("from", laMidnight(period.from).toISOString());
  url.searchParams.set("to", period.to.toISOString());
  url.searchParams.set("teamId", credentials.vercelTeamId());

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Vercel billing → ${res.status} ${await res.text()}`);
  const charges = (await res.text())
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Charge);

  const byProjectService = new Map<string, number>();
  const warnings = new Set<string>();
  let billed = 0;
  let measured = 0;

  for (const charge of charges) {
    billed += charge.BilledCost;
    const name = charge.Tags.ProjectName;
    if (!name || charge.EffectiveCost === 0) continue;
    const projectId = projectByVercelName.get(name);
    if (!projectId) warnings.add(`Vercel: proyecto "${name}" no está en el catálogo`);
    const key = `${projectId ?? name}\u0000${charge.ServiceName}`;
    byProjectService.set(key, (byProjectService.get(key) ?? 0) + charge.EffectiveCost);
    measured += charge.EffectiveCost;
  }

  const lines: CostLine[] = [...byProjectService].map(([key, usd]) => {
    const [projectId, category] = key.split("\u0000");
    return { provider: "vercel", category, projectId, orgId: null, basis: "measured", usd };
  });
  lines.push({
    provider: "vercel",
    category: "Plan Pro + asientos",
    projectId: null,
    orgId: null,
    basis: "fixed",
    usd: billed - measured,
    note: "Facturado menos el consumo medido de los proyectos",
  });

  return { lines, warnings: [...warnings] };
}
