// Point d'entrée unique des données scolaires. Il synchronise les services liés dans la
// base locale ; les écrans lisent la base (hooks), jamais un service directement.
// Inspiré de l'AccountManager de Papillon (services/shared/index.ts, GPLv3).
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import type { Db } from "@/database/client";
import {
  accounts,
  attendance,
  courses,
  grades,
  homework,
  news,
  periods,
  services,
  subjectAverages,
  subjects,
  syncState,
} from "@/database/schema";
import { allowInstance } from "@/lib/http";
import { deleteSecret, getSecret, setSecret } from "@/lib/keyring";
import { log } from "@/lib/log";
import { addDays, weekStart } from "@/lib/week";

import {
  AuthenticationError,
  SecurityChallenge,
  ServiceUnavailable,
  UnsupportedService,
} from "./shared/errors";
import type {
  Account,
  Attendance,
  LinkedService,
  ServiceKind,
} from "./shared/models";
import {
  type CapabilityMethods,
  type ConnectService,
  NO_SECRET,
  type SchoolServicePlugin,
} from "./shared/plugin";

/** Les capabilities qui ont déjà leurs tables. Les autres arriveront avec leur migration. */
export const SYNCED = [
  "TIMETABLE",
  "HOMEWORK",
  "GRADES",
  "NEWS",
  "ATTENDANCE",
] as const;
export type SyncedCapability = (typeof SYNCED)[number];

/**
 * Une donnée synchronisée il y a moins longtemps n'est pas redemandée au service : PRONOTE
 * suspend les adresses IP qui envoient trop de requêtes. Fixé dans le code, non réglable.
 */
export const SYNC_INTERVAL = 30 * 60_000;

/**
 * Synchro demandée (`Ctrl R`) : une donnée de moins de 5 minutes n'est pas redemandée, et le
 * store n'en accepte qu'une toutes les 5 minutes (`stores/sync.ts`).
 */
export const MANUAL_SYNC_INTERVAL = 5 * 60_000;

/** Les données rangées par semaine : `loadWeek` les charge pour une autre semaine. */
const WEEKLY = ["TIMETABLE", "HOMEWORK"] as const;

