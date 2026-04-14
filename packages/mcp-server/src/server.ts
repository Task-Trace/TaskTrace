import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FileStorageProvider, WorklogEngine, loadConfig } from "@tasktrace/core";
import { registerResourceHandlers } from "./resources/worklogs.resource.js";
import { registerQueryTools } from "./tools/query.tools.js";
import { registerWorklogTools } from "./tools/worklog.tools.js";

export interface TaskTraceMcpServer {
	start(): Promise<void>;
}

export async function createMcpServer(): Promise<TaskTraceMcpServer> {
	const projectDir = process.env.TASKTRACE_PROJECT_DIR ?? process.cwd();
	const config = await loadConfig(projectDir);
	const storage = new FileStorageProvider(config, projectDir);
	const engine = new WorklogEngine(config, storage);

	const server = new McpServer({
		name: "tasktrace",
		version: "0.1.0",
	});

	// Register tools
	registerWorklogTools(server, engine);
	registerQueryTools(server, engine);

	// Register resources
	registerResourceHandlers(server, engine, config);

	return {
		async start() {
			const transport = new StdioServerTransport();
			await server.connect(transport);
		},
	};
}
