# TaskTrace

Git-native developer worklog engine. Capture work, consolidate with AI agents, sync to task managers.

```bash
# Quick install
npm i -g @tasktrace/cli

# Or run without installing
npx @tasktrace/cli add -d "fixed auth timeout" -k bugfix
```

---

## What is TaskTrace?

TaskTrace sits between your git workflow and your task manager. It captures what you actually did, lets AI agents consolidate messy notes into clean entries, and syncs the result to ClickUp (Linear, Jira planned).

**No existing tool does this end-to-end.** SDKs exist for ClickUp. Changelog generators exist. Time trackers exist. None of them combine:

- Append-only worklog capture
- Git commit/branch linking
- AI-powered consolidation (via external agents, not baked in)
- Bidirectional task sync (create + update, not just update)
- Provider-agnostic adapter pattern

TaskTrace fills that gap.

---

## How it works

```
1. You work normally

2. Capture events (quick, messy, low friction)
   $ tt add -d "investigated auth timeout" -k investigation
   $ tt add -d "fixed refresh token flow" -k bugfix

3. Consolidate (you or an AI agent)
   $ tt consolidate
   → Groups events into a clean worklog entry

4. Link to git
   $ tt attach
   → Binds the entry to your latest commit SHA

5. Sync to task manager
   $ tt plan          → Preview what goes to ClickUp
   $ tt sync          → Execute (creates comment, subtask, or new task)
```

---

## Data model

Three layers, from raw to polished:

### Layer 1 — Events (`events.ndjson`)

Raw, append-only, granular. Captured fast, no need to be perfect.

```json
{
  "id": "01JRZX...",
  "timestamp": "2026-04-14T10:23:11-03:00",
  "source": "manual",
  "kind": "bugfix",
  "description": "Fixed refresh token timeout",
  "branch": "fix/auth-timeout",
  "taskRef": "CU-abc123",
  "tags": ["auth", "bugfix"]
}
```

### Layer 2 — Entries (`entries.ndjson`)

Consolidated, AI-improvable summaries grouping multiple events.

```json
{
  "id": "01JRZY...",
  "eventIds": ["01JRZX...", "01JRZX..."],
  "summary": "Investigated and fixed auth timeout related to refresh token flow",
  "kind": "bugfix",
  "statusHint": "done",
  "totalMinutes": 90,
  "branch": "fix/auth-timeout",
  "commits": ["abc123def"],
  "taskRef": "CU-abc123",
  "syncMode": "comment",
  "syncStatus": "pending"
}
```

### Layer 3 — Sync State (`sync-state.json`)

Tracks what was already sent to avoid duplicates.

### Why separate events from entries?

Events can be ugly and fast. Entries can be improved later by AI. Sync only works with entries — never with raw noise.

---

## Architecture

### Monorepo

```
tasktrace/
├── packages/
│   ├── core/             # @tasktrace/core
│   ├── cli/              # @tasktrace/cli
│   ├── adapter-clickup/  # @tasktrace/adapter-clickup
│   └── mcp-server/       # @tasktrace/mcp-server
```

### Dependency graph

```
cli ──────────► core ◄──────────── mcp-server
                 ▲
adapter-clickup ─┘
```

Core depends on nothing from the monorepo. Everything else depends on core.

### Packages

| Package | Purpose | Install |
|---|---|---|
| `@tasktrace/core` | Engine: types, storage, git integration, consolidation | `npm i @tasktrace/core` |
| `@tasktrace/cli` | Terminal commands (`tasktrace` / `tt`) | `npm i -g @tasktrace/cli` |
| `@tasktrace/adapter-clickup` | ClickUp sync adapter | `npm i @tasktrace/adapter-clickup` |
| `@tasktrace/mcp-server` | MCP server for AI agents (Claude Code, Cursor) | `bunx @tasktrace/mcp-server` |

---

## CLI commands

```bash
tt init                          # Scaffold config, storage dir, git hooks
tt add -d "..." -k bugfix       # Register a work event
tt log [--events] [--json]       # List entries (or raw events)
tt status                        # Summary dashboard
tt consolidate [--dry-run]       # Group pending events into entries
tt attach [sha]                  # Link commit to latest entry
tt plan [--json]                 # Preview sync payload
tt sync [--entry id] [--all]     # Execute sync to task provider
```

All commands support `--json` for machine-readable output (AI agents, scripts, pipes).

