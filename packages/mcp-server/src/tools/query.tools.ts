import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WorklogEngine } from "@tasktrace/core";
import { syncStatusSchema, worklogKindSchema } from "@tasktrace/core";
import { z } from "zod";

export function registerQueryTools(server: McpServer, engine: WorklogEngine): void {
	server.tool(
		"worklog_log",
		"List worklog entries with optional filters",
		{
			branch: z.string().optional().describe("Filter by branch name"),
			taskRef: z.string().optional().describe("Filter by task reference"),
			kind: worklogKindSchema.optional().describe("Filter by work type"),
			syncStatus: syncStatusSchema.optional().describe("Filter by sync status"),
			since: z.string().optional().describe("Filter since date (ISO format)"),
			limit: z.number().positive().optional().default(20).describe("Maximum entries to return"),
			showEvents: z.boolean().optional().describe("Show raw events instead of entries"),
		},
		async (input) => {
			const filter = {
				branch: input.branch,
				taskRef: input.taskRef,
				kind: input.kind,
				syncStatus: input.syncStatus,
				since: input.since,
				limit: input.limit,
			};

			if (input.showEvents) {
				const events = await engine.listEvents(filter);
				return {
					content: [{ type: "text", text: JSON.stringify(events, null, 2) }],
				};
			}

			const entries = await engine.listEntries(filter);
			return {
				content: [{ type: "text", text: JSON.stringify(entries, null, 2) }],
			};
		},
	);

	server.tool(
		"worklog_status",
		"Get a summary of the worklog state for the current project",
		{},
		async () => {
			const status = await engine.status();
			return {
				content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
			};
		},
	);
}
