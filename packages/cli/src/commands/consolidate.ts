import { defineCommand } from "citty";
import pc from "picocolors";
import { createEngine } from "../utils/engine.js";
import { formatEntry } from "../utils/output.js";

export const consolidateCommand = defineCommand({
	meta: {
		name: "consolidate",
		description: "Group pending events into worklog entries",
	},
	args: {
		dryRun: {
			type: "boolean",
			description: "Preview without saving",
			default: false,
		},
		gap: {
			type: "string",
			description: "Time gap in minutes to split entries (default: 240)",
			default: "240",
		},
		json: {
			type: "boolean",
			description: "Output as JSON",
			default: false,
		},
	},
	async run({ args }) {
		const engine = await createEngine();
		const gapMinutes = Number.parseInt(args.gap, 10);

		const entries = await engine.consolidate({
			dryRun: args.dryRun,
			gapMinutes,
		});

		if (args.json) {
			console.log(JSON.stringify(entries, null, 2));
			return;
		}

		if (entries.length === 0) {
			console.log(pc.dim("No pending events to consolidate."));
			return;
		}

		const prefix = args.dryRun ? pc.yellow("[dry-run] ") : "";
		console.log(
			pc.bold(`${prefix}Consolidated ${entries.length} entr${entries.length === 1 ? "y" : "ies"}:`),
		);
		console.log("");

		for (const entry of entries) {
			console.log(`  ${formatEntry(entry)}`);
		}

		if (args.dryRun) {
			console.log("");
			console.log(pc.dim("Run without --dry-run to save."));
		}
	},
});
