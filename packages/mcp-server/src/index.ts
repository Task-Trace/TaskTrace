#!/usr/bin/env node
import { createMcpServer } from "./server.js";

async function main() {
	const server = await createMcpServer();
	await server.start();
}

main().catch((err) => {
	console.error("[TaskTrace MCP] Fatal error:", err);
	process.exit(1);
});
