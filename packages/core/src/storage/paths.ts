import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { TaskTraceConfig } from "../types.js";

export type StorageFile = "events" | "entries" | "sync-state";

const FILE_NAMES: Record<StorageFile, string> = {
	events: "events.ndjson",
	entries: "entries.ndjson",
	"sync-state": "sync-state.json",
};

/**
 * Resolve the storage directory from config.
 * If the dir starts with ~, expands to home directory.
 * If relative, resolves from the project root (cwd).
 */
export function resolveStorageDir(config: TaskTraceConfig, projectDir?: string): string {
	const dir = config.storage.dir;

	if (dir.startsWith("~")) {
		return resolve(homedir(), dir.slice(2));
	}

	return resolve(projectDir ?? process.cwd(), dir);
}

/**
 * Get the full path to a specific storage file.
 */
export function getStorageFilePath(storageDir: string, file: StorageFile): string {
	return join(storageDir, FILE_NAMES[file]);
}

/**
 * Get the default global config directory.
 */
export function getGlobalConfigDir(): string {
	return join(homedir(), ".tasktrace");
}

/**
 * Get the default global config file path.
 */
export function getGlobalConfigPath(): string {
	return join(getGlobalConfigDir(), "config.json");
}
