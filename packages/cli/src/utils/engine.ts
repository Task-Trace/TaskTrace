import { FileStorageProvider, WorklogEngine, loadConfig } from "@tasktrace/core";

/**
 * Create a WorklogEngine instance from the current project directory.
 * Loads config, resolves storage, and returns a ready engine.
 */
export async function createEngine(projectDir?: string): Promise<WorklogEngine> {
	const dir = projectDir ?? process.cwd();
	const config = await loadConfig(dir);
	const storage = new FileStorageProvider(config, dir);
	return new WorklogEngine(config, storage);
}
