# Stack

Only technologies present in this repository.

## Application
- **TanStack Start** (`@tanstack/react-start`) with **TanStack Router** — full-stack React framework, file routes in `src/routes`, server functions (`createServerFn`) and server routes (`src/routes/api/public/*`).
- **React 19**, **TypeScript**.
- **Vite 8** with `@lovable.dev/vite-tanstack-config`; **Nitro** for the server build targeting an edge (Worker) runtime.
- **TanStack Query** — data fetching and caching.

## UI
- **Tailwind CSS v4** (`@tailwindcss/vite`, `tw-animate-css`), configured in `src/styles.css`.
- **shadcn/ui** components on **Radix UI** primitives; `lucide-react` icons; `sonner` toasts; `cmdk`, `vaul`, `embla-carousel-react`, `react-day-picker`, `react-resizable-panels`, `input-otp`.
- **Recharts** — charts.
- **react-hook-form** + **zod** (`@hookform/resolvers`, `@tanstack/zod-adapter`) — forms and validation.
- `date-fns`, `clsx`, `tailwind-merge`, `class-variance-authority`, `react-markdown`.

## Reports and export
- **jsPDF** + **jspdf-autotable** — PDF reports.
- **SheetJS (`xlsx`)** — Excel workbooks.

## Backend (Lovable Cloud)
- **Postgres** with Row-Level Security, SQL views (`city_stats`, `employer_stats`, `city_employer_share`), vault, `pg_cron`, `pg_net`.
- **Auth** — email/password with password reset.
- **`@supabase/supabase-js`** — browser client and server clients.

## Data source
- **Bundesagentur für Arbeit Jobsuche API** via `fetch` (`src/lib/ba-api.server.ts`).

## Database tooling
- **drizzle-kit** / **drizzle-orm** / **postgres** — schema file and migration history in `drizzle/`; hand-written rollbacks in `drizzle/rollbacks/`.

## Tooling
- **Bun** (lockfile `bun.lock`) or npm; **ESLint 9** + `typescript-eslint`; **Prettier**.
