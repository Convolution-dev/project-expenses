import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { appError } from "./errors";

type Ctx = QueryCtx | MutationCtx;

// The signed-in User, or an error if the request is unauthenticated.
export async function requireUserId(ctx: Ctx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw appError("NOT_AUTHENTICATED", "Debes iniciar sesión.");
  }
  return userId;
}

// The signed-in User, acting on an existing Project. Every User sees and edits
// every Project: being a Participant only decides who is part of the money
// math. See CONTEXT.md → Project, Participant.
export async function requireProjectAccess(
  ctx: Ctx,
  projectId: Id<"projects">,
): Promise<Id<"users">> {
  const userId = await requireUserId(ctx);
  if ((await ctx.db.get(projectId)) === null) {
    throw appError("PROJECT_NOT_FOUND", "El proyecto no existe.");
  }
  return userId;
}
