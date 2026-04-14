export interface ClickUpConfig {
	apiKey: string;
	defaultListId: string;
	workspaceId?: string;
	/** Default assignee user IDs for new tasks */
	assignees?: number[];
}

export interface ClickUpTask {
	id: string;
	name: string;
	status: { status: string };
	url: string;
	list: { id: string };
}

export interface ClickUpComment {
	id: string;
	comment_text: string;
}