When flags are missing and stdin is a TTY, the CLI prompts interactively. When piped or fully flagged, it runs silently. Same commands work for humans and agents.

---

## MCP server

For AI agents (Claude Code, Cursor, etc.). Stdio transport, local only.

### Setup (`.mcp.json`)

```json
{
  "mcpServers": {
    "tasktrace": {
      "type": "stdio",
      "command": "bunx",
      "args": ["@tasktrace/mcp-server"]
    }
  }
}
```

### Tools

| Tool | Description |
|---|---|
| `worklog_add` | Add a work event |
| `worklog_consolidate` | Group events into entries |
| `worklog_attach_commit` | Link commit SHA to entry |
| `worklog_log` | List entries with filters |
| `worklog_status` | Project worklog summary |
| `worklog_plan_sync` | Preview sync payload |
| `worklog_sync` | Execute sync |
| `worklog_set_sync_mode` | Set sync mode for an entry |

### Resources

| Resource | URI |
|---|---|
| Project config | `tasktrace://config` |
| Recent entries | `tasktrace://worklogs/recent` |

---

## AI integration

**AI is not in the runtime.** TaskTrace has zero LLM dependencies. No API keys required in core.

AI agents interact with TaskTrace through CLI (`--json` mode) or MCP tools. The agent:

1. **Improves events** — Turns messy notes into well-written descriptions
2. **Consolidates** — Groups related events into clean entries
3. **Classifies sync mode** — Suggests comment vs. subtask vs. new task
4. **Reviews sync plan** — Checks the payload before it goes to ClickUp

This design means TaskTrace works perfectly without AI. AI makes it better, not dependent.

---

## Task provider sync

### Adapter pattern

Core is provider-agnostic. Each task manager gets its own adapter implementing `TaskProviderAdapter`:

```typescript
interface TaskProviderAdapter {
  readonly name: string
  testConnection(): Promise<{ ok: boolean; error?: string }>
  resolveTask(taskRef: string): Promise<ProviderTask | null>
  createTask(params: CreateTaskParams): Promise<ProviderTask>
  syncEntry(entry: WorklogEntry, mode: SyncMode): Promise<SyncResult>
  suggestSyncMode(entry: WorklogEntry): SyncMode
}
```

### Sync modes

| Mode | When |
|---|---|
| `comment` | Small update on existing task |
| `subtask` | Identifiable deliverable under existing task |
| `task` | New work with no matching task — creates one |
| `skip` | Don't sync this entry |

### Heuristic suggestions

The adapter suggests a sync mode based on:
- No `taskRef` → `task` (create new)
- Has `taskRef` + short duration → `comment`
- Has `taskRef` + long duration or multiple commits → `subtask`

Dev or AI agent can always override.

### Task auto-detection from branch

TaskTrace parses branch names to extract task references:

```
fix/CU-abc123-auth-timeout  → taskRef: "CU-abc123"
feat/PROJ-42-new-dashboard  → taskRef: "PROJ-42"
bugfix/#123-login-error     → taskRef: "#123"
```

Patterns are configurable. When no match is found, the CLI falls back to asking (or the agent provides it).

### Task auto-creation

When work has no matching task, TaskTrace can create one in the mapped ClickUp list. Flow:

1. `tt plan` generates a preview (title, description, target list)
2. Dev or AI agent reviews
3. `tt sync` executes — task is created and linked

---

## Configuration

### File hierarchy (lowest → highest precedence)

1. Built-in defaults
2. Global config `~/.tasktrace/config.json` (API keys, preferences)
3. Project config `.tasktracerc.json` (project-specific settings)
4. Environment variables (`TASKTRACE_CLICKUP_API_KEY`, etc.)
5. CLI flags

### Project config (`.tasktracerc.json`)

```json
{
  "version": 1,
  "storage": {
    "dir": ".tasktrace"
  },
  "git": {
    "branchPatterns": ["CU-([a-z0-9]+)", "([A-Z]+-\\d+)"],
    "hooks": {
      "preCommit": false,
      "postCommit": true
    }
  },
  "provider": {
    "name": "clickup",
    "config": {
      "defaultListId": "12345678"
    }
  },
  "defaults": {
    "syncMode": "comment",
    "kind": "implementation"
  }
}
```

### Storage location

Configurable per project. Default: `~/.tasktrace`. Override with `storage.dir` in `.tasktracerc.json`.

```
~/.tasktrace/               # global (API keys, defaults)
  config.json

/your-project/.tasktrace/   # per-project (if configured)
  events.ndjson
  entries.ndjson
  sync-state.json
```

