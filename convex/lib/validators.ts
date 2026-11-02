import { v } from "convex/values";

// The Split Rule shape shared by Expenses and Incomes, and by the schema.
// Single source of truth so the table definition and the mutation args agree.
// See CONTEXT.md → Split Rule.
export const splitValidator = v.object({
  mode: v.union(v.literal("equal"), v.literal("weighted")),
  beneficiaries: v.array(
    v.object({
      userId: v.id("users"),
      shares: v.optional(v.number()),
    }),
  ),
});

// The currencies a Project can hold (src/lib/money/currency.ts → CURRENCIES).
// Amounts are never converted between them. CONTEXT.md → Project.
export const currencyValidator = v.union(v.literal("ARS"), v.literal("USD"));

// Storage references for attached bills/receipts. CONTEXT.md → Expense/Income.
export const attachmentsValidator = v.array(v.id("_storage"));
