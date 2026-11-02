import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { QueryCtx, query } from "./_generated/server";
import { getProjectOrThrow, requireUserId } from "./lib/access";
import {
  PeriodLedger,
  Transfer,
  netBalances,
  suggestedTransfers,
} from "../src/lib/money/balance";

type Currency = Doc<"projects">["currencies"][number];

// One ledger per currency: amounts in different currencies never offset each
// other. CONTEXT.md → Balance.
async function loadLedgers(
  ctx: QueryCtx,
  project: Doc<"projects">,
  period: string,
): Promise<Map<Currency, PeriodLedger>> {
  const [expenses, incomes, settlements] = await Promise.all([
    ctx.db
      .query("expenses")
      .withIndex("by_project_period", (q) =>
        q.eq("projectId", project._id).eq("period", period),
      )
      .collect(),
    ctx.db
      .query("incomes")
      .withIndex("by_project_period", (q) =>
        q.eq("projectId", project._id).eq("period", period),
      )
      .collect(),
    ctx.db
      .query("settlements")
      .withIndex("by_project_period", (q) =>
        q.eq("projectId", project._id).eq("period", period),
      )
      .collect(),
  ]);

  const ledgers = new Map<Currency, PeriodLedger>(
    project.currencies.map((currency) => [
      currency,
      { expenses: [], incomes: [], settlements: [] },
    ]),
  );
  const ledgerFor = (currency: Currency) => {
    let ledger = ledgers.get(currency);
    if (ledger === undefined) {
      ledger = { expenses: [], incomes: [], settlements: [] };
      ledgers.set(currency, ledger);
    }
    return ledger;
  };
  for (const e of expenses) {
    ledgerFor(e.currency).expenses.push({
      amountCents: e.amountCents,
      payerId: e.payerId,
      split: e.split,
    });
  }
  for (const i of incomes) {
    ledgerFor(i.currency).incomes.push({
      amountCents: i.amountCents,
      recipientId: i.recipientId,
      split: i.split,
    });
  }
  for (const s of settlements) {
    ledgerFor(s.currency).settlements.push({
      fromUserId: s.fromUserId,
      toUserId: s.toUserId,
      amountCents: s.amountCents,
    });
  }
  return ledgers;
}

export interface PeriodBalance {
  currency: Currency;
  net: { userId: string; cents: number }[];
  transfers: Transfer[];
}

// The Settle button: the live Balance for a Project + month, one per currency,
// with the minimal transfers that bring each to zero. Computed on demand, never
// stored. CONTEXT.md → Balance.
export const forPeriod = query({
  args: { projectId: v.id("projects"), period: v.string() },
  handler: async (ctx, { projectId, period }): Promise<PeriodBalance[]> => {
    await requireUserId(ctx);
    const project = await getProjectOrThrow(ctx, projectId);
    const ledgers = await loadLedgers(ctx, project, period);
    return [...ledgers].map(([currency, ledger]) => ({
      currency,
      net: [...netBalances(ledger)].map(([userId, cents]) => ({ userId, cents })),
      transfers: suggestedTransfers(ledger),
    }));
  },
});
