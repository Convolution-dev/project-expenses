"use client";

import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Doc, Id } from "../../../convex/_generated/dataModel";
import type { ParticipantView } from "../../../convex/participants";
import { splitAmount } from "@/lib/money/split";
import {
  type Currency,
  formatAmount,
  formatCents,
  parseAmountToCents,
} from "@/lib/money/currency";
import AmountField from "@/components/money/AmountField";
import { convexErrorMessage } from "@/lib/convexError";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Field from "@/components/ui/Field";
import AttachmentsField from "@/components/attachments/AttachmentsField";

type SplitMode = "equal" | "weighted";

interface Row {
  userId: Id<"users">;
  label: string;
  included: boolean;
  shares: string; // major-unit text; only meaningful when weighted
}

function buildRows(
  participants: ParticipantView[],
  income: Doc<"incomes"> | undefined,
): Row[] {
  return participants.map((p) => {
    const onIncome = income?.split.beneficiaries.find(
      (b) => b.userId === p.userId,
    );
    return {
      userId: p.userId,
      label: p.name ?? p.email ?? "Usuario desconocido",
      included: income ? onIncome !== undefined : true,
      shares: onIncome?.shares ? String(onIncome.shares) : "1",
    };
  });
}

// Create or edit an Income. The split and Beneficiary set are snapshotted on
// submit; the Recipient is a Beneficiary by default but may be unchecked. The
// per-Beneficiary preview reuses the same largest-remainder split the backend
// stores. CONTEXT.md → Income, Split Rule. (#9)
export default function IncomeForm({
  projectId,
  currencies,
  defaultSplitMode,
  participants,
  defaultPeriod,
  income,
  onDone,
}: {
  projectId: Id<"projects">;
  currencies: Currency[];
  defaultSplitMode: SplitMode;
  participants: ParticipantView[];
  defaultPeriod: string;
  income?: Doc<"incomes">;
  onDone: () => void;
}) {
  const create = useMutation(api.incomes.create);
  const update = useMutation(api.incomes.update);

  const [title, setTitle] = useState(income?.title ?? "");
  const [description, setDescription] = useState(income?.description ?? "");
  const [amount, setAmount] = useState(
    income ? formatAmount(income.amountCents) : "",
  );
  const [recipientId, setRecipientId] = useState<Id<"users"> | "">(
    income?.recipientId ?? participants[0]?.userId ?? "",
  );
  const [currency, setCurrency] = useState<Currency>(
    income?.currency ?? currencies[0],
  );
  const [period, setPeriod] = useState(income?.period ?? defaultPeriod);
  const [mode, setMode] = useState<SplitMode>(
    income?.split.mode ?? defaultSplitMode,
  );
  const [rows, setRows] = useState<Row[]>(() => buildRows(participants, income));
  const [attachments, setAttachments] = useState<Id<"_storage">[]>(
    income?.attachments ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const amountCents = parseAmountToCents(amount);
  const included = rows.filter((r) => r.included);

  // Live per-beneficiary breakdown, recomputed from the same logic the backend
  // uses. Empty when the amount or shares are not yet valid to split.
  const preview = useMemo(() => {
    if (amountCents === null || included.length === 0) return null;
    const beneficiaries = included.map((r) => ({
      userId: r.userId,
      shares: mode === "weighted" ? Number(r.shares) : undefined,
    }));
    if (
      mode === "weighted" &&
      beneficiaries.some((b) => !Number.isInteger(b.shares) || (b.shares ?? 0) <= 0)
    ) {
      return null;
    }
    try {
      const shares = splitAmount(amountCents, { mode, beneficiaries });
      return new Map(shares.map((s) => [s.userId, s.cents]));
    } catch {
      return null;
    }
  }, [amountCents, included, mode]);

  function setRow(userId: Id<"users">, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r) => (r.userId === userId ? { ...r, ...patch } : r)),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (recipientId === "") {
      setError("Elige un receptor.");
      return;
    }
    if (amountCents === null) {
      setError("Ingresa un monto positivo (hasta dos decimales).");
      return;
    }
    if (included.length === 0) {
      setError("Selecciona al menos un beneficiario.");
      return;
    }
    const beneficiaries = included.map((r) => ({
      userId: r.userId,
      shares: mode === "weighted" ? Number(r.shares) : undefined,
    }));
    if (
      mode === "weighted" &&
      beneficiaries.some((b) => !Number.isInteger(b.shares) || (b.shares ?? 0) <= 0)
    ) {
      setError("Las partes ponderadas deben ser números enteros positivos.");
      return;
    }

    const split = { mode, beneficiaries };
    setPending(true);
    try {
      if (income) {
        await update({
          incomeId: income._id,
          title: title.trim(),
          description: description.trim(),
          amountCents,
          currency,
          recipientId,
          split,
          period,
          attachments,
        });
      } else {
        await create({
          projectId,
          title: title.trim(),
          description: description.trim(),
          amountCents,
          currency,
          recipientId,
          split,
          period,
          attachments,
        });
      }
      onDone();
    } catch (err) {
      setError(convexErrorMessage(err, "No se pudo guardar el ingreso."));
      setPending(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <Field label="Título" htmlFor="income-title">
        <Input
          id="income-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="ej. Pago del cliente Acme"
          required
          autoFocus
        />
      </Field>

      <Field label="Descripción" htmlFor="income-description">
        <Input
          id="income-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="ej. Factura del sprint de marzo"
          required
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <AmountField
          id="income-amount"
          currency={currency}
          currencies={currencies}
          onCurrencyChange={setCurrency}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <Field label="Receptor" htmlFor="income-recipient">
          <Select
            id="income-recipient"
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value as Id<"users">)}
          >
            {participants.map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.name ?? p.email ?? "Usuario desconocido"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Mes" htmlFor="income-month">
          <Input
            id="income-month"
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            required
          />
        </Field>
      </div>

      <Field label="Reparto" htmlFor="income-split-mode">
        <Select
          id="income-split-mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as SplitMode)}
        >
          <option value="equal">Equitativo</option>
          <option value="weighted">Ponderado por partes</option>
        </Select>
      </Field>

      <fieldset className="rounded-[var(--radius)] border border-border p-3">
        <legend className="px-1 text-sm font-medium">Beneficiarios</legend>
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li
              key={row.userId}
              className="flex items-center justify-between gap-3 py-2"
            >
              <label className="flex min-w-0 items-center gap-2">
                <input
                  type="checkbox"
                  checked={row.included}
                  onChange={(e) =>
                    setRow(row.userId, { included: e.target.checked })
                  }
                />
                <span className="truncate text-sm">{row.label}</span>
              </label>
              <div className="flex items-center gap-3">
                {mode === "weighted" && row.included && (
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={row.shares}
                    onChange={(e) =>
                      setRow(row.userId, { shares: e.target.value })
                    }
                    aria-label={`Partes de ${row.label}`}
                    className="h-8 w-16 rounded-[var(--radius)] border border-border bg-surface px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                )}
                {row.included && preview?.has(row.userId) && (
                  <span className="w-24 text-right text-sm text-muted">
                    {formatCents(preview.get(row.userId)!, currency)}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </fieldset>

      <Field label="Adjuntos (opcional)" htmlFor="income-attachments">
        <div id="income-attachments">
          <AttachmentsField
            value={attachments}
            onChange={setAttachments}
            disabled={pending}
          />
        </div>
      </Field>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : income ? "Guardar cambios" : "Agregar ingreso"}
        </Button>
      </div>
    </form>
  );
}
