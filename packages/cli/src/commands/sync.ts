import { loadConfig } from "@tasktrace/core";
import { defineCommand } from "citty";
import pc from "picocolors";
import { loadAdapter } from "../utils/adapter.js";
import { createEngine } from "../utils/engine.js";

export const syncCommand = defineCommand({
	meta: {
		name: "sync",
		description: "Sync worklog entries to the configured task provider",
	},
	args: {
		entry: {
			type: "string",
			alias: "e",
			description: "Sync a specific entry by ID",
		},
		dryRun: {
			type: "boolean",
			description: "Preview without syncing (alias for plan)",
			default: false,
		},
		json: {
			type: "boolean",
			description: "Output as JSON",
			default: false,
		},
	},
	async run({ args }) {
		const config = await loadConfig();
		const engine = await createEngine();

		let adapter;
		try {
			adapter = await loadAdapter(config);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			console.error(pc.red(message));
			process.exit(1);
		}

		// Test connection first
		const conn = await adapter.testConnection();
		if (!conn.ok) {
			console.error(pc.red(`Connection failed: ${conn.error}`));
			console.error(pc.dim("Check your API key and network."));
			process.exit(1);
		}

		// If dry-run, just show plan
		if (args.dryRun) {
			const plan = await engine.planSync(adapter);
			if (args.json) {
				console.log(JSON.stringify(plan, null, 2));
			} else {
				console.log(pc.yellow("[dry-run]"), `Would sync ${plan.items.length} entries.`);
				for (const item of plan.items) {
					console.log(`  ${pc.cyan(item.suggestedMode)} ${item.entry.summary}`);
				}
			}
			return;
		}

		// If specific entry requested, update its sync mode first
		if (args.entry) {
			const entries = await engine.listEntries();
			const target = entries.find(
				(e) => e.id === args.entry || e.id.endsWith(args.entry ?? ""),
			);
			if (!target) {
				console.error(pc.red(`Entry not found: ${args.entry}`));
				process.exit(1);
			}
		}

		// Execute sync
		const plan = await engine.planSync(adapter);

		if (plan.items.length === 0) {
			if (args.json) {
				console.log(JSON.stringify({ results: [], message: "Nothing to sync" }));
			} else {
				console.log(pc.dim("Nothing to sync. All entries are up to date."));
			}
			return;
		}

		console.log(pc.bold(`Syncing ${plan.items.length} entr${plan.items.length === 1 ? "y" : "ies"} to ${adapter.name}...`));
		console.log("");

		const results = await engine.executeSync(adapter, plan);

		if (args.json) {
			console.log(JSON.stringify(results, null, 2));
			return;
		}

		let success = 0;
		let failed = 0;

		for (let i = 0; i < results.length; i++) {
			const result = results[i];
			const item = plan.items[i];
			const summary = item.entry.summary.slice(0, 60);

			if (result.success) {
				success++;
				const ref = result.providerRef ? pc.dim(` → ${result.providerRef}`) : "";
				console.log(`  ${pc.green("✓")} ${summary}${ref}`);
			} else {
				failed++;
				console.log(`  ${pc.red("✗")} ${summary}`);
				console.log(`    ${pc.red(result.error ?? "Unknown error")}`);
			}
		}

		console.log("");
		console.log(`${pc.green(String(success))} synced, ${pc.red(String(failed))} failed.`);
	},
});
