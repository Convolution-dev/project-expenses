import { internalMutation } from "./_generated/server";

export const currencies = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const p of await ctx.db.query("projects").collect()) {
      await ctx.db.patch(p._id, { currencies: p.currencies ?? ["USD"], currency: undefined });
    }
    for (const table of ["expenses", "incomes", "settlements"] as const) {
      for (const doc of await ctx.db.query(table).collect()) {
        if (doc.currency === undefined) await ctx.db.patch(doc._id, { currency: "USD" });
      }
    }
  },
});
