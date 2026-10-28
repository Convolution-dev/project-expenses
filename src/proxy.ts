import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

// Next.js 16 renamed the `middleware` file convention to `proxy`.
// Besides keeping the session cookie fresh, this enforces the auth boundary
// server-side: unauthenticated requests for /projects or /costos never reach a page.
const isProtected = createRouteMatcher(["/projects(.*)", "/costos(.*)"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  if (isProtected(request) && !(await convexAuth.isAuthenticated())) {
    return nextjsMiddlewareRedirect(request, "/");
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
