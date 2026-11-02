"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Doc } from "../../../convex/_generated/dataModel";
import { convexErrorMessage } from "@/lib/convexError";
import Menu from "@/components/ui/Menu";
import Dialog from "@/components/ui/Dialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ProjectForm from "@/components/projects/ProjectForm";

// Edit / delete for a Project, behind the header's kebab menu. Deleting takes
// every movement with it, so it asks first and then returns to the list.
export default function ProjectActions({ project }: { project: Doc<"projects"> }) {
  const router = useRouter();
  const removeProject = useMutation(api.projects.remove);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setDeleting(true);
    setError(null);
    try {
      await removeProject({ projectId: project._id });
      router.push("/projects");
    } catch (err) {
      setError(convexErrorMessage(err, "No se pudo eliminar el proyecto."));
      setDeleting(false);
    }
  }

  return (
    <>
      <Menu
        label="Acciones del proyecto"
        items={[
          { label: "Editar", onSelect: () => setEditing(true) },
          {
            label: "Eliminar",
            danger: true,
            onSelect: () => {
              setError(null);
              setConfirming(true);
            },
          },
        ]}
      />
      {editing && (
        <Dialog open onClose={() => setEditing(false)} title="Editar proyecto">
          <ProjectForm project={project} onDone={() => setEditing(false)} />
        </Dialog>
      )}
      <ConfirmDialog
        open={confirming}
        title="Eliminar proyecto"
        message={`Se eliminará "${project.name}" con todos sus gastos, ingresos, pagos y archivos. Esta acción no se puede deshacer.`}
        pending={deleting}
        error={error}
        onConfirm={confirmDelete}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
