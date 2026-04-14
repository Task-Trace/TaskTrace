#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { addCommand } from "./commands/add.js";
import { attachCommand } from "./commands/attach.js";
import { consolidateCommand } from "./commands/consolidate.js";
import { initCommand } from "./commands/init.js";
import { logCommand } from "./commands/log.js";
import { planCommand } from "./commands/plan.js";
import { statusCommand } from "./commands/status.js";
import { syncCommand } from "./commands/sync.js";

const main = defineCommand({
	meta: {
		name: "tasktrace",
		version: "0.1.0",
		description: "Git-native developer worklog engine",
	},
	subCommands: {
		init: initCommand,
		add: addCommand,
		log: logCommand,
		status: statusCommand,
		consolidate: consolidateCommand,
		attach: attachCommand,
		plan: planCommand,
		sync: syncCommand,
	},
});

runMain(main);
