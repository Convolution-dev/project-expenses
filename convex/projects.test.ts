// @vitest-environment edge-runtime
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import { actingAs } from "./testing";

const modules = import.meta.glob("./**/*.*s");

test("creating a project makes the creator a participant", async () => {
  const { userId, as } = await actingAs(modules, "ana@example.com");

  const projectId = await as.mutation(api.projects.create, { name: "Office Trip" });
  const participants = await as.query(api.participants.list, { projectId });

  expect(participants.map((p) => p.userId)).toContain(userId);
});

test("every user sees every project, even without being a participant", async () => {
  const { t, as: ana } = await actingAs(modules, "ana@example.com");
  const projectId = await ana.mutation(api.projects.create, { name: "Office Trip" });

  const bobId = await t.run((ctx) => ctx.db.insert("users", { email: "bob@example.com" }));
  const bob = t.withIdentity({ subject: `${bobId}|session` });

  const projects = await bob.query(api.projects.list, {});
  expect(projects.map((p) => p._id)).toContain(projectId);
  expect(await bob.query(api.projects.get, { projectId })).toMatchObject({ name: "Office Trip" });

  await bob.mutation(api.participants.add, { projectId, email: "bob@example.com" });
  const participants = await bob.query(api.participants.list, { projectId });
  expect(participants.map((p) => p.userId)).toContain(bobId);
});

test("listing projects requires being signed in", async () => {
  const { t } = await actingAs(modules, "ana@example.com");
  await expect(t.query(api.projects.list, {})).rejects.toThrow();
});
