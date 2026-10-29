# Costos por cliente

`/costos` muestra cuánto le cuesta a Convolution cada **cliente = proyecto + org de Clerk**, por mes.
Un cliente que usa varias apps u orgs se agrupa en una sola fila con `clients` en `src/server/costs/catalog.ts` (por ejemplo Persys = Persys + Persys CRM). Cada org se busca por nombre o slug de Clerk; si no aparece, sale un aviso.
La API vive en `src/app/api/costs/report/route.ts` y la lógica en `src/server/costs/`.

## Cómo se calcula

Cada monto lleva una **base**:

| Base | Qué significa | Ejemplos |
|---|---|---|
| Medido | El proveedor reporta ese monto para ese proyecto u org | Consumo de Vercel por proyecto, AI Gateway con `user = clerkOrgId`, uso de Convex por proyecto |
| Asignado | Monto medido del proyecto repartido entre sus orgs por un peso medido | Convex por almacenamiento de cada org, Vercel por usuarios activos |
| Fijo | Nadie lo causa; se reparte por política (`fixedCostPolicy`) | Plan Pro y asientos de Vercel, cluster de PlanetScale |

Pesos por proveedor (`weightPreference` en `report.ts`): Convex y PlanetScale usan almacenamiento por org y, si no hay, usuarios activos; Vercel usa usuarios activos y, si no hay, almacenamiento.
Sin ningún peso, el costo queda en "Sin desglose por org" del proyecto.
Los costos compartidos (sin proyecto) van a los clientes facturables; los proyectos `internal` no los absorben.

## Fuentes

| Proveedor | Fuente | Notas |
|---|---|---|
| Vercel | `GET /v1/billing/charges` | Límites a medianoche de Los Ángeles: coincide con la factura y con `vercel usage` |
| AI Gateway | `GET /v1/report?group_by=user` y `group_by=api_key_name` | Exacto por org cuando la llamada manda `providerOptions.gateway.user` |
| Convex | API interna del dashboard (`/usage/query`) | Uso × tarifa Starter (`convexRates`), descontando lo incluido. Contra el gasto real de Convex: 2% de diferencia (oct-2026). Puede romperse si Convex cambia los IDs |
| PlanetScale | `organizations/{org}/invoices` | Factura del mes. Si hay varias bases se divide en partes iguales |
| Clerk | Backend API por app | Orgs y usuarios activos (`last_active_at`); exacto para el mes en curso, subestima meses pasados |
| Postmark | `/servers` + `/stats/outbound` | El plan (`manualFixedCosts`, cargado a mano: Postmark no tiene API de facturación) se reparte por emails enviados de cada server; un mes sin envíos va entero al server `default` |
| Uso por org | `GET /internal/cost-usage` de cada app | Bytes almacenados por org (foto actual). Cache de 24 h por proyecto: el endpoint recorre todas las tablas |

El mapeo de recursos a proyectos está en `src/server/costs/catalog.ts`.
Un proyecto con `excluded: true` se reconoce pero no suma: sus costos no aparecen en `/costos` (hoy: MiniCRM minicrm.space, sin uso real).

## Variables de entorno

En desarrollo local, Vercel, Convex y PlanetScale usan las sesiones de sus CLIs (`vercel login`, `npx convex login`, `pscale auth login`); en producción hacen falta:

```
VERCEL_TOKEN=                      # token con acceso de lectura al team Convolution
VERCEL_TEAM_ID=team_4WuL1BLigiXAWbqGgRd0U1qm
AI_GATEWAY_API_KEY=                # cualquier key del team
CONVEX_ACCESS_TOKEN=               # token del team "SW Factory"
CONVEX_TEAM_ID=322167
PLANETSCALE_ORG=convolution
PLANETSCALE_SERVICE_TOKEN_ID=      # permisos: read_invoices, read_databases
PLANETSCALE_SERVICE_TOKEN=
POSTMARK_ACCOUNT_TOKEN=
CLERK_SECRET_KEY_CRM=              # keys de producción, una por app
CLERK_SECRET_KEY_PERSYS_CRM=
CLERK_SECRET_KEY_PERSYS=
CLERK_SECRET_KEY_MINICRM=
CLERK_SECRET_KEY_MINICRM2=
CLERK_SECRET_KEY_GESTION_JUDICIAL=
CLERK_SECRET_KEY_GESTION_JUDICIAL_DEV=  # instancia dev: solo para asignar sus orgs a un cliente
USAGE_URL_CRM=                     # https://<deployment>.convex.site/internal/cost-usage
USAGE_SECRET_CRM=                  # = COST_REPORT_SECRET de esa app
USAGE_URL_PERSYS_CRM=
USAGE_SECRET_PERSYS_CRM=
USAGE_URL_MINICRM=
USAGE_SECRET_MINICRM=
USAGE_URL_MINICRM2=
USAGE_SECRET_MINICRM2=
USAGE_URL_GESTION_JUDICIAL=        # https://gestion-judicial.com.ar/api/internal/cost-usage
USAGE_SECRET_GESTION_JUDICIAL=
```

Cualquier usuario logueado en la app puede ver `/costos`.
