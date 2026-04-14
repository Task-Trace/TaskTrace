// Core engine
export { WorklogEngine } from "./worklog.js";

// Types
export type {
	WorklogSource,
	WorklogKind,
	WorklogStatusHint,
	SyncMode,
	SyncStatus,
	WorklogEvent,
	WorklogEntry,
	SyncState,
	TaskTraceConfig,
	ProviderTask,
	CreateTaskParams,
	SyncResult,
	TaskProviderAdapter,
	AddEventInput,
	EventFilter,
	EntryFilter,
	ConsolidateOptions,
	SyncPlan,
	SyncPlanItem,
	WorklogStatus,
} from "./types.js";

// Schemas (for MCP server and external validation)
export {
	worklogSourceSchema,
	worklogKindSchema,
	worklogStatusHintSchema,
	syncModeSchema,
	syncStatusSchema,
	worklogEventSchema,
	worklogEntrySchema,
	syncStateSchema,
	taskTraceConfigSchema,
	addEventInputSchema,
	eventFilterSchema,
	entryFilterSchema,
} from "./schemas.js";

// Storage
export { FileStorageProvider } from "./storage/storage.js";
export type { StorageProvider } from "./storage/storage.js";
export type { StorageFile } from "./storage/paths.js";
export {
	resolveStorageDir,
	getStorageFilePath,
	getGlobalConfigDir,
	getGlobalConfigPath,
} from "./storage/paths.js";

// Config
export { loadConfig, generateProjectConfig } from "./config/config.js";
export { DEFAULT_CONFIG, DEFAULT_CONSOLIDATION_GAP_MINUTES } from "./config/defaults.js";

// Git
export { parseTaskRef, detectProvider } from "./git/branch-parser.js";
export { getCurrentBranch, getCommitSha, getCommitInfo, isGitRepo } from "./git/commit-info.js";
export { installHooks, generatePostCommitHook, generatePreCommitHook } from "./git/hooks.js";

// Consolidation
export { consolidateEvents } from "./consolidation/consolidate.js";
