import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TaskTraceConfig, WorklogEngine } from "@tasktrace/core";

export function registerResourceHandlers(
	server: McpServer,
	engine: WorklogEngine,
	config: TaskTraceConfig,
): void {
	server.resource(
		"config",
		"tasktrace://config",
		{ description: "Current TaskTrace configuration" },
		async (uri) => ({
			contents: [
				{
					uri: uri.href,
					mimeType: "application/json",
					text: JSON.stringify(config, null, 2),
				},
			],
		}),
	);

	server.resource(
		"recent-worklogs",
		"tasktrace://worklogs/recent",
		{ description: "Recent worklog entries (last 10)" },
		async (uri) => {
			const entries = await engine.listEntries({ limit: 10 });
			return {
				contents: [
					{
						uri: uri.href,
						mimeType: "application/json",
						text: JSON.stringify(entries, null, 2),
					},
				],
			};
		},
	);
}
