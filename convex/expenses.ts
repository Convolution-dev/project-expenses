import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireProjectAccess } from "./lib/access";
import { assertValidItem } from "./lib/items";
import { attachmentsValidator, splitValidator } from "./lib/validators";
import { appError } from "./lib/errors";

// Record a cost fronted by one Payer for a set of Beneficiaries. The split is
// snapshotted onto the Expense at creation. CONTEXT.md → Expense.
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    note: v.optional(v.string()),
    amountCents: v.number(),
    payerId: v.id("users"),
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
      actorId: args.payerId,
      split: args.split,
    });
    return ctx.db.insert("expenses", { ...args, registrarId });
  },
});

export const listByPeriod = query({
  args: { projectId: v.id("projects"), period: v.string() },
  handler: async (ctx, { projectId, period }): Promise<Doc<"expenses">[]> => {
    await requireProjectAccess(ctx, projectId);
    return ctx.db
      .query("expenses")
      .withIndex("by_project_period", (q) =>
        q.eq("projectId", projectId).eq("period", period),
      )
      .collect();
  },
});

// Items are freely editable — nothing is ever frozen. CONTEXT.md → Period.
export const update = mutation({
  args: {
    expenseId: v.id("expenses"),
    title: v.string(),
    note: v.optional(v.string()),
    amountCents: v.number(),
    payerId: v.id("users"),
    split: splitValidator,
    period: v.string(),
    attachments: attachmentsValidator,
  },
  handler: async (ctx, { expenseId, ...fields }) => {
    const expense = await ctx.db.get(expenseId);
    if (expense === null) {
      throw appError("EXPENSE_NOT_FOUND", "No se encontró el gasto.");
    }
    await requireProjectAccess(ctx, expense.projectId);
    await assertValidItem(ctx, {
      projectId: expense.projectId,
      amountCents: fields.amountCents,
      period: fields.period,
      actorId: fields.payerId,
      split: fields.split,
    });
    await ctx.db.patch(expenseId, fields);
  },
});

export const remove = mutation({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, { expenseId }) => {
    const expense = await ctx.db.get(expenseId);
    if (expense === null) {
      return;
    }
    await requireProjectAccess(ctx, expense.projectId);
    await ctx.db.delete(expenseId);
  },
});
