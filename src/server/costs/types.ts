export type Provider =
  | "vercel"
  | "ai-gateway"
  | "convex"
  | "planetscale"
  | "clerk"
  | "postmark"
  | "manual";

/**
 * measured  — the provider reports this amount for this exact project/org.
 * allocated — a measured project-level amount split across orgs by a measured weight.
 * fixed     — a cost nobody causes (plans, seats); split by policy.
 */
export type CostBasis = "measured" | "allocated" | "fixed";

export type Period = { month: string; from: Date; to: Date };

/** One amount attributed to a project, and to an org when the provider knows it. */
export type CostLine = {
  provider: Provider;
  category: string;
  projectId: string | null;
  orgId: string | null;
  /** Org name or slug, resolved to `orgId` within `projectId` when the provider has no id. */
  orgName?: string;
  basis: CostBasis;
  usd: number;
  note?: string;
};

/** How much of a project's usage belongs to each org, by some measured quantity. */
export type OrgWeights = {
  projectId: string;
  metric: string;
  byOrg: Record<string, number>;
};

export type OrgInfo = {
  orgId: string;
  projectId: string;
  name: string;
  activeUsers: number;
  slug?: string;
  /** From the project's dev Clerk instance: never weighs production costs. */
  dev?: boolean;
};

export type ProviderResult = {
  lines: CostLine[];
  weights?: OrgWeights[];
  orgs?: OrgInfo[];
  warnings?: string[];
};
