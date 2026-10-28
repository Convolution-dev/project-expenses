"use client";

import { Fragment, useState } from "react";
import type { ClientRow } from "@/server/costs/report";
import { BASIS_LABEL, PROVIDERS, usd } from "./format";

const th = "whitespace-nowrap border-b border-border px-2 py-1.5 text-left text-xs font-medium text-muted";
const td = "border-b border-border px-2 py-2 align-top";
const num = "text-right whitespace-nowrap tabular-nums";

// Per-client breakdown; a row expands into the cost lines and how each was computed.
export default function CostTable({ clients }: { clients: ClientRow[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className={th}>Cliente</th>
            <th className={`${th} ${num}`}>Usuarios</th>
            {PROVIDERS.map((p) => (
              <th key={p.id} className={`${th} ${num}`}>
                {p.label}
              </th>
            ))}
            <th className={`${th} ${num}`}>Medido</th>
            <th className={`${th} ${num}`}>Asignado</th>
            <th className={`${th} ${num}`}>Fijo</th>
            <th className={`${th} ${num}`}>Total</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => {
            const expanded = open === c.key;
            return (
              <Fragment key={c.key}>
                <tr
                  className="cursor-pointer hover:bg-surface-muted"
                  onClick={() => setOpen(expanded ? null : c.key)}
                  aria-expanded={expanded}
                >
                  <td className={td}>
                    <span className="inline-block w-3.5 text-muted" aria-hidden>
                      {expanded ? "▾" : "▸"}
                    </span>
                    {c.orgName}
                    <span className="ml-3.5 block text-xs text-muted">{c.projectLabel}</span>
                  </td>
                  <td className={`${td} ${num}`}>{c.activeUsers ?? "—"}</td>
                  {PROVIDERS.map((p) => (
                    <td key={p.id} className={`${td} ${num}`}>
                      {c.byProvider[p.id] ? usd(c.byProvider[p.id]!) : <span className="text-muted">—</span>}
                    </td>
                  ))}
                  <td className={`${td} ${num}`}>{usd(c.measured)}</td>
                  <td className={`${td} ${num}`}>{usd(c.allocated)}</td>
                  <td className={`${td} ${num}`}>{usd(c.fixed)}</td>
                  <td className={`${td} ${num} font-semibold`}>{usd(c.total)}</td>
                </tr>
                {expanded && (
                  <tr>
                    <td colSpan={PROVIDERS.length + 6} className="border-b border-border bg-background py-2 pl-6 pr-2">
                      <LineDetail client={c} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const BASIS_STYLE = {
  measured: "border-success",
  allocated: "border-border",
  fixed: "border-border border-dashed",
};

function LineDetail({ client }: { client: ClientRow }) {
  const lines = client.lines.filter((l) => Math.abs(l.usd) >= 0.005).sort((a, b) => b.usd - a.usd);
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr>
          <th className={th}>Proveedor</th>
          <th className={th}>Concepto</th>
          <th className={th}>Base</th>
          <th className={th}>Cómo se calculó</th>
          <th className={`${th} ${num}`}>USD</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l, i) => (
          <tr key={i}>
            <td className="px-2 py-1">{PROVIDERS.find((p) => p.id === l.provider)?.label}</td>
            <td className="px-2 py-1">{l.category}</td>
            <td className="px-2 py-1">
              <span className={`whitespace-nowrap rounded-full border px-2 text-xs text-muted ${BASIS_STYLE[l.basis]}`}>
                {BASIS_LABEL[l.basis]}
              </span>
            </td>
            <td className="px-2 py-1 text-muted">{l.note ?? ""}</td>
            <td className={`px-2 py-1 ${num}`}>{usd(l.usd)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
