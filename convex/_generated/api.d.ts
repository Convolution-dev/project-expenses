/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as balances from "../balances.js";
import type * as expenses from "../expenses.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as incomes from "../incomes.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_guards from "../lib/guards.js";
import type * as lib_items from "../lib/items.js";
import type * as lib_validators from "../lib/validators.js";
import type * as participants from "../participants.js";
import type * as projects from "../projects.js";
import type * as settlements from "../settlements.js";
import type * as testing from "../testing.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  balances: typeof balances;
  expenses: typeof expenses;
  files: typeof files;
  http: typeof http;
  incomes: typeof incomes;
  "lib/access": typeof lib_access;
  "lib/errors": typeof lib_errors;
  "lib/guards": typeof lib_guards;
  "lib/items": typeof lib_items;
  "lib/validators": typeof lib_validators;
  participants: typeof participants;
  projects: typeof projects;
  settlements: typeof settlements;
  testing: typeof testing;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
