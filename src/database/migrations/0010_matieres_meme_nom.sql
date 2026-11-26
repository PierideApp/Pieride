-- Retouchée à la main : drizzle-kit ne sait pas remplir une nouvelle colonne NOT NULL. Les lignes
-- déjà en cache prennent le nom comme `subject_id` ; la prochaine synchro réécrit tout.
CREATE TABLE `__new_subject_averages` (
	`service_id` text NOT NULL,
	`period_id` text NOT NULL,
	`subject` text NOT NULL,
	`subject_id` text NOT NULL,
	`student` real,
	`class_average` real,
	`min` real,
	`max` real,
	`out_of` real NOT NULL,
	PRIMARY KEY(`service_id`, `period_id`, `subject_id`),
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_subject_averages`("service_id", "period_id", "subject", "subject_id", "student", "class_average", "min", "max", "out_of") SELECT "service_id", "period_id", "subject", "subject", "student", "class_average", "min", "max", "out_of" FROM `subject_averages`;--> statement-breakpoint
DROP TABLE `subject_averages`;--> statement-breakpoint
ALTER TABLE `__new_subject_averages` RENAME TO `subject_averages`;--> statement-breakpoint
CREATE TABLE `__new_grades` (
	`service_id` text NOT NULL,
	`id` text NOT NULL,
	`period_id` text NOT NULL,
	`subject` text NOT NULL,
	`subject_id` text NOT NULL,
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
INSERT INTO `__new_grades`("service_id", "id", "period_id", "subject", "subject_id", "title", "date", "value", "status", "out_of", "coefficient", "class_average", "min", "max", "bonus", "optional") SELECT "service_id", "id", "period_id", "subject", "subject", "title", "date", "value", "status", "out_of", "coefficient", "class_average", "min", "max", "bonus", "optional" FROM `grades`;--> statement-breakpoint
DROP TABLE `grades`;--> statement-breakpoint
ALTER TABLE `__new_grades` RENAME TO `grades`;--> statement-breakpoint
CREATE INDEX `grades_period` ON `grades` (`service_id`,`period_id`);
