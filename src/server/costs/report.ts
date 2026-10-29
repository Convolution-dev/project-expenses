import {
  clients as clientCatalog,
  fixedCostPolicy,
  manualFixedCosts,
  projects,
  type ClientConfig,
  type ProjectConfig,
} from "@/server/costs/catalog";
import { MissingCredential } from "@/server/costs/credentials";
import { aiGatewayCosts } from "@/server/costs/providers/aiGateway";
import { clerkOrgs } from "@/server/costs/providers/clerk";
import { convexCosts, convexCurrentSpend } from "@/server/costs/providers/convex";
import { planetscaleCosts } from "@/server/costs/providers/planetscale";
import { postmarkCosts } from "@/server/costs/providers/postmark";
import { tenantStorage } from "@/server/costs/providers/tenantUsage";
import { vercelCosts } from "@/server/costs/providers/vercel";
import type { CostLine, OrgInfo, OrgWeights, Period, Provider, ProviderResult } from "@/server/costs/types";

export type ClientRow = {
  key: string;
  projectId: string;
  projectLabel: string;
  orgId: string | null;
  orgName: string;
  activeUsers: number | null;
  internal: boolean;
  lines: CostLine[];
  byProvider: Partial<Record<Provider, number>>;
  measured: number;
  allocated: number;
  fixed: number;
  total: number;
};

export type Report = {
  period: { month: string; from: string; to: string };
  clients: ClientRow[];
  totals: { byProvider: Partial<Record<Provider, number>>; measured: number; allocated: number; fixed: number; total: number };
  sources: { provider: string; ok: boolean; error?: string }[];
  warnings: string[];
  convexCheck?: { usd: number; from: string; to: string };
  policy: typeof fixedCostPolicy;
};

export function periodOf(month: string): Period {
  const [y, m] = month.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { month, from, to: end < new Date() ? end : new Date() };
}

const UNASSIGNED = "__sin_asignar__";
const NO_BREAKDOWN = "__sin_desglose__";

/** Weight a project-level cost by the measure that best explains it. */
const weightPreference: Record<Provider, string[]> = {
  convex: ["almacenamiento", "usuarios activos"],
  planetscale: ["almacenamiento", "usuarios activos"],
  vercel: ["usuarios activos", "almacenamiento"],
  "ai-gateway": ["usuarios activos"],
  clerk: ["usuarios activos"],
  postmark: ["usuarios activos"],
  manual: ["usuarios activos"],
};

export async function buildReport(month: string): Promise<Report> {
  const period = periodOf(month);
  const sources: Report["sources"] = [];
  const run = async (provider: string, fn: () => Promise<ProviderResult>): Promise<ProviderResult> => {
    try {
      const result = await fn();
      sources.push({ provider, ok: true });
      return result;
    } catch (err) {
      const missing = err instanceof MissingCredential;
      if (!missing) console.error(`[costos] ${provider}:`, (err as Error).message);
      sources.push({ provider, ok: false, error: (err as Error).message });
      return { lines: [], warnings: missing ? [] : [`${provider}: ${(err as Error).message}`] };
    }
  };

  const results = await Promise.all([
    run("Vercel", () => vercelCosts(period)),
    run("AI Gateway", () => aiGatewayCosts(period)),
    run("Convex", () => convexCosts(period)),
    run("PlanetScale", () => planetscaleCosts(period)),
    run("Postmark", () => postmarkCosts(period)),
    run("Clerk", () => clerkOrgs(period)),
    run("Uso por org", () => tenantStorage()),
  ]);
  const convexCheck = await convexCurrentSpend().catch(() => undefined);

  const lines = results.flatMap((r) => r.lines);
  const orgs = results.flatMap((r) => r.orgs ?? []);
  const weights = results.flatMap((r) => r.weights ?? []);
  const warnings = results.flatMap((r) => r.warnings ?? []);

  for (const cost of manualFixedCosts) {
    if (cost.provider === "postmark") continue; // split by emails sent in postmarkCosts
    lines.push({
      provider: cost.provider,
      category: cost.category,
      projectId: cost.projectId ?? null,
      orgId: null,
      basis: "fixed",
      usd: cost.usd,
      note: "Carga manual",
    });
  }

  const clients = allocate(lines, orgs, weights, warnings);
  const sum = (pick: (c: ClientRow) => number) => clients.reduce((acc, c) => acc + pick(c), 0);
  const byProvider: Report["totals"]["byProvider"] = {};
  for (const c of clients) {
    for (const [p, usd] of Object.entries(c.byProvider)) {
      byProvider[p as Provider] = (byProvider[p as Provider] ?? 0) + usd;
    }
  }

  return {
    period: { month, from: period.from.toISOString(), to: period.to.toISOString() },
    clients: clients.sort((a, b) => b.total - a.total),
    totals: {
      byProvider,
      measured: sum((c) => c.measured),
      allocated: sum((c) => c.allocated),
      fixed: sum((c) => c.fixed),
      total: sum((c) => c.total),
    },
    sources,
    warnings: [...new Set(warnings)],
    convexCheck,
    policy: fixedCostPolicy,
  };
}

