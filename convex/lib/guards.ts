import { Infer } from "convex/values";
import { Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { currencyValidator, splitValidator } from "./validators";
import { appError } from "./errors";
import { getProjectOrThrow } from "./access";

type Ctx = QueryCtx | MutationCtx;
type Split = Infer<typeof splitValidator>;
type Currency = Infer<typeof currencyValidator>;

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

// A Period is a calendar month tagged "YYYY-MM". CONTEXT.md → Period.
export function assertPeriod(period: string): void {
  if (!PERIOD_PATTERN.test(period)) {
    throw appError("INVALID_PERIOD", "El mes debe tener el formato AAAA-MM.");
  }
}

export function assertPositiveCents(amountCents: number): void {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw appError("INVALID_AMOUNT", "El monto debe ser positivo.");
  }
}

async function participantIds(
  ctx: Ctx,
  projectId: Id<"projects">,
): Promise<Set<string>> {
  const members = await ctx.db
    .query("participants")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .collect();
  return new Set(members.map((member) => member.userId));
}

// Every User referenced by an Expense/Income (its actor and Beneficiaries)
// must already be a Participant of the Project. Guards against splitting a
// cost onto someone who isn't in the Project.
export async function assertUsersAreParticipants(
  ctx: Ctx,
  projectId: Id<"projects">,
  userIds: Id<"users">[],
): Promise<void> {
  const participants = await participantIds(ctx, projectId);
  for (const userId of userIds) {
    if (!participants.has(userId)) {
      throw appError(
        "NOT_PARTICIPANTS",
        "Todos los actores y beneficiarios deben ser participantes del proyecto.",
      );
    }
  }
}

export function assertHasBeneficiaries(split: Split): void {
  if (split.beneficiaries.length === 0) {
    throw appError("NO_BENEFICIARIES", "Se requiere al menos un beneficiario.");
  }
}

// The currency an item is recorded in: the requested one, which must be one of
// the Project's currencies, or the Project's first currency when omitted.
// CONTEXT.md → Project.
export async function resolveCurrency(
  ctx: Ctx,
  projectId: Id<"projects">,
  requested: Currency | undefined,
): Promise<Currency> {
  const project = await getProjectOrThrow(ctx, projectId);
  const currency = requested ?? project.currencies[0];
  if (!project.currencies.includes(currency)) {
    throw appError(
      "INVALID_CURRENCY",
      `El proyecto no usa ${currency}. Monedas: ${project.currencies.join(", ")}.`,
    );
  }
  return currency;
}