type ServiceRow = typeof services.$inferSelect;
type Write = BatchItem<"sqlite">;

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
  /** Semaines chargées par `loadWeek` pendant la session, par service et par lundi. */
  private readonly weeks = new Map<string, Promise<boolean>>();
  /** Les adresses rouvertes par `start` : une connexion les attend. */
  private started: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly db: Db,
    private readonly connectors: Partial<Record<ServiceKind, ConnectService>>
  ) {}

  /**
   * Au démarrage : rouvre au réseau l'adresse de chaque service enregistré. Une adresse
   * refusée n'empêche pas d'ouvrir l'app : ce service sera en erreur à la synchro. La synchro
   * du lancement part avant la fin : ses connexions attendent.
   */
  async start(): Promise<void> {
    this.started = this.db
      .select({ url: services.instanceUrl })
      .from(services)
      .then(rows =>
        Promise.allSettled(
          rows.flatMap(({ url }) => (url ? [allowInstance(url)] : []))
        )
      );
    await this.started;
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
   * Reconnecte un service refusé : le nouveau secret remplace l'ancien, et la connexion en
   * mémoire est oubliée pour que la prochaine synchro reparte de lui.
   */
  async relinkService(serviceId: string, secret: string): Promise<void> {
    await setSecret(serviceId, secret);
    this.plugins.delete(serviceId);
    await this.db
      .update(services)
      .set({ needsLogin: false })
      .where(eq(services.id, serviceId));
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

  async refreshAll(
    accountId: string,
    now = new Date(),
    interval = SYNC_INTERVAL
  ): Promise<void> {
    const errors: unknown[] = [];
    for (const capability of SYNCED) {
      await this.refresh(accountId, capability, now, interval).catch(
        (error: unknown) => errors.push(error)
      );
    }
    if (errors.length > 0) {
      throw errors[0];
    }
  }

  /**
   * Synchronise une capability pour chaque service du compte qui la fournit, s'il n'a pas
   * réussi depuis `interval` (`SYNC_INTERVAL`, ou `MANUAL_SYNC_INTERVAL` pour `Ctrl R`).
   * Un service en panne garde ses données en base ; l'erreur est notée dans `sync_state`.
   * Ne rejette que si la base elle-même refuse d'écrire.
   */
  async refresh(
    accountId: string,
    capability: SyncedCapability,
    now = new Date(),
    interval = SYNC_INTERVAL
  ): Promise<void> {
    const linked = await this.db
      .select({ service: services, lastSync: syncState.lastSync })
      .from(services)
      .leftJoin(
        syncState,
        and(
          eq(syncState.serviceId, services.id),
          eq(syncState.capability, capability)
        )
      )
      .where(eq(services.accountId, accountId));
    // `abs` : une horloge reculée ne bloque pas la synchro jusqu'à ce qu'elle rattrape.
    const due = linked.filter(
      ({ lastSync }) =>
        !lastSync || Math.abs(now.getTime() - lastSync.getTime()) >= interval
    );
    await settleAll(
      due.map(({ service }) => this.refreshService(service, capability, now))
    );
  }

  /**
   * Charge les cours et les devoirs d'une autre semaine que celle de la synchro (Cours,
   * Tâches), une fois par session : y revenir ne redemande rien au service. La semaine en
   * cours reste à la synchro et à son délai. Hors ligne ou en panne, la base garde ce
   * qu'elle a et l'erreur va au journal ; la semaine sera redemandée à la prochaine visite.
   * Renvoie vrai si la base a changé.
   */
  async loadWeek(
    accountId: string,
    week: Date,
    now = new Date()
  ): Promise<boolean> {
    const monday = weekStart(week);
    if (monday.getTime() === weekStart(now).getTime()) {
      return false;
    }
    const linked = await this.db
      .select()
      .from(services)
      .where(
        and(eq(services.accountId, accountId), eq(services.needsLogin, false))
      );
    const changed = await Promise.all(
      linked.map(service => {
        const key = `${service.id}:${monday.getTime()}`;
        const loading = this.weeks.get(key);
        if (loading) {
          return loading.then(() => false);
        }
        const load = this.loadServiceWeek(service, monday).catch(
          (error: unknown) => {
            this.weeks.delete(key);
            if (error instanceof AuthenticationError) {
              this.plugins.delete(service.id);
            }
            log(
              "warn",
              "sync",
              `${service.kind} semaine : ${errorKind(error)}`
            );
            return false;
          }
        );
        this.weeks.set(key, load);
        return load;
      })
    );
    return changed.some(Boolean);
  }

  /**
   * Coche ou décoche un devoir : chez le service d'abord, puis dans la base. Hors ligne ou en
   * panne, rien ne change et l'erreur remonte à l'écran.
   */
  async setHomeworkDone(
    serviceId: string,
    id: string,
    done: boolean
  ): Promise<void> {
    const [service] = await this.db
      .select()
      .from(services)
      .where(eq(services.id, serviceId));
    if (!service) {
      return;
    }
    const methods = (await this.plugin(service)).capabilities.HOMEWORK;
    if (!methods) {
      throw new UnsupportedService(`${service.kind} ne gère pas les devoirs`);
    }
    await methods.setHomeworkCompletion(id, done);
    await this.db
      .update(homework)
      .set({ done })
      .where(and(eq(homework.serviceId, serviceId), eq(homework.id, id)));
  }

  /** Marque une actualité comme lue : chez le service d'abord, puis dans la base. */
  async markNewsRead(serviceId: string, id: string): Promise<void> {
    const [service] = await this.db
      .select()
      .from(services)
      .where(eq(services.id, serviceId));
    const methods = service && (await this.plugin(service)).capabilities.NEWS;
    if (!methods) {
      return;
    }
    await methods.setNewsAsAcknowledged(id);
    await this.db
      .update(news)
      .set({ read: true })
      .where(and(eq(news.serviceId, serviceId), eq(news.id, id)));
  }

  private async loadServiceWeek(
    service: ServiceRow,
    monday: Date
  ): Promise<boolean> {
    const plugin = await this.plugin(service);
    const writes: Write[] = [];
    for (const capability of WEEKLY) {
      writes.push(
        ...((await this.fetch(plugin, service.id, capability, monday)) ?? [])
      );
    }
    const [first, ...rest] = writes;
    if (!first) {
      return false;
    }
    await this.db.batch([first, ...rest]);
    return true;
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
    await this.started;
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
    const { TIMETABLE, HOMEWORK, GRADES, NEWS, ATTENDANCE } =
      plugin.capabilities;
    switch (capability) {
      case "TIMETABLE":
        return TIMETABLE ? this.timetable(serviceId, TIMETABLE, now) : null;
      case "HOMEWORK":
        return HOMEWORK ? this.homework(serviceId, HOMEWORK, now) : null;
      case "GRADES":
        return GRADES ? this.grades(serviceId, GRADES) : null;
      case "NEWS":
        return NEWS ? this.news(serviceId, NEWS) : null;
      case "ATTENDANCE":
        return ATTENDANCE ? this.attendance(serviceId, ATTENDANCE) : null;
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
    const to = addDays(from, 7);
    // La semaine d'abord : un cours d'une autre semaine ne doit pas en remplacer un de celle-ci.
    const list = uniqueById(
      (await methods.getWeeklyTimetable(from)).filter(
        course => course.from >= from && course.from < to
      )
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
    const to = addDays(from, 7);
    const list = uniqueById(
      (await methods.getHomeworks(from)).filter(
        item => item.dueAt >= from && item.dueAt < to
      )
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
    const averageRows = [];
    const periodRows = [];
    // L'un après l'autre : certains services (PRONOTE) numérotent leurs requêtes.
    for (const period of periodList) {
      const found = await methods.getGradesForPeriod(period);
      gradeList.push(...found.grades);
      // Une matière en double dans un relevé ferait échouer tout l'enregistrement.
      const bySubject = new Map(
        found.averages.map(average => [average.subject, average])
      );
      averageRows.push(
        ...[...bySubject.values()].map(average => ({
          ...average,
          serviceId,
          periodId: period.id,
        }))
      );
      periodRows.push({
        ...period,
        serviceId,
        average: found.overall?.student,
        classAverage: found.overall?.classAverage,
      });
    }
    const unique = uniqueById(gradeList);
    return [
      this.db.delete(grades).where(eq(grades.serviceId, serviceId)),
      this.db
        .delete(subjectAverages)
        .where(eq(subjectAverages.serviceId, serviceId)),
      this.db.delete(periods).where(eq(periods.serviceId, serviceId)),
      ...(periodRows.length > 0
        ? [this.db.insert(periods).values(periodRows)]
        : []),
      ...(averageRows.length > 0
        ? [this.db.insert(subjectAverages).values(averageRows)]
        : []),
      ...this.subjectsOf(serviceId, [
        ...averageRows.map(average => average.subject),
        ...unique.map(grade => grade.subject),
      ]),
      ...(unique.length > 0
        ? [
            this.db
              .insert(grades)
              .values(unique.map(grade => ({ ...grade, serviceId }))),
          ]
        : []),
    ];
  }

  private async news(
    serviceId: string,
    methods: CapabilityMethods["NEWS"]
  ): Promise<Write[]> {
    const list = uniqueById(await methods.getNews());
    return [
      this.db.delete(news).where(eq(news.serviceId, serviceId)),
      ...(list.length > 0
        ? [
            this.db
              .insert(news)
              .values(list.map(item => ({ ...item, serviceId }))),
          ]
        : []),
    ];
  }

  /** Absences et retards de toutes les périodes du carnet (l'année recoupe les trimestres). */
  private async attendance(
    serviceId: string,
    methods: CapabilityMethods["ATTENDANCE"]
  ): Promise<Write[]> {
    const found = new Map<string, Attendance>();
    // L'un après l'autre : certains services (PRONOTE) numérotent leurs requêtes.
    for (const period of uniqueById(await methods.getAttendancePeriods())) {
      for (const item of await methods.getAttendanceForPeriod(period)) {
        found.set(`${item.kind}:${item.id}`, item);
      }
    }
    const list = [...found.values()];
    return [
      this.db.delete(attendance).where(eq(attendance.serviceId, serviceId)),
      ...(list.length > 0
        ? [
            this.db
              .insert(attendance)
              .values(list.map(item => ({ ...item, serviceId }))),
          ]
        : []),
    ];
  }
}
