import { describe, expect, test } from "bun:test";
import type { WorklogEvent } from "../types.js";
import { consolidateEvents } from "./consolidate.js";

function makeEvent(
	overrides: Partial<WorklogEvent> & { id: string; timestamp: string },
): WorklogEvent {
	return {
		source: "manual",
		kind: "implementation",
		description: "test event",
		branch: "main",
		...overrides,
	};
}

describe("consolidateEvents", () => {
	test("returns empty for no pending events", () => {
		const result = consolidateEvents([], new Set());
		expect(result).toEqual([]);
	});

	test("skips already consolidated events", () => {
		const events: WorklogEvent[] = [makeEvent({ id: "evt_01", timestamp: "2026-04-14T10:00:00Z" })];
		const existing = new Set(["evt_01"]);

		const result = consolidateEvents(events, existing);
		expect(result).toEqual([]);
	});

	test("consolidates single event into one entry", () => {
		const events: WorklogEvent[] = [
			makeEvent({
				id: "evt_01",
				timestamp: "2026-04-14T10:00:00Z",
				description: "Fixed auth bug",
				kind: "bugfix",
				branch: "fix/auth",
				tags: ["auth"],
			}),
		];

		const result = consolidateEvents(events, new Set());
		expect(result).toHaveLength(1);
		expect(result[0].eventIds).toEqual(["evt_01"]);
		expect(result[0].summary).toBe("Fixed auth bug");
		expect(result[0].kind).toBe("bugfix");
		expect(result[0].branch).toBe("fix/auth");
		expect(result[0].syncStatus).toBe("pending");
	});

	test("groups events on same branch within time gap", () => {
		const events: WorklogEvent[] = [
			makeEvent({ id: "evt_01", timestamp: "2026-04-14T10:00:00Z", branch: "fix/auth" }),
			makeEvent({ id: "evt_02", timestamp: "2026-04-14T11:00:00Z", branch: "fix/auth" }),
			makeEvent({ id: "evt_03", timestamp: "2026-04-14T12:00:00Z", branch: "fix/auth" }),
		];

		const result = consolidateEvents(events, new Set());
		expect(result).toHaveLength(1);
		expect(result[0].eventIds).toEqual(["evt_01", "evt_02", "evt_03"]);
	});

	test("splits events by time gap", () => {
		const events: WorklogEvent[] = [
			makeEvent({ id: "evt_01", timestamp: "2026-04-14T08:00:00Z", branch: "main" }),
			makeEvent({ id: "evt_02", timestamp: "2026-04-14T16:00:00Z", branch: "main" }), // 8h gap
		];

		const result = consolidateEvents(events, new Set());
		expect(result).toHaveLength(2);
	});

	test("splits events by branch", () => {
		const events: WorklogEvent[] = [
			makeEvent({ id: "evt_01", timestamp: "2026-04-14T10:00:00Z", branch: "fix/auth" }),
			makeEvent({ id: "evt_02", timestamp: "2026-04-14T10:30:00Z", branch: "feat/dashboard" }),
		];

		const result = consolidateEvents(events, new Set());
		expect(result).toHaveLength(2);
	});

	test("respects custom gap minutes", () => {
		const events: WorklogEvent[] = [
			makeEvent({ id: "evt_01", timestamp: "2026-04-14T10:00:00Z", branch: "main" }),
			makeEvent({ id: "evt_02", timestamp: "2026-04-14T10:45:00Z", branch: "main" }), // 45 min gap
		];

		// Default gap is 240 min — should group
		expect(consolidateEvents(events, new Set())).toHaveLength(1);

		// With 30 min gap — should split
		expect(consolidateEvents(events, new Set(), { gapMinutes: 30 })).toHaveLength(2);
	});

	test("accumulates tags from all events", () => {
		const events: WorklogEvent[] = [
			makeEvent({
				id: "evt_01",
				timestamp: "2026-04-14T10:00:00Z",
				branch: "main",
				tags: ["auth"],
			}),
			makeEvent({
				id: "evt_02",
				timestamp: "2026-04-14T10:30:00Z",
				branch: "main",
				tags: ["api", "auth"],
			}),
		];

		const result = consolidateEvents(events, new Set());
		expect(result[0].tags).toContain("auth");
		expect(result[0].tags).toContain("api");
	});

	test("accumulates duration from events", () => {
		const events: WorklogEvent[] = [
			makeEvent({
				id: "evt_01",
				timestamp: "2026-04-14T10:00:00Z",
				branch: "main",
				durationMinutes: 30,
			}),
			makeEvent({
				id: "evt_02",
				timestamp: "2026-04-14T10:30:00Z",
				branch: "main",
				durationMinutes: 45,
			}),
		];

		const result = consolidateEvents(events, new Set());
		expect(result[0].totalMinutes).toBe(75);
	});

	test("uses dominant kind priority", () => {
		const events: WorklogEvent[] = [
			makeEvent({
				id: "evt_01",
				timestamp: "2026-04-14T10:00:00Z",
				branch: "main",
				kind: "investigation",
			}),
			makeEvent({
				id: "evt_02",
				timestamp: "2026-04-14T10:30:00Z",
				branch: "main",
				kind: "bugfix",
			}),
		];

		const result = consolidateEvents(events, new Set());
		expect(result[0].kind).toBe("bugfix"); // bugfix > investigation
	});
});
