CREATE TABLE `attendance_periods` (
	`service_id` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	PRIMARY KEY(`service_id`, `id`),
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
);
