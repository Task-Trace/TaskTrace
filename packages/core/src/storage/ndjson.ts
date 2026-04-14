import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { lock, unlock } from "proper-lockfile";
import type { z } from "zod";

/**
 * Append a single record to an NDJSON file.
 * Uses file locking to prevent corruption from concurrent writes.
 */
export async function appendNdjson<T>(filePath: string, record: T): Promise<void> {
	await ensureDir(filePath);
	await ensureFile(filePath);

	let release: (() => Promise<void>) | undefined;
	try {
		release = await lock(filePath, { retries: 3 });
		const line = `${JSON.stringify(record)}\n`;
		await appendFile(filePath, line, "utf-8");
	} finally {
		if (release) {
			await release();
		}
	}
}

/**
 * Read all records from an NDJSON file.
 * Validates each line through the provided Zod schema.
 * Skips invalid lines with a warning.
 */
export async function readNdjson<T>(filePath: string, schema: z.ZodType<T>): Promise<T[]> {
	if (!existsSync(filePath)) {
		return [];
	}

	const content = await readFile(filePath, "utf-8");
	const lines = content.split("\n").filter((line) => line.trim().length > 0);
	const results: T[] = [];

	for (const line of lines) {
		try {
			const parsed = JSON.parse(line);
			const validated = schema.parse(parsed);
			results.push(validated);
		} catch {
			console.warn(`[TaskTrace] Skipping invalid NDJSON line: ${line.slice(0, 80)}...`);
		}
	}

	return results;
}

/**
 * Overwrite an NDJSON file with the given records.
 * Uses atomic write (write to temp, then rename) to prevent corruption.
 */
export async function writeNdjson<T>(filePath: string, records: T[]): Promise<void> {
	await ensureDir(filePath);

	const tempPath = join(dirname(filePath), `.${Date.now()}.tmp`);
	const content =
		records.map((r) => JSON.stringify(r)).join("\n") + (records.length > 0 ? "\n" : "");

	await writeFile(tempPath, content, "utf-8");
	await rename(tempPath, filePath);
}

/**
 * Read a JSON file with schema validation.
 */
export async function readJson<T>(filePath: string, schema: z.ZodType<T>): Promise<T | null> {
	if (!existsSync(filePath)) {
		return null;
	}

	try {
		const content = await readFile(filePath, "utf-8");
		const parsed = JSON.parse(content);
		return schema.parse(parsed);
	} catch {
		console.warn(`[TaskTrace] Failed to read JSON: ${filePath}`);
		return null;
	}
}

/**
 * Write a JSON file with atomic write.
 */
export async function writeJson<T>(filePath: string, data: T): Promise<void> {
	await ensureDir(filePath);

	const tempPath = join(dirname(filePath), `.${Date.now()}.tmp`);
	const content = `${JSON.stringify(data, null, 2)}\n`;

	await writeFile(tempPath, content, "utf-8");
	await rename(tempPath, filePath);
}

// === Helpers ===

async function ensureDir(filePath: string): Promise<void> {
	const dir = dirname(filePath);
	if (!existsSync(dir)) {
		await mkdir(dir, { recursive: true });
	}
}

async function ensureFile(filePath: string): Promise<void> {
	if (!existsSync(filePath)) {
		await writeFile(filePath, "", "utf-8");
	}
}
