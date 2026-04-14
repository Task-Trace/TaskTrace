import type {
	CreateTaskParams,
	ProviderTask,
	SyncMode,
	SyncResult,
	TaskProviderAdapter,
	WorklogEntry,
} from "@tasktrace/core";
import type { ClickUpConfig } from "./types.js";

/**
 * ClickUp adapter for TaskTrace.
 * Implements the TaskProviderAdapter interface for syncing worklogs to ClickUp.
 */
export class ClickUpAdapter implements TaskProviderAdapter {
	readonly name = "clickup";
	private readonly apiKey: string;
	private readonly baseUrl = "https://api.clickup.com/api/v2";
	private readonly defaultListId: string;

	private readonly assignees: number[];

	constructor(config: ClickUpConfig) {
		this.apiKey = config.apiKey;
		this.defaultListId = config.defaultListId;
		this.assignees = config.assignees ?? [];
	}

	async testConnection(): Promise<{ ok: boolean; error?: string }> {
		try {
			const response = await this.fetch("/user");
			if (!response.ok) {
				return { ok: false, error: `HTTP ${response.status}: ${response.statusText}` };
			}
			return { ok: true };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : String(err) };
		}
	}

	async resolveTask(taskRef: string): Promise<ProviderTask | null> {
		const taskId = taskRef.replace(/^CU-/i, "");
		try {
			const response = await this.fetch(`/task/${taskId}`);
			if (!response.ok) return null;

			const data = (await response.json()) as {
				id: string;
				name: string;
				url: string;
				status: { status: string };
			};
			return {
				id: data.id,
				ref: `CU-${data.id}`,
				title: data.name,
				url: data.url,
				status: data.status?.status,
			};
		} catch {
			return null;
		}
	}

	async createTask(params: CreateTaskParams): Promise<ProviderTask> {
		const response = await this.fetch(`/list/${this.defaultListId}/task`, {
			method: "POST",
			body: JSON.stringify({
				name: params.title,
				description: params.description ?? "",
				status: params.status ?? "to do",
				...(this.assignees.length > 0 && { assignees: this.assignees }),
			}),
		});

		if (!response.ok) {
			throw new Error(`Failed to create task: HTTP ${response.status}`);
		}

		const data = (await response.json()) as {
			id: string;
			name: string;
			url: string;
			status: { status: string };
		};
		return {
			id: data.id,
			ref: `CU-${data.id}`,
			title: data.name,
			url: data.url,
			status: data.status?.status,
		};
	}

	async syncEntry(entry: WorklogEntry, mode: SyncMode): Promise<SyncResult> {
		if (mode === "skip") {
			return { success: true };
		}

		switch (mode) {
			case "comment":
				return this.syncAsComment(entry);
			case "subtask":
				return this.syncAsSubtask(entry);
			case "task":
				return this.syncAsNewTask(entry);
			default:
				return { success: false, error: `Unknown sync mode: ${mode}` };
		}
	}

	suggestSyncMode(entry: WorklogEntry): SyncMode {
		if (!entry.taskRef) return "task";
		if (entry.totalMinutes > 120 || entry.commits.length > 3) return "subtask";
		return "comment";
	}

	// === Private methods ===

	private async syncAsComment(entry: WorklogEntry): Promise<SyncResult> {
		const taskId = entry.taskRef?.replace(/^CU-/i, "");
		if (!taskId) {
			return { success: false, error: "No taskRef to add comment to" };
		}

		const body = this.formatCommentBody(entry);
		const response = await this.fetch(`/task/${taskId}/comment`, {
			method: "POST",
			body: JSON.stringify({ comment_text: body }),
		});

		if (!response.ok) {
			return { success: false, error: `HTTP ${response.status}` };
		}

		const data = (await response.json()) as { id: string };
		return { success: true, providerRef: data.id };
	}

	private async syncAsSubtask(entry: WorklogEntry): Promise<SyncResult> {
		const parentId = entry.taskRef?.replace(/^CU-/i, "");
		if (!parentId) {
			return this.syncAsNewTask(entry);
		}

		const response = await this.fetch(`/list/${this.defaultListId}/task`, {
			method: "POST",
			body: JSON.stringify({
				name: entry.summary,
				description: this.formatDescription(entry),
				parent: parentId,
				...(this.assignees.length > 0 && { assignees: this.assignees }),
			}),
		});

		if (!response.ok) {
			return { success: false, error: `HTTP ${response.status}` };
		}

		const data = (await response.json()) as { id: string };
		return { success: true, providerRef: `CU-${data.id}` };
	}

	private async syncAsNewTask(entry: WorklogEntry): Promise<SyncResult> {
		const response = await this.fetch(`/list/${this.defaultListId}/task`, {
			method: "POST",
			body: JSON.stringify({
				name: entry.summary,
				description: this.formatDescription(entry),
				...(this.assignees.length > 0 && { assignees: this.assignees }),
			}),
		});

		if (!response.ok) {
			return { success: false, error: `HTTP ${response.status}` };
		}

		const data = (await response.json()) as { id: string };
		return { success: true, providerRef: `CU-${data.id}` };
	}

	private formatCommentBody(entry: WorklogEntry): string {
		const lines: string[] = [];
		lines.push(`**${entry.summary}**`);
		lines.push("");
		lines.push(`Type: ${entry.kind}`);
		if (entry.totalMinutes > 0) lines.push(`Duration: ${entry.totalMinutes}m`);
		if (entry.branch) lines.push(`Branch: ${entry.branch}`);
		if (entry.commits.length > 0) {
			lines.push(`Commits: ${entry.commits.map((c: string) => c.slice(0, 7)).join(", ")}`);
		}
		return lines.join("\n");
	}

	private formatDescription(entry: WorklogEntry): string {
		const lines: string[] = [];
		lines.push(entry.summary);
		lines.push("");
		if (entry.branch) lines.push(`Branch: ${entry.branch}`);
		if (entry.commits.length > 0) {
			lines.push(`Commits: ${entry.commits.map((c: string) => c.slice(0, 7)).join(", ")}`);
		}
		if (entry.tags && entry.tags.length > 0) {
			lines.push(`Tags: ${entry.tags.join(", ")}`);
		}
		return lines.join("\n");
	}

	private async fetch(path: string, init?: RequestInit): Promise<Response> {
		return fetch(`${this.baseUrl}${path}`, {
			...init,
			headers: {
				Authorization: this.apiKey,
				"Content-Type": "application/json",
				...init?.headers,
			},
		});
	}
}
