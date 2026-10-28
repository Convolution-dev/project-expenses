import type { CostBasis, Provider } from "@/server/costs/types";

/** Fixed order = fixed color slot (`--series-N`). Never reorder by value. */
export const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "vercel", label: "Vercel" },
  { id: "convex", label: "Convex" },
  { id: "ai-gateway", label: "AI Gateway" },
  { id: "planetscale", label: "PlanetScale" },
  { id: "postmark", label: "Postmark" },
  { id: "clerk", label: "Clerk" },
  { id: "manual", label: "Otros" },
];

export const seriesColor = (provider: Provider) =>
  `var(--series-${PROVIDERS.findIndex((p) => p.id === provider) + 1})`;

export const BASIS_LABEL: Record<CostBasis, string> = {
  measured: "Medido",
  allocated: "Asignado",
  fixed: "Fijo",
};

export const usd = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const monthLabel = (month: string) =>
  new Date(`${month}-01T12:00:00Z`).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });

export function lastMonths(count: number): string[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7),
  );
}
