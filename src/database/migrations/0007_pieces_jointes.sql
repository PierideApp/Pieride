CREATE TABLE `downloads` (
	`service_id` text NOT NULL,
	`key` text NOT NULL,
	`path` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`service_id`, `key`),
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
);
