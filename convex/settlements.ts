import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireProjectAccess } from "./lib/access";
import {
  assertPeriod,
  assertPositiveCents,
  assertUsersAreParticipants,
} from "./lib/guards";
import { attachmentsValidator } from "./lib/validators";
import { appError } from "./lib/errors";

// Record an actual transfer that clears debt, full or partial. CONTEXT.md →
// Settlement (a transfer between Participants, not an Income).
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    amountCents: v.number(),
    period: v.string(),
    note: v.optional(v.string()),
    attachments: attachmentsValidator,
  },
  handler: async (ctx, args) => {
    const registrarId = await requireProjectAccess(ctx, args.projectId);
    assertPositiveCents(args.amountCents);
    assertPeriod(args.period);
    if (args.fromUserId === args.toUserId) {
      throw appError(
        "SAME_PARTICIPANT",
        "Una liquidación debe ser entre dos participantes distintos.",
      );
    }
    await assertUsersAreParticipants(ctx, args.projectId, [
      args.fromUserId,
      args.toUserId,
    ]);
    return ctx.db.insert("settlements", { ...args, registrarId });
  },
});

export const listByPeriod = query({
  args: { projectId: v.id("projects"), period: v.string() },
  handler: async (ctx, { projectId, period }): Promise<Doc<"settlements">[]> => {
    await requireProjectAccess(ctx, projectId);
    return ctx.db
      .query("settlements")
      .withIndex("by_project_period", (q) =>
        q.eq("projectId", projectId).eq("period", period),
      )
      .collect();
  },
});

export const remove = mutation({
  args: { settlementId: v.id("settlements") },
  handler: async (ctx, { settlementId }) => {
    const settlement = await ctx.db.get(settlementId);
    if (settlement === null) {
      return;
    }
    await requireProjectAccess(ctx, settlement.projectId);
    await ctx.db.delete(settlementId);
  },
});
