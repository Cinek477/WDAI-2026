CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`category` text NOT NULL,
	`details` text NOT NULL,
	`message` text NOT NULL,
	`created` text NOT NULL,
	`is_read` integer DEFAULT 0 NOT NULL,
	`mail_status` text DEFAULT 'not_configured' NOT NULL,
	`sender` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `records` (
	`id` text NOT NULL,
	`kind` text NOT NULL,
	`data` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`kind`, `id`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
