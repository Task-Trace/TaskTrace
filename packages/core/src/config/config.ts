import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { taskTraceConfigSchema } from "../schemas.js";
import type { TaskTraceConfig } from "../types.js";
import { DEFAULT_CONFIG } from "./defaults.js";

/**
 * Deep merge two objects. Source values override target values.
 */
function deepMerge(
	target: Record<string, unknown>,
	source: Record<string, unknown>,
): Record<string, unknown> {
	const result: Record<string, unknown> = { ...target };

	for (const key of Object.keys(source)) {
		const sourceVal = source[key];
		const targetVal = target[key];

		if (
			sourceVal !== undefined &&
			typeof sourceVal === "object" &&
			sourceVal !== null &&
			!Array.isArray(sourceVal) &&
			typeof targetVal === "object" &&
			targetVal !== null &&
			!Array.isArray(targetVal)
		) {
			result[key] = deepMerge(
				targetVal as Record<string, unknown>,
				sourceVal as Record<string, unknown>,
			);
		} else if (sourceVal !== undefined) {
			result[key] = sourceVal;
		}
	}

	return result;
}

/**
 * Read and parse a JSON config file. Returns null if not found.
 */
async function readConfigFile(filePath: string): Promise<Partial<TaskTraceConfig> | null> {
	if (!existsSync(filePath)) {
		return null;
	}

	try {
		const content = await readFile(filePath, "utf-8");
		return JSON.parse(content) as Partial<TaskTraceConfig>;
	} catch {
		console.warn(`[TaskTrace] Failed to read config: ${filePath}`);
		return null;
	}
}

/**
 * Apply environment variable overrides to config.
 */
function applyEnvOverrides(config: TaskTraceConfig): TaskTraceConfig {
	const result = { ...config };

	const storageDir = process.env.TASKTRACE_STORAGE_DIR;
	if (storageDir) {
		result.storage = { ...result.storage, dir: storageDir };
	}

	const providerName = process.env.TASKTRACE_PROVIDER;
	if (providerName) {
		result.provider = {
			name: providerName,
			config: result.provider?.config ?? {},
		};
	}

	return result;
}

/**
 * Load the full TaskTrace config by merging all sources.
 *
 * Precedence (lowest → highest):
 * 1. Built-in defaults
 * 2. Global config (~/.tasktrace/config.json)
 * 3. Project config (.tasktracerc.json)
 * 4. Environment variables
 */
export async function loadConfig(projectDir?: string): Promise<TaskTraceConfig> {
	const resolvedProjectDir = projectDir ?? process.cwd();

	// Start with defaults
	let config: TaskTraceConfig = { ...DEFAULT_CONFIG };

	// Merge global config
	const globalConfigPath = join(homedir(), ".tasktrace", "config.json");
	const globalConfig = await readConfigFile(globalConfigPath);
	if (globalConfig) {
		config = deepMerge(
			config as unknown as Record<string, unknown>,
			globalConfig as Record<string, unknown>,
		) as unknown as TaskTraceConfig;
	}

	// Merge project config
	const projectConfigPath = resolve(resolvedProjectDir, ".tasktracerc.json");
	const projectConfig = await readConfigFile(projectConfigPath);
	if (projectConfig) {
		config = deepMerge(
			config as unknown as Record<string, unknown>,
			projectConfig as Record<string, unknown>,
		) as unknown as TaskTraceConfig;
	}

	// Apply env overrides
	config = applyEnvOverrides(config);

	// Validate final config
	return taskTraceConfigSchema.parse(config);
}

/**
 * Generate a default .tasktracerc.json for a project.
 */
export function generateProjectConfig(overrides?: Partial<TaskTraceConfig>): TaskTraceConfig {
	const config = overrides
		? (deepMerge(
				DEFAULT_CONFIG as unknown as Record<string, unknown>,
				overrides as Record<string, unknown>,
			) as unknown as TaskTraceConfig)
		: { ...DEFAULT_CONFIG };
	return taskTraceConfigSchema.parse(config);
}
