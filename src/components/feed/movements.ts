import { Doc } from "../../../convex/_generated/dataModel";

export type MovementKind = "expense" | "income" | "settlement";

// A direction the money flows, decoupled from the source table: outgoing group
// spend, incoming group money, or a debt-clearing transfer between members.
export type MovementDirection = "out" | "in" | "transfer";

// One normalized entry in the unified feed. The original document is carried so
// edit/delete can act on the right table without re-querying.
export interface Movement {
  kind: MovementKind;
  id: string;
  creationTime: number;
  title: string;
  subtitle: string;
  amountCents: number;
  currency: string;
  signed: MovementDirection;
  expense?: Doc<"expenses">;
  income?: Doc<"incomes">;
  settlement?: Doc<"settlements">;
}

type NameLookup = (userId: string) => string;

function beneficiaryCount(count: number): string {
  return count === 1 ? "1 beneficiario" : `${count} beneficiarios`;
}

// Merge the three money tables into one newest-first feed. Expenses and incomes
// keep their split context; settlements read as "deudor → acreedor".
export function buildMovements(
  expenses: Doc<"expenses">[],
  incomes: Doc<"incomes">[],
  settlements: Doc<"settlements">[],
  nameOf: NameLookup,
): Movement[] {
  const movements: Movement[] = [];

  for (const expense of expenses) {
    movements.push({
      kind: "expense",
      id: expense._id,
      creationTime: expense._creationTime,
      title: expense.title,
      subtitle: `${nameOf(expense.payerId)} pagó · ${beneficiaryCount(
        expense.split.beneficiaries.length,
      )}`,
      amountCents: expense.amountCents,
      currency: expense.currency,
      signed: "out",
      expense,
    });
  }

  for (const income of incomes) {
    movements.push({
      kind: "income",
      id: income._id,
      creationTime: income._creationTime,
      title: income.title,
      subtitle: `${nameOf(income.recipientId)} recibió · ${beneficiaryCount(
        income.split.beneficiaries.length,
      )}`,
      amountCents: income.amountCents,
      currency: income.currency,
      signed: "in",
      income,
    });
  }

  for (const settlement of settlements) {
    movements.push({
      kind: "settlement",
      id: settlement._id,
      creationTime: settlement._creationTime,
      title: `${nameOf(settlement.fromUserId)} → ${nameOf(settlement.toUserId)}`,
      subtitle: settlement.note ?? "Pago entre participantes",
      amountCents: settlement.amountCents,
      currency: settlement.currency,
      signed: "transfer",
      settlement,
    });
  }

  return movements.sort((a, b) => b.creationTime - a.creationTime);
}
