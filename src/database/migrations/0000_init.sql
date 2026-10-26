CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`school_name` text,
	`class_name` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`service_id` text NOT NULL,
	`id` text NOT NULL,
	`subject` text NOT NULL,
	`from` integer NOT NULL,
	`to` integer NOT NULL,
	`room` text,
	`teacher` text,
	`group` text,
	`status` text,
	PRIMARY KEY(`service_id`, `id`),
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `courses_from` ON `courses` (`service_id`,`from`);--> statement-breakpoint
CREATE TABLE `grades` (
	`service_id` text NOT NULL,
	`id` text NOT NULL,
	`period_id` text NOT NULL,
	`subject` text NOT NULL,
	`title` text NOT NULL,
	`date` integer NOT NULL,
	`value` real,
	`status` text,
	`out_of` real NOT NULL,
	`coefficient` real NOT NULL,
	`class_average` real,
	`min` real,
	`max` real,
	`bonus` integer NOT NULL,
	`optional` integer NOT NULL,
	PRIMARY KEY(`service_id`, `id`),
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `grades_period` ON `grades` (`service_id`,`period_id`);--> statement-breakpoint
CREATE TABLE `homework` (
	`service_id` text NOT NULL,
	`id` text NOT NULL,
	`subject` text NOT NULL,
	`content` text NOT NULL,
	`given_at` integer,
	`due_at` integer NOT NULL,
	`done` integer NOT NULL,
	`attachments` text NOT NULL,
	PRIMARY KEY(`service_id`, `id`),
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `homework_due_at` ON `homework` (`service_id`,`due_at`);--> statement-breakpoint
CREATE TABLE `periods` (
	`service_id` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	PRIMARY KEY(`service_id`, `id`),
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`kind` text NOT NULL,
	`instance_url` text,
	`needs_login` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `subjects` (
	`service_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`emoji` text,
	PRIMARY KEY(`service_id`, `name`),
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sync_state` (
	`service_id` text NOT NULL,
	`capability` text NOT NULL,
	`last_sync` integer,
	`last_error` text,
	PRIMARY KEY(`service_id`, `capability`),
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
);
