import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WorklogEngine } from "@tasktrace/core";
import { worklogKindSchema, worklogSourceSchema } from "@tasktrace/core";
import { z } from "zod";

export function registerWorklogTools(server: McpServer, engine: WorklogEngine): void {
	server.tool(
		"worklog_add",
		"Add a worklog event for the current work session",
		{
			description: z.string().describe("What was done"),
			kind: worklogKindSchema.describe("Type of work"),
			source: worklogSourceSchema.optional().describe("Event source (default: ai)"),
			durationMinutes: z.number().positive().optional().describe("Time spent in minutes"),
			taskRef: z.string().optional().describe("Task reference (e.g. CU-abc123)"),
			tags: z.array(z.string()).optional().describe("Tags for categorization"),
		},
		async (input) => {
			const event = await engine.addEvent({
				...input,
				source: input.source ?? "ai",
			});
			return {
				content: [{ type: "text", text: JSON.stringify(event, null, 2) }],
			};
		},
	);

	server.tool(
		"worklog_consolidate",
		"Group recent events into worklog entries",
		{
			dryRun: z.boolean().optional().describe("Preview without saving"),
			gapMinutes: z
				.number()
				.positive()
				.optional()
				.describe("Time gap to split entries (default: 240)"),
		},
		async (input) => {
			const entries = await engine.consolidate({
				dryRun: input.dryRun,
				gapMinutes: input.gapMinutes,
			});

			const summary =
				entries.length === 0
					? "No pending events to consolidate."
					: `Consolidated ${entries.length} entr${entries.length === 1 ? "y" : "ies"}.`;

			return {
				content: [
					{ type: "text", text: summary },
					{ type: "text", text: JSON.stringify(entries, null, 2) },
				],
			};
		},
	);

	server.tool(
		"worklog_attach_commit",
		"Link a git commit to the most recent worklog entry",
		{
			sha: z.string().optional().describe("Commit SHA (defaults to HEAD)"),
			entryId: z
				.string()
				.optional()
				.describe("Entry ID (defaults to most recent on current branch)"),
		},
		async (input) => {
			const entry = await engine.attachCommit(input.sha, input.entryId);
			return {
				content: [{ type: "text", text: JSON.stringify(entry, null, 2) }],
			};
		},
	);
}
