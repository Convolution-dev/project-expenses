"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import IconBadge from "@/components/ui/IconBadge";
import NewProjectForm from "@/components/projects/NewProjectForm";

// Projects home: every Project (all Users see all of them), plus a create
// affordance.
export default function ProjectsPage() {
  const projects = useQuery(api.projects.list);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proyectos"
        description="Espacios de gastos compartidos."
        action={
          !creating && (
            <Button onClick={() => setCreating(true)}>Nuevo proyecto</Button>
          )
        }
      />

      {creating && (
        <Card>
          <NewProjectForm onDone={() => setCreating(false)} />
        </Card>
      )}

      {projects === undefined ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : projects.length === 0 ? (
        !creating && (
          <Card>
            <p className="text-sm text-muted">
              Aún no hay proyectos. Crea uno para empezar a registrar gastos
              compartidos.
            </p>
          </Card>
        )
      ) : (
        <ul className="space-y-3">
          {projects.map((project) => (
            <li key={project._id}>
              <Link href={`/projects/${project._id}`} className="block">
                <Card className="transition-colors hover:border-primary">
                  <div className="flex items-center gap-3">
                    <IconBadge tone="primary">
                      {project.name.charAt(0).toUpperCase()}
                    </IconBadge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{project.name}</p>
                      <p className="truncate text-sm text-muted">
                        {project.currency} ·{" "}
                        {project.defaultSplitMode === "equal"
                          ? "Equitativo"
                          : "Ponderado"}
                      </p>
                    </div>
                    <span className="shrink-0 text-lg text-muted">›</span>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
