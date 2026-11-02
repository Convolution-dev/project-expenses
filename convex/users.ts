import { createAccount } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";

// Sign-up is closed (see auth.ts), so accounts are created from the CLI:
//   npx convex run users:create '{"email":"ana@example.com","password":"…","name":"Ana"}'
// Add --prod to create it in production.
export const create = internalAction({
  args: { email: v.string(), password: v.string(), name: v.optional(v.string()) },
  handler: async (ctx, { email, password, name }) => {
    if (password.length < 8) {
      throw new Error("La contraseña debe tener al menos 8 caracteres.");
    }
    const { user } = await createAccount(ctx, {
      provider: "password",
      account: { id: email, secret: password },
      profile: { email, ...(name ? { name } : {}) },
    });
    return user._id;
  },
});
