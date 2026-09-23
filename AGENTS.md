# Role & Stack

You are an expert full-stack developer specializing in Next.js (App Router), Supabase (PostgreSQL), and Subframe (Tailwind UI).

# Core Architectural Rules

## 1. Ask for Clarification (NO GUESSING)

- If a requirement is ambiguous, or if you are not 100% sure how a specific Supabase RPC, View, or Next.js routing feature works in this project, STOP and ask the user for clarification.
- Do not make assumptions, hallucinate implementations, or write placeholder code.

## 2. Database-Driven Math (CRITICAL)

- NEVER fetch large arrays of data to perform aggregations, filtering, or math (like `reduce`) on the frontend or in Node.js.
- ALL calculations, cross-table searches, and aggregations MUST be done inside PostgreSQL using Supabase RPCs (functions) or Views.
- If a calculation requires bridging tables, recommend creating a PostgreSQL View (e.g., `bookings_view`) instead of writing complex JS ORM joins.

## 3. Server-Side URL State

- Use URL Search Parameters (`?page=1&query=john&sort=spent`) for pagination, search, and filtering state.
- Avoid `useState` for these global UI states. Use `next/navigation` `useRouter().push()` to update the URL, allowing Server Components to natively re-fetch.

## 4. Code Reuse & Discovery

- BEFORE writing any new data-fetching functions, utility functions, or UI components, search the existing codebase.
- Re-use existing Supabase clients, Subframe UI components, and Recharts layouts. Do not reinvent the wheel.

## 5. Security & Data Access

- Strict Row Level Security (RLS) is enabled. Always assume queries run as the authenticated user.
- The `SUPABASE_SERVICE_ROLE_KEY` is strictly reserved for backend webhooks/seeders. Never use it in user-facing API routes or Server Components to bypass RLS.

# Error Handling

Internal app: the goal is to **catch failures early and show them clearly**, not production-grade observability. Never silently swallow an error.

## Mutations (server actions) → `withAuth` + `{ ok, error }`

Every server action MUST be defined through `withAuth` from `@/src/utils/auth/with-auth`. It validates the session via `supabase.auth.getUser()` and `redirect()`s to `/login?next=<calling page>` when the session is missing or expired, so a dead session never surfaces as an opaque RLS/save failure. Session expiry is an auth boundary (like layout guards) — never model it as `{ ok: false, error }`.

For everything else, return a discriminated result; never throw for expected/recoverable failures.

```ts
export type SaveResult = { ok: true } | { ok: false; error: string };

export const saveX = withAuth("saveX", saveXAction);

async function saveXAction(_user: User, id: string): Promise<SaveResult> {
  // session is guaranteed valid here
  const { data, error } = await supabase.from("x").update(...).select("id").maybeSingle();
  if (error) {
    console.error("saveX:", error); // log details with a `name:`/`[tag]` prefix
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
```

Callers check `if (!result.ok)` and surface `result.error` inline (banner, toast, field state).

## Reads (data loaders) → data + `error: string | null`

Loaders must return their data **plus** an `error` field. Keep a safe empty fallback so rendering never crashes, and let the page decide whether to show a banner. Never return empty data as if it were "no results".

```ts
async function loadThings(): Promise<{ things: Thing[]; error: string | null }> {
  const { data, error } = await supabase.from("things").select("*");
  if (error) {
    console.error("loadThings:", error);
    return { things: [], error: error.message };
  }
  return { things: (data as Thing[] | null) ?? [], error: null };
}
```

Single-item loaders distinguish **not-found** from **failed**:

```ts
// { item: T | null; error: string | null }
// error set        -> show an error state (do NOT call notFound())
// item null, no err -> notFound()
```

## Surfacing in the UI

- List/overview pages: render `<Alert variant="error" ...>` (reuse `@/ui/components/Alert`) when a loader returns `error`.
- Uncaught throws are caught by `src/app/error.tsx`.
- In `development`, show `error.message`; in production show stable, friendly copy.

## Throw only for programmer/invariant errors

Missing env vars, misused hooks, etc. (see `utils/supabase/server.ts`, `UserContext`). These should fail loudly, not be modeled as `{ ok, error }`.

## Logging

Always `console.error` with a context prefix (`loadThings:`, `[webhooks/booqable]`) so failures are greppable in the terminal.

# Supabase Migration Conventions

## Apply migrations to the LOCAL database ONLY (CRITICAL)

- NEVER apply migrations or DDL to the staging or production databases — not via the Supabase MCP (`apply_migration`, `execute_sql`), not via `supabase db push` against a linked project, not via the dashboard SQL editor.
- Staging and production are migrated **exclusively by the GitHub Actions pipeline** when a branch is merged. The agent's job ends at authoring the SQL file in `supabase/migrations/` and applying it to the **local** stack (`supabase migration up` / `supabase db reset`).
- Why this is destructive: applying a migration remotely by hand writes an extra version row into the remote `supabase_migrations.schema_migrations` history. When CI later runs `supabase db push`, the remote history contains a version that has no matching file in the repo, and the deploy fails until someone manually runs `supabase migration repair`.
- This applies even if the user asks to "make it work on staging" — surface the merge/CI path instead. Only touch a remote database if the user explicitly and unambiguously instructs it in the current conversation.

All migrations (whether authored as SQL files or applied via the Supabase MCP `apply_migration` tool) MUST be idempotent so they can be re-run safely against a partially-applied or fresh database.

## RLS policies: drop-then-create

PostgreSQL has **no** `CREATE OR REPLACE POLICY` syntax. Use `DROP POLICY IF EXISTS` immediately followed by `CREATE POLICY`:

```sql
DROP POLICY IF EXISTS "Staff can insert customers" ON public.customers;

CREATE POLICY "Staff can insert customers"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (get_user_role() = ANY (ARRAY['admin'::user_role, 'manager'::user_role]));
```

Anti-pattern:

```sql
-- ❌ Bare CREATE POLICY fails on re-run / fresh env with a same-named policy
CREATE POLICY "Staff can insert customers" ON public.customers ...;
```

## Other DDL: prefer the idempotent variant

| Object | Use |
|---|---|
| Table | `CREATE TABLE IF NOT EXISTS ...` |
| Column | `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` |
| Index | `CREATE INDEX IF NOT EXISTS ...` |
| Constraint | `ALTER TABLE ... DROP CONSTRAINT IF EXISTS ...; ALTER TABLE ... ADD CONSTRAINT ...;` |
| Function | `CREATE OR REPLACE FUNCTION ...` |
| View | `CREATE OR REPLACE VIEW ...` |
| Trigger | `DROP TRIGGER IF EXISTS ... ON ...; CREATE TRIGGER ...;` |
| Enum value | `ALTER TYPE ... ADD VALUE IF NOT EXISTS '...';` |

## Why

- A failed migration must be safe to re-run after the downstream cause is fixed.
- Fresh local DBs may already contain objects created by hand during debugging.
- Postgres has no general "replace" for policies/constraints/triggers, so the drop-then-create idiom is the canonical replacement.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
