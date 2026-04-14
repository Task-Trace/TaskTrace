import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

export interface CommitInfo {
	sha: string;
	shortSha: string;
	message: string;
	author: string;
	date: string;
}

/**
 * Execute a git command safely using execFile (no shell injection).
 */
async function git(args: string[], cwd?: string): Promise<string> {
	const { stdout } = await execFile("git", args, {
		cwd: cwd ?? process.cwd(),
		timeout: 10_000,
	});
	return stdout.trim();
}

/**
 * Get the current branch name.
 */
export async function getCurrentBranch(cwd?: string): Promise<string> {
	return git(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
}

/**
 * Get the full SHA of HEAD or a given ref.
 */
export async function getCommitSha(ref = "HEAD", cwd?: string): Promise<string> {
	return git(["rev-parse", ref], cwd);
}

/**
 * Get detailed commit info for a given ref.
 */
export async function getCommitInfo(ref = "HEAD", cwd?: string): Promise<CommitInfo> {
	const format = "%H%n%h%n%s%n%an%n%aI";
	const output = await git(["log", "-1", `--format=${format}`, ref], cwd);
	const [sha, shortSha, message, author, date] = output.split("\n");

	return { sha, shortSha, message, author, date };
}

/**
 * Check if we're inside a git repository.
 */
export async function isGitRepo(cwd?: string): Promise<boolean> {
	try {
		await git(["rev-parse", "--is-inside-work-tree"], cwd);
		return true;
	} catch {
		return false;
	}
}
