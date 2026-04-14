// === Enums / Unions ===

export type WorklogSource = "manual" | "ai" | "git" | "system";

export type WorklogKind =
	| "investigation"
	| "implementation"
	| "bugfix"
	| "refactor"
	| "review"
	| "documentation"
	| "meeting"
	| "support";

export type WorklogStatusHint = "planned" | "in_progress" | "blocked" | "done";

export type SyncMode = "comment" | "subtask" | "task" | "skip";

export type SyncStatus = "pending" | "planned" | "synced" | "failed" | "ignored";

// === Core Data ===

export interface WorklogEvent {
	id: string;
	timestamp: string;
	source: WorklogSource;
	kind: WorklogKind;
	description: string;
	durationMinutes?: number;
	commitSha?: string;
	branch?: string;
	taskRef?: string;
	tags?: string[];
	metadata?: Record<string, unknown>;
}

export interface WorklogEntry {
	id: string;
	createdAt: string;
	updatedAt: string;
	eventIds: string[];
	summary: string;
	kind: WorklogKind;
	statusHint: WorklogStatusHint;
	totalMinutes: number;
	taskRef?: string;
	branch?: string;
	commits: string[];
	syncMode: SyncMode;
	syncStatus: SyncStatus;
	tags?: string[];
	metadata?: Record<string, unknown>;
}

export interface SyncState {
	lastSyncAt?: string;
	entries: Record<
		string,
		{
			syncStatus: SyncStatus;
			syncMode: SyncMode;
			providerRef?: string;
			syncedAt?: string;
			error?: string;
		}
	>;
}

// === Config ===

export interface TaskTraceConfig {
	version: 1;
	storage: {
		dir: string;
	};
	git: {
		branchPatterns: string[];
		hooks: {
			preCommit: boolean;
			postCommit: boolean;
		};
	};
	provider?: {
		name: string;
		config: Record<string, unknown>;
	};
	defaults: {
		syncMode: SyncMode;
		kind: WorklogKind;
	};
}

// === Adapter Interface ===

export interface ProviderTask {
	id: string;
	ref: string;
	title: string;
	url: string;
	status?: string;
}

export interface CreateTaskParams {
	title: string;
	description?: string;
	status?: string;
}

export interface SyncResult {
	success: boolean;
	providerRef?: string;
	error?: string;
}

export interface TaskProviderAdapter {
	readonly name: string;
	testConnection(): Promise<{ ok: boolean; error?: string }>;
	resolveTask(taskRef: string): Promise<ProviderTask | null>;
	createTask(params: CreateTaskParams): Promise<ProviderTask>;
	syncEntry(entry: WorklogEntry, mode: SyncMode): Promise<SyncResult>;
	suggestSyncMode(entry: WorklogEntry): SyncMode;
}

// === Input types (without auto-generated fields) ===

export interface AddEventInput {
	source?: WorklogSource;
	kind: WorklogKind;
	description: string;
	durationMinutes?: number;
	commitSha?: string;
	branch?: string;
	taskRef?: string;
	tags?: string[];
	metadata?: Record<string, unknown>;
}

// === Filter types ===

export interface EventFilter {
	branch?: string;
	taskRef?: string;
	kind?: WorklogKind;
	since?: string;
	limit?: number;
}

export interface EntryFilter {
	branch?: string;
	taskRef?: string;
	kind?: WorklogKind;
	syncStatus?: SyncStatus;
	since?: string;
	limit?: number;
}

// === Consolidation ===

export interface ConsolidateOptions {
	dryRun?: boolean;
	gapMinutes?: number;
}

// === Sync Plan ===

export interface SyncPlanItem {
	entry: WorklogEntry;
	suggestedMode: SyncMode;
	taskRef?: string;
	action: string;
}

export interface SyncPlan {
	items: SyncPlanItem[];
	createdAt: string;
}

// === Status ===

export interface WorklogStatus {
	totalEvents: number;
	totalEntries: number;
	pendingEvents: number;
	pendingSync: number;
	currentBranch?: string;
	lastEventAt?: string;
	lastEntryAt?: string;
}
