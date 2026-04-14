import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const POST_COMMIT_SCRIPT = `#!/bin/sh
# TaskTrace: auto-attach commit to latest worklog entry
tasktrace attach 2>/dev/null || true
`;

const PRE_COMMIT_SCRIPT = `#!/bin/sh
# TaskTrace: validate worklog entry exists for current branch
# Exit 0 to not block commit if tasktrace is not installed
tasktrace status --quiet 2>/dev/null || true
`;

/**
 * Generate a post-commit hook script.
 */
export function generatePostCommitHook(): string {
	return POST_COMMIT_SCRIPT;
}

/**
 * Generate a pre-commit hook script.
 */
export function generatePreCommitHook(): string {
	return PRE_COMMIT_SCRIPT;
}

/**
 * Install TaskTrace hooks into a project.
 * Detects Husky and uses it if available, otherwise falls back to .git/hooks/.
 */
export async function installHooks(
	projectDir: string,
	options: { preCommit?: boolean; postCommit?: boolean } = {},
): Promise<{ method: "husky" | "git-hooks"; installed: string[] }> {
	const { preCommit = false, postCommit = true } = options;
	const installed: string[] = [];

	const huskyDir = join(projectDir, ".husky");
	const useHusky = existsSync(huskyDir);
	const hookDir = useHusky ? huskyDir : join(projectDir, ".git", "hooks");

	if (!existsSync(hookDir)) {
		await mkdir(hookDir, { recursive: true });
	}

	if (postCommit) {
		const hookPath = join(hookDir, "post-commit");
		await appendHookContent(hookPath, POST_COMMIT_SCRIPT, "tasktrace attach");
		installed.push("post-commit");
	}

	if (preCommit) {
		const hookPath = join(hookDir, "pre-commit");
		await appendHookContent(hookPath, PRE_COMMIT_SCRIPT, "tasktrace status");
		installed.push("pre-commit");
	}

	return {
		method: useHusky ? "husky" : "git-hooks",
		installed,
	};
}

/**
 * Append TaskTrace hook content to an existing hook file,
 * or create a new one. Avoids duplicating if already present.
 */
async function appendHookContent(
	hookPath: string,
	fullScript: string,
	marker: string,
): Promise<void> {
	if (existsSync(hookPath)) {
		const existing = await readFile(hookPath, "utf-8");
		if (existing.includes(marker)) {
			return; // Already installed
		}
		// Append to existing hook
		const tasktraceLines = fullScript
			.split("\n")
			.filter((line) => !line.startsWith("#!/"))
			.join("\n");
		await writeFile(hookPath, `${existing}\n${tasktraceLines}`, "utf-8");
	} else {
		await writeFile(hookPath, fullScript, { mode: 0o755 });
	}
}
