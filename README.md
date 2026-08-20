# git-wayback

Web application that renders the evolution of a GitHub repository as an animated
file tree. Given an `owner/repo`, it reconstructs the repository's file
structure at successive points in its history — tags or commits — and draws each
one as a force-directed graph you can step through.

Comparable to [Gource](https://gource.io/), but served from a URL: no local
clone, nothing to install, and the result is shareable.

![The evolution tab: file tree of git-wayback at release v0.6.34, with the file
list, extension legend and snapshot timeline](docs/evolution-diagram.png)

## Features

- **Evolution diagram.** D3 force simulation of the file tree, folders as parent
  nodes and files attached to them, colored by extension. Playback controls step
  through snapshots or animate the sequence.
- **Two history sources.** Tags produce meaningful intervals between releases;
  commits give finer resolution on repositories without releases. Branch is
  selectable for the commit source.
- **Sampling strategies.** `spread` distributes snapshots evenly across the
  available history, `latest` takes the most recent ones. Both cap at 30
  snapshots.
- **Repository overview.** Languages, contributors, recent commits with
  expandable message bodies, and commit activity by hour and weekday.
- **Rankings.** Most visited repositories overall, this month and this week,
  aggregated from anonymous per-day visit counts.

## How it works

1. Tags or commits are listed from the GitHub REST API, up to a pool of 100.
2. The pool is sampled down to the requested snapshot count **before** any tree
   is fetched, so a repository with thousands of refs still costs at most 30
   tree requests.
3. Each selected ref resolves to a commit SHA, and its recursive tree is fetched
   and reduced to path, name, size and extension.
4. The resulting snapshot array is persisted and returned. The client builds the
   hierarchy and hands it to the D3 simulation.

GitHub truncates the recursive tree endpoint for very large repositories. That
flag is preserved per snapshot and surfaced in the UI rather than silently
serving an incomplete file list.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Nuxt 3 (Vue 3, SSR) with Nitro server routes |
| Visualization | D3 v7 — force simulation, zoom, custom rendering |
| Styling | Tailwind CSS |
| Database | PostgreSQL (Neon) via Drizzle ORM |
| Rate limiting | Upstash Redis, sliding-window counters |
| Monorepo | Turborepo with pnpm workspaces |
| Tooling | TypeScript, Biome, Vitest |
| Hosting | Vercel |

## Repository layout

```
apps/web            Nuxt application — pages, API routes, components, diagram
packages/db         Drizzle schema and database client
packages/shared     Constants, types and formatters shared by both sides
```

Two tables: `evolution_snapshots` caches computed snapshot sets, `repo_visits`
records one row per visitor, repository and day, which keeps the rankings
bounded and the counts honest.

## Getting started

Requires Node 20+, pnpm 9 and a PostgreSQL database.

```bash
pnpm install
pnpm dev
```

Environment variables live in `apps/web/.env`:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `GITHUB_TOKEN` | recommended | Raises the GitHub API budget from 60 to 5000 requests/hour |
| `UPSTASH_REDIS_REST_URL` | production | Rate limiter backend |
| `UPSTASH_REDIS_REST_TOKEN` | production | Rate limiter backend |

Without Upstash configured the application still runs in development. In
production the GitHub-backed endpoints fail closed if the limiter is
unreachable: an unavailable limiter is indistinguishable from one being drained
deliberately.

Schema changes are applied with `pnpm db:push` from `packages/db`.

### Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the development server |
| `pnpm build` | Production build |
| `pnpm typecheck` | TypeScript across all workspaces |
| `pnpm lint` / `pnpm lint:fix` | Biome check and autofix |
| `pnpm test` | Vitest suites |

## Caching and API budget

An uncached repository page costs six GitHub calls, which limits the deployment
to roughly 830 views per hour on a single authenticated token. Two layers keep
that under control.

**Repository overview** is cached for ten minutes with stale-while-revalidate,
keyed on the repository alone so query parameters cannot fragment the entry.

**Evolution snapshots** are cached in PostgreSQL under a key covering every input
that changes the result: repository, source, branch, sampling strategy and
snapshot count. Freshness is decided by the repository's `pushed_at` timestamp
rather than an expiry — when it matches the value recorded at capture time, no
commits have landed and the cached set is still exact regardless of age. That
comparison costs one request and only runs once the row is older than five
minutes. If the timestamp is unavailable, a 24-hour TTL applies as a fallback.

A manual refresh bypasses both layers. It is restricted to the repository
endpoints, accepted on GET only, and charged against two sliding windows before
reaching a handler: five per hour per IP address and sixty per hour across all
callers. Requests are ignored entirely when the cached row is less than a minute
old.

## License

GNU General Public License v3.0. See [LICENSE](LICENSE).
