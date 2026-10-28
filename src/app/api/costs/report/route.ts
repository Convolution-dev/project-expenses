import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { buildReport, type Report } from "@/server/costs/report";

// Cost data reads billing APIs with team-wide credentials: only signed-in
// users get it. Reports are cached per month for 10 minutes; `?fresh` skips it.
const cache = new Map<string, { at: number; report: Report }>();
const TTL_MS = 10 * 60 * 1000;

export async function GET(request: Request) {
  if (!(await isAuthenticatedNextjs())) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const month = params.get("month") ?? new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return Response.json({ error: "month debe ser YYYY-MM" }, { status: 400 });
  }

  const hit = cache.get(month);
  if (hit && Date.now() - hit.at < TTL_MS && !params.has("fresh")) {
    return Response.json(hit.report);
  }
  const report = await buildReport(month);
  cache.set(month, { at: Date.now(), report });
  return Response.json(report);
}
