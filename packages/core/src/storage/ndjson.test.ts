import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { appendNdjson, readJson, readNdjson, writeJson, writeNdjson } from "./ndjson.js";

const testSchema = z.object({
	id: z.string(),
	value: z.number(),
});

type TestRecord = z.infer<typeof testSchema>;

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "tasktrace-test-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("appendNdjson", () => {
	test("creates file and appends record", async () => {
		const filePath = join(tempDir, "test.ndjson");
		const record: TestRecord = { id: "1", value: 42 };

		await appendNdjson(filePath, record);

		const results = await readNdjson(filePath, testSchema);
		expect(results).toHaveLength(1);
		expect(results[0]).toEqual(record);
	});

	test("appends multiple records", async () => {
		const filePath = join(tempDir, "test.ndjson");

		await appendNdjson(filePath, { id: "1", value: 10 });
		await appendNdjson(filePath, { id: "2", value: 20 });
		await appendNdjson(filePath, { id: "3", value: 30 });

		const results = await readNdjson(filePath, testSchema);
		expect(results).toHaveLength(3);
		expect(results[0].id).toBe("1");
		expect(results[2].id).toBe("3");
	});
});

describe("readNdjson", () => {
	test("returns empty array for non-existent file", async () => {
		const filePath = join(tempDir, "missing.ndjson");
		const results = await readNdjson(filePath, testSchema);
		expect(results).toEqual([]);
	});

	test("skips invalid lines", async () => {
		const filePath = join(tempDir, "test.ndjson");
		await appendNdjson(filePath, { id: "1", value: 10 });
		// Manually append invalid line
		const { appendFile } = await import("node:fs/promises");
		await appendFile(filePath, '{"invalid": true}\n');
		await appendNdjson(filePath, { id: "2", value: 20 });

		const results = await readNdjson(filePath, testSchema);
		expect(results).toHaveLength(2);
	});
});

describe("writeNdjson", () => {
	test("overwrites file with new records", async () => {
		const filePath = join(tempDir, "test.ndjson");

		await appendNdjson(filePath, { id: "1", value: 10 });
		await appendNdjson(filePath, { id: "2", value: 20 });

		// Overwrite with single record
		await writeNdjson(filePath, [{ id: "3", value: 30 }]);

		const results = await readNdjson(filePath, testSchema);
		expect(results).toHaveLength(1);
		expect(results[0].id).toBe("3");
	});
});

describe("readJson / writeJson", () => {
	test("roundtrips JSON data", async () => {
		const filePath = join(tempDir, "config.json");
		const data = { id: "config", value: 99 };

		await writeJson(filePath, data);
		const result = await readJson(filePath, testSchema);

		expect(result).toEqual(data);
	});

	test("returns null for non-existent file", async () => {
		const filePath = join(tempDir, "missing.json");
		const result = await readJson(filePath, testSchema);
		expect(result).toBeNull();
	});
});
