// Schéma de la base locale (section 5 du schéma d'architecture). Après une modification :
// `pnpm db:generate` écrit la migration dans `migrations/`.
// Aucun secret ici : mots de passe, jetons et cookies vont dans le trousseau.
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import type { Attachment, Course, ServiceKind } from "@/services/shared/models";
import type { Capability } from "@/services/shared/plugin";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

// Chaque donnée porte `service_id` : retirer un compte supprime ses services en cascade,
// et délier un service supprime ses données.
const serviceId = () =>
  text("service_id")
    .notNull()
    .references(() => services.id, { onDelete: "cascade" });

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  schoolName: text("school_name"),
  className: text("class_name"),
  createdAt: createdAt(),
});

export const services = sqliteTable("services", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  kind: text("kind").$type<ServiceKind>().notNull(),
  instanceUrl: text("instance_url"),
  /** Vrai quand le service a refusé les identifiants : il faut se reconnecter. */
  needsLogin: integer("needs_login", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: createdAt(),
});

export const syncState = sqliteTable(
  "sync_state",
  {
    serviceId: serviceId(),
    capability: text("capability").$type<Capability>().notNull(),
    lastSync: integer("last_sync", { mode: "timestamp_ms" }),
    /** Le type d'erreur seulement (`ServiceUnavailable`…), jamais son message. */
    lastError: text("last_error"),
  },
  t => [primaryKey({ columns: [t.serviceId, t.capability] })]
);

export const subjects = sqliteTable(
  "subjects",
  {
    serviceId: serviceId(),
    name: text("name").notNull(),
    color: text("color"),
    emoji: text("emoji"),
  },
  t => [primaryKey({ columns: [t.serviceId, t.name] })]
);

export const periods = sqliteTable(
  "periods",
  {
    serviceId: serviceId(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    start: integer("start", { mode: "timestamp_ms" }).notNull(),
    end: integer("end", { mode: "timestamp_ms" }).notNull(),
  },
  t => [primaryKey({ columns: [t.serviceId, t.id] })]
);

export const courses = sqliteTable(
  "courses",
  {
    serviceId: serviceId(),
    id: text("id").notNull(),
    subject: text("subject").notNull(),
    from: integer("from", { mode: "timestamp_ms" }).notNull(),
    to: integer("to", { mode: "timestamp_ms" }).notNull(),
    room: text("room"),
    teacher: text("teacher"),
    group: text("group"),
    status: text("status").$type<NonNullable<Course["status"]>>(),
  },
  t => [
    primaryKey({ columns: [t.serviceId, t.id] }),
    index("courses_from").on(t.serviceId, t.from),
  ]
);

export const homework = sqliteTable(
  "homework",
  {
    serviceId: serviceId(),
    id: text("id").notNull(),
    subject: text("subject").notNull(),
    content: text("content").notNull(),
    givenAt: integer("given_at", { mode: "timestamp_ms" }),
    dueAt: integer("due_at", { mode: "timestamp_ms" }).notNull(),
    done: integer("done", { mode: "boolean" }).notNull(),
    attachments: text("attachments", { mode: "json" })
      .$type<Attachment[]>()
      .notNull(),
  },
  t => [
    primaryKey({ columns: [t.serviceId, t.id] }),
    index("homework_due_at").on(t.serviceId, t.dueAt),
  ]
);

export const grades = sqliteTable(
  "grades",
  {
    serviceId: serviceId(),
    id: text("id").notNull(),
    periodId: text("period_id").notNull(),
    subject: text("subject").notNull(),
    title: text("title").notNull(),
    date: integer("date", { mode: "timestamp_ms" }).notNull(),
    value: real("value"),
    status: text("status"),
    outOf: real("out_of").notNull(),
    coefficient: real("coefficient").notNull(),
    classAverage: real("class_average"),
    min: real("min"),
    max: real("max"),
    bonus: integer("bonus", { mode: "boolean" }).notNull(),
    optional: integer("optional", { mode: "boolean" }).notNull(),
  },
  t => [
    primaryKey({ columns: [t.serviceId, t.id] }),
    index("grades_period").on(t.serviceId, t.periodId),
  ]
);
