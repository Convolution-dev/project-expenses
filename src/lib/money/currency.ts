// Conversion between major units (what a user types, e.g. "12.34") and the
// integer cents the backend stores. Kept Convex/React-free so it stays unit
// testable. CONTEXT.md → Project (amounts are exact cents in their currency).

const CENTS_PER_UNIT = 100;

// The currencies a Project can hold; mirrors convex/lib/validators.ts →
// currencyValidator. Amounts are never converted between them.
export const CURRENCIES = ["ARS", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

// Parse a major-unit string into positive integer cents, or null if it is not
// a valid positive money amount. Accepts an optional thousands-free decimal
// with up to two fraction digits, e.g. "12", "12.3", "12.34".
export function parseAmountToCents(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }
  const cents = Math.round(Number(trimmed) * CENTS_PER_UNIT);
  return cents > 0 ? cents : null;
}

// Format integer cents as a major-unit string with two fraction digits.
export function formatAmount(cents: number): string {
  return (cents / CENTS_PER_UNIT).toFixed(2);
}

// Format integer cents for display alongside its currency code.
export function formatCents(cents: number, currency: string): string {
  return `${currency} ${formatAmount(cents)}`;
}
