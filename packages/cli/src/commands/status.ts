import { defineCommand } from "citty";
import { createEngine } from "../utils/engine.js";
import { formatStatus } from "../utils/output.js";

export const statusCommand = defineCommand({
	meta: {
		name: "status",
		description: "Show worklog status summary",
	},
	args: {
		json: {
			type: "boolean",
			description: "Output as JSON",
			default: false,
		},
		quiet: {
			type: "boolean",
			alias: "q",
			description: "Quiet mode (exit code only)",
			default: false,
		},
	},
	async run({ args }) {
		const engine = await createEngine();
		const status = await engine.status();

		if (args.quiet) {
			// Exit 0 if there are pending events, 1 if not
			process.exit(status.pendingEvents > 0 ? 0 : 1);
		}

		if (args.json) {
			console.log(JSON.stringify(status, null, 2));
		} else {
			console.log(formatStatus(status));
		}
	},
});
