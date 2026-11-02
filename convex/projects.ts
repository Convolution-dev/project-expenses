import { Infer, v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, mutation, query } from "./_generated/server";
import { getProjectOrThrow, requireProjectAccess, requireUserId } from "./lib/access";
import { appError } from "./lib/errors";
import { currencyValidator } from "./lib/validators";

const DEFAULT_CURRENCIES: Currency[] = ["USD"];
const splitModeValidator = v.union(v.literal("equal"), v.literal("weighted"));

type Currency = Infer<typeof currencyValidator>;

function normalizeCurrencies(currencies: Currency[]): Currency[] {
  const unique = [...new Set(currencies)];
  if (unique.length === 0) {
    throw appError("NO_CURRENCIES", "El proyecto necesita al menos una moneda.");
  }
  return unique;
}

function assertName(name: string): string {
  const trimmed = name.trim();
  if (trimmed === "") {
    throw appError("INVALID_NAME", "El proyecto necesita un nombre.");
  }
  return trimmed;
}

// Every Expense, Income and Settlement of a Project.
async function projectItems(ctx: MutationCtx, projectId: Id<"projects">) {
  const [expenses, incomes, settlements] = await Promise.all([
    ctx.db
      .query("expenses")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect(),
    ctx.db
      .query("incomes")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect(),
    ctx.db
      .query("settlements")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect(),
  ]);
  return [...expenses, ...incomes, ...settlements];
}

// Any signed-in User may start a Project; the creator becomes its first
// Participant. CONTEXT.md → Project, Participant.
export const create = mutation({
  args: {
    name: v.string(),
    currencies: v.optional(v.array(currencyValidator)),
    defaultSplitMode: v.optional(splitModeValidator),
  },
  handler: async (ctx, { name, currencies, defaultSplitMode }) => {
    const userId = await requireUserId(ctx);
    const projectId = await ctx.db.insert("projects", {
      name: assertName(name),
      currencies: normalizeCurrencies(currencies ?? DEFAULT_CURRENCIES),
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

// Null once the Project is deleted, so an open page shows "not found".
export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await requireUserId(ctx);
    return ctx.db.get(projectId);
  },
});

// A currency can only be dropped while no item is recorded in it, so no amount
// is left in a currency the Project no longer has.
export const update = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    currencies: v.array(currencyValidator),
    defaultSplitMode: splitModeValidator,
  },
  handler: async (ctx, { projectId, name, currencies, defaultSplitMode }) => {
    await requireUserId(ctx);
    const project = await getProjectOrThrow(ctx, projectId);
    const next = normalizeCurrencies(currencies);
    const dropped = project.currencies.filter((c) => !next.includes(c));
    if (dropped.length > 0) {
      const items = await projectItems(ctx, projectId);
      const inUse = dropped.filter((c) => items.some((item) => item.currency === c));
      if (inUse.length > 0) {
        throw appError(
          "CURRENCY_IN_USE",
          `No se puede quitar ${inUse.join(", ")}: hay movimientos en esa moneda.`,
        );
      }
    }
    await ctx.db.patch(projectId, {
      name: assertName(name),
      currencies: next,
      defaultSplitMode,
    });
  },
});

// Deletes the Project with everything in it: Participants, Expenses, Incomes,
// Settlements and their attached files. Cannot be undone.
export const remove = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await requireProjectAccess(ctx, projectId);
    for (const item of await projectItems(ctx, projectId)) {
      for (const storageId of item.attachments) {
        await ctx.storage.delete(storageId);
      }
      await ctx.db.delete(item._id);
    }
    const participants = await ctx.db
      .query("participants")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const participant of participants) {
      await ctx.db.delete(participant._id);
    }
    await ctx.db.delete(projectId);
  },
});
