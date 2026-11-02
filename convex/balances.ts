import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { QueryCtx, query } from "./_generated/server";
import { requireProjectAccess } from "./lib/access";
import {
  PeriodLedger,
  Transfer,
  netBalances,
  suggestedTransfers,
} from "../src/lib/money/balance";

async function loadLedger(
  ctx: QueryCtx,
  projectId: Id<"projects">,
  period: string,
): Promise<PeriodLedger> {
  const [expenses, incomes, settlements] = await Promise.all([
    ctx.db
      .query("expenses")
      .withIndex("by_project_period", (q) =>
        q.eq("projectId", projectId).eq("period", period),
      )
      .collect(),
    ctx.db
      .query("incomes")
      .withIndex("by_project_period", (q) =>
        q.eq("projectId", projectId).eq("period", period),
      )
      .collect(),
    ctx.db
      .query("settlements")
      .withIndex("by_project_period", (q) =>
        q.eq("projectId", projectId).eq("period", period),
      )
      .collect(),
  ]);

  return {
    expenses: expenses.map((e) => ({
      amountCents: e.amountCents,
      payerId: e.payerId,
      split: e.split,
    })),
    incomes: incomes.map((i) => ({
      amountCents: i.amountCents,
      recipientId: i.recipientId,
      split: i.split,
    })),
    settlements: settlements.map((s) => ({
      fromUserId: s.fromUserId,
      toUserId: s.toUserId,
      amountCents: s.amountCents,
    })),
  };
}

export interface PeriodBalance {
  net: { userId: string; cents: number }[];
  transfers: Transfer[];
}

// The Settle button: the live Balance for a Project + month and the minimal
// transfers that bring it to zero. Computed on demand, never stored.
// CONTEXT.md → Balance.
export const forPeriod = query({
  args: { projectId: v.id("projects"), period: v.string() },
  handler: async (ctx, { projectId, period }): Promise<PeriodBalance> => {
    await requireProjectAccess(ctx, projectId);
    const ledger = await loadLedger(ctx, projectId, period);
    const net = [...netBalances(ledger)].map(([userId, cents]) => ({
      userId,
      cents,
    }));
    return { net, transfers: suggestedTransfers(ledger) };
  },
});
