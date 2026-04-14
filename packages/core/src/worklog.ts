import { ulid } from "ulid";
import { consolidateEvents } from "./consolidation/consolidate.js";
import { parseTaskRef } from "./git/branch-parser.js";
import { getCommitSha, getCurrentBranch } from "./git/commit-info.js";
import { syncStateSchema, worklogEntrySchema, worklogEventSchema } from "./schemas.js";
import type { StorageProvider } from "./storage/storage.js";
import type {
	AddEventInput,
	ConsolidateOptions,
	EntryFilter,
	EventFilter,
	SyncMode,
	SyncPlan,
	SyncResult,
	SyncState,
	TaskProviderAdapter,
	WorklogEntry,
	WorklogEvent,
	WorklogStatus,
} from "./types.js";
import type { TaskTraceConfig } from "./types.js";

export class WorklogEngine {
	constructor(
		private config: TaskTraceConfig,
		private storage: StorageProvider,
	) {}

	// ==========================================================
	// Events
	// ==========================================================

	/**
	 * Add a new worklog event. Auto-generates id, timestamp, and detects branch/taskRef.
	 */
	async addEvent(input: AddEventInput): Promise<WorklogEvent> {
		const branch = input.branch ?? (await this.safeGetBranch());
		const taskRef = input.taskRef ?? (branch ? this.detectTaskRefSync(branch) : undefined);

		const event: WorklogEvent = {
			id: ulid(),
			timestamp: new Date().toISOString(),
			source: input.source ?? "manual",
			kind: input.kind,
			description: input.description,
			durationMinutes: input.durationMinutes,
			commitSha: input.commitSha,
			branch: branch ?? undefined,
			taskRef: taskRef ?? undefined,
			tags: input.tags,
			metadata: input.metadata,
		};

		await this.storage.append("events", event);
		return event;
	}

	/**
	 * List all events, optionally filtered.
	 */
	async listEvents(filter?: EventFilter): Promise<WorklogEvent[]> {
		let events = await this.storage.readAll("events", worklogEventSchema);
		events = applyEventFilter(events, filter);
		return events;
	}

	// ==========================================================
	// Entries
	// ==========================================================

	/**
	 * Consolidate pending events into entries.
	 * Groups by branch + taskRef + time proximity.
	 */
	async consolidate(options?: ConsolidateOptions): Promise<WorklogEntry[]> {
		const events = await this.storage.readAll("events", worklogEventSchema);
		const existingEntries = await this.storage.readAll("entries", worklogEntrySchema);

		// Collect all event IDs already in entries
		const existingEventIds = new Set<string>();
		for (const entry of existingEntries) {
			for (const id of entry.eventIds) {
				existingEventIds.add(id);
			}
		}

		const newEntries = consolidateEvents(events, existingEventIds, options);

		if (newEntries.length === 0 || options?.dryRun) {
			return newEntries;
		}

		// Append new entries
		for (const entry of newEntries) {
			await this.storage.append("entries", entry);
		}

		return newEntries;
	}

	/**
	 * List all entries, optionally filtered.
	 */
	async listEntries(filter?: EntryFilter): Promise<WorklogEntry[]> {
		let entries = await this.storage.readAll("entries", worklogEntrySchema);
		entries = applyEntryFilter(entries, filter);
		return entries;
	}

	/**
	 * Update an existing entry by id with a partial patch.
	 */
	async updateEntry(id: string, patch: Partial<WorklogEntry>): Promise<WorklogEntry> {
		const entries = await this.storage.readAll("entries", worklogEntrySchema);
		const index = entries.findIndex((e) => e.id === id);

		if (index === -1) {
			throw new Error(`Entry not found: ${id}`);
		}

		const updated: WorklogEntry = {
			...entries[index],
			...patch,
			id: entries[index].id, // Prevent id override
			updatedAt: new Date().toISOString(),
		};

		entries[index] = updated;
		await this.storage.writeAll("entries", entries);

		return updated;
	}

	// ==========================================================
	// Git Integration
	// ==========================================================

	/**
	 * Attach a commit SHA to the most recent entry (or a specific one).
	 */
	async attachCommit(sha?: string, entryId?: string): Promise<WorklogEntry> {
		const resolvedSha = sha ?? (await getCommitSha("HEAD"));
		const shortSha = resolvedSha.slice(0, 7);

		const entries = await this.storage.readAll("entries", worklogEntrySchema);

		if (entries.length === 0) {
			throw new Error("No entries found to attach commit to");
		}

		let targetEntry: WorklogEntry | undefined;

		if (entryId) {
			targetEntry = entries.find((e) => e.id === entryId);
			if (!targetEntry) {
				throw new Error(`Entry not found: ${entryId}`);
			}
		} else {
			// Find the most recent entry for the current branch
			const branch = await this.safeGetBranch();
			const branchEntries = branch ? entries.filter((e) => e.branch === branch) : entries;

			targetEntry = branchEntries[branchEntries.length - 1] ?? entries[entries.length - 1];
		}

		// Avoid duplicate SHAs
		if (targetEntry.commits.includes(resolvedSha) || targetEntry.commits.includes(shortSha)) {
			return targetEntry;
		}

		return this.updateEntry(targetEntry.id, {
			commits: [...targetEntry.commits, resolvedSha],
		});
	}

	/**
	 * Detect task reference from current or specified branch.
	 */
	async detectTaskRef(branch?: string): Promise<string | null> {
		const resolvedBranch = branch ?? (await this.safeGetBranch());
		if (!resolvedBranch) return null;
		return this.detectTaskRefSync(resolvedBranch);
	}

	// ==========================================================
	// Sync
	// ==========================================================

