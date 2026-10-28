"use client";

import { useState } from "react";
import type { ClientRow } from "@/server/costs/report";
import { PROVIDERS, seriesColor, usd } from "./format";

type Tip = { x: number; y: number; title: string; body: string };

// Horizontal stacked bars, one per client, segmented by provider.
export default function CostBars({ clients }: { clients: ClientRow[] }) {
  const [tip, setTip] = useState<Tip | null>(null);
  if (clients.length === 0) return <p className="text-sm text-muted">Sin costos en este período.</p>;
  const max = Math.max(...clients.map((c) => c.total));

  return (
    <div>
      <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted" aria-label="Proveedores">
        {PROVIDERS.map((p) => (
          <li key={p.id} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: seriesColor(p.id) }} aria-hidden />
            {p.label}
          </li>
        ))}
      </ul>
      <div className="grid gap-2.5" onMouseLeave={() => setTip(null)}>
        {clients.map((c) => (
          <div key={c.key} className="grid items-center gap-1 sm:grid-cols-[minmax(120px,240px)_1fr] sm:gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm">{c.orgName}</div>
              <div className="truncate text-xs text-muted">{c.projectLabel}</div>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-[18px] min-w-1 gap-[2px]" style={{ width: `${(c.total / max) * 100}%` }}>
                {PROVIDERS.map((p) => {
                  const value = c.byProvider[p.id] ?? 0;
                  if (value <= 0) return null;
                  return (
                    <div
                      key={p.id}
                      className="h-full min-w-[2px] last:rounded-r hover:brightness-110"
                      style={{ flexGrow: value, background: seriesColor(p.id) }}
                      onMouseMove={(e) =>
                        setTip({
                          x: e.clientX,
                          y: e.clientY,
                          title: `${c.orgName} · ${p.label}`,
                          body: `${usd(value)} (${((value / c.total) * 100).toFixed(0)}% del cliente)`,
                        })
                      }
                    />
                  );
                })}
              </div>
              <span className="whitespace-nowrap text-sm tabular-nums text-muted">{usd(c.total)}</span>
            </div>
          </div>
        ))}
      </div>
      {tip && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-20 grid gap-0.5 rounded-lg border border-border bg-surface px-2.5 py-2 text-sm shadow-lg"
          style={{ left: tip.x + 12, top: tip.y + 12 }}
        >
          <strong className="font-medium">{tip.title}</strong>
          <span className="tabular-nums">{tip.body}</span>
        </div>
      )}
    </div>
  );
}
