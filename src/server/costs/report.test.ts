import { describe, expect, it } from "vitest";
import { allocate } from "./report";
import type { ClientConfig } from "./catalog";
import type { CostLine, OrgInfo, OrgWeights } from "./types";

const line = (overrides: Partial<CostLine>): CostLine => ({
  provider: "convex",
  category: "test",
  projectId: null,
  orgId: null,
  basis: "measured",
  usd: 0,
  ...overrides,
});

const orgs: OrgInfo[] = [
  { orgId: "org_a", projectId: "crm", name: "A", activeUsers: 3 },
  { orgId: "org_b", projectId: "crm", name: "B", activeUsers: 1 },
];

const byKey = (rows: ReturnType<typeof allocate>) => new Map(rows.map((r) => [r.key, r]));

describe("allocate", () => {
  it("puts org-tagged lines on that org, resolving the project from Clerk", () => {
    const rows = byKey(allocate([line({ provider: "ai-gateway", orgId: "org_b", usd: 2 })], orgs, [], []));
    expect(rows.get("crm/org_b")?.measured).toBe(2);
  });

  it("splits a project-level line by the preferred measured weight", () => {
    const weights: OrgWeights[] = [
      { projectId: "crm", metric: "usuarios activos", byOrg: { org_a: 1, org_b: 1 } },
      { projectId: "crm", metric: "almacenamiento", byOrg: { org_a: 300, org_b: 100 } },
    ];
    const rows = byKey(allocate([line({ projectId: "crm", usd: 8 })], orgs, weights, []));
    // Convex prefers storage over users.
    expect(rows.get("crm/org_a")?.allocated).toBeCloseTo(6);
    expect(rows.get("crm/org_b")?.allocated).toBeCloseTo(2);
  });

  it("keeps a project line unsplit when no weight is available", () => {
    const rows = byKey(allocate([line({ projectId: "crm", usd: 5 })], orgs, [], []));
    expect(rows.get("crm/__sin_desglose__")?.total).toBe(5);
  });

  it("splits shared fixed costs equally across billable clients, never internal ones", () => {
    const rows = allocate(
      [
        line({ provider: "vercel", basis: "fixed", usd: 30 }),
        line({ projectId: "interno", usd: 1 }),
      ],
      orgs,
      [],
      [],
    );
    const fixed = Object.fromEntries(rows.map((r) => [r.key, r.fixed]));
    expect(fixed["crm/org_a"]).toBeCloseTo(15);
    expect(fixed["crm/org_b"]).toBeCloseTo(15);
    expect(fixed["interno/interno"]).toBe(0);
  });

  it("conserves the total", () => {
    const lines = [
      line({ provider: "vercel", basis: "fixed", usd: 17 }),
      line({ projectId: "crm", usd: 4 }),
      line({ provider: "ai-gateway", orgId: "org_a", usd: 3 }),
      line({ projectId: "nope", usd: 1 }),
    ];
    const weights: OrgWeights[] = [{ projectId: "crm", metric: "almacenamiento", byOrg: { org_a: 1, org_b: 3 } }];
    const total = allocate(lines, orgs, weights, []).reduce((acc, r) => acc + r.total, 0);
    expect(total).toBeCloseTo(25);
  });

  it("resolves an org given by name or slug, ignoring HTML-escaped ampersands", () => {
    const named: OrgInfo[] = [{ orgId: "org_mga", projectId: "crm", name: "MG&amp;A", slug: "mg-a-1", activeUsers: 0 }];
    const rows = byKey(allocate([line({ provider: "postmark", projectId: "crm", orgName: "MG&A", basis: "fixed", usd: 15 })], named, [], [], []));
    expect(rows.get("crm/org_mga")?.fixed).toBe(15);
  });

  describe("clients", () => {
    const clientOrgs: OrgInfo[] = [
      ...orgs,
      { orgId: "org_x", projectId: "gestion-judicial", name: "X", slug: "x-prod", activeUsers: 2 },
      { orgId: "org_x_dev", projectId: "gestion-judicial", name: "X dev", activeUsers: 0, dev: true },
    ];
    const config: ClientConfig[] = [
      {
        id: "x",
        label: "Cliente X",
        members: [
          { projectId: "gestion-judicial", org: "X-PROD" },
          { projectId: "gestion-judicial", org: "x dev" },
          { projectId: "crm", org: "A" },
        ],
      },
    ];

    it("folds the member rows into one, matching org name or slug", () => {
      const rows = byKey(
        allocate(
          [
            line({ provider: "ai-gateway", orgId: "org_a", usd: 1 }),
            line({ provider: "ai-gateway", orgId: "org_x", usd: 2 }),
            line({ provider: "ai-gateway", orgId: "org_x_dev", usd: 4 }),
            line({ provider: "ai-gateway", orgId: "org_b", usd: 8 }),
          ],
          clientOrgs,
          [],
          [],
          config,
        ),
      );
      const x = rows.get("cliente/x");
      expect(x?.total).toBe(7);
      expect(x?.activeUsers).toBe(5);
      expect(x?.orgName).toBe("Cliente X");
      expect(x?.lines.some((l) => l.note?.includes("X dev (dev)"))).toBe(true);
      expect(rows.has("crm/org_a")).toBe(false);
      expect(rows.get("crm/org_b")?.total).toBe(8);
    });

    it("gives a client one share of shared fixed costs, however many rows it has", () => {
      const rows = byKey(
        allocate([line({ provider: "vercel", basis: "fixed", usd: 10 })], clientOrgs, [], [], config),
      );
      expect(rows.get("cliente/x")?.fixed).toBeCloseTo(5);
      expect(rows.get("crm/org_b")?.fixed).toBeCloseTo(5);
    });

    it("warns when a configured org is not found", () => {
      const warnings: string[] = [];
      allocate([], orgs, [], warnings, [{ id: "y", label: "Y", members: [{ projectId: "crm", org: "Nadie" }] }]);
      expect(warnings).toContain("Cliente Y: no encontré la org «Nadie» en CRM (TocToc)");
    });
  });
});
