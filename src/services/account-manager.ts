// Point d'entrée unique des données scolaires. Il synchronise les services liés dans la
// base locale ; les écrans lisent la base (hooks), jamais un service directement.
// Inspiré de l'AccountManager de Papillon (services/shared/index.ts, GPLv3).
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

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
import { log } from "@/lib/log";

import {
  AuthenticationError,
  SecurityChallenge,
  ServiceUnavailable,
  UnsupportedService,
} from "./shared/errors";
import type { Account, LinkedService, ServiceKind } from "./shared/models";
import {
  type CapabilityMethods,
  type ConnectService,
  NO_SECRET,
  type SchoolServicePlugin,
} from "./shared/plugin";

/** Les capabilities qui ont déjà leurs tables. Les autres arriveront avec leur migration. */
export const SYNCED = ["TIMETABLE", "HOMEWORK", "GRADES"] as const;
export type SyncedCapability = (typeof SYNCED)[number];

type ServiceRow = typeof services.$inferSelect;
type Write = BatchItem<"sqlite">;

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
    error instanceof SecurityChallenge ||
    error instanceof UnsupportedService
    ? error.name
    : "Unknown";
}

/** Attend tout, puis signale la première erreur : un échec n'arrête pas les autres. */
async function settleAll(tasks: Promise<unknown>[]): Promise<void> {
  const failed = (await Promise.allSettled(tasks)).find(
    result => result.status === "rejected"
  );
  if (failed) {
    throw failed.reason;
  }
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

  /** Modifie le profil (Paramètres > Mon compte). `avatar: null` retire la photo. */
  async updateAccount(
    accountId: string,
    profile: Partial<{
      firstName: string;
      lastName: string;
      avatar: string | null;
    }>
  ): Promise<void> {
    await this.db
      .update(accounts)
      .set(profile)
      .where(eq(accounts.id, accountId));
  }

  /**
   * Lie un service : adresse ouverte au réseau, ligne en base, puis secret dans le trousseau.
   * Si le trousseau échoue, la ligne est retirée : pas de service sans secret, ni l'inverse.
   * Un service sans identifiants (`NO_SECRET`) ne touche pas au trousseau.
   */
  async linkService(service: LinkedService, secret?: string): Promise<void> {
    const secretless = NO_SECRET.has(service.kind);
    if (!secretless && secret === undefined) {
      throw new AuthenticationError("Identifiants manquants");
    }
    if (service.instanceUrl) {
      await allowInstance(service.instanceUrl);
    }
    await this.db.insert(services).values(service);
    if (secretless || secret === undefined) {
      return;
    }
    try {
      await setSecret(service.id, secret);
    } catch (error) {
      await this.db.delete(services).where(eq(services.id, service.id));
      throw error;
    }
  }

  /**
   * Retire un compte et toutes ses données, même si le trousseau est indisponible.
   * Renvoie les services dont le secret n'a pas pu être effacé (à retenter avec `deleteSecrets`).
   */
  async removeAccount(accountId: string): Promise<string[]> {
    const linked = await this.db
      .select({ id: services.id, kind: services.kind })
      .from(services)
      .where(eq(services.accountId, accountId));
    const failed = await this.deleteSecrets(
      linked.filter(({ kind }) => !NO_SECRET.has(kind)).map(({ id }) => id)
    );
    for (const { id } of linked) {
      this.plugins.delete(id);
    }
    await this.db.delete(accounts).where(eq(accounts.id, accountId));
    return failed;
  }

  /**
   * Nom, couleur et emoji choisis pour une matière, dans tous les services du compte qui la
   * fournissent (Paramètres > Matières). `null` revient au choix par défaut.
   */
  async updateSubject(
    accountId: string,
    name: string,
    choice: Partial<{
      displayName: string | null;
      color: string | null;
      emoji: string | null;
    }>
  ): Promise<void> {
    await this.db
      .update(subjects)
      .set(choice)
      .where(
        and(
          eq(subjects.name, name),
          inArray(subjects.serviceId, this.servicesOf(accountId))
        )
      );
  }

  /** Oublie les choix faits pour toutes les matières du compte. */
  async resetSubjects(accountId: string): Promise<void> {
    await this.db
      .update(subjects)
      .set({ displayName: null, color: null, emoji: null })
      .where(inArray(subjects.serviceId, this.servicesOf(accountId)));
  }

  private servicesOf(accountId: string) {
    return this.db
      .select({ id: services.id })
      .from(services)
      .where(eq(services.accountId, accountId));
  }

  /** Efface les secrets de ces services ; renvoie ceux que le trousseau a refusé d'effacer. */
  async deleteSecrets(serviceIds: readonly string[]): Promise<string[]> {
    const results = await Promise.allSettled(serviceIds.map(deleteSecret));
    return serviceIds.filter((_, i) => results[i]?.status === "rejected");
  }

  /**
   * Délie un service : son secret d'abord, puis sa ligne et toutes ses données (cascade).
   * Si le trousseau échoue, rien n'est effacé : pas de secret sans service.
   */
  async unlinkService(serviceId: string): Promise<void> {
    const [service] = await this.db
      .select({ kind: services.kind })
      .from(services)
      .where(eq(services.id, serviceId));
    if (!service) {
      return;
    }
    if (!NO_SECRET.has(service.kind)) {
      await deleteSecret(serviceId);
    }
    this.plugins.delete(serviceId);
    await this.db.delete(services).where(eq(services.id, serviceId));
  }

  async refreshAll(accountId: string, now = new Date()): Promise<void> {
    const errors: unknown[] = [];
    for (const capability of SYNCED) {
      await this.refresh(accountId, capability, now).catch((error: unknown) =>
        errors.push(error)
      );
    }
    if (errors.length > 0) {
      throw errors[0];
    }
  }

  /**
   * Synchronise une capability pour chaque service du compte qui la fournit.
   * Un service en panne garde ses données en base ; l'erreur est notée dans `sync_state`.
   * Ne rejette que si la base elle-même refuse d'écrire.
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
    await settleAll(
      linked.map(service => this.refreshService(service, capability, now))
    );
  }

  private async refreshService(
    service: ServiceRow,
    capability: SyncedCapability,
    now: Date
  ): Promise<void> {
    const state = { serviceId: service.id, capability };
    let writes: Write[] | null;
    try {
      writes = await this.fetch(
        await this.plugin(service),
        service.id,
        capability,
        now
      );
    } catch (error) {
      const mustLogin = error instanceof AuthenticationError;
      if (mustLogin) {
        this.plugins.delete(service.id);
      }
      const lastError = errorKind(error);
      // En mémoire seulement, masqué par `log` (lib/log.ts) : de quoi comprendre une erreur
      // inconnue sans garder un jeton qu'une bibliothèque aurait mis dans son message.
      log(
        lastError === "Unknown" ? "error" : "warn",
        "sync",
        `${service.kind} ${capability} : ${
          lastError === "Unknown" && error instanceof Error
            ? `${error.name} ${error.message.slice(0, 200)}`
            : lastError
        }`
      );
      await this.db.batch([
        this.db
          .insert(syncState)
          .values({ ...state, lastError })
          .onConflictDoUpdate({
            target: [syncState.serviceId, syncState.capability],
            set: { lastError },
          }),
        ...(mustLogin
          ? [
              this.db
                .update(services)
                .set({ needsLogin: true })
                .where(eq(services.id, service.id)),
            ]
          : []),
      ]);
      return;
    }
    if (!writes) {
      return;
    }
    // Les données et leur date de synchro passent ensemble, ou pas du tout.
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
      ...writes,
    ]);
  }

  /** Connexion gardée pour la session ; refaite si elle a échoué. */
  private plugin(service: ServiceRow): Promise<SchoolServicePlugin> {
    const cached = this.plugins.get(service.id);
    if (cached) {
      return cached;
    }
    const plugin = this.connect(service);
    this.plugins.set(service.id, plugin);
    plugin.catch(() => {
      if (this.plugins.get(service.id) === plugin) {
        this.plugins.delete(service.id);
      }
    });
    return plugin;
  }

  private async connect(service: ServiceRow): Promise<SchoolServicePlugin> {
    const connect = this.connectors[service.kind];
    if (!connect) {
      throw new UnsupportedService(
        `Service non pris en charge : ${service.kind}`
      );
    }
    const secret = NO_SECRET.has(service.kind)
      ? ""
      : await getSecret(service.id);
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

  /** Les écritures à faire, ou `null` si le service ne fournit pas cette capability. */
  private async fetch(
    plugin: SchoolServicePlugin,
    serviceId: string,
    capability: SyncedCapability,
    now: Date
  ): Promise<Write[] | null> {
    const { TIMETABLE, HOMEWORK, GRADES } = plugin.capabilities;
    switch (capability) {
      case "TIMETABLE":
        return TIMETABLE ? this.timetable(serviceId, TIMETABLE, now) : null;
      case "HOMEWORK":
        return HOMEWORK ? this.homework(serviceId, HOMEWORK, now) : null;
      case "GRADES":
        return GRADES ? this.grades(serviceId, GRADES) : null;
      default:
        return capability satisfies never;
    }
  }

  private subjectsOf(serviceId: string, names: string[]): Write[] {
    if (names.length === 0) {
      return [];
    }
    return [
      this.db
        .insert(subjects)
        .values([...new Set(names)].map(name => ({ serviceId, name })))
        .onConflictDoNothing(),
    ];
  }

  private async timetable(
    serviceId: string,
    methods: CapabilityMethods["TIMETABLE"],
    now: Date
  ): Promise<Write[]> {
    const from = weekStart(now);
    const to = weekAfter(from);
    const list = uniqueById(await methods.getWeeklyTimetable(from)).filter(
      course => course.from >= from && course.from < to
    );
    return [
      this.db
        .delete(courses)
        .where(
          and(
            eq(courses.serviceId, serviceId),
            gte(courses.from, from),
            lt(courses.from, to)
          )
        ),
      ...this.subjectsOf(
        serviceId,
        list.map(course => course.subject)
      ),
      ...(list.length > 0
        ? [
            this.db
              .insert(courses)
              .values(list.map(course => ({ ...course, serviceId }))),
          ]
        : []),
    ];
  }

  private async homework(
    serviceId: string,
    methods: CapabilityMethods["HOMEWORK"],
    now: Date
  ): Promise<Write[]> {
    const from = weekStart(now);
    const to = weekAfter(from);
    const list = uniqueById(await methods.getHomeworks(from)).filter(
      item => item.dueAt >= from && item.dueAt < to
    );
    return [
      this.db
        .delete(homework)
        .where(
          and(
            eq(homework.serviceId, serviceId),
            gte(homework.dueAt, from),
            lt(homework.dueAt, to)
          )
        ),
      ...this.subjectsOf(
        serviceId,
        list.map(item => item.subject)
      ),
      ...(list.length > 0
        ? [
            this.db
              .insert(homework)
              .values(list.map(item => ({ ...item, serviceId }))),
          ]
        : []),
    ];
  }

  private async grades(
    serviceId: string,
    methods: CapabilityMethods["GRADES"]
  ): Promise<Write[]> {
    const periodList = uniqueById(await methods.getGradesPeriods());
    const gradeList = [];
    // L'un après l'autre : certains services (PRONOTE) numérotent leurs requêtes.
    for (const period of periodList) {
      gradeList.push(...(await methods.getGradesForPeriod(period)));
    }
    const unique = uniqueById(gradeList);
    return [
      this.db.delete(grades).where(eq(grades.serviceId, serviceId)),
      this.db.delete(periods).where(eq(periods.serviceId, serviceId)),
      ...(periodList.length > 0
        ? [
            this.db
              .insert(periods)
              .values(periodList.map(period => ({ ...period, serviceId }))),
          ]
        : []),
      ...this.subjectsOf(
        serviceId,
        unique.map(grade => grade.subject)
      ),
      ...(unique.length > 0
        ? [
            this.db
              .insert(grades)
              .values(unique.map(grade => ({ ...grade, serviceId }))),
          ]
        : []),
    ];
  }
}
