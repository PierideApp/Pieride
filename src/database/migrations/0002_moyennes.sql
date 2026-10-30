CREATE TABLE `subject_averages` (
	`service_id` text NOT NULL,
	`period_id` text NOT NULL,
	`subject` text NOT NULL,
	`student` real,
	`class_average` real,
	`min` real,
	`max` real,
	`out_of` real NOT NULL,
	PRIMARY KEY(`service_id`, `period_id`, `subject`),
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `periods` ADD `average` real;--> statement-breakpoint
ALTER TABLE `periods` ADD `class_average` real;