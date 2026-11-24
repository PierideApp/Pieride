ALTER TABLE `attendance_periods` ADD `is_default` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `periods` ADD `is_default` integer DEFAULT false NOT NULL;