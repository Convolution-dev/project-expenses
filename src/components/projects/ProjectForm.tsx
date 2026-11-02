"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Doc } from "../../../convex/_generated/dataModel";
import { CURRENCIES, type Currency } from "@/lib/money/currency";
import { convexErrorMessage } from "@/lib/convexError";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Field from "@/components/ui/Field";

type SplitMode = "equal" | "weighted";

// Create a Project, or edit one when `project` is given. A Project holds one
// or more currencies (CONTEXT.md → Project). A new Project starts with ARS and
// USD and an Equal split; after creating it we navigate into it.
export default function ProjectForm({
  project,
  onDone,
}: {
  project?: Doc<"projects">;
  onDone?: () => void;
}) {
  const router = useRouter();
  const createProject = useMutation(api.projects.create);
  const updateProject = useMutation(api.projects.update);
  const [name, setName] = useState(project?.name ?? "");
  const [currencies, setCurrencies] = useState<Currency[]>(
    project?.currencies ?? [...CURRENCIES],
  );
  const [defaultSplitMode, setDefaultSplitMode] = useState<SplitMode>(
    project?.defaultSplitMode ?? "equal",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function toggleCurrency(currency: Currency, checked: boolean) {
    setCurrencies((prev) =>
      CURRENCIES.filter((c) => (c === currency ? checked : prev.includes(c))),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const fields = { name: name.trim(), currencies, defaultSplitMode };
      if (project) {
        await updateProject({ projectId: project._id, ...fields });
        onDone?.();
      } else {
        const projectId = await createProject(fields);
        onDone?.();
        router.push(`/projects/${projectId}`);
      }
    } catch (err) {
      setError(convexErrorMessage(err, "No se pudo guardar el proyecto."));
      setPending(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <Field label="Nombre" htmlFor="project-name">
        <Input
          id="project-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ej. App de delivery"
          required
          autoFocus
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Monedas</legend>
          <div className="flex h-10 items-center gap-4">
            {CURRENCIES.map((currency) => (
              <label key={currency} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={currencies.includes(currency)}
                  onChange={(e) => toggleCurrency(currency, e.target.checked)}
                />
                {currency}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Reparto predeterminado" htmlFor="project-split">
          <Select
            id="project-split"
            value={defaultSplitMode}
            onChange={(e) => setDefaultSplitMode(e.target.value as SplitMode)}
          >
            <option value="equal">Equitativo</option>
            <option value="weighted">Ponderado por partes</option>
          </Select>
        </Field>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        {onDone && (
          <Button type="button" variant="secondary" onClick={onDone}>
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          disabled={pending || name.trim() === "" || currencies.length === 0}
        >
          {pending ? "Guardando…" : project ? "Guardar" : "Crear proyecto"}
        </Button>
      </div>
    </form>
  );
}
