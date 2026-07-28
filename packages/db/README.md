# @git-wayback/db

Drizzle schema and migrations for the Neon database.

## Migration state

`drizzle/0000_*.sql` is a **baseline**, regenerated from `src/schema` once the
history had drifted past the point of being replayable. The previous `0000`
described tables that no longer exist (`repositories`, `commits`, `branches`,
`screenshots`), while the tables the app actually uses had been created with
`db:push` and never recorded. `drizzle-kit generate` therefore misread the real
schema as a set of renames.

The baseline now matches what is deployed, so **`db:generate` is safe again**.
Write new changes as generated migrations rather than by hand.

### Existing databases

The baseline is *already applied* on any database provisioned before the
rebaseline — running it would fail on `CREATE TABLE`. Mark it as applied
instead of executing it:

```sql
-- once, on a pre-existing database
CREATE TABLE IF NOT EXISTS drizzle."__drizzle_migrations" (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);
```

then run `pnpm db:migrate` once with the baseline's hash recorded, or simply
keep using `db:push` on that database — the schema is identical either way.

A fresh database can run `pnpm db:migrate` from empty with no special steps.

### `drizzle/manual/`

Reviewed DDL applied by hand while the history was drifted. They are superseded
by the baseline and are kept as a record of what was run. `0003` is the only one
still worth applying, and only to databases created before the rebaseline.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm db:generate` | Emit a migration from `src/schema` changes |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:push` | Push the schema straight to the database (no migration file) |
| `pnpm db:studio` | Open Drizzle Studio |
