import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { projectByDatabase } from "@/server/costs/catalog";
import { credentials, getJson, MissingCredential } from "@/server/costs/credentials";
import type { CostLine, Period, ProviderResult } from "@/server/costs/types";

type Invoice = { id: string; total: string; billing_period_start: string };
type Database = { name: string };

/** Service token if set; in local dev, the logged-in pscale CLI (its token lives in the keyring). */
async function api<T>(path: string): Promise<T> {
  const org = credentials.planetscaleOrg();
  const token = credentials.planetscaleToken();
  if (token) {
    return getJson<T>(`https://api.planetscale.com/v1/organizations/${org}/${path}`, {
      headers: { Authorization: token },
    });
  }
  if (process.env.NODE_ENV === "production") {
    throw new MissingCredential("PLANETSCALE_SERVICE_TOKEN_ID / PLANETSCALE_SERVICE_TOKEN");
  }
  const { stdout } = await promisify(execFile)("pscale", ["api", `organizations/${org}/${path}`]);
  return JSON.parse(stdout) as T;
}

/**
 * PlanetScale bills fixed clusters, so the invoice is a fixed cost of the
 * project that owns the database. With several databases the invoice is split
 * evenly — the API does not expose line items per database.
 */
export async function planetscaleCosts(period: Period): Promise<ProviderResult> {
  const [{ data: invoices }, { data: databases }] = await Promise.all([
    api<{ data: Invoice[] }>("invoices"),
    api<{ data: Database[] }>("databases"),
  ]);

  const invoice = invoices.find((inv) => inv.billing_period_start.startsWith(period.month));
  if (!invoice) return { lines: [], warnings: [`PlanetScale: sin factura para ${period.month}`] };

  const total = Number(invoice.total);
  const warnings: string[] = [];
  const lines: CostLine[] = databases.map((db) => {
    const projectId = projectByDatabase.get(db.name) ?? null;
    if (!projectId) warnings.push(`PlanetScale: base "${db.name}" no está en el catálogo`);
    return {
      provider: "planetscale",
      category: `Cluster ${db.name}`,
      projectId,
      orgId: null,
      basis: "fixed",
      usd: total / databases.length,
    };
  });
  return { lines, warnings };
}
