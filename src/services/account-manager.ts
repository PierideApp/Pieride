// Point d'entrée unique des données scolaires. Il synchronise les services liés dans la
// base locale ; les écrans lisent la base (hooks), jamais un service directement.
// Inspiré de l'AccountManager de Papillon (services/shared/index.ts, GPLv3).
import { and, eq, gte, lt } from "drizzle-orm";

import type { Db } from "@/database/client";
import {
  accounts,
  courses,
  grades,
  homework,
  periods,
  services,
  subjects,
  syncState,
} from "@/database/schema";
import { allowInstance } from "@/lib/http";
import { deleteSecret, getSecret, setSecret } from "@/lib/keyring";

import {
  AuthenticationError,
  SecurityChallenge,
  ServiceUnavailable,
} from "./shared/errors";
import type { Account, LinkedService, ServiceKind } from "./shared/models";
import type {
  CapabilityMethods,
  ConnectService,
  SchoolServicePlugin,
} from "./shared/plugin";

/** Les capabilities qui ont déjà leurs tables. Les autres arriveront avec leur migration. */
export const SYNCED = ["TIMETABLE", "HOMEWORK", "GRADES"] as const;
export type SyncedCapability = (typeof SYNCED)[number];

type ServiceRow = typeof services.$inferSelect;

/** Lundi 0 h, heure locale, de la semaine de `date`. */
export function weekStart(date: Date): Date {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

function weekAfter(start: Date): Date {
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return end;
}

/** Un même `id` en double ferait échouer tout l'enregistrement. */
function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map(item => [item.id, item])).values()];
}

/** Le type d'erreur seulement : le message d'une bibliothèque peut contenir un jeton. */
function errorKind(error: unknown): string {
  return error instanceof AuthenticationError ||
    error instanceof ServiceUnavailable ||
    error instanceof SecurityChallenge
    ? error.name
    : "Unknown";
}

export class AccountManager {
  private readonly plugins = new Map<string, Promise<SchoolServicePlugin>>();

  constructor(
    private readonly db: Db,
    private readonly connectors: Partial<Record<ServiceKind, ConnectService>>
  ) {}

  /**
   * Au démarrage : rouvre au réseau l'adresse de chaque service enregistré. Une adresse
   * refusée n'empêche pas d'ouvrir l'app : ce service sera en erreur à la synchro.
   */
  async start(): Promise<void> {
    const rows = await this.db
      .select({ url: services.instanceUrl })
      .from(services);
    await Promise.allSettled(
      rows.flatMap(({ url }) => (url ? [allowInstance(url)] : []))
    );
  }

  async addAccount(account: Account): Promise<void> {
    await this.db.insert(accounts).values(account);
  }

  /** Lie un service : adresse ouverte au réseau, secret dans le trousseau, ligne en base. */
  async linkService(service: LinkedService, secret: string): Promise<void> {
    if (service.instanceUrl) {
      await allowInstance(service.instanceUrl);
    }
    await setSecret(service.id, secret);
    await this.db.insert(services).values(service);
  }

  /** Retire un compte : d'abord ses secrets, puis ses données (en cascade). */
  async removeAccount(accountId: string): Promise<void> {
    const linked = await this.db
      .select({ id: services.id })
      .from(services)
      .where(eq(services.accountId, accountId));
    for (const { id } of linked) {
      await deleteSecret(id);
      this.plugins.delete(id);
    }
    await this.db.delete(accounts).where(eq(accounts.id, accountId));
  }

  async refreshAll(accountId: string, now = new Date()): Promise<void> {
    for (const capability of SYNCED) {
      await this.refresh(accountId, capability, now);
    }
  }

  /**
   * Synchronise une capability pour chaque service du compte qui la fournit.
   * Un service en panne garde ses données en base ; l'erreur est notée dans `sync_state`.
   */
  async refresh(
    accountId: string,
    capability: SyncedCapability,
    now = new Date()
  ): Promise<void> {
    const linked = await this.db
      .select()
      .from(services)
      .where(eq(services.accountId, accountId));
    await Promise.all(
      linked.map(service => this.refreshService(service, capability, now))
    );
  }

