"use client";

import { formatCents } from "@/lib/money/currency";
import IconBadge from "@/components/ui/IconBadge";
import Menu, { MenuItem } from "@/components/ui/Menu";
import type { Movement } from "@/components/feed/movements";

// Visual language per direction: outgoing money reads red and signed "-",
// incoming green and "+", a settlement transfer stays neutral (it moves debt,
// it is not group spend). The leading badge mirrors the same tone.
const DIRECTION = {
  out: { tone: "danger", glyph: "↗", sign: "-", amount: "text-danger" },
  in: { tone: "success", glyph: "↙", sign: "+", amount: "text-success" },
  transfer: { tone: "primary", glyph: "⇄", sign: "", amount: "text-foreground" },
} as const;

// A single row in the unified Movimientos feed: tinted badge, title + context,
// color-coded amount, and a kebab menu hiding edit/delete.
export default function MovementRow({
  movement,
  items,
  onOpen,
}: {
  movement: Movement;
  items: MenuItem[];
  onOpen: () => void;
}) {
  const direction = DIRECTION[movement.signed];

  return (
    <li className="flex items-center gap-1 py-1">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-[var(--radius)] px-2 py-2 text-left transition-colors hover:bg-surface-muted"
      >
        <IconBadge tone={direction.tone}>{direction.glyph}</IconBadge>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{movement.title}</p>
          <p className="truncate text-sm text-muted">{movement.subtitle}</p>
        </div>
        <span
          className={`shrink-0 text-sm font-semibold tabular-nums ${direction.amount}`}
        >
          {direction.sign}
          {formatCents(movement.amountCents, movement.currency)}
        </span>
      </button>
      <Menu items={items} />
    </li>
  );
}