	/**
	 * Create a sync plan without executing it.
	 */
	async planSync(adapter: TaskProviderAdapter): Promise<SyncPlan> {
		const entries = await this.storage.readAll("entries", worklogEntrySchema);
		const pendingEntries = entries.filter((e) => e.syncStatus === "pending");

		const items = pendingEntries.map((entry) => {
			const suggestedMode = adapter.suggestSyncMode(entry);
			const action = describeAction(suggestedMode, entry);

			return {
				entry,
				suggestedMode,
				taskRef: entry.taskRef,
				action,
			};
		});

		return {
			items,
			createdAt: new Date().toISOString(),
		};
	}

	/**
	 * Execute sync for pending entries.
	 */
	async executeSync(adapter: TaskProviderAdapter, plan?: SyncPlan): Promise<SyncResult[]> {
		const syncPlan = plan ?? (await this.planSync(adapter));
		const results: SyncResult[] = [];

		const syncState = (await this.storage.readJsonFile("sync-state", syncStateSchema)) ?? {
			entries: {},
		};

		for (const item of syncPlan.items) {
			const mode = item.entry.syncMode !== "comment" ? item.entry.syncMode : item.suggestedMode;

			if (mode === "skip") {
				await this.updateEntry(item.entry.id, { syncStatus: "ignored" });
				results.push({ success: true });
				continue;
			}

			try {
				const result = await adapter.syncEntry(item.entry, mode);

				await this.updateEntry(item.entry.id, {
					syncStatus: result.success ? "synced" : "failed",
				});

				syncState.entries[item.entry.id] = {
					syncStatus: result.success ? "synced" : "failed",
					syncMode: mode,
					providerRef: result.providerRef,
					syncedAt: new Date().toISOString(),
					error: result.error,
				};

				results.push(result);
			} catch (err) {
				const error = err instanceof Error ? err.message : String(err);

				await this.updateEntry(item.entry.id, { syncStatus: "failed" });

				syncState.entries[item.entry.id] = {
					syncStatus: "failed",
					syncMode: mode,
					error,
					syncedAt: new Date().toISOString(),
				};

				results.push({ success: false, error });
			}
		}

		syncState.lastSyncAt = new Date().toISOString();
		await this.storage.writeJsonFile("sync-state", syncState);

		return results;
	}

	// ==========================================================
	// Status
	// ==========================================================

	/**
	 * Get a summary of the worklog state.
	 */
	async status(): Promise<WorklogStatus> {
		const events = await this.storage.readAll("events", worklogEventSchema);
		const entries = await this.storage.readAll("entries", worklogEntrySchema);

		// Compute pending events (not yet consolidated)
		const consolidatedEventIds = new Set<string>();
		for (const entry of entries) {
			for (const id of entry.eventIds) {
				consolidatedEventIds.add(id);
			}
		}
		const pendingEvents = events.filter((e) => !consolidatedEventIds.has(e.id)).length;

		// Compute pending sync
		const pendingSync = entries.filter((e) => e.syncStatus === "pending").length;

		const currentBranch = await this.safeGetBranch();

		return {
			totalEvents: events.length,
			totalEntries: entries.length,
			pendingEvents,
			pendingSync,
			currentBranch: currentBranch ?? undefined,
			lastEventAt: events.length > 0 ? events[events.length - 1].timestamp : undefined,
			lastEntryAt: entries.length > 0 ? entries[entries.length - 1].createdAt : undefined,
		};
	}

	// ==========================================================
	// Private helpers
	// ==========================================================

	private async safeGetBranch(): Promise<string | null> {
		try {
			return await getCurrentBranch();
		} catch {
			return null;
		}
	}

	private detectTaskRefSync(branch: string): string | null {
		return parseTaskRef(branch, this.config.git.branchPatterns);
	}
}

// ==========================================================
// Filter helpers
// ==========================================================

function applyEventFilter(events: WorklogEvent[], filter?: EventFilter): WorklogEvent[] {
	if (!filter) return events;

	let result = events;

	if (filter.branch) {
		result = result.filter((e) => e.branch === filter.branch);
	}
	if (filter.taskRef) {
		result = result.filter((e) => e.taskRef === filter.taskRef);
	}
	if (filter.kind) {
		result = result.filter((e) => e.kind === filter.kind);
	}
	if (filter.since) {
		const sinceDate = new Date(filter.since).getTime();
		result = result.filter((e) => new Date(e.timestamp).getTime() >= sinceDate);
	}
	if (filter.limit) {
		result = result.slice(-filter.limit);
	}

	return result;
}

function applyEntryFilter(entries: WorklogEntry[], filter?: EntryFilter): WorklogEntry[] {
	if (!filter) return entries;

	let result = entries;

	if (filter.branch) {
		result = result.filter((e) => e.branch === filter.branch);
	}
	if (filter.taskRef) {
		result = result.filter((e) => e.taskRef === filter.taskRef);
	}
	if (filter.kind) {
		result = result.filter((e) => e.kind === filter.kind);
	}
	if (filter.syncStatus) {
		result = result.filter((e) => e.syncStatus === filter.syncStatus);
	}
	if (filter.since) {
		const sinceDate = new Date(filter.since).getTime();
		result = result.filter((e) => new Date(e.createdAt).getTime() >= sinceDate);
	}
	if (filter.limit) {
		result = result.slice(-filter.limit);
	}

	return result;
}

function describeAction(mode: SyncMode, entry: WorklogEntry): string {
	switch (mode) {
		case "comment":
			return `Add comment to task ${entry.taskRef ?? "unknown"}`;
		case "subtask":
			return `Create subtask under ${entry.taskRef ?? "unknown"}`;
		case "task":
			return "Create new task";
		case "skip":
			return "Skip (will not sync)";
	}
}
