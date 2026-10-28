import { convexRates, projectByConvexId } from "@/server/costs/catalog";
import { credentials, getJson, required } from "@/server/costs/credentials";
import type { CostLine, Period, ProviderResult } from "@/server/costs/types";

/**
 * Convex has no public billing API. These are the query ids the Convex
 * dashboard itself uses (get-convex/convex-backend,
 * npm-packages/dashboard/src/hooks/usageMetrics.ts). If Convex changes them,
 * this provider fails loudly instead of returning wrong numbers.
 */
const QUERY = {
  functionCalls: "77a4e5bd-aa82-43e7-85a4-89897cecaa05", // team, project, class, ds, cached, uncached, mutations, actions, http
  storageCalls: "90c9d3b3-d93e-4583-a054-dbb2f9dad5a3", // team, project, class, ds, calls
  databaseIo: "9f606f77-521d-44bb-83ef-b1057b0fb1c9", // team, project, class, ds, ingress, egress
  databaseStorage: "489b0f87-6b3a-4dfe-a327-f2965b5c2977", // team, project, class, ds, document, index
  compute: "038e5492-6de5-4ddb-86b4-761e19b4d2ab", // team, project, ds, actionConvexGbS, actionNodeGbS
  fileStorage: "72add9df-4ef2-47fe-9942-194dfbb72088", // team, project, ds, bytes
  searchStorage: "87f2b0b2-024c-4c2a-bf81-8a3c0cab1b82", // team, project, ds, text, vector
  dataEgress: "67ce838f-b2d0-4cda-9a2e-580c6d134466", // team, project, ds, ...bytes
} as const;

type Row = string[];
type Resource = keyof typeof convexRates.included;

const GB = 1024 ** 3;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

async function query(queryId: string, period: Period): Promise<Row[]> {
  const token = required(credentials.convexToken(), "CONVEX_ACCESS_TOKEN");
  const url = new URL(`https://api.convex.dev/api/dashboard/teams/${credentials.convexTeamId()}/usage/query`);
  url.searchParams.set("queryId", queryId);
  url.searchParams.set("from", ymd(period.from));
  url.searchParams.set("to", ymd(new Date(period.to.getTime() - 1)));
  return getJson<Row[]>(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, Origin: "https://dashboard.convex.dev" },
  });
}

const sum = (row: Row, from: number) => row.slice(from).reduce((acc, v) => acc + Number(v || 0), 0);

export async function convexCosts(period: Period): Promise<ProviderResult> {
  const results = await Promise.all(Object.values(QUERY).map((id) => query(id, period)));
  const [calls, storageCalls, io, dbStorage, compute, files, search, egress] = results;
  const daysInMonth = (period.to.getTime() - period.from.getTime()) / 86_400_000;

  // usage[project][resource] in billing units (millions, GB-hours, GB, GB-month).
  const usage = new Map<string, Record<Resource, number>>();
  const add = (projectId: string, resource: Resource, amount: number) => {
    const entry =
      usage.get(projectId) ??
      ({ functionCallsMillions: 0, actionComputeGbHours: 0, databaseStorageGb: 0, databaseIoGb: 0, fileStorageGb: 0, searchStorageGb: 0, dataEgressGb: 0 } satisfies Record<Resource, number>);
    entry[resource] += amount;
    usage.set(projectId, entry);
  };

  for (const r of calls) add(r[1], "functionCallsMillions", sum(r, 4) / 1e6);
  for (const r of storageCalls) add(r[1], "functionCallsMillions", sum(r, 4) / 1e6);
  for (const r of io) add(r[1], "databaseIoGb", sum(r, 4) / GB);
  // Storage rows are daily gauges: summing days / days-in-month gives GB-month.
  for (const r of dbStorage) add(r[1], "databaseStorageGb", sum(r, 4) / GB / daysInMonth);
  for (const r of files) add(r[1], "fileStorageGb", sum(r, 3) / GB / daysInMonth);
  for (const r of search) add(r[1], "searchStorageGb", sum(r, 3) / GB / daysInMonth);
  for (const r of compute) add(r[1], "actionComputeGbHours", sum(r, 3) / 3600);
  for (const r of egress) add(r[1], "dataEgressGb", sum(r, 3) / GB);

  const rate: Record<Resource, number> = {
    functionCallsMillions: convexRates.functionCallsPerMillion,
    actionComputeGbHours: convexRates.actionComputePerGbHour,
    databaseStorageGb: convexRates.databaseStoragePerGbMonth,
    databaseIoGb: convexRates.databaseIoPerGb,
    fileStorageGb: convexRates.fileStoragePerGbMonth,
    searchStorageGb: convexRates.searchStoragePerGbMonth,
    dataEgressGb: convexRates.dataEgressPerGb,
  };
  const label: Record<Resource, string> = {
    functionCallsMillions: "Llamadas a funciones",
    actionComputeGbHours: "Cómputo de actions",
    databaseStorageGb: "Almacenamiento DB",
    databaseIoGb: "I/O de DB",
    fileStorageGb: "Archivos",
    searchStorageGb: "Índices de búsqueda",
    dataEgressGb: "Egress",
  };

  // Included allowances are team-wide: each project gets the billable fraction of its usage.
  const lines: CostLine[] = [];
  const warnings = new Set<string>();
  for (const resource of Object.keys(rate) as Resource[]) {
    const teamTotal = [...usage.values()].reduce((acc, u) => acc + u[resource], 0);
    if (teamTotal === 0) continue;
    const billable = Math.max(0, teamTotal - convexRates.included[resource]) / teamTotal;
    for (const [convexId, u] of usage) {
      const usd = u[resource] * billable * rate[resource];
      if (usd < 0.0001) continue;
      const projectId = convexId === "_rest" ? null : projectByConvexId.get(Number(convexId)) ?? null;
      if (!projectId && convexId !== "_rest") warnings.add(`Convex: proyecto ${convexId} no está en el catálogo`);
      lines.push({
        provider: "convex",
        category: label[resource],
        projectId,
        orgId: null,
        basis: "measured",
        usd,
        note: "Uso medido × tarifa Starter, descontando lo incluido",
      });
    }
  }
  return { lines, warnings: [...warnings] };
}

/** What Convex says the current billing period costs so far, to cross-check the estimate. */
export async function convexCurrentSpend(): Promise<{ usd: number; from: string; to: string }> {
  const token = required(credentials.convexToken(), "CONVEX_ACCESS_TOKEN");
  const base = `https://api.convex.dev/api/dashboard/teams/${credentials.convexTeamId()}`;
  const headers = { Authorization: `Bearer ${token}` };
  const [spend, period] = await Promise.all([
    getJson<{ totalCents: number }>(`${base}/get_current_spend`, { headers }),
    getJson<{ start: string; end: string }>(`${base}/usage/current_billing_period`, { headers }),
  ]);
  return { usd: spend.totalCents / 100, from: period.start, to: period.end };
}
