"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";

const SECTIONS = [
  { href: "/projects", label: "Proyectos" },
  { href: "/costos", label: "Costos" },
];

// Persistent chrome for every authenticated view: brand returns to the
// Projects home, section tabs and sign-out are always reachable from the header.
export default function AppShell({ children }: { children: ReactNode }) {
  const { signOut } = useAuthActions();
  const pathname = usePathname();

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur">
        <Container className="flex h-14 items-center justify-between">
          <Link
            href="/projects"
            className="flex items-center gap-2 font-semibold tracking-tight hover:opacity-80"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-sm text-primary-foreground">
              C
            </span>
            <span className="hidden sm:inline">Convolution.Expenses</span>
          </Link>
          <div className="flex items-center gap-4">
            <nav aria-label="Secciones" className="flex items-center gap-1">
              {SECTIONS.map(({ href, label }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      active ? "bg-surface-muted text-foreground" : "text-muted hover:text-foreground"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
            <Button variant="secondary" size="sm" onClick={() => void signOut()}>
              Cerrar sesión
            </Button>
          </div>
        </Container>
      </header>
      <main className="flex-1 py-8">
        <Container>{children}</Container>
      </main>
    </div>
  );
}
