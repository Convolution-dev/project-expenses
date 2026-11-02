"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import type { PeriodBalance } from "../../../convex/balances";
import type { Transfer } from "@/lib/money/balance";
import { formatCents } from "@/lib/money/currency";
import { convexErrorMessage } from "@/lib/convexError";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

function transferKey(transfer: Transfer, currency: string): string {
  return `${currency}-${transfer.fromUserId}-${transfer.toUserId}`;
}

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// The Settle view: pick a month, click to compute the live Balance, and see
// each Participant's net position plus the minimal transfers that zero the
// month, per currency. The view never mutates — a suggested transfer is
// recorded through the existing settlements.create, and the reactive query
// recomputes on its own.
// CONTEXT.md → Balance. (#11)
export default function SettleSection({
  projectId,
}: {
  projectId: Id<"projects">;
}) {
  const [period, setPeriod] = useState(currentPeriod);
  const [computed, setComputed] = useState(false);
  const [recording, setRecording] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const participants = useQuery(api.participants.list, { projectId });
  const balances = useQuery(
    api.balances.forPeriod,
    computed ? { projectId, period } : "skip",
  );
  const recordSettlement = useMutation(api.settlements.create);

  const nameByUser = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of participants ?? []) {
      map.set(p.userId, p.name ?? p.email ?? "Usuario desconocido");
    }
    return map;
  }, [participants]);

  const nameOf = (userId: string) => nameByUser.get(userId) ?? "Desconocido";

  function selectPeriod(next: string) {
    setPeriod(next);
    setComputed(false);
    setError(null);
  }

  async function record(transfer: Transfer, currency: PeriodBalance["currency"]) {
    setError(null);
    setRecording(transferKey(transfer, currency));
    try {
      await recordSettlement({
        projectId,
        fromUserId: transfer.fromUserId as Id<"users">,
        toUserId: transfer.toUserId as Id<"users">,
        amountCents: transfer.amountCents,
        currency,
        period,
        attachments: [],
      });
    } catch (err) {
      setError(convexErrorMessage(err, "No se pudo registrar la liquidación."));
    } finally {
      setRecording(null);
    }
  }

  // Currencies with movements this month; the rest have nothing to show.
  const active = (balances ?? []).filter((balance) => balance.net.length > 0);
  const isSquare = active.every(
    (balance) =>
      balance.transfers.length === 0 &&
      balance.net.every((position) => position.cents === 0),
  );

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-medium">Liquidar</h2>
        <div className="flex items-center gap-2">
          <Input
            type="month"
            value={period}
            onChange={(e) => selectPeriod(e.target.value)}
            aria-label="Mes"
            className="w-auto"
          />
          <Button size="sm" onClick={() => setComputed(true)}>
            Liquidar
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {!computed ? (
        <p className="text-sm text-muted">
          Elige un mes y pulsa Liquidar para calcular el balance.
        </p>
      ) : balances === undefined ? (
        <p className="text-sm text-muted">Calculando…</p>
      ) : isSquare ? (
        <p className="text-sm font-medium text-success">
          Mes saldado: todos están a mano para {period}.
        </p>
      ) : (
        <div className="space-y-6">
          {active.map((balance) => (
            <CurrencyBalance
              key={balance.currency}
              balance={balance}
              showCurrency={active.length > 1}
              period={period}
              nameOf={nameOf}
              recordingKey={recording}
              onRecord={(transfer) => record(transfer, balance.currency)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

// Net positions and suggested transfers for one currency of the month.
function CurrencyBalance({
  balance,
  showCurrency,
  period,
  nameOf,
  recordingKey,
  onRecord,
}: {
  balance: PeriodBalance;
  showCurrency: boolean;
  period: string;
  nameOf: (userId: string) => string;
  recordingKey: string | null;
  onRecord: (transfer: Transfer) => void;
}) {
  const currency = balance.currency;
  return (
    <div className="space-y-5">
      {showCurrency && <h3 className="text-sm font-semibold">{currency}</h3>}
      <section className="space-y-2">
        <h3 className="text-sm font-medium">Posición neta</h3>
        <ul className="divide-y divide-border">
          {balance.net.map((position) => (
            <li
              key={position.userId}
              className="flex items-center justify-between gap-3 py-2"
            >
              <span className="truncate text-sm">
                {nameOf(position.userId)}
              </span>
              <span
                className={`text-sm font-medium tabular-nums ${
                  position.cents > 0
                    ? "text-success"
                    : position.cents < 0
                      ? "text-danger"
                      : "text-muted"
                }`}
              >
                {position.cents > 0
                  ? `Le deben ${formatCents(position.cents, currency)}`
                  : position.cents < 0
                    ? `Debe ${formatCents(-position.cents, currency)}`
                    : "A mano"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Transferencias sugeridas</h3>
        <ul className="space-y-3">
          {balance.transfers.map((transfer) => (
            <li
              key={transferKey(transfer, currency)}
              className="flex items-start justify-between gap-3 rounded-[var(--radius)] border border-border p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {nameOf(transfer.fromUserId)} →{" "}
                  {nameOf(transfer.toUserId)} ·{" "}
                  {formatCents(transfer.amountCents, currency)}
                </p>
                <p className="text-sm text-muted">
                  {nameOf(transfer.fromUserId)} quedó como deudor y{" "}
                  {nameOf(transfer.toUserId)} como acreedor, así que{" "}
                  {nameOf(transfer.fromUserId)} le paga{" "}
                  {formatCents(transfer.amountCents, currency)} a{" "}
                  {nameOf(transfer.toUserId)} para saldar {period}.
                </p>
              </div>
              <Button
                size="sm"
                disabled={recordingKey !== null}
                onClick={() => onRecord(transfer)}
              >
                {recordingKey === transferKey(transfer, currency)
                  ? "Registrando…"
                  : "Registrar"}
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
