import { describe, expect, test } from "bun:test";
import { detectProvider, parseTaskRef } from "./branch-parser.js";

describe("parseTaskRef", () => {
	test("extracts ClickUp ID from branch", () => {
		expect(parseTaskRef("fix/CU-abc123-auth-timeout")).toBe("CU-abc123");
	});

	test("extracts ClickUp ID case-insensitive", () => {
		expect(parseTaskRef("feat/cu-DEF456-new-feature")).toBe("cu-DEF456");
	});

	test("extracts Jira-style ID", () => {
		expect(parseTaskRef("feat/PROJ-42-new-dashboard")).toBe("PROJ-42");
	});

	test("extracts GitHub issue number", () => {
		expect(parseTaskRef("bugfix/#123-login-error")).toBe("#123");
	});

	test("returns null for no match", () => {
		expect(parseTaskRef("main")).toBeNull();
		expect(parseTaskRef("develop")).toBeNull();
		expect(parseTaskRef("feat/some-feature")).toBeNull();
	});

	test("uses custom patterns", () => {
		const patterns = ["TASK-(\\d+)"];
		expect(parseTaskRef("fix/TASK-999-stuff", patterns)).toBe("TASK-999");
	});

	test("returns first match when multiple patterns could match", () => {
		// CU pattern is checked first
		expect(parseTaskRef("fix/CU-abc-PROJ-42")).toBe("CU-abc");
	});
});

describe("detectProvider", () => {
	test("detects clickup", () => {
		expect(detectProvider("CU-abc123")).toBe("clickup");
	});

	test("detects jira", () => {
		expect(detectProvider("PROJ-42")).toBe("jira");
	});

	test("detects github", () => {
		expect(detectProvider("#123")).toBe("github");
	});

	test("returns null for unknown", () => {
		expect(detectProvider("random-ref")).toBeNull();
	});
});
