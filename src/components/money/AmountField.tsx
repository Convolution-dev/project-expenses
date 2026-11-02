import { InputHTMLAttributes } from "react";
import type { Currency } from "@/lib/money/currency";
import Field from "@/components/ui/Field";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

// Amount input with its currency. The currency picker only shows when the
// Project holds more than one. CONTEXT.md → Project.
export default function AmountField({
  id,
  currency,
  currencies,
  onCurrencyChange,
  ...inputProps
}: {
  id: string;
  currency: Currency;
  currencies: Currency[];
  onCurrencyChange: (currency: Currency) => void;
} & InputHTMLAttributes<HTMLInputElement>) {
  const single = currencies.length === 1;
  return (
    <Field label={single ? `Monto (${currency})` : "Monto"} htmlFor={id}>
      <div className="flex gap-2">
        {!single && (
          <Select
            aria-label="Moneda"
            value={currency}
            onChange={(e) => onCurrencyChange(e.target.value as Currency)}
            className="w-auto"
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        )}
        <Input id={id} inputMode="decimal" placeholder="0.00" {...inputProps} />
      </div>
    </Field>
  );
}
