"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Doc, Id } from "../../../convex/_generated/dataModel";
import { type Currency, formatCents } from "@/lib/money/currency";
import { convexErrorMessage } from "@/lib/convexError";
import { buildMovements, Movement } from "@/components/feed/movements";
import MovementRow from "@/components/feed/MovementRow";
import MovementDetail from "@/components/feed/MovementDetail";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Fab, { FabAction } from "@/components/ui/Fab";
import Dialog from "@/components/ui/Dialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { MenuItem } from "@/components/ui/Menu";
import ExpenseForm from "@/components/expenses/ExpenseForm";
import IncomeForm from "@/components/incomes/IncomeForm";
import SettlementForm from "@/components/settlements/SettlementForm";

type SplitMode = "equal" | "weighted";

// Which form the modal is showing. Settlements have no edit form, so only
// expenses and incomes carry an existing document.
type FormState =
  | { kind: "expense"; expense?: Doc<"expenses"> }
  | { kind: "income"; income?: Doc<"incomes"> }
  | { kind: "settlement" };

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function periodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const label = new Date(year, month - 1, 1).toLocaleDateString("es", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formTitle(form: FormState): string {
  if (form.kind === "expense") return form.expense ? "Editar gasto" : "Nuevo gasto";
  if (form.kind === "income") return form.income ? "Editar ingreso" : "Nuevo ingreso";
  return "Registrar pago";
}

// The unified money feed for one Project, scoped to a single month. Owns the
// month selector, the monthly KPI summary, the merged Movimientos list, the FAB
// add-flow, and the edit/delete modals — replacing the old per-table sections.
export default function MovementsFeed({
  projectId,
  currencies,
  defaultSplitMode,
}: {
  projectId: Id<"projects">;
  currencies: Currency[];
  defaultSplitMode: SplitMode;
}) {
  const [period, setPeriod] = useState(currentPeriod);
  const [form, setForm] = useState<FormState | null>(null);
  const [detail, setDetail] = useState<Movement | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Movement | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const participants = useQuery(api.participants.list, { projectId });
  const expenses = useQuery(api.expenses.listByPeriod, { projectId, period });
  const incomes = useQuery(api.incomes.listByPeriod, { projectId, period });
  const settlements = useQuery(api.settlements.listByPeriod, {
    projectId,
    period,
  });

  const removeExpense = useMutation(api.expenses.remove);
  const removeIncome = useMutation(api.incomes.remove);
  const removeSettlement = useMutation(api.settlements.remove);

  const nameByUser = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of participants ?? []) {
      map.set(p.userId, p.name ?? p.email ?? "Usuario desconocido");
    }
    return map;
  }, [participants]);

  const movements = useMemo(
    () =>
      buildMovements(
        expenses ?? [],
        incomes ?? [],
        settlements ?? [],
        (userId) => nameByUser.get(userId) ?? "Desconocido",
      ),
    [expenses, incomes, settlements, nameByUser],
  );

  const loading =
    expenses === undefined ||
    incomes === undefined ||
    settlements === undefined;

  // One KPI row per currency: amounts in different currencies never add up.
  const totals = useMemo(
    () =>
      currencies.map((currency) => {
        const sum = (items: { amountCents: number; currency: string }[]) =>
          items
            .filter((item) => item.currency === currency)
            .reduce((s, item) => s + item.amountCents, 0);
        const gastos = sum(expenses ?? []);
        const ingresos = sum(incomes ?? []);
        return { currency, gastos, ingresos, neto: ingresos - gastos };
      }),
    [currencies, expenses, incomes],
  );

  const memberCount = participants?.length ?? 0;

  const fabActions: FabAction[] = [];
  if (memberCount >= 1) {
    fabActions.push({
      label: "Nuevo gasto",
      onSelect: () => setForm({ kind: "expense" }),
    });
    fabActions.push({
      label: "Nuevo ingreso",
      onSelect: () => setForm({ kind: "income" }),
    });
  }
  if (memberCount >= 2) {
    fabActions.push({
      label: "Registrar pago",
      onSelect: () => setForm({ kind: "settlement" }),
    });
  }

  function rowItems(movement: Movement): MenuItem[] {
    const items: MenuItem[] = [];
    if (movement.kind === "expense" && movement.expense) {
      const expense = movement.expense;
      items.push({
        label: "Editar",
        onSelect: () => setForm({ kind: "expense", expense }),
      });
    }
    if (movement.kind === "income" && movement.income) {
      const income = movement.income;
      items.push({
        label: "Editar",
        onSelect: () => setForm({ kind: "income", income }),
      });
    }
    items.push({
      label: "Eliminar",
      danger: true,
      onSelect: () => {
        setDeleteError(null);
        setPendingDelete(movement);
      },
    });
    return items;
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      if (pendingDelete.expense) {
        await removeExpense({ expenseId: pendingDelete.expense._id });
      } else if (pendingDelete.income) {
        await removeIncome({ incomeId: pendingDelete.income._id });
      } else if (pendingDelete.settlement) {
        await removeSettlement({ settlementId: pendingDelete.settlement._id });
      }
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(convexErrorMessage(err, "No se pudo eliminar."));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">{periodLabel(period)}</h2>
          <Input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            aria-label="Mes"
            className="w-auto"
          />
        </div>
        {totals.map(({ currency, gastos, ingresos, neto }) => (
          <div key={currency} className="grid grid-cols-3 gap-3">
            <KpiTile
              label="Gastos"
              value={formatCents(gastos, currency)}
              tone="text-danger"
            />
            <KpiTile
              label="Ingresos"
              value={formatCents(ingresos, currency)}
              tone="text-success"
            />
            <KpiTile
              label="Neto"
              value={`${neto >= 0 ? "+" : "-"}${formatCents(
                Math.abs(neto),
                currency,
              )}`}
              tone={neto >= 0 ? "text-success" : "text-danger"}
            />
          </div>
        ))}
      </Card>

      <Card>
        <h2 className="mb-2 font-medium">Movimientos</h2>
        {loading ? (
          <p className="text-sm text-muted">Cargando…</p>
        ) : movements.length === 0 ? (
          <p className="text-sm text-muted">
            {memberCount === 0
              ? "Agrega participantes para empezar a registrar movimientos."
              : `Sin movimientos para ${periodLabel(period).toLowerCase()}.`}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {movements.map((movement) => (
              <MovementRow
                key={`${movement.kind}-${movement.id}`}
                movement={movement}
                items={rowItems(movement)}
                onOpen={() => setDetail(movement)}
              />
            ))}
          </ul>
        )}
      </Card>

      <Fab actions={fabActions} />

      {form && participants && (
        <Dialog open onClose={() => setForm(null)} title={formTitle(form)}>
          {form.kind === "expense" && (
            <ExpenseForm
              projectId={projectId}
              currencies={currencies}
              defaultSplitMode={defaultSplitMode}
              participants={participants}
              defaultPeriod={period}
              expense={form.expense}
              onDone={() => setForm(null)}
            />
          )}
          {form.kind === "income" && (
            <IncomeForm
              projectId={projectId}
              currencies={currencies}
              defaultSplitMode={defaultSplitMode}
              participants={participants}
              defaultPeriod={period}
              income={form.income}
              onDone={() => setForm(null)}
            />
          )}
          {form.kind === "settlement" && (
            <SettlementForm
              projectId={projectId}
              currencies={currencies}
              participants={participants}
              defaultPeriod={period}
              onDone={() => setForm(null)}
            />
          )}
        </Dialog>
      )}

      {detail && (
        <Dialog open onClose={() => setDetail(null)} title={detail.title}>
          <MovementDetail
            movement={detail}
            onEdit={
              detail.expense
                ? () => {
                    const expense = detail.expense;
                    setDetail(null);
                    setForm({ kind: "expense", expense });
                  }
                : detail.income
                  ? () => {
                      const income = detail.income;
                      setDetail(null);
                      setForm({ kind: "income", income });
                    }
                  : undefined
            }
            onDelete={() => {
              const movement = detail;
              setDetail(null);
              setDeleteError(null);
              setPendingDelete(movement);
            }}
          />
        </Dialog>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Eliminar movimiento"
        message="Esta acción no se puede deshacer. ¿Eliminar este movimiento?"
        pending={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => {
          setPendingDelete(null);
          setDeleteError(null);
        }}
      />
    </div>
  );
}

function KpiTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-[var(--radius)] bg-surface-muted p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-sm font-semibold tabular-nums ${tone}`}>
        {value}
      </p>
    </div>
  );
}
