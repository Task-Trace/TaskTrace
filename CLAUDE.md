# TaskTrace

Git-native developer worklog engine. Captures work, consolidates with AI agents, syncs to task managers.

## Project structure

Monorepo with Bun workspaces + Turbo:

- `packages/core` — `@tasktrace/core`: engine, types, storage (NDJSON), git integration, config, consolidation
- `packages/cli` — `@tasktrace/cli`: terminal commands (`tasktrace` / `tt`), uses Citty framework
- `packages/adapter-clickup` — `@tasktrace/adapter-clickup`: ClickUp sync adapter
- `packages/mcp-server` — `@tasktrace/mcp-server`: MCP server for AI agents (stdio transport)

Dependency graph: cli → core ← mcp-server, adapter-clickup → core

## Commands

```bash
bun run build          # Build all packages via Turbo
bun run typecheck      # TypeScript check all packages
bun run lint           # Biome lint
bun run test           # Run all tests
bun run check          # lint + typecheck
```

## Key conventions

- Runtime: Bun-native, Node-compatible (conditional exports)
- IDs: ULID (sortable, collision-free)
- Storage: NDJSON append-only for events/entries, JSON for sync-state/config
- Git: uses execFile("git", [...]) — no shell, no git library dependency
- Validation: Zod schemas for all data boundaries
- File locking: proper-lockfile for concurrent NDJSON writes
- Config hierarchy: defaults → ~/.tasktrace/config.json → .tasktracerc.json → env vars → CLI flags
- Credentials: NEVER in project config. Only in ~/.tasktrace/config.json or env vars
- AI: not in runtime. Agents interact via CLI (--json) or MCP tools
- All CLI commands support --json output

## Data model

Three layers:
1. WorklogEvent (events.ndjson) — raw, append-only, granular
2. WorklogEntry (entries.ndjson) — consolidated, AI-improvable
3. SyncState (sync-state.json) — tracks what was synced

## Testing

- Test runner: bun:test
- Co-located tests: foo.test.ts next to foo.ts
- Integration tests in __tests__/ directories
