"use client";

import { Id } from "../../../convex/_generated/dataModel";
import { formatCents } from "@/lib/money/currency";
import type { Movement } from "@/components/feed/movements";
import AttachmentList from "@/components/attachments/AttachmentList";
import Button from "@/components/ui/Button";

const KIND_LABEL: Record<Movement["kind"], string> = {
  expense: "Gasto",
  income: "Ingreso",
  settlement: "Pago",
};

const AMOUNT_TONE = {
  out: { sign: "-", className: "text-danger" },
  in: { sign: "+", className: "text-success" },
  transfer: { sign: "", className: "text-foreground" },
} as const;

function periodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const label = new Date(year, month - 1, 1).toLocaleDateString("es", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Read-only detail for one feed entry: amount, context, period, description,
// and its openable attachments. Edit is offered for expenses/incomes (the only
// two with an edit form); delete is always available.
export default function MovementDetail({
  movement,
  onEdit,
  onDelete,
}: {
  movement: Movement;
  onEdit?: () => void;
  onDelete: () => void;
}) {
  const doc = movement.expense ?? movement.income ?? movement.settlement;
  const description =
    movement.expense?.note ??
    movement.income?.description ??
    movement.settlement?.note ??
    "";
  const attachments = (doc?.attachments ?? []) as Id<"_storage">[];
  const tone = AMOUNT_TONE[movement.signed];

  return (
    <div className="space-y-5">
      <div>
        <span className="inline-block rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted">
          {KIND_LABEL[movement.kind]}
        </span>
        <p className={`mt-2 text-2xl font-semibold tabular-nums ${tone.className}`}>
          {tone.sign}
          {formatCents(movement.amountCents, movement.currency)}
        </p>
        <p className="mt-1 text-sm text-muted">{movement.subtitle}</p>
      </div>

      <dl className="space-y-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Período</dt>
          <dd className="font-medium">
            {doc ? periodLabel(doc.period) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Descripción</dt>
          <dd className="mt-1">
            {description ? (
              description
            ) : (
              <span className="text-muted">Sin descripción.</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Adjuntos</dt>
          <dd className="mt-1">
            {attachments.length > 0 ? (
              <AttachmentList storageIds={attachments} />
            ) : (
              <span className="text-muted">Sin adjuntos.</span>
            )}
          </dd>
        </div>
      </dl>

      <div className="flex justify-end gap-2">
        {onEdit && (
          <Button variant="secondary" onClick={onEdit}>
            Editar
          </Button>
        )}
        <Button variant="danger" onClick={onDelete}>
          Eliminar
        </Button>
      </div>
    </div>
  );
}
