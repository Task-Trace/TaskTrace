// @tasktrace/adapter-clickup
// ClickUp adapter for TaskTrace — planned for v0.2
//
// Will implement:
// - ClickUpClient (typed HTTP client using native fetch)
// - ClickUpAdapter (implements TaskProviderAdapter)
// - syncMode heuristics
// - Task auto-creation from worklog entries

export { ClickUpAdapter } from "./clickup-adapter.js";
export type { ClickUpConfig } from "./types.js";
