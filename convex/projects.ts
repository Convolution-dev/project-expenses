import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireProjectAccess, requireUserId } from "./lib/access";

const DEFAULT_CURRENCY = "USD";
const splitModeValidator = v.union(v.literal("equal"), v.literal("weighted"));

// Any signed-in User may start a Project; the creator becomes its first
// Participant. CONTEXT.md → Project, Participant.
export const create = mutation({
  args: {
    name: v.string(),
    currency: v.optional(v.string()),
    defaultSplitMode: v.optional(splitModeValidator),
  },
  handler: async (ctx, { name, currency, defaultSplitMode }) => {
    const userId = await requireUserId(ctx);
    const projectId = await ctx.db.insert("projects", {
      name,
      currency: currency ?? DEFAULT_CURRENCY,
      defaultSplitMode: defaultSplitMode ?? "equal",
      createdBy: userId,
    });
    await ctx.db.insert("participants", { projectId, userId });
    return projectId;
  },
});

// Every Project, for any signed-in User. CONTEXT.md → Project.
export const list = query({
  args: {},
  handler: async (ctx): Promise<Doc<"projects">[]> => {
    await requireUserId(ctx);
    return ctx.db.query("projects").order("desc").collect();
  },
});

export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await requireProjectAccess(ctx, projectId);
    return ctx.db.get(projectId);
  },
});
