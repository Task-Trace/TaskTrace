import type { WorklogKind, WorklogSource } from "@tasktrace/core";
import { defineCommand } from "citty";
import pc from "picocolors";
import { createEngine } from "../utils/engine.js";
import { formatEvent } from "../utils/output.js";

const VALID_KINDS: WorklogKind[] = [
	"investigation",
	"implementation",
	"bugfix",
	"refactor",
	"review",
	"documentation",
	"meeting",
	"support",
];

const VALID_SOURCES: WorklogSource[] = ["manual", "ai", "git", "system"];

export const addCommand = defineCommand({
	meta: {
		name: "add",
		description: "Add a worklog event",
	},
	args: {
		description: {
			type: "string",
			alias: "d",
			description: "What was done",
			required: true,
		},
		kind: {
			type: "string",
			alias: "k",
			description: `Type of work: ${VALID_KINDS.join(", ")}`,
			default: "implementation",
		},
		source: {
			type: "string",
			alias: "s",
			description: `Source: ${VALID_SOURCES.join(", ")}`,
			default: "manual",
		},
		duration: {
			type: "string",
			alias: "t",
			description: "Duration in minutes",
		},
		taskRef: {
			type: "string",
			alias: "r",
			description: "Task reference (e.g. CU-abc123)",
		},
		tags: {
			type: "string",
			description: "Comma-separated tags",
		},
		json: {
			type: "boolean",
			description: "Output as JSON",
			default: false,
		},
	},
	async run({ args }) {
		const engine = await createEngine();

		const kind = args.kind as WorklogKind;
		if (!VALID_KINDS.includes(kind)) {
			console.error(pc.red(`Invalid kind: ${kind}. Valid: ${VALID_KINDS.join(", ")}`));
			process.exit(1);
		}

		const source = args.source as WorklogSource;
		if (!VALID_SOURCES.includes(source)) {
			console.error(pc.red(`Invalid source: ${source}. Valid: ${VALID_SOURCES.join(", ")}`));
			process.exit(1);
		}

		const event = await engine.addEvent({
			description: args.description,
			kind,
			source,
			durationMinutes: args.duration ? Number.parseInt(args.duration, 10) : undefined,
			taskRef: args.taskRef ?? undefined,
			tags: args.tags ? args.tags.split(",").map((t) => t.trim()) : undefined,
		});

		if (args.json) {
			console.log(JSON.stringify(event, null, 2));
		} else {
			console.log(pc.green("Event added:"));
			console.log(`  ${formatEvent(event)}`);
		}
	},
});
