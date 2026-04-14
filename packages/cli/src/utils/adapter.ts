import type { TaskProviderAdapter, TaskTraceConfig } from "@tasktrace/core";

/**
 * Load the configured task provider adapter.
 *
 * API key resolution order:
 * 1. Environment variable (TASKTRACE_CLICKUP_API_KEY)
 * 2. Global config (~/.tasktrace/config.json → provider.config.apiKey)
 * 3. Project config (.tasktracerc.json → provider.config.apiKey) — NOT recommended
 */
export async function loadAdapter(config: TaskTraceConfig): Promise<TaskProviderAdapter> {
	if (!config.provider) {
		throw new Error(
			"No provider configured.\n" +
				'Add "provider" to .tasktracerc.json:\n\n' +
				'  "provider": {\n' +
				'    "name": "clickup",\n' +
				'    "config": { "defaultListId": "YOUR_LIST_ID" }\n' +
				"  }",
		);
	}

	switch (config.provider.name) {
		case "clickup":
			return loadClickUpAdapter(config);
		default:
			throw new Error(
				`Unknown provider: "${config.provider.name}". Supported: clickup`,
			);
	}
}

async function loadClickUpAdapter(config: TaskTraceConfig): Promise<TaskProviderAdapter> {
	const { ClickUpAdapter } = await import("@tasktrace/adapter-clickup");

	const providerConfig = (config.provider?.config ?? {}) as Record<string, unknown>;

	// Resolve API key: env var takes priority
	const apiKey =
		process.env.TASKTRACE_CLICKUP_API_KEY ??
		(providerConfig.apiKey as string | undefined);

	if (!apiKey) {
		throw new Error(
			"ClickUp API key not found.\n\n" +
				"Set it via environment variable:\n" +
				"  export TASKTRACE_CLICKUP_API_KEY=pk_YOUR_KEY\n\n" +
				"Or add it to ~/.tasktrace/config.json:\n" +
				'  { "provider": { "name": "clickup", "config": { "apiKey": "pk_YOUR_KEY" } } }\n\n' +
				"Get your key at: https://app.clickup.com/settings/apps",
		);
	}

	const defaultListId = providerConfig.defaultListId as string | undefined;
	if (!defaultListId) {
		throw new Error(
			"ClickUp defaultListId not configured.\n\n" +
				"Add it to .tasktracerc.json:\n" +
				'  "provider": {\n' +
				'    "name": "clickup",\n' +
				'    "config": { "defaultListId": "YOUR_LIST_ID" }\n' +
				"  }\n\n" +
				"Find your list ID in the ClickUp URL: app.clickup.com/.../li/YOUR_LIST_ID",
		);
	}

	const assignees = providerConfig.assignees as number[] | undefined;

	return new ClickUpAdapter({
		apiKey,
		defaultListId,
		workspaceId: providerConfig.workspaceId as string | undefined,
		...(assignees && assignees.length > 0 && { assignees }),
	});
}
