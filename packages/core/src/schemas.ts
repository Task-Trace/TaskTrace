import { z } from "zod";

// === Enum Schemas ===

export const worklogSourceSchema = z.enum(["manual", "ai", "git", "system"]);

export const worklogKindSchema = z.enum([
	"investigation",
	"implementation",
	"bugfix",
	"refactor",
	"review",
	"documentation",
	"meeting",
	"support",
]);

export const worklogStatusHintSchema = z.enum(["planned", "in_progress", "blocked", "done"]);

export const syncModeSchema = z.enum(["comment", "subtask", "task", "skip"]);

export const syncStatusSchema = z.enum(["pending", "planned", "synced", "failed", "ignored"]);

// === WorklogEvent Schema ===

export const worklogEventSchema = z.object({
	id: z.string(),
	timestamp: z.string(),
	source: worklogSourceSchema,
	kind: worklogKindSchema,
	description: z.string().min(1),
	durationMinutes: z.number().positive().optional(),
	commitSha: z
		.string()
		.regex(/^[a-f0-9]{7,40}$/)
		.optional(),
	branch: z.string().optional(),
	taskRef: z.string().optional(),
	tags: z.array(z.string()).optional(),
	metadata: z.record(z.unknown()).optional(),
});

// === AddEventInput Schema (without auto-generated fields) ===

export const addEventInputSchema = z.object({
	source: worklogSourceSchema.optional(),
	kind: worklogKindSchema,
	description: z.string().min(1),
	durationMinutes: z.number().positive().optional(),
	commitSha: z
		.string()
		.regex(/^[a-f0-9]{7,40}$/)
		.optional(),
	branch: z.string().optional(),
	taskRef: z.string().optional(),
	tags: z.array(z.string()).optional(),
	metadata: z.record(z.unknown()).optional(),
});

// === WorklogEntry Schema ===

export const worklogEntrySchema = z.object({
	id: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
	eventIds: z.array(z.string()),
	summary: z.string().min(1),
	kind: worklogKindSchema,
	statusHint: worklogStatusHintSchema,
	totalMinutes: z.number().min(0),
	taskRef: z.string().optional(),
	branch: z.string().optional(),
	commits: z.array(z.string()),
	syncMode: syncModeSchema,
	syncStatus: syncStatusSchema,
	tags: z.array(z.string()).optional(),
	metadata: z.record(z.unknown()).optional(),
});

// === SyncState Schema ===

export const syncStateEntrySchema = z.object({
	syncStatus: syncStatusSchema,
	syncMode: syncModeSchema,
	providerRef: z.string().optional(),
	syncedAt: z.string().optional(),
	error: z.string().optional(),
});

export const syncStateSchema = z.object({
	lastSyncAt: z.string().optional(),
	entries: z.record(syncStateEntrySchema),
});

// === Config Schema ===

export const taskTraceConfigSchema = z.object({
	version: z.literal(1),
	storage: z.object({
		dir: z.string(),
	}),
	git: z.object({
		branchPatterns: z.array(z.string()),
		hooks: z.object({
			preCommit: z.boolean(),
			postCommit: z.boolean(),
		}),
	}),
	provider: z
		.object({
			name: z.string(),
			config: z.record(z.unknown()),
		})
		.optional(),
	defaults: z.object({
		syncMode: syncModeSchema,
		kind: worklogKindSchema,
	}),
});

// === Filter Schemas ===

export const eventFilterSchema = z.object({
	branch: z.string().optional(),
	taskRef: z.string().optional(),
	kind: worklogKindSchema.optional(),
	since: z.string().optional(),
	limit: z.number().positive().optional(),
});

export const entryFilterSchema = z.object({
	branch: z.string().optional(),
	taskRef: z.string().optional(),
	kind: worklogKindSchema.optional(),
	syncStatus: syncStatusSchema.optional(),
	since: z.string().optional(),
	limit: z.number().positive().optional(),
});
