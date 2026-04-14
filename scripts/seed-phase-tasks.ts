/**
 * Creates one ClickUp task per implementation phase and marks all as complete.
 * Run: bun run scripts/seed-phase-tasks.ts
 */
// Simple ULID-compatible ID: timestamp prefix + random suffix
function makeId(): string {
	return Date.now().toString(36).toUpperCase().padStart(10, "0") + Math.random().toString(36).slice(2, 12).toUpperCase().padStart(10, "0");
}
import { FileStorageProvider, WorklogEngine, loadConfig } from "../packages/core/src/index.js";
import { ClickUpAdapter } from "../packages/adapter-clickup/src/index.js";
import type { WorklogEntry } from "../packages/core/src/index.js";

const API_KEY = process.env.TASKTRACE_CLICKUP_API_KEY ?? "";
const LIST_ID = "901712903985";

const PHASES: Array<{ title: string; summary: string; tags: string[]; minutes: number }> = [
	{
		title: "Fase 1 — Scaffold: monorepo, tooling e configs",
		summary:
			"Setup do monorepo com Bun workspaces, Turbo, Biome, TypeScript e estrutura dos 4 packages (@tasktrace/core, cli, adapter-clickup, mcp-server). Inclui LICENSE MIT, CLAUDE.md e .gitignore.",
		tags: ["scaffold", "monorepo", "infra"],
		minutes: 20,
	},
	{
		title: "Fase 2 — Core: engine, storage, git e consolidation",
		summary:
			"Implementação completa do @tasktrace/core: tipos TypeScript, schemas Zod, storage NDJSON com file locking e atomic writes, sistema de config com hierarquia (defaults → global → projeto → env), git branch parser com auto-detect CU/Jira/GitHub, WorklogEngine com todos os métodos, e 28 testes unitários.",
		tags: ["core", "engine", "storage", "git", "tests"],
		minutes: 120,
	},
	{
		title: "Fase 3 — CLI: 8 comandos com dual output JSON/terminal",
		summary:
			"Implementação do @tasktrace/cli com Citty: comandos init, add, log, status, consolidate, attach, plan e sync. Todos suportam --json para consumo por agentes. Output formatado com picocolors. Binários tasktrace e tt.",
		tags: ["cli", "commands", "ux"],
		minutes: 45,
	},
	{
		title: "Fase 4 — MCP Server: tools e resources para agentes IA",
		summary:
			"Implementação do @tasktrace/mcp-server com transporte stdio para Claude Code e Cursor. 5 tools: worklog_add, worklog_consolidate, worklog_attach_commit, worklog_log, worklog_status. 2 resources: tasktrace://config e tasktrace://worklogs/recent.",
		tags: ["mcp", "ai-integration", "tools"],
		minutes: 30,
	},
	{
		title: "Fase 5 — ClickUp Adapter: sync bidirecional com task creation",
		summary:
			"Implementação do @tasktrace/adapter-clickup com ClickUpAdapter completo: HTTP client via native fetch, sync modes (comment/subtask/task/skip), heurística de sugestão de modo, auto-criação de tasks para trabalho sem taskRef. Factory de adapter no CLI com resolução de API key via env ou config global.",
		tags: ["clickup", "adapter", "sync"],
		minutes: 40,
	},
];

async function markComplete(taskId: string): Promise<void> {
	const res = await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
		method: "PUT",
		headers: {
			Authorization: API_KEY,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ status: "complete" }),
	});
	if (!res.ok) {
		throw new Error(`Failed to mark complete: HTTP ${res.status}`);
	}
}

async function main() {
	const now = new Date().toISOString();
	const config = await loadConfig();
	const storage = new FileStorageProvider(config);
	const engine = new WorklogEngine(config, storage);

	const adapter = new ClickUpAdapter({ apiKey: API_KEY, defaultListId: LIST_ID });

	// Verify connection
	const conn = await adapter.testConnection();
	if (!conn.ok) throw new Error(`ClickUp connection failed: ${conn.error}`);
	console.log("✓ Connected to ClickUp\n");

	for (const [i, phase] of PHASES.entries()) {
		const phaseNum = i + 1;
		process.stdout.write(`Creating task ${phaseNum}/5: ${phase.title}... `);

		// Create entry directly in storage
		const entry: WorklogEntry = {
			id: makeId(),
			createdAt: now,
			updatedAt: now,
			eventIds: [],
			summary: phase.title,
			kind: "implementation",
			statusHint: "done",
			totalMinutes: phase.minutes,
			branch: "main",
			commits: [],
			syncMode: "task",
			syncStatus: "pending",
			tags: phase.tags,
			metadata: { description: phase.summary },
		};

		await storage.append("entries", entry);

		// Sync as new task
		const result = await adapter.syncEntry(entry, "task");
		if (!result.success) throw new Error(`Sync failed: ${result.error}`);

		const taskId = result.providerRef?.replace(/^CU-/i, "") ?? "";

		// Mark complete
		await markComplete(taskId);

		// Update entry status
		await engine.updateEntry(entry.id, { syncStatus: "synced" });

		console.log(`✓  ${result.providerRef}`);
	}

	console.log("\n5 tasks created and marked complete.");
}

main().catch((err) => {
	console.error("Error:", err.message);
	process.exit(1);
});