  private async refreshService(
    service: ServiceRow,
    capability: SyncedCapability,
    now: Date
  ): Promise<void> {
    const state = { serviceId: service.id, capability };
    try {
      const plugin = await this.plugin(service);
      if (!(await this.sync(plugin, service.id, capability, now))) {
        return;
      }
      await this.db.batch([
        this.db
          .insert(syncState)
          .values({ ...state, lastSync: now, lastError: null })
          .onConflictDoUpdate({
            target: [syncState.serviceId, syncState.capability],
            set: { lastSync: now, lastError: null },
          }),
        this.db
          .update(services)
          .set({ needsLogin: false })
          .where(eq(services.id, service.id)),
      ]);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        this.plugins.delete(service.id);
        await this.db
          .update(services)
          .set({ needsLogin: true })
          .where(eq(services.id, service.id));
      }
      const lastError = errorKind(error);
      await this.db
        .insert(syncState)
        .values({ ...state, lastError })
        .onConflictDoUpdate({
          target: [syncState.serviceId, syncState.capability],
          set: { lastError },
        });
    }
  }

  /** Connexion gardée pour la session ; refaite si elle a échoué. */
  private plugin(service: ServiceRow): Promise<SchoolServicePlugin> {
    let plugin = this.plugins.get(service.id);
    if (!plugin) {
      plugin = this.connect(service);
      this.plugins.set(service.id, plugin);
      plugin.catch(() => this.plugins.delete(service.id));
    }
    return plugin;
  }

  private async connect(service: ServiceRow): Promise<SchoolServicePlugin> {
    const connect = this.connectors[service.kind];
    if (!connect) {
      throw new ServiceUnavailable(
        `Service non pris en charge : ${service.kind}`
      );
    }
    const secret = await getSecret(service.id);
    if (secret === null) {
      throw new AuthenticationError("Aucun secret enregistré pour ce service");
    }
    return connect(
      {
        id: service.id,
        accountId: service.accountId,
        kind: service.kind,
        instanceUrl: service.instanceUrl ?? undefined,
      },
      secret,
      newSecret => setSecret(service.id, newSecret)
    );
  }

  /** Renvoie `false` si le service ne fournit pas cette capability. */
  private async sync(
    plugin: SchoolServicePlugin,
    serviceId: string,
    capability: SyncedCapability,
    now: Date
  ): Promise<boolean> {
    const { TIMETABLE, HOMEWORK, GRADES } = plugin.capabilities;
    switch (capability) {
      case "TIMETABLE":
        if (!TIMETABLE) {
          return false;
        }
        await this.syncTimetable(serviceId, TIMETABLE, now);
        return true;
      case "HOMEWORK":
        if (!HOMEWORK) {
          return false;
        }
        await this.syncHomework(serviceId, HOMEWORK, now);
        return true;
      case "GRADES":
        if (!GRADES) {
          return false;
        }
        await this.syncGrades(serviceId, GRADES);
        return true;
      default:
        return capability satisfies never;
    }
  }

  private subjectsOf(serviceId: string, names: string[]) {
    return this.db
      .insert(subjects)
      .values([...new Set(names)].map(name => ({ serviceId, name })))
      .onConflictDoNothing();
  }

  private async syncTimetable(
    serviceId: string,
    methods: CapabilityMethods["TIMETABLE"],
    now: Date
  ): Promise<void> {
    const from = weekStart(now);
    const to = weekAfter(from);
    const list = uniqueById(await methods.getWeeklyTimetable(from)).filter(
      course => course.from >= from && course.from < to
    );
    await this.db.batch([
      this.db
        .delete(courses)
        .where(
          and(
            eq(courses.serviceId, serviceId),
            gte(courses.from, from),
            lt(courses.from, to)
          )
        ),
      ...(list.length > 0
        ? [
            this.subjectsOf(
              serviceId,
              list.map(course => course.subject)
            ),
            this.db
              .insert(courses)
              .values(list.map(course => ({ ...course, serviceId }))),
          ]
        : []),
    ]);
  }

  private async syncHomework(
    serviceId: string,
    methods: CapabilityMethods["HOMEWORK"],
    now: Date
  ): Promise<void> {
    const from = weekStart(now);
    const to = weekAfter(from);
    const list = uniqueById(await methods.getHomeworks(from)).filter(
      item => item.dueAt >= from && item.dueAt < to
    );
    await this.db.batch([
      this.db
        .delete(homework)
        .where(
          and(
            eq(homework.serviceId, serviceId),
            gte(homework.dueAt, from),
            lt(homework.dueAt, to)
          )
        ),
      ...(list.length > 0
        ? [
            this.subjectsOf(
              serviceId,
              list.map(item => item.subject)
            ),
            this.db
              .insert(homework)
              .values(list.map(item => ({ ...item, serviceId }))),
          ]
        : []),
    ]);
  }

  private async syncGrades(
    serviceId: string,
    methods: CapabilityMethods["GRADES"]
  ): Promise<void> {
    const periodList = uniqueById(await methods.getGradesPeriods());
    const gradeList = [];
    // L'un après l'autre : certains services (PRONOTE) numérotent leurs requêtes.
    for (const period of periodList) {
      gradeList.push(...(await methods.getGradesForPeriod(period)));
    }
    const unique = uniqueById(gradeList);
    await this.db.batch([
      this.db.delete(grades).where(eq(grades.serviceId, serviceId)),
      this.db.delete(periods).where(eq(periods.serviceId, serviceId)),
      ...(periodList.length > 0
        ? [
            this.db
              .insert(periods)
              .values(periodList.map(period => ({ ...period, serviceId }))),
          ]
        : []),
      ...(unique.length > 0
        ? [
            this.subjectsOf(
              serviceId,
              unique.map(grade => grade.subject)
            ),
            this.db
              .insert(grades)
              .values(unique.map(grade => ({ ...grade, serviceId }))),
          ]
        : []),
    ]);
  }
}
