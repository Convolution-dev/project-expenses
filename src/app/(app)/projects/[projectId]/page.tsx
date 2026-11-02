"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import ParticipantsPanel from "@/components/projects/ParticipantsPanel";
import MovementsFeed from "@/components/feed/MovementsFeed";
import SettleSection from "@/components/settle/SettleSection";
import ProjectActions from "@/components/projects/ProjectActions";

// Project detail: header with edit/delete, Participants, the movements feed
// and the Settle view. Any signed-in User can open any Project.
export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const project = useQuery(api.projects.get, {
    projectId: projectId as Id<"projects">,
  });

  return (
    <div className="space-y-6">
      <Link href="/projects" className="text-sm text-muted hover:text-foreground">
        ← Volver a proyectos
      </Link>

      {project === undefined ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : project === null ? (
        <Card>
          <p className="text-sm text-muted">
            Proyecto no encontrado.
          </p>
        </Card>
      ) : (
        <>
          <PageHeader
            title={project.name}
            description={`${project.currencies.join(" / ")} · Reparto predeterminado: ${
              project.defaultSplitMode === "equal"
                ? "Equitativo"
                : "Ponderado por partes"
            }`}
            action={<ProjectActions project={project} />}
          />
          <ParticipantsPanel projectId={project._id} />
          <MovementsFeed
            projectId={project._id}
            currencies={project.currencies}
            defaultSplitMode={project.defaultSplitMode}
          />
          <SettleSection projectId={project._id} />
        </>
      )}
    </div>
  );
}