export function allocate(
  lines: CostLine[],
  orgs: OrgInfo[],
  weights: OrgWeights[],
  warnings: string[],
  clientConfigs: ClientConfig[] = clientCatalog,
): ClientRow[] {
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const orgById = new Map(orgs.map((o) => [o.orgId, o]));
  const rows = new Map<string, ClientRow>();

  const row = (projectId: string, orgId: string | null): ClientRow => {
    const key = `${projectId}/${orgId ?? ""}`;
    let r = rows.get(key);
    if (!r) {
      const project = projectById.get(projectId);
      const org = orgId ? orgById.get(orgId) : undefined;
      const singleTenant = project?.singleTenant && orgId === project.id;
      r = {
        key,
        projectId,
        projectLabel: project?.label ?? (projectId === UNASSIGNED ? "Sin asignar" : projectId),
        orgId,
        orgName:
          (org && (org.dev ? `${org.name} (dev)` : org.name)) ??
          (singleTenant
            ? project.label
            : orgId === NO_BREAKDOWN
            ? "Sin desglose por org"
            : orgId
              ? `Org desconocida (${orgId})`
              : projectId === UNASSIGNED
                ? "Recursos fuera del catálogo"
                : "—"),
        activeUsers: org?.activeUsers ?? null,
        internal: project?.internal ?? false,
        lines: [],
        byProvider: {},
        measured: 0,
        allocated: 0,
        fixed: 0,
        total: 0,
      };
      rows.set(key, r);
    }
    return r;
  };

  const put = (target: ClientRow, line: CostLine) => {
    target.lines.push(line);
    target.byProvider[line.provider] = (target.byProvider[line.provider] ?? 0) + line.usd;
    target[line.basis] += line.usd;
    target.total += line.usd;
  };

  // Every known org gets a row, even at zero cost, so fixed costs can reach it.
  for (const org of orgs) row(org.projectId, org.orgId);

  const singleTenantId = (p: ProjectConfig) => p.id;
  const shared: CostLine[] = [];

  for (let line of lines) {
    if (line.orgName && !line.orgId) {
      const org = orgs.find((o) => o.projectId === line.projectId && orgMatches(o, line.orgName!));
      if (org) line = { ...line, orgId: org.orgId };
      else warnings.push(`${line.provider}: no encontré la org «${line.orgName}» en ${line.projectId}`);
    }
    // Org-tagged lines (AI Gateway): resolve the project from the org.
    if (line.orgId) {
      const org = orgById.get(line.orgId);
      if (!org) warnings.push(`Org ${line.orgId} no aparece en ninguna app de Clerk configurada`);
      put(row(org?.projectId ?? line.projectId ?? UNASSIGNED, line.orgId), { ...line, projectId: org?.projectId ?? line.projectId });
      continue;
    }
    if (!line.projectId) {
      if (line.basis === "fixed") shared.push(line);
      else put(row(UNASSIGNED, null), line);
      continue;
    }
    const project = projectById.get(line.projectId);
    if (!project) {
      put(row(UNASSIGNED, null), line);
      continue;
    }
    if (project.singleTenant) {
      put(row(project.id, singleTenantId(project)), line);
      continue;
    }

    const weight = weightPreference[line.provider]
      .map((metric) => weights.find((w) => w.projectId === project.id && w.metric === metric))
      .find((w) => w && Object.values(w.byOrg).some((v) => v > 0));
    if (!weight) {
      put(row(project.id, NO_BREAKDOWN), line);
      continue;
    }
    const total = Object.values(weight.byOrg).reduce((a, b) => a + b, 0);
    for (const [orgId, amount] of Object.entries(weight.byOrg)) {
      if (amount === 0) continue;
      const share = amount / total;
      put(row(project.id, orgId), {
        ...line,
        basis: line.basis === "fixed" ? "fixed" : "allocated",
        usd: line.usd * share,
        note: `${(share * 100).toFixed(1)}% del proyecto por ${weight.metric}${line.note ? ` · ${line.note}` : ""}`,
      });
    }
  }

  const grouped = groupClients([...rows.values()], orgById, clientConfigs, warnings);

  // Shared fixed costs (team plans, seats) go to billable clients by policy.
  const billable = grouped.filter(
    (r) => !r.internal && r.projectId !== UNASSIGNED && r.orgId !== NO_BREAKDOWN && (r.total > 0 || (r.activeUsers ?? 0) > 0),
  );
  if (billable.length > 0) {
    const variable = billable.map((r) => r.measured + r.allocated);
    const variableTotal = variable.reduce((a, b) => a + b, 0);
    for (const line of shared) {
      billable.forEach((r, i) => {
        const share =
          fixedCostPolicy === "proportional-to-variable" && variableTotal > 0
            ? variable[i] / variableTotal
            : 1 / billable.length;
        put(r, {
          ...line,
          usd: line.usd * share,
          note: `${(share * 100).toFixed(1)}% del costo compartido (${fixedCostPolicy === "equal" ? "partes iguales" : "según consumo"})`,
        });
      });
    }
  } else {
    for (const line of shared) {
      const unassigned = row(UNASSIGNED, null);
      if (!grouped.includes(unassigned)) grouped.push(unassigned);
      put(unassigned, line);
    }
  }

  return grouped;
}

