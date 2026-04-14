/**
 * Extract a task reference from a git branch name using configurable patterns.
 *
 * Default patterns detect:
 * - ClickUp: CU-abc123 (from fix/CU-abc123-auth-timeout)
 * - Jira-style: PROJ-42 (from feat/PROJ-42-new-dashboard)
 * - GitHub issues: #123 (from bugfix/#123-login-error)
 */
export function parseTaskRef(branch: string, patterns?: string[]): string | null {
	const defaultPatterns = ["[Cc][Uu]-([a-zA-Z0-9]+)", "([A-Z]+-\\d+)", "#(\\d+)"];

	const activePatterns = patterns ?? defaultPatterns;

	for (const pattern of activePatterns) {
		const regex = new RegExp(pattern);
		const match = branch.match(regex);

		if (match) {
			// Return the full match (group 0) which includes the prefix (CU-, PROJ-, #)
			return match[0];
		}
	}

	return null;
}

/**
 * Detect the provider name from a task reference.
 *
 * Examples:
 * - "CU-abc123" → "clickup"
 * - "PROJ-42" → "jira"
 * - "#123" → "github"
 * - unknown → null
 */
export function detectProvider(taskRef: string): string | null {
	if (/^CU-/i.test(taskRef)) return "clickup";
	if (/^[A-Z]+-\d+$/.test(taskRef)) return "jira";
	if (/^#\d+$/.test(taskRef)) return "github";
	return null;
}
