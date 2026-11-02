import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { attachmentsValidator, splitValidator } from "./lib/validators";

export default defineSchema({
  // Convex Auth tables (includes `users` — our User identity).
  ...authTables,

  // A container scoping all money math. CONTEXT.md → Project.
  projects: defineTable({
    name: v.string(),
    currency: v.optional(v.string()),
    currencies: v.optional(v.array(v.union(v.literal("ARS"), v.literal("USD")))),
    defaultSplitMode: v.union(v.literal("equal"), v.literal("weighted")),
    createdBy: v.id("users"),
  }).index("by_createdBy", ["createdBy"]),

  // A User added to a Project as a financial actor. CONTEXT.md → Participant.
  participants: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
  })
    .index("by_project", ["projectId"])
    .index("by_user", ["userId"])
    .index("by_project_user", ["projectId", "userId"]),

  // A cost: one Payer, a snapshotted Beneficiary set + Split Rule.
  // CONTEXT.md → Expense.
  expenses: defineTable({
    projectId: v.id("projects"),
    title: v.string(),
    note: v.optional(v.string()),
    amountCents: v.number(), // integer cents, project currency
    payerId: v.id("users"),
    currency: v.optional(v.union(v.literal("ARS"), v.literal("USD"))),
    split: splitValidator,
    period: v.string(), // "YYYY-MM"
    attachments: attachmentsValidator,
    registrarId: v.id("users"),
  })
    .index("by_project", ["projectId"])
    .index("by_project_period", ["projectId", "period"]),

  // Money from outside the group: one Recipient, mirror of Expense.
  // CONTEXT.md → Income.
  incomes: defineTable({
    projectId: v.id("projects"),
    title: v.string(),
    description: v.string(),
    amountCents: v.number(),
    recipientId: v.id("users"),
    currency: v.optional(v.union(v.literal("ARS"), v.literal("USD"))),
    split: splitValidator,
    period: v.string(), // "YYYY-MM"
    attachments: attachmentsValidator,
    registrarId: v.id("users"),
  })
    .index("by_project", ["projectId"])
    .index("by_project_period", ["projectId", "period"]),

  // A recorded transfer clearing debt (full or partial). CONTEXT.md → Settlement.
  settlements: defineTable({
    projectId: v.id("projects"),
    fromUserId: v.id("users"), // debtor
    toUserId: v.id("users"), // creditor
    currency: v.optional(v.union(v.literal("ARS"), v.literal("USD"))),
    amountCents: v.number(),
    period: v.string(), // "YYYY-MM"
    note: v.optional(v.string()),
    attachments: attachmentsValidator,
    registrarId: v.id("users"),
  })
    .index("by_project", ["projectId"])
    .index("by_project_period", ["projectId", "period"]),
});
