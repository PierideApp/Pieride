CREATE TABLE `attendance` (
	`service_id` text NOT NULL,
	`id` text NOT NULL,
	`kind` text NOT NULL,
	`from` integer NOT NULL,
	`to` integer NOT NULL,
	`duration_minutes` integer NOT NULL,
	`reason` text,
	`justified` integer NOT NULL,
	PRIMARY KEY(`service_id`, `kind`, `id`),
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `news` (
	`service_id` text NOT NULL,
	`id` text NOT NULL,
	`title` text,
	`author` text NOT NULL,
	`date` integer NOT NULL,
	`content` text NOT NULL,
	`read` integer NOT NULL,
	`attachments` text NOT NULL,
	PRIMARY KEY(`service_id`, `id`),
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `news_date` ON `news` (`service_id`,`date`);