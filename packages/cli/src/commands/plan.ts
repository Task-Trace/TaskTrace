import { loadConfig } from "@tasktrace/core";
import { defineCommand } from "citty";
import pc from "picocolors";
import { loadAdapter } from "../utils/adapter.js";
import { createEngine } from "../utils/engine.js";

export const planCommand = defineCommand({
	meta: {
		name: "plan",
		description: "Preview what would be synced to the task provider",
	},
	args: {
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

		const plan = await engine.planSync(adapter);

		if (args.json) {
			console.log(JSON.stringify(plan, null, 2));
			return;
		}

		if (plan.items.length === 0) {
			console.log(pc.dim("Nothing to sync. All entries are up to date."));
			return;
		}

		console.log(pc.bold(`Sync plan (${plan.items.length} entr${plan.items.length === 1 ? "y" : "ies"}):`));
		console.log("");

		for (const item of plan.items) {
			const mode = pc.cyan(item.suggestedMode.padEnd(10));
			const task = item.taskRef ? pc.yellow(item.taskRef) : pc.dim("no task");
			const action = pc.dim(item.action);
			console.log(`  ${mode} ${item.entry.summary}`);
			console.log(`           ${task}  ${action}`);
			console.log("");
		}

		console.log(pc.dim("Run 'tt sync' to execute this plan."));
	},
});
