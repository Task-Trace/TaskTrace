import type { WorklogEntry, WorklogEvent, WorklogStatus } from "@tasktrace/core";
import pc from "picocolors";

/**
 * Format a worklog event for terminal display.
 */
export function formatEvent(event: WorklogEvent): string {
	const time = new Date(event.timestamp).toLocaleString();
	const kind = pc.cyan(event.kind.padEnd(15));
	const branch = event.branch ? pc.dim(` [${event.branch}]`) : "";
	const taskRef = event.taskRef ? pc.yellow(` ${event.taskRef}`) : "";
	const duration = event.durationMinutes ? pc.dim(` ${event.durationMinutes}m`) : "";

	return `${pc.dim(event.id.slice(-6))} ${pc.dim(time)} ${kind} ${event.description}${branch}${taskRef}${duration}`;
}

/**
 * Format a worklog entry for terminal display.
 */
export function formatEntry(entry: WorklogEntry): string {
	const time = new Date(entry.createdAt).toLocaleString();
	const kind = pc.cyan(entry.kind.padEnd(15));
	const branch = entry.branch ? pc.dim(` [${entry.branch}]`) : "";
	const taskRef = entry.taskRef ? pc.yellow(` ${entry.taskRef}`) : "";
	const commits = entry.commits.length > 0 ? pc.green(` ${entry.commits.length} commits`) : "";
	const sync = formatSyncBadge(entry.syncStatus);
	const events = pc.dim(` (${entry.eventIds.length} events)`);
	const duration = entry.totalMinutes > 0 ? pc.dim(` ${entry.totalMinutes}m`) : "";

	return `${pc.dim(entry.id.slice(-6))} ${pc.dim(time)} ${kind} ${entry.summary}${branch}${taskRef}${commits}${duration}${events} ${sync}`;
}

/**
 * Format a sync status badge.
 */
function formatSyncBadge(status: string): string {
	switch (status) {
		case "pending":
			return pc.yellow("[pending]");
		case "synced":
			return pc.green("[synced]");
		case "failed":
			return pc.red("[failed]");
		case "ignored":
			return pc.dim("[ignored]");
		case "planned":
			return pc.blue("[planned]");
		default:
			return pc.dim(`[${status}]`);
	}
}

/**
 * Format worklog status for terminal display.
 */
export function formatStatus(status: WorklogStatus): string {
	const lines: string[] = [];

	lines.push(pc.bold("TaskTrace Status"));
	lines.push("");

	if (status.currentBranch) {
		lines.push(`  ${pc.dim("Branch:")}     ${pc.cyan(status.currentBranch)}`);
	}

	lines.push(
		`  ${pc.dim("Events:")}     ${status.totalEvents} total, ${pc.yellow(String(status.pendingEvents))} pending`,
	);
	lines.push(
		`  ${pc.dim("Entries:")}    ${status.totalEntries} total, ${pc.yellow(String(status.pendingSync))} pending sync`,
	);

	if (status.lastEventAt) {
		lines.push(`  ${pc.dim("Last event:")} ${new Date(status.lastEventAt).toLocaleString()}`);
	}
	if (status.lastEntryAt) {
		lines.push(`  ${pc.dim("Last entry:")} ${new Date(status.lastEntryAt).toLocaleString()}`);
	}

	return lines.join("\n");
}
