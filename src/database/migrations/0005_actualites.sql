ALTER TABLE `news` ADD `kind` text DEFAULT 'information' NOT NULL;--> statement-breakpoint
ALTER TABLE `news` ADD `category` text;--> statement-breakpoint
ALTER TABLE `news` ADD `needs_acknowledgement` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `news` ADD `acknowledged` integer DEFAULT false NOT NULL;