### Security

**Credentials never go in project config.** API keys live in `~/.tasktrace/config.json` (outside any repo) or environment variables. Project config only references the provider name — the adapter resolves credentials at runtime.

---

## Type system

### Enums

```typescript
type WorklogSource = "manual" | "ai" | "git" | "system"

type WorklogKind =
  | "investigation" | "implementation" | "bugfix" | "refactor"
  | "review" | "documentation" | "meeting" | "support"

type WorklogStatusHint = "planned" | "in_progress" | "blocked" | "done"

type SyncMode = "comment" | "subtask" | "task" | "skip"

type SyncStatus = "pending" | "planned" | "synced" | "failed" | "ignored"
```

### Core interfaces

```typescript
interface WorklogEvent {
  id: string                    // ULID (sortable, collision-free)
  timestamp: string             // ISO 8601
  source: WorklogSource
  kind: WorklogKind
  description: string
  durationMinutes?: number
  commitSha?: string
  branch?: string
  taskRef?: string              // provider-agnostic (e.g. "CU-abc123")
  tags?: string[]
  metadata?: Record<string, unknown>
}

interface WorklogEntry {
  id: string
  createdAt: string
  updatedAt: string
  eventIds: string[]
  summary: string
  kind: WorklogKind
  statusHint: WorklogStatusHint
  totalMinutes: number
  taskRef?: string
  branch?: string
  commits: string[]
  syncMode: SyncMode
  syncStatus: SyncStatus
  tags?: string[]
  metadata?: Record<string, unknown>
}
```

### Programmatic usage

```typescript
import { WorklogEngine } from "@tasktrace/core"

const engine = new WorklogEngine(config, storage)

await engine.addEvent({
  kind: "bugfix",
  description: "Fixed auth timeout",
  tags: ["auth"]
})

await engine.consolidate()
await engine.attachCommit()

const status = await engine.status()
```

---

## Git integration

### How git fits in

- **Branch parsing**: Auto-extracts task references from branch names
- **Commit linking**: Entries bind to commit SHAs via `tt attach`
- **Hooks**: Pre-commit (validate entry exists) and post-commit (auto-attach) — both optional, configurable
- **Implementation**: Uses `execFile("git", [...])` — no git library dependency, no shell injection

### Husky integration

`tt init` detects Husky and adds TaskTrace hooks automatically. Works with any existing Husky setup.

---

## Tech stack

| Tool | Role |
|---|---|
| Bun | Runtime + package manager + test runner |
| TypeScript | Language (strict mode) |
| Turbo | Monorepo task orchestration |
| Biome | Lint + format (single tool) |
| Zod | Runtime validation for all data |
| ULID | Sortable, collision-free IDs |
| proper-lockfile | File locking for concurrent NDJSON writes |
| Citty | CLI framework (UnJS, tiny, type-safe) |
| @clack/prompts | Interactive terminal prompts |
| picocolors | Terminal colors |
| @modelcontextprotocol/sdk | MCP server protocol |
| changesets | Version management + npm publishing |

### Compatibility

Developed with Bun, runs on Node. Conditional exports resolve TypeScript source in Bun and compiled JS in Node:

```json
{
  "exports": {
    ".": {
      "bun": "./src/index.ts",
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

---

## Roadmap

### v0.1 — Local worklog engine

- `@tasktrace/core` — full implementation
- `@tasktrace/cli` — init, add, log, status, consolidate, attach
- `@tasktrace/mcp-server` — worklog + query tools
- Unit and integration tests

### v0.2 — ClickUp sync

- `@tasktrace/adapter-clickup`
- `tt plan` and `tt sync` commands
- MCP sync tools
- Git hooks via Husky

### v0.3+ — Scale

- Adapters: Linear, Jira
- Standalone binary (`bun build --compile`)
- GitHub Actions CI/CD
- npm publish automation

---

## Design principles

1. **Events are cheap, entries are valuable.** Capture fast, refine later.
2. **AI improves, never blocks.** Everything works without AI. AI is a multiplier.
3. **Commit is the anchor.** Every meaningful entry links to a commit.
4. **Sync is explicit.** Never auto-publish. Always plan → review → apply.
5. **Credentials stay out of repos.** Global config or env vars only.
6. **Dual interface.** CLI and MCP are both first-class citizens.
7. **Provider-agnostic core.** ClickUp today, anything tomorrow.

---

## License

MIT
