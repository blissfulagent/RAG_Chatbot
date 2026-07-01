CREATE TABLE `embeddings` (
	`id` text PRIMARY KEY NOT NULL,
	`chunk_id` text NOT NULL,
	`model` text NOT NULL,
	`dimensions` integer NOT NULL,
	`vector_json` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`chunk_id`) REFERENCES `chunks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `embeddings_chunk_model_idx` ON `embeddings` (`chunk_id`,`model`);