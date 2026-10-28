"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import Select from "@/components/ui/Select";
import CostBars from "@/components/costs/CostBars";
import CostTable from "@/components/costs/CostTable";
import { lastMonths, monthLabel, usd } from "@/components/costs/format";
import type { Report } from "@/server/costs/report";

// What each client (project + Clerk org) costs Convolution per month,
// separating what providers measure from what is split by policy.
export default function CostsPage() {
  const months = useMemo(() => lastMonths(6), []);
  const [month, setMonth] = useState(months[0]);
  const [showInternal, setShowInternal] = useState(false);
  // Bumped by "Actualizar" to bypass the server cache.
  const [refreshes, setRefreshes] = useState(0);
  const requestKey = `${month}:${refreshes}`;
  const [result, setResult] = useState<{ key: string; report?: Report; error?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const key = `${month}:${refreshes}`;
    fetch(`/api/costs/report?month=${month}${refreshes > 0 ? "&fresh" : ""}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
        return (await res.json()) as Report;
      })
      .then((report) => !cancelled && setResult({ key, report }))
      .catch((err: Error) => !cancelled && setResult({ key, error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [month, refreshes]);

  const loading = result?.key !== requestKey;
  const report = result?.report ?? null;
  const error = loading ? null : (result?.error ?? null);

  const clients = (report?.clients ?? []).filter((c) => (showInternal || !c.internal) && c.total >= 0.005);

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Costos por cliente"
        description="Cliente = proyecto + org de Clerk"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mes" className="w-44">
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-1.5 text-sm text-muted">
              <input type="checkbox" checked={showInternal} onChange={(e) => setShowInternal(e.target.checked)} />
              Interno
            </label>
            <Button variant="secondary" onClick={() => setRefreshes((n) => n + 1)} disabled={loading}>
              {loading ? "Cargando…" : "Actualizar"}
            </Button>
          </div>
        }
      />

      {error && <Card className="border-danger text-sm">Error: {error}</Card>}
      {!report && loading && <p className="py-10 text-center text-sm text-muted">Consultando proveedores…</p>}

      {report && (
        <>
          <Sources report={report} />
          <Kpis report={report} />
          <Card>
            <h2 className="mb-3 font-semibold">Costo por cliente</h2>
            <CostBars clients={clients} />
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold">Detalle</h2>
            <CostTable clients={clients} />
          </Card>
          {report.warnings.length > 0 && (
            <Card>
              <h2 className="mb-3 font-semibold">Avisos ({report.warnings.length})</h2>
              <ul className="grid gap-1.5 text-sm text-muted">
                {report.warnings.map((w) => (
                  <li key={w} className="flex items-baseline gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-warning" aria-hidden />
                    {w}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Sources({ report }: { report: Report }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Fuentes de datos">
      {report.sources.map((s) => (
        <li
          key={s.provider}
          title={s.error}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-sm text-muted"
        >
          <span className={`h-2 w-2 rounded-full ${s.ok ? "bg-success" : "bg-danger"}`} aria-hidden />
          {s.provider}
          {!s.ok && <span className="text-xs">{s.error?.startsWith("Falta") ? "sin credencial" : "error"}</span>}
        </li>
      ))}
    </ul>
  );
}

function Kpi({ label, value, sub, hero }: { label: string; value: string; sub: string; hero?: boolean }) {
  return (
    <Card className="grid gap-0.5 !p-4">
      <span className="text-sm text-muted">{label}</span>
      <span className={`${hero ? "text-3xl" : "text-2xl"} font-semibold tabular-nums tracking-tight`}>{value}</span>
      <span className="text-xs text-muted">{sub}</span>
    </Card>
  );
}

function Kpis({ report }: { report: Report }) {
  const { totals, period, convexCheck } = report;
  const pct = (n: number) => (totals.total > 0 ? `${((n / totals.total) * 100).toFixed(0)}%` : "—");
  return (
    <section className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
      <Kpi
        hero
        label={`Total ${monthLabel(period.month)}`}
        value={usd(totals.total)}
        sub={`hasta ${new Date(period.to).toLocaleDateString("es-AR")}`}
      />
      <Kpi label="Medido" value={usd(totals.measured)} sub={`${pct(totals.measured)} · reportado por el proveedor`} />
      <Kpi label="Asignado" value={usd(totals.allocated)} sub={`${pct(totals.allocated)} · repartido por peso medido`} />
      <Kpi
        label="Fijo"
        value={usd(totals.fixed)}
        sub={`${pct(totals.fixed)} · ${report.policy === "equal" ? "partes iguales" : "según consumo"}`}
      />
      {convexCheck && (
        <Kpi
          label="Convex facturado"
          value={usd(convexCheck.usd)}
          sub={`control · ${convexCheck.from} → ${convexCheck.to}`}
        />
      )}
    </section>
  );
}
