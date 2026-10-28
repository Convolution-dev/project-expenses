import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { Hono } from "hono";
import { handle } from "hono/vercel";
import { buildReport, type Report } from "@/server/costs/report";

// Cost data reads billing APIs with team-wide credentials: only signed-in
// users get it. Reports are cached per month for 10 minutes; `?fresh` skips it.
const app = new Hono().basePath("/api/costs");
const cache = new Map<string, { at: number; report: Report }>();
const TTL_MS = 10 * 60 * 1000;

app.use("*", async (c, next) => {
  if (!(await isAuthenticatedNextjs())) return c.json({ error: "No autenticado" }, 401);
  await next();
});

app.get("/report", async (c) => {
  const month = c.req.query("month") ?? new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return c.json({ error: "month debe ser YYYY-MM" }, 400);

  const hit = cache.get(month);
  if (hit && Date.now() - hit.at < TTL_MS && c.req.query("fresh") === undefined) {
    return c.json(hit.report);
  }
  const report = await buildReport(month);
  cache.set(month, { at: Date.now(), report });
  return c.json(report);
});

export const GET = handle(app);
