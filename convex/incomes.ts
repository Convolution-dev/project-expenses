import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireProjectAccess } from "./lib/access";
import { assertValidItem } from "./lib/items";
import { resolveCurrency } from "./lib/guards";
import {
  attachmentsValidator,
  currencyValidator,
  splitValidator,
} from "./lib/validators";
import { appError } from "./lib/errors";

// Record money from outside the group, held by one Recipient and credited to
// the Beneficiaries — the mirror of an Expense. CONTEXT.md → Income.
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    description: v.string(),
    amountCents: v.number(),
    currency: v.optional(currencyValidator),
    recipientId: v.id("users"),
    split: splitValidator,
    period: v.string(),
    attachments: attachmentsValidator,
  },
  handler: async (ctx, args) => {
    const registrarId = await requireProjectAccess(ctx, args.projectId);
    await assertValidItem(ctx, {
      projectId: args.projectId,
      amountCents: args.amountCents,
      period: args.period,
      actorId: args.recipientId,
      split: args.split,
    });
    const currency = await resolveCurrency(ctx, args.projectId, args.currency);
    return ctx.db.insert("incomes", { ...args, currency, registrarId });
  },
});

export const listByPeriod = query({
  args: { projectId: v.id("projects"), period: v.string() },
  handler: async (ctx, { projectId, period }): Promise<Doc<"incomes">[]> => {
    await requireProjectAccess(ctx, projectId);
    return ctx.db
      .query("incomes")
      .withIndex("by_project_period", (q) =>
        q.eq("projectId", projectId).eq("period", period),
      )
      .collect();
  },
});

// Items are freely editable — nothing is ever frozen. CONTEXT.md → Period.
export const update = mutation({
  args: {
    incomeId: v.id("incomes"),
    title: v.string(),
    description: v.string(),
    amountCents: v.number(),
    currency: v.optional(currencyValidator),
    recipientId: v.id("users"),
    split: splitValidator,
    period: v.string(),
    attachments: attachmentsValidator,
  },
  handler: async (ctx, { incomeId, ...fields }) => {
    const income = await ctx.db.get(incomeId);
    if (income === null) {
      throw appError("INCOME_NOT_FOUND", "No se encontró el ingreso.");
    }
    await requireProjectAccess(ctx, income.projectId);
    await assertValidItem(ctx, {
      projectId: income.projectId,
      amountCents: fields.amountCents,
      period: fields.period,
      actorId: fields.recipientId,
      split: fields.split,
    });
    const currency = await resolveCurrency(
      ctx,
      income.projectId,
      fields.currency ?? income.currency,
    );
    await ctx.db.patch(incomeId, { ...fields, currency });
  },
});

export const remove = mutation({
  args: { incomeId: v.id("incomes") },
  handler: async (ctx, { incomeId }) => {
    const income = await ctx.db.get(incomeId);
    if (income === null) {
      return;
    }
    await requireProjectAccess(ctx, income.projectId);
    await ctx.db.delete(incomeId);
  },
});
