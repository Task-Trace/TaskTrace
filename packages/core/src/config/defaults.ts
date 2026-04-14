import type { TaskTraceConfig } from "../types.js";

export const DEFAULT_CONFIG: TaskTraceConfig = {
	version: 1,
	storage: {
		dir: ".tasktrace",
	},
	git: {
		branchPatterns: ["[Cc][Uu]-([a-zA-Z0-9]+)", "([A-Z]+-\\d+)", "#(\\d+)"],
		hooks: {
			preCommit: false,
			postCommit: true,
		},
	},
	defaults: {
		syncMode: "comment",
		kind: "implementation",
	},
};

/** Default gap in minutes between events to split into separate entries */
export const DEFAULT_CONSOLIDATION_GAP_MINUTES = 240;
