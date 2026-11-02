import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { appError } from "./lib/errors";

// Email + password auth for the small internal user set. See ADR 0001.
// Sign-up is closed: every User sees every Project, so accounts are created
// by hand with `npx convex run users:create`.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        if (params.flow === "signUp") {
          throw appError("SIGN_UP_CLOSED", "El registro está cerrado.");
        }
        return { email: params.email as string };
      },
    }),
  ],
});
