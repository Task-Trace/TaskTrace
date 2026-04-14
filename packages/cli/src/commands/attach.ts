import { defineCommand } from "citty";
import pc from "picocolors";
import { createEngine } from "../utils/engine.js";
import { formatEntry } from "../utils/output.js";

export const attachCommand = defineCommand({
	meta: {
		name: "attach",
		description: "Link a git commit to a worklog entry",
	},
	args: {
		sha: {
			type: "positional",
			description: "Commit SHA (defaults to HEAD)",
			required: false,
		},
		entry: {
			type: "string",
			alias: "e",
			description: "Entry ID to attach to (defaults to most recent)",
		},
		json: {
			type: "boolean",
			description: "Output as JSON",
			default: false,
		},
	},
	async run({ args }) {
		const engine = await createEngine();

		try {
			const entry = await engine.attachCommit(args.sha ?? undefined, args.entry ?? undefined);

			if (args.json) {
				console.log(JSON.stringify(entry, null, 2));
			} else {
				console.log(pc.green("Commit attached:"));
				console.log(`  ${formatEntry(entry)}`);
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			console.error(pc.red(`Failed to attach commit: ${message}`));
			process.exit(1);
		}
	},
});
