import { manualFixedCosts, postmarkServers } from "@/server/costs/catalog";
import { credentials, getJson, required } from "@/server/costs/credentials";
import type { CostLine, Period, ProviderResult } from "@/server/costs/types";

type Server = { ID: number; Name: string };
type ServerDetail = Server & { ApiTokens: string[] };

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Splits the Postmark plan fee across servers by emails sent; each server maps to a client. */
export async function postmarkCosts(period: Period): Promise<ProviderResult> {
  const planUsd = manualFixedCosts
    .filter((c) => c.provider === "postmark")
    .reduce((acc, c) => acc + c.usd, 0);
  if (planUsd === 0) return { lines: [], warnings: ["Postmark: falta el costo del plan en manualFixedCosts"] };

  const account = required(credentials.postmarkAccountToken(), "POSTMARK_ACCOUNT_TOKEN");
  const headers = { Accept: "application/json", "X-Postmark-Account-Token": account };
  const { Servers } = await getJson<{ Servers: Server[] }>(
    "https://api.postmarkapp.com/servers?count=100&offset=0",
    { headers },
  );

  const sent = await Promise.all(
    Servers.map(async (server) => {
      const detail = await getJson<ServerDetail>(`https://api.postmarkapp.com/servers/${server.ID}`, { headers });
      const stats = await getJson<{ Sent: number }>(
        `https://api.postmarkapp.com/stats/outbound?fromdate=${ymd(period.from)}&todate=${ymd(new Date(period.to.getTime() - 1))}`,
        { headers: { Accept: "application/json", "X-Postmark-Server-Token": detail.ApiTokens[0] } },
      );
      return { server, sent: stats.Sent };
    }),
  );

  const total = sent.reduce((acc, s) => acc + s.sent, 0);
  const warnings: string[] = [];
  const lines: CostLine[] = [];
  if (total === 0) {
    const fallback = Object.entries(postmarkServers).find(([, t]) => t.default);
    const server = Servers.find((s) => s.ID === Number(fallback?.[0]));
    lines.push({
      provider: "postmark",
      category: `Plan${server ? ` (${server.Name})` : ""}`,
      projectId: fallback?.[1].projectId ?? null,
      orgId: null,
      orgName: fallback?.[1].org,
      basis: "fixed",
      usd: planUsd,
      note: "Sin emails enviados en el período: plan completo al server por defecto",
    });
    return { lines, warnings };
  }
  for (const { server, sent: count } of sent) {
    if (count === 0) continue;
    const target = postmarkServers[server.ID];
    if (!target) warnings.push(`Postmark: server "${server.Name}" (${server.ID}) no está mapeado`);
    lines.push({
      provider: "postmark",
      category: `Emails (${server.Name})`,
      projectId: target?.projectId ?? null,
      orgId: null,
      orgName: target?.org,
      basis: "allocated",
      usd: (planUsd * count) / total,
      note: `${count} de ${total} emails enviados`,
    });
  }
  return { lines, warnings };
}
