CREATE TABLE `review_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`message_id` text,
	`graph_run_id` text NOT NULL,
	`reason` text NOT NULL,
	`risk_score` integer NOT NULL,
	`proposed_output` text NOT NULL,
	`status` text NOT NULL,
	`human_feedback` text,
	`edited_output` text,
	`created_at` integer NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action
);
