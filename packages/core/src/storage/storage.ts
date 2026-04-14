import type { z } from "zod";
import type { TaskTraceConfig } from "../types.js";
import { appendNdjson, readJson, readNdjson, writeJson, writeNdjson } from "./ndjson.js";
import type { StorageFile } from "./paths.js";
import { getStorageFilePath, resolveStorageDir } from "./paths.js";

export interface StorageProvider {
	/** Append a single record to an NDJSON file */
	append<T>(file: StorageFile, record: T): Promise<void>;

	/** Read all records from an NDJSON file */
	readAll<T>(file: StorageFile, schema: z.ZodType<T>): Promise<T[]>;

	/** Overwrite an NDJSON file with the given records */
	writeAll<T>(file: StorageFile, records: T[]): Promise<void>;

	/** Read a JSON file */
	readJsonFile<T>(file: StorageFile, schema: z.ZodType<T>): Promise<T | null>;

	/** Write a JSON file */
	writeJsonFile<T>(file: StorageFile, data: T): Promise<void>;

	/** Get the resolved storage directory path */
	getStorageDir(): string;
}

/**
 * Default storage provider using NDJSON files on the local filesystem.
 */
export class FileStorageProvider implements StorageProvider {
	private readonly storageDir: string;

	constructor(config: TaskTraceConfig, projectDir?: string) {
		this.storageDir = resolveStorageDir(config, projectDir);
	}

	async append<T>(file: StorageFile, record: T): Promise<void> {
		const filePath = getStorageFilePath(this.storageDir, file);
		await appendNdjson(filePath, record);
	}

	async readAll<T>(file: StorageFile, schema: z.ZodType<T>): Promise<T[]> {
		const filePath = getStorageFilePath(this.storageDir, file);
		return readNdjson(filePath, schema);
	}

	async writeAll<T>(file: StorageFile, records: T[]): Promise<void> {
		const filePath = getStorageFilePath(this.storageDir, file);
		await writeNdjson(filePath, records);
	}

	async readJsonFile<T>(file: StorageFile, schema: z.ZodType<T>): Promise<T | null> {
		const filePath = getStorageFilePath(this.storageDir, file);
		return readJson(filePath, schema);
	}

	async writeJsonFile<T>(file: StorageFile, data: T): Promise<void> {
		const filePath = getStorageFilePath(this.storageDir, file);
		await writeJson(filePath, data);
	}

	getStorageDir(): string {
		return this.storageDir;
	}
}