const norm = (s: string) => s.replace(/&amp;/g, "&").trim().toLowerCase();

/** A configured org reference matches a Clerk org by name or slug. */
function orgMatches(org: OrgInfo, ref: string): boolean {
  return [org.name, org.slug].some((n) => n && norm(n) === norm(ref));
}

/**
 * Folds the (project, org) rows of each configured client into one row, so a
 * customer using several apps or orgs shows once and counts once for shared costs.
 */
function groupClients(
  rows: ClientRow[],
  orgById: Map<string, OrgInfo>,
  clientConfigs: ClientConfig[],
  warnings: string[],
): ClientRow[] {
  const memberMatches = (m: ClientConfig["members"][number], r: ClientRow) => {
    if (m.projectId !== r.projectId) return false;
    if (!m.org) return true;
    const org = r.orgId ? orgById.get(r.orgId) : undefined;
    return !!org && orgMatches(org, m.org);
  };

  const result: ClientRow[] = [];
  const groups = new Map<string, ClientRow[]>();
  for (const r of rows) {
    const client = clientConfigs.find((c) => c.members.some((m) => memberMatches(m, r)));
    if (!client) result.push(r);
    else groups.set(client.id, [...(groups.get(client.id) ?? []), r]);
  }

  for (const client of clientConfigs) {
    const members = groups.get(client.id) ?? [];
    for (const m of client.members) {
      if (m.org && !members.some((r) => memberMatches(m, r))) {
        const project = projects.find((p) => p.id === m.projectId)?.label ?? m.projectId;
        warnings.push(`Cliente ${client.label}: no encontré la org «${m.org}» en ${project}`);
      }
    }
    if (members.length === 0) continue;

    const users = members.filter((r) => r.activeUsers !== null);
    const merged: ClientRow = {
      key: `cliente/${client.id}`,
      projectId: `cliente:${client.id}`,
      projectLabel: [...new Set(members.map((r) => r.projectLabel))].join(" + "),
      orgId: null,
      orgName: client.label,
      activeUsers: users.length ? users.reduce((acc, r) => acc + (r.activeUsers ?? 0), 0) : null,
      internal: false,
      lines: [],
      byProvider: {},
      measured: 0,
      allocated: 0,
      fixed: 0,
      total: 0,
    };
    for (const r of members) {
      for (const line of r.lines) {
        merged.lines.push({ ...line, note: [`${r.projectLabel} · ${r.orgName}`, line.note].filter(Boolean).join(" · ") });
        merged.byProvider[line.provider] = (merged.byProvider[line.provider] ?? 0) + line.usd;
      }
      merged.measured += r.measured;
      merged.allocated += r.allocated;
      merged.fixed += r.fixed;
      merged.total += r.total;
    }
    result.push(merged);
  }
  return result;
}
