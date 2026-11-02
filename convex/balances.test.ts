// @vitest-environment edge-runtime
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import { actingAs } from "./testing";

const modules = import.meta.glob("./**/*.*s");

test("forPeriod suggests the minimal transfers that zero the month, per currency", async () => {
  const { t, as, userId: anaId } = await actingAs(modules, "ana@example.com");
  const projectId = await as.mutation(api.projects.create, {
    name: "Trip",
    currencies: ["ARS", "USD"],
  });
  const bobId = await t.run((db) => db.db.insert("users", { email: "bob@example.com" }));
  await as.mutation(api.participants.add, { projectId, email: "bob@example.com" });

  const split = { mode: "equal" as const, beneficiaries: [{ userId: anaId }, { userId: bobId }] };
  await as.mutation(api.expenses.create, {
    projectId,
    title: "Hotel",
    amountCents: 12000,
    currency: "USD",
    payerId: anaId,
    split,
    period: "2026-06",
    attachments: [],
  });
  await as.mutation(api.expenses.create, {
    projectId,
    title: "Cena",
    amountCents: 5000,
    currency: "ARS",
    payerId: bobId,
    split,
    period: "2026-06",
    attachments: [],
  });

  const balances = await as.query(api.balances.forPeriod, { projectId, period: "2026-06" });

  // Currencies never offset each other: each one gets its own transfers.
  expect(balances.map((b) => [b.currency, b.transfers])).toEqual([
    ["ARS", [{ fromUserId: anaId, toUserId: bobId, amountCents: 2500 }]],
    ["USD", [{ fromUserId: bobId, toUserId: anaId, amountCents: 6000 }]],
  ]);
});
