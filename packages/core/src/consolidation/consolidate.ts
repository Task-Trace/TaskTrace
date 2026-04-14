import { ulid } from "ulid";
import { DEFAULT_CONSOLIDATION_GAP_MINUTES } from "../config/defaults.js";
import type { ConsolidateOptions, WorklogEntry, WorklogEvent, WorklogKind } from "../types.js";

interface EventGroup {
	key: string;
	events: WorklogEvent[];
}

/**
 * Group events by branch + taskRef, then split by time gaps.
 * Events within the same group and within the gap threshold are consolidated into one entry.
 */
export function consolidateEvents(
	events: WorklogEvent[],
	existingEntryEventIds: Set<string>,
	options?: ConsolidateOptions,
): WorklogEntry[] {
	const gapMinutes = options?.gapMinutes ?? DEFAULT_CONSOLIDATION_GAP_MINUTES;

	// Filter out events that are already consolidated
	const pendingEvents = events.filter((e) => !existingEntryEventIds.has(e.id));

	if (pendingEvents.length === 0) {
		return [];
	}

	// Sort by timestamp
	const sorted = [...pendingEvents].sort(
		(a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
	);

	// Group by branch + taskRef
	const groups = groupByKey(sorted);

	// Split each group by time gaps and create entries
	const entries: WorklogEntry[] = [];

	for (const group of groups) {
		const subGroups = splitByTimeGap(group.events, gapMinutes);

		for (const subGroup of subGroups) {
			entries.push(createEntryFromEvents(subGroup));
		}
	}

	return entries;
}

/**
 * Group events by their branch + taskRef combination.
 */
function groupByKey(events: WorklogEvent[]): EventGroup[] {
	const map = new Map<string, WorklogEvent[]>();

	for (const event of events) {
		const key = `${event.branch ?? "unknown"}::${event.taskRef ?? "none"}`;
		const group = map.get(key);
		if (group) {
			group.push(event);
		} else {
			map.set(key, [event]);
		}
	}

	return Array.from(map.entries()).map(([key, evts]) => ({ key, events: evts }));
}

/**
 * Split a sorted list of events by time gaps.
 * If two consecutive events are more than `gapMinutes` apart, they go into separate sub-groups.
 */
function splitByTimeGap(events: WorklogEvent[], gapMinutes: number): WorklogEvent[][] {
	if (events.length === 0) return [];

	const gapMs = gapMinutes * 60 * 1000;
	const groups: WorklogEvent[][] = [[events[0]]];

	for (let i = 1; i < events.length; i++) {
		const prev = new Date(events[i - 1].timestamp).getTime();
		const curr = new Date(events[i].timestamp).getTime();

		if (curr - prev > gapMs) {
			groups.push([events[i]]);
		} else {
			groups[groups.length - 1].push(events[i]);
		}
	}

	return groups;
}

/**
 * Create a WorklogEntry from a group of related events.
 */
function createEntryFromEvents(events: WorklogEvent[]): WorklogEntry {
	const now = new Date().toISOString();
	const allTags = new Set<string>();
	const commits = new Set<string>();
	let totalMinutes = 0;

	for (const event of events) {
		if (event.tags) {
			for (const tag of event.tags) allTags.add(tag);
		}
		if (event.commitSha) {
			commits.add(event.commitSha);
		}
		if (event.durationMinutes) {
			totalMinutes += event.durationMinutes;
		}
	}

	// Determine the dominant kind
	const kind = determineDominantKind(events);

	// Build summary from event descriptions
	const summary = buildSummary(events);

	// Determine status hint from events
	const lastEvent = events[events.length - 1];
	const hasAllDone = events.every((e) => e.kind === "review" || e.kind === "documentation");
	const statusHint = hasAllDone ? ("done" as const) : ("in_progress" as const);

	return {
		id: ulid(),
		createdAt: now,
		updatedAt: now,
		eventIds: events.map((e) => e.id),
		summary,
		kind,
		statusHint,
		totalMinutes,
		taskRef: lastEvent.taskRef,
		branch: lastEvent.branch,
		commits: Array.from(commits),
		syncMode: "comment",
		syncStatus: "pending",
		tags: allTags.size > 0 ? Array.from(allTags) : undefined,
	};
}

/**
 * Determine the dominant kind from a list of events.
 * Priority: bugfix > implementation > refactor > investigation > others
 */
function determineDominantKind(events: WorklogEvent[]): WorklogKind {
	const priority: WorklogKind[] = [
		"bugfix",
		"implementation",
		"refactor",
		"investigation",
		"review",
		"documentation",
		"meeting",
		"support",
	];

	const kinds = new Set(events.map((e) => e.kind));

	for (const kind of priority) {
		if (kinds.has(kind)) return kind;
	}

	return events[0].kind;
}

/**
 * Build a summary string from event descriptions.
 */
function buildSummary(events: WorklogEvent[]): string {
	if (events.length === 1) {
		return events[0].description;
	}

	// For multiple events, join unique descriptions
	const seen = new Set<string>();
	const descriptions: string[] = [];

	for (const event of events) {
		const normalized = event.description.trim().toLowerCase();
		if (!seen.has(normalized)) {
			seen.add(normalized);
			descriptions.push(event.description.trim());
		}
	}

	if (descriptions.length <= 3) {
		return descriptions.join(". ");
	}

	// For many descriptions, use first 2 + count
	return `${descriptions[0]}. ${descriptions[1]}. (+${descriptions.length - 2} more)`;
}
