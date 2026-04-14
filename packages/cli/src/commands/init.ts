import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { generateProjectConfig, installHooks, isGitRepo } from "@tasktrace/core";
import { defineCommand } from "citty";
import pc from "picocolors";

export const initCommand = defineCommand({
	meta: {
		name: "init",
		description: "Initialize TaskTrace in the current project",
	},
	args: {
		dir: {
			type: "string",
			description: "Project directory",
			default: ".",
		},
		hooks: {
			type: "boolean",
			description: "Install git hooks",
			default: false,
		},
	},
	async run({ args }) {
		const projectDir = args.dir === "." ? process.cwd() : args.dir;

		// Check if already initialized
		const configPath = join(projectDir, ".tasktracerc.json");
		if (existsSync(configPath)) {
			console.log(pc.yellow("TaskTrace already initialized in this project."));
			return;
		}

		// Generate default config
		const config = generateProjectConfig();
		await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
		console.log(pc.green("Created .tasktracerc.json"));

		// Create storage directory
		const storageDir = join(projectDir, config.storage.dir);
		if (!existsSync(storageDir)) {
			await mkdir(storageDir, { recursive: true });
			console.log(pc.green(`Created storage directory: ${config.storage.dir}/`));
		}

		// Install hooks if requested and in a git repo
		if (args.hooks) {
			const inGitRepo = await isGitRepo(projectDir);
			if (inGitRepo) {
				const result = await installHooks(projectDir, {
					preCommit: config.git.hooks.preCommit,
					postCommit: config.git.hooks.postCommit,
				});
				console.log(
					pc.green(`Installed hooks via ${result.method}: ${result.installed.join(", ")}`),
				);
			} else {
				console.log(pc.yellow("Not a git repository — skipping hooks."));
			}
		}

		console.log("");
		console.log(pc.bold("TaskTrace initialized!"));
		console.log(pc.dim('  Next: tt add -d "your first worklog" -k implementation'));
	},
});
