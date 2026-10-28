/**
 * Maps every provider resource to a project. A project is one deployed app;
 * a client is (project, Clerk org). Edit this file when a resource is added.
 *
 * Entries marked `// verificar` are inferred from names and need confirmation.
 */

export type ProjectConfig = {
  id: string;
  label: string;
  /** Vercel project names whose charges belong here. */
  vercelProjects: string[];
  /** Convex project ids (team "SW Factory"). */
  convexProjects: number[];
  /** PlanetScale database names. */
  planetscaleDatabases: string[];
  /** AI Gateway API key names used before per-org tagging. */
  aiGatewayKeys: string[];
  /** Env var holding this project's production Clerk secret key. */
  clerkSecretEnv?: string;
  /** Env vars for the per-org storage endpoint added to the app. */
  usageEndpoint?: { urlEnv: string; secretEnv: string };
  /** For apps without Clerk orgs: the whole project is a single client. */
  singleTenant?: boolean;
  /** Internal Convolution work, not billable to anyone. */
  internal?: boolean;
};

export const projects: ProjectConfig[] = [
  {
    id: "crm",
    label: "CRM (TocToc)",
    vercelProjects: ["crm"],
    convexProjects: [3011226],
    planetscaleDatabases: [],
    aiGatewayKeys: [],
    clerkSecretEnv: "CLERK_SECRET_KEY_CRM",
    usageEndpoint: { urlEnv: "USAGE_URL_CRM", secretEnv: "USAGE_SECRET_CRM" },
  },
  {
    id: "persys-crm",
    label: "Persys CRM",
    vercelProjects: ["persys-crm"],
    convexProjects: [2783775],
    planetscaleDatabases: [],
    aiGatewayKeys: [],
    clerkSecretEnv: "CLERK_SECRET_KEY_PERSYS_CRM",
    usageEndpoint: { urlEnv: "USAGE_URL_PERSYS_CRM", secretEnv: "USAGE_SECRET_PERSYS_CRM" },
    singleTenant: true, // verificar
  },
  {
    id: "persys",
    label: "Persys",
    vercelProjects: ["persys"],
    convexProjects: [],
    planetscaleDatabases: [],
    aiGatewayKeys: [],
    clerkSecretEnv: "CLERK_SECRET_KEY_PERSYS",
    singleTenant: true,
  },
  {
    id: "minicrm",
    label: "MiniCRM (coop5.space)",
    vercelProjects: ["minicrm"],
    convexProjects: [1329688], // verificar: minicrm-33c52
    planetscaleDatabases: [],
    aiGatewayKeys: ["minicrm issues"],
    clerkSecretEnv: "CLERK_SECRET_KEY_MINICRM",
    usageEndpoint: { urlEnv: "USAGE_URL_MINICRM", secretEnv: "USAGE_SECRET_MINICRM" },
  },
  {
    id: "minicrm2",
    label: "MiniCRM (minicrm.space)",
    vercelProjects: ["minicrm2"],
    convexProjects: [2023027],
    planetscaleDatabases: [],
    aiGatewayKeys: ["minicrm2 issues"],
    clerkSecretEnv: "CLERK_SECRET_KEY_MINICRM2",
    usageEndpoint: { urlEnv: "USAGE_URL_MINICRM2", secretEnv: "USAGE_SECRET_MINICRM2" },
  },
  {
    id: "gestion-judicial",
    label: "Gestión Judicial",
    vercelProjects: ["gestion-judicial"],
    convexProjects: [],
    planetscaleDatabases: ["mga"], // verificar
    aiGatewayKeys: ["gestion-judicial"],
    clerkSecretEnv: "CLERK_SECRET_KEY_GESTION_JUDICIAL",
    usageEndpoint: {
      urlEnv: "USAGE_URL_GESTION_JUDICIAL",
      secretEnv: "USAGE_SECRET_GESTION_JUDICIAL",
    },
  },
  {
    id: "custodia",
    label: "Custodia (testkey)", // verificar: qué es
    vercelProjects: [],
    convexProjects: [],
    planetscaleDatabases: [],
    aiGatewayKeys: ["testkey-custodia"],
    singleTenant: true,
  },
  {
    id: "interno",
    label: "Convolution (interno)",
    vercelProjects: ["crm-landing", "convolution-landing", "project-expenses"],
    convexProjects: [2051308, 1450362, 1229907], // proyect-expenses, eguia-backend, automations
    planetscaleDatabases: [],
    aiGatewayKeys: [],
    singleTenant: true,
    internal: true,
  },
];

/** Postmark servers mapped to a client. Servers not listed are unattributed. */
export const postmarkServers: Record<number, { projectId: string; orgId?: string }> = {
  // 19603569: { projectId: "crm", orgId: "org_..." }, // Mansilla Garzón & Asociados — verificar
};

/**
 * Costs no API reports (plan fees). USD per month.
 * `projectId` set: the fee belongs to that project; unset: shared by everyone.
 */
export const manualFixedCosts: { provider: "clerk" | "postmark" | "manual"; category: string; usd: number; projectId?: string }[] = [
  // { provider: "clerk", category: "Plan Pro", usd: 25, projectId: "crm" },
  // { provider: "postmark", category: "Plan", usd: 15 },
];

/** How shared fixed costs are split across billable clients. */
export const fixedCostPolicy: "equal" | "proportional-to-variable" = "equal";

/** Convex Starter rates (convex.dev/pricing, checked 2026-10-28). */
export const convexRates = {
  functionCallsPerMillion: 2.2,
  actionComputePerGbHour: 0.33,
  databaseStoragePerGbMonth: 0.22,
  databaseIoPerGb: 0.22,
  fileStoragePerGbMonth: 0.033,
  searchStoragePerGbMonth: 0.55,
  dataEgressPerGb: 0.132,
  included: {
    functionCallsMillions: 1,
    actionComputeGbHours: 20,
    databaseStorageGb: 0.5,
    databaseIoGb: 1,
    fileStorageGb: 1,
    searchStorageGb: 0.5,
    dataEgressGb: 1,
  },
};

export const projectByVercelName = new Map(
  projects.flatMap((p) => p.vercelProjects.map((name) => [name, p.id] as const)),
);
export const projectByConvexId = new Map(
  projects.flatMap((p) => p.convexProjects.map((id) => [id, p.id] as const)),
);
export const projectByDatabase = new Map(
  projects.flatMap((p) => p.planetscaleDatabases.map((db) => [db, p.id] as const)),
);
export const projectByAiKey = new Map(
  projects.flatMap((p) => p.aiGatewayKeys.map((key) => [key, p.id] as const)),
);
