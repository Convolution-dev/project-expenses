"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import type { ParticipantView } from "../../../convex/participants";
import { type Currency, parseAmountToCents } from "@/lib/money/currency";
import AmountField from "@/components/money/AmountField";
import { convexErrorMessage } from "@/lib/convexError";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Field from "@/components/ui/Field";
import AttachmentsField from "@/components/attachments/AttachmentsField";

// Record a Settlement: an actual transfer from a debtor to a creditor, full or
// partial. No split — it is a single payment between two Participants, and the
// two must differ. CONTEXT.md → Settlement. (#10)
export default function SettlementForm({
  projectId,
  currencies,
  participants,
  defaultPeriod,
  onDone,
}: {
  projectId: Id<"projects">;
  currencies: Currency[];
  participants: ParticipantView[];
  defaultPeriod: string;
  onDone: () => void;
}) {
  const create = useMutation(api.settlements.create);

  const [fromUserId, setFromUserId] = useState<Id<"users"> | "">(
    participants[0]?.userId ?? "",
  );
  const [toUserId, setToUserId] = useState<Id<"users"> | "">(
    participants[1]?.userId ?? "",
  );
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>(currencies[0]);
  const [period, setPeriod] = useState(defaultPeriod);
  const [note, setNote] = useState("");
  const [attachments, setAttachments] = useState<Id<"_storage">[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (fromUserId === "" || toUserId === "") {
      setError("Elige quién paga y quién recibe.");
      return;
    }
    if (fromUserId === toUserId) {
      setError("El pagador y el receptor deben ser distintos.");
      return;
    }
    const amountCents = parseAmountToCents(amount);
    if (amountCents === null) {
      setError("Ingresa un monto positivo (hasta dos decimales).");
      return;
    }

    setPending(true);
    try {
      await create({
        projectId,
        fromUserId,
        toUserId,
        amountCents,
        currency,
        period,
        note: note.trim() || undefined,
        attachments,
      });
      onDone();
    } catch (err) {
      setError(convexErrorMessage(err, "No se pudo guardar la liquidación."));
      setPending(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Paga" htmlFor="settlement-from">
          <Select
            id="settlement-from"
            value={fromUserId}
            onChange={(e) => setFromUserId(e.target.value as Id<"users">)}
          >
            {participants.map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.name ?? p.email ?? "Usuario desconocido"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Recibe" htmlFor="settlement-to">
          <Select
            id="settlement-to"
            value={toUserId}
            onChange={(e) => setToUserId(e.target.value as Id<"users">)}
          >
            {participants.map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.name ?? p.email ?? "Usuario desconocido"}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AmountField
          id="settlement-amount"
          currency={currency}
          currencies={currencies}
          onCurrencyChange={setCurrency}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          autoFocus
        />
        <Field label="Mes" htmlFor="settlement-month">
          <Input
            id="settlement-month"
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            required
          />
        </Field>
      </div>

      <Field label="Nota (opcional)" htmlFor="settlement-note">
        <Input
          id="settlement-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="ej. Transferencia por el alquiler del servidor"
        />
      </Field>

      <Field label="Adjuntos (opcional)" htmlFor="settlement-attachments">
        <div id="settlement-attachments">
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
          {pending ? "Guardando…" : "Registrar liquidación"}
        </Button>
      </div>
    </form>
  );
}
