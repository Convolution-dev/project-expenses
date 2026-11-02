"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import Card from "@/components/ui/Card";
import Field from "@/components/ui/Field";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

// Sign-up is closed: accounts are created by hand (convex/users.ts).
export default function SignInForm() {
  const { signIn } = useAuthActions();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const data = new FormData(event.currentTarget);
    data.set("flow", "signIn");
    try {
      await signIn("password", data);
    } catch {
      setError("No se pudo iniciar sesión. Revisa tu correo y contraseña.");
      setPending(false);
    }
  }

  return (
    <Card className="w-full max-w-sm space-y-5">
      <h1 className="text-xl font-semibold">Iniciar sesión</h1>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <Field label="Correo electrónico" htmlFor="auth-email">
          <Input
            id="auth-email"
            type="email"
            name="email"
            placeholder="tu@correo.com"
            autoComplete="email"
            required
            autoFocus
          />
        </Field>

        <Field label="Contraseña" htmlFor="auth-password">
          <Input
            id="auth-password"
            type="password"
            name="password"
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" disabled={pending}>
          {pending ? "Procesando…" : "Iniciar sesión"}
        </Button>
      </form>

    </Card>
  );
}
