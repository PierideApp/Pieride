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
  downloads,
  grades,
  homework,
  news,
  periods,
  services,
  subjectAverages,
  subjects,
  syncState,
} from "@/database/schema";
import {
  chooseDownloadsFolder,
  deleteFiles,
  filesInfo,
  forgetFiles,
  openFile,
  openSavedFile,
  type SavedFile,
  saveFile,
} from "@/lib/files";
import { allowInstance } from "@/lib/http";
import { deleteSecret, getSecret, setSecret } from "@/lib/keyring";
import { log } from "@/lib/log";
import { addDays, schoolYear, weekStart } from "@/lib/week";

import { ServiceAuth } from "./shared/auth";
import {
  AuthenticationError,
  SecurityChallenge,
  ServiceUnavailable,
  UnsupportedService,
} from "./shared/errors";
import type {
  Account,
  Attachment,
  Attendance,
  Course,
  LinkedService,
  News,
  ServiceKind,
} from "./shared/models";
import {
  type Capability,
  type CapabilityMethods,
  type ConnectService,
  NO_SECRET,
  type SchoolServicePlugin,
  SERVICE_CAPABILITIES,
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

/** Ce qui retrouve le téléchargement d'une pièce jointe d'une synchro à l'autre. */
const downloadKey = (attachment: Attachment) =>
  attachment.key ?? attachment.url;

/** Les modules dont les pièces jointes se téléchargent, chacun son dossier. */
export type FileModule = "cours" | "taches" | "actualites";

/**
 * Où ranger un fichier sous le dossier du compte : l'année scolaire de `date`, le module (son
 * nom affiché), puis la matière s'il y en a une. `date` date aussi le fichier.
 */
export interface Placement {
  module: string;
  subject?: string;
  date: Date;
}

/** Un fichier vu à la synchro ; `subject` : le nom de la matière chez le service. */
interface FoundFile {
  attachment: Attachment;
  module: FileModule;
  subject?: string;
  date: Date;
}

/** `chemin` : `<compte>/<année>/<module>/…/<fichier>`, découpé pour l'affichage. */
const foldersOf = (path: string) => path.split("/").slice(1, -1);

/** Les fichiers de `after` absents de `before` : apparus depuis la synchro d'avant. */
function newFiles(before: Attachment[], after: FoundFile[]): FoundFile[] {
  const known = new Set(before.map(downloadKey));
  return after.filter(
    ({ attachment }) =>
      attachment.kind === "file" && !known.has(downloadKey(attachment))
  );
}

const courseFiles = ({ contents, subject, from }: Course): FoundFile[] =>
  (contents ?? []).flatMap(content =>
    content.attachments.map(attachment => ({
      attachment,
      module: "cours" as const,
      subject,
      date: from,
    }))
  );

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
  /** La connexion de chaque service pendant ce lancement : elle survit aux plugins refaits. */
  private readonly auth = new Map<string, ServiceAuth>();
  /** Semaines chargées par `loadWeek` pendant la session, par service et par lundi. */
  private readonly weeks = new Map<string, Promise<boolean>>();
  /** Les adresses rouvertes par `start` : une connexion les attend. */
  private started: Promise<unknown> = Promise.resolve();
  /** Par service : les fichiers apparus à cette synchro (`saveNewAttachments`). */
  private readonly fresh = new Map<string, FoundFile[]>();

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

  /**
   * Le compte où ce service est déjà lié (même service, même adresse, et un secret que
   * `same` reconnaît), pour ne pas ajouter deux fois le même élève.
   */
  async findLinkedAccount(
    kind: ServiceKind,
    instanceUrl: string,
    same: (secret: string) => boolean
  ): Promise<string | undefined> {
    const linked = await this.db
      .select({ id: services.id, accountId: services.accountId })
      .from(services)
      .where(
        and(eq(services.kind, kind), eq(services.instanceUrl, instanceUrl))
      );
    for (const { id, accountId } of linked) {
      const secret = await getSecret(id);
      if (secret !== null && same(secret)) {
        return accountId;
      }
    }
    return undefined;
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

  /** Récupère la photo du premier service scolaire qui sait la fournir. */
  async getProfilePhoto(accountId: string): Promise<string | undefined> {
    const linked = await this.db
      .select()
      .from(services)
      .where(
        and(eq(services.accountId, accountId), eq(services.kind, "pronote"))
      );
    for (const service of linked) {
      const photo = await (await this.plugin(service)).getProfilePhoto?.();
      if (photo) {
        return photo;
      }
    }
    return undefined;
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
    this.auth.delete(serviceId);
    await this.db
      .update(services)
      .set({ needsLogin: false, authStep: null, authFailure: null })
      .where(eq(services.id, serviceId));
  }

  /**
   * `Ctrl R` : l'utilisateur redemande tout de suite. Lève l'attente après un échec, pas une
   * suspension de l'adresse IP ni le refus d'un jeton (seule la reconnexion le lève).
   */
  allowAuthRetries(): void {
    for (const auth of this.auth.values()) {
      auth.allowRetry();
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
      this.auth.delete(id);
    }
    const saved = await Promise.all(
      linked.map(({ id }) => this.downloadPaths(id))
    );
    await this.db.delete(accounts).where(eq(accounts.id, accountId));
    await Promise.all(
      linked.map(({ id }, index) => this.forgetFiles(id, saved[index] ?? []))
    );
    return failed;
  }

  private async downloadPaths(serviceId: string): Promise<string[]> {
    const rows = await this.db
      .select({ path: downloads.path })
      .from(downloads)
      .where(eq(downloads.serviceId, serviceId));
    return rows.map(row => row.path);
  }

  /**
   * Les fichiers ouverts et téléchargés d'un service. Un échec n'empêche rien : le lancement
   * vide le cache, mais un téléchargement resté là n'est plus suivi par l'app.
   */
  private async forgetFiles(serviceId: string, paths: string[]): Promise<void> {
    try {
      await forgetFiles(serviceId, paths);
    } catch (error) {
      log("warn", "fichiers", `Pièces jointes non effacées : ${String(error)}`);
    }
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
    this.auth.delete(serviceId);
    const saved = await this.downloadPaths(serviceId);
    await this.db.delete(services).where(eq(services.id, serviceId));
    await this.forgetFiles(serviceId, saved);
  }

  /** `wanted` : les données des modules affichés (`syncedCapabilities` du registre). */
  async refreshAll(
    accountId: string,
    wanted: readonly Capability[],
    now = new Date(),
    interval = SYNC_INTERVAL
  ): Promise<void> {
    this.fresh.clear();
    const errors: unknown[] = [];
    for (const capability of SYNCED.filter(item => wanted.includes(item))) {
      await this.refresh(accountId, capability, now, interval).catch(
        (error: unknown) => errors.push(error)
      );
    }
    await this.keepAlive(accountId, wanted).catch((error: unknown) =>
      errors.push(error)
    );
    if (errors.length > 0) {
      throw errors[0];
    }
  }

  /**
   * Connecte, sans rien lui demander, un service dont tous les modules sont masqués : PRONOTE
   * ne renouvelle le jeton qu'à la connexion. Une fois par lancement, la connexion est gardée.
   */
  private async keepAlive(
    accountId: string,
    wanted: readonly Capability[]
  ): Promise<void> {
    const linked = await this.db
      .select()
      .from(services)
      .where(
        and(eq(services.accountId, accountId), eq(services.needsLogin, false))
      );
    const idle = linked.filter(service => {
      const provided = SYNCED.filter(item =>
        SERVICE_CAPABILITIES[service.kind].includes(item)
      );
      return (
        provided.length > 0 && !provided.some(item => wanted.includes(item))
      );
    });
    await settleAll(
      idle.map(service =>
        this.plugin(service).then(
          () => undefined,
          async (error: unknown) => {
            log(
              "warn",
              "sync",
              `${service.kind} connexion : ${errorKind(error)}`
            );
            if (error instanceof AuthenticationError) {
              await this.db
                .update(services)
                .set({ needsLogin: true })
                .where(eq(services.id, service.id));
            }
          }
        )
      )
    );
  }

  /**
   * Synchronise une capability pour chaque service du compte qui la fournit, s'il n'a pas
   * réussi depuis `interval` (`SYNC_INTERVAL`, ou `MANUAL_SYNC_INTERVAL` pour `Ctrl R`).
   * Un service en panne garde ses données en base ; l'erreur est notée dans `sync_state`.
   * Un service à reconnecter est laissé de côté jusqu'à la reconnexion (`connect`).
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
      .where(
        and(eq(services.accountId, accountId), eq(services.needsLogin, false))
      );
    // `abs` : une horloge reculée ne bloque pas la synchro jusqu'à ce qu'elle rattrape.
    const due = linked.filter(
      ({ lastSync }) =>
        !lastSync || Math.abs(now.getTime() - lastSync.getTime()) >= interval
    );
    await settleAll(
      due.map(({ service, lastSync }) =>
        this.refreshService(service, capability, now, !lastSync)
      )
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

  private async newsMethods(
    serviceId: string
  ): Promise<CapabilityMethods["NEWS"] | undefined> {
    const [service] = await this.db
      .select()
      .from(services)
      .where(eq(services.id, serviceId));
    return service && (await this.plugin(service)).capabilities.NEWS;
  }

  /**
   * Ouvre une pièce jointe : sa copie téléchargée s'il y en a une (hors ligne aussi), sinon
   * le service, avec une adresse à jour (la sienne expire).
   */
  async openAttachment(
    serviceId: string,
    attachment: Attachment
  ): Promise<void> {
    const path = await this.downloaded(serviceId, attachment);
    if (path) {
      try {
        await openSavedFile(path);
        return;
      } catch (error) {
        if (error !== "not_found") {
          throw error;
        }
      }
    }
    const bytes = await this.downloadAttachment(serviceId, attachment);
    await openFile(serviceId, attachment.name, bytes);
  }

  async saveAttachment(
    serviceId: string,
    attachment: Attachment,
    { module, subject, date }: Placement
  ): Promise<void> {
    const bytes = await this.downloadAttachment(serviceId, attachment);
    const [owner] = await this.db
      .select({ firstName: accounts.firstName, lastName: accounts.lastName })
      .from(services)
      .innerJoin(accounts, eq(accounts.id, services.accountId))
      .where(eq(services.id, serviceId));
    const account = `${owner?.firstName ?? ""} ${owner?.lastName ?? ""}`.trim();
    const path = await saveFile(
      [
        account || serviceId,
        schoolYear(date),
        module,
        ...(subject ? [subject] : []),
      ],
      attachment.name,
      bytes,
      date
    );
    await this.db
      .insert(downloads)
      .values({ serviceId, key: downloadKey(attachment), path })
      .onConflictDoUpdate({
        target: [downloads.serviceId, downloads.key],
        set: { path },
      });
  }

  async revealAttachment(
    serviceId: string,
    attachment: Attachment
  ): Promise<void> {
    const path = await this.downloaded(serviceId, attachment);
    if (!path) {
      throw new Error("Pièce jointe pas téléchargée");
    }
    await openSavedFile(path, true);
  }

  /** Par adresse (`url`). */
  async savedAttachments(
    serviceId: string,
    attachments: readonly Attachment[]
  ): Promise<Map<string, SavedFile>> {
    const files = attachments.filter(attachment => attachment.kind === "file");
    if (files.length === 0) {
      return new Map();
    }
    const rows = await this.db
      .select({ key: downloads.key, path: downloads.path })
      .from(downloads)
      .where(
        and(
          eq(downloads.serviceId, serviceId),
          inArray(downloads.key, files.map(downloadKey))
        )
      );
    const paths = new Map(rows.map(row => [row.key, row.path]));
    const found = files.flatMap(attachment => {
      const path = paths.get(downloadKey(attachment));
      return path ? [{ url: attachment.url, path }] : [];
    });
    if (found.length === 0) {
      return new Map();
    }
    const info = await filesInfo(found.map(item => item.path));
    return new Map(
      found.map(({ url, path }, index): [string, SavedFile] => [
        url,
        { folders: foldersOf(path), location: info[index]?.[0] },
      ])
    );
  }

  /** Les téléchargements du compte par année scolaire, de la plus récente à la plus ancienne. */
  async downloadsByYear(
    accountId: string
  ): Promise<{ year: string; count: number; size: number }[]> {
    const paths = await this.accountDownloads(accountId);
    const info = await filesInfo(paths);
    const years = new Map<string, { count: number; size: number }>();
    paths.forEach((path, index) => {
      const year = path.split("/")[1] ?? "";
      const size = info[index]?.[1];
      if (size !== undefined && /^\d{4}-\d{4}$/.test(year)) {
        const total = years.get(year) ?? { count: 0, size: 0 };
        years.set(year, { count: total.count + 1, size: total.size + size });
      }
    });
    return [...years]
      .map(([year, total]) => ({ year, ...total }))
      .sort((a, b) => b.year.localeCompare(a.year));
  }

  /** Efface du dossier les fichiers d'une année scolaire, puis les oublie. */
  async deleteDownloads(accountId: string, year: string): Promise<void> {
    const ids = (await this.servicesOf(accountId)).map(({ id }) => id);
    const rows = (
      await this.db
        .select()
        .from(downloads)
        .where(inArray(downloads.serviceId, ids))
    ).filter(row => row.path.split("/")[1] === year);
    await deleteFiles([...new Set(rows.map(row => row.path))]);
    const writes = rows.map(row =>
      this.db
        .delete(downloads)
        .where(
          and(
            eq(downloads.serviceId, row.serviceId),
            eq(downloads.key, row.key)
          )
        )
    );
    const [first, ...rest] = writes;
    if (first) {
      await this.db.batch([first, ...rest]);
    }
  }

  private async accountDownloads(accountId: string): Promise<string[]> {
    const ids = (await this.servicesOf(accountId)).map(({ id }) => id);
    const rows = await this.db
      .select({ path: downloads.path })
      .from(downloads)
      .where(inArray(downloads.serviceId, ids));
    return [...new Set(rows.map(row => row.path))];
  }

  /**
   * Télécharge, l'un après l'autre, les fichiers apparus à la dernière synchro du compte
   * (Paramètres > Fonctionnalités), chacun une seule fois : un échec va au journal, il reste
   * le bouton. `modules` : le nom affiché de chaque module, son dossier. Renvoie vrai si un
   * fichier a été rangé.
   */
  async saveNewAttachments(
    accountId: string,
    modules: Record<FileModule, string>
  ): Promise<boolean> {
    let saved = false;
    for (const { id } of await this.servicesOf(accountId)) {
      const files = this.fresh.get(id) ?? [];
      this.fresh.delete(id);
      if (files.length === 0) {
        continue;
      }
      const chosen = await this.db
        .select({ name: subjects.name, displayName: subjects.displayName })
        .from(subjects)
        .where(eq(subjects.serviceId, id));
      const labels = new Map(
        chosen.map(row => [row.name, row.displayName ?? row.name])
      );
      for (const { attachment, module, subject, date } of files) {
        if (await this.downloaded(id, attachment)) {
          continue;
        }
        try {
          await this.saveAttachment(id, attachment, {
            module: modules[module],
            subject: subject && (labels.get(subject) ?? subject),
            date,
          });
          saved = true;
        } catch (error) {
          log(
            "warn",
            "fichiers",
            `Téléchargement automatique en échec : ${
              typeof error === "string" ? error : errorKind(error)
            }`
          );
        }
      }
    }
    return saved;
  }

  /**
   * Le dossier choisi dans le sélecteur du système ; les fichiers déjà téléchargés y sont
   * déplacés. Faux si l'élève a annulé.
   */
  async changeDownloadsFolder(title: string): Promise<boolean> {
    const rows = await this.db.select().from(downloads);
    // Un fichier repris pour deux pièces jointes (cours et devoir) ne se déplace qu'une fois.
    const before = [...new Set(rows.map(row => row.path))];
    const after = await chooseDownloadsFolder(title, before);
    if (!after) {
      return false;
    }
    const moved = new Map(before.map((path, index) => [path, after[index]]));
    const writes = rows.flatMap((row): Write[] => {
      const path = moved.get(row.path);
      return path && path !== row.path
        ? [
            this.db
              .update(downloads)
              .set({ path })
              .where(
                and(
                  eq(downloads.serviceId, row.serviceId),
                  eq(downloads.key, row.key)
                )
              ),
          ]
        : [];
    });
    const [first, ...rest] = writes;
    if (first) {
      await this.db.batch([first, ...rest]);
    }
    return true;
  }

  private async downloaded(
    serviceId: string,
    attachment: Attachment
  ): Promise<string | undefined> {
    const [row] = await this.db
      .select({ path: downloads.path })
      .from(downloads)
      .where(
        and(
          eq(downloads.serviceId, serviceId),
          eq(downloads.key, downloadKey(attachment))
        )
      );
    return row?.path;
  }

  private async downloadAttachment(
    serviceId: string,
    attachment: Attachment
  ): Promise<Uint8Array> {
    const [service] = await this.db
      .select()
      .from(services)
      .where(eq(services.id, serviceId));
    const plugin = service && (await this.plugin(service));
    if (!plugin?.downloadAttachment) {
      throw new UnsupportedService(
        "Ce service ne donne pas ses pièces jointes"
      );
    }
    return plugin.downloadAttachment(attachment);
  }

  /** Marque une actualité comme lue : chez le service d'abord, puis dans la base. */
  async markNewsRead(serviceId: string, id: string): Promise<void> {
    const methods = await this.newsMethods(serviceId);
    if (!methods) {
      return;
    }
    await methods.setNewsAsRead(id);
    await this.db
      .update(news)
      .set({ read: true })
      .where(and(eq(news.serviceId, serviceId), eq(news.id, id)));
  }

  /**
   * Envoie l'accusé de réception demandé par l'établissement : chez le service d'abord, puis
   * dans la base. Hors ligne ou en panne, rien ne change et l'erreur remonte à l'écran.
   */
  async acknowledgeNews(serviceId: string, id: string): Promise<void> {
    const methods = await this.newsMethods(serviceId);
    if (!methods) {
      throw new UnsupportedService("Ce service ne gère pas les actualités");
    }
    await methods.setNewsAsAcknowledged(id);
    await this.db
      .update(news)
      .set({ read: true, acknowledged: true })
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

  /** `first` : à la première synchro, tout serait nouveau, rien n'est téléchargé. */
  private async refreshService(
    service: ServiceRow,
    capability: SyncedCapability,
    now: Date,
    first: boolean
  ): Promise<void> {
    const state = { serviceId: service.id, capability };
    const found: FoundFile[] | undefined = first ? undefined : [];
    let writes: Write[] | null;
    try {
      writes = await this.fetch(
        await this.plugin(service),
        service.id,
        capability,
        now,
        found
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
    if (found && found.length > 0) {
      this.fresh.set(service.id, [
        ...(this.fresh.get(service.id) ?? []),
        ...found,
      ]);
    }
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
    // Un jeton refusé ne redevient jamais valable (PRONOTE n'accepte que le dernier émis) : le
    // renvoyer, même à un autre lancement, ne ferait qu'ajouter une erreur d'authentification au
    // compteur du service, qui finit par bloquer la reconnexion elle-même. Papillon, lui, le
    // renvoie à chaque lancement.
    if (service.needsLogin) {
      throw new AuthenticationError("Reconnexion nécessaire");
    }
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
      newSecret => setSecret(service.id, newSecret),
      this.authOf(service)
    );
  }

  /** Créée au premier usage du lancement, avec l'étape et l'échec laissés en base. */
  private authOf(service: ServiceRow): ServiceAuth {
    let auth = this.auth.get(service.id);
    if (!auth) {
      auth = new ServiceAuth(
        service.kind,
        { step: service.authStep, failure: service.authFailure },
        async ({ step, failure }) => {
          await this.db
            .update(services)
            .set({ authStep: step, authFailure: failure })
            .where(eq(services.id, service.id));
        }
      );
      this.auth.set(service.id, auth);
    }
    return auth;
  }

  /**
   * Les écritures à faire, ou `null` si le service ne fournit pas cette capability. `found`
   * reçoit les fichiers apparus depuis la synchro d'avant.
   */
  private async fetch(
    plugin: SchoolServicePlugin,
    serviceId: string,
    capability: SyncedCapability,
    now: Date,
    found?: FoundFile[]
  ): Promise<Write[] | null> {
    const { TIMETABLE, HOMEWORK, GRADES, NEWS, ATTENDANCE } =
      plugin.capabilities;
    switch (capability) {
      case "TIMETABLE":
        return TIMETABLE
          ? this.timetable(serviceId, TIMETABLE, now, found)
          : null;
      case "HOMEWORK":
        return HOMEWORK ? this.homework(serviceId, HOMEWORK, now, found) : null;
      case "GRADES":
        return GRADES ? this.grades(serviceId, GRADES) : null;
      case "NEWS":
        return NEWS ? this.news(serviceId, NEWS, found) : null;
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
    now: Date,
    found?: FoundFile[]
  ): Promise<Write[]> {
    const from = weekStart(now);
    const to = addDays(from, 7);
    // La semaine d'abord : un cours d'une autre semaine ne doit pas en remplacer un de celle-ci.
    const list = uniqueById(
      (await methods.getWeeklyTimetable(from)).filter(
        course => course.from >= from && course.from < to
      )
    );
    const week = and(
      eq(courses.serviceId, serviceId),
      gte(courses.from, from),
      lt(courses.from, to)
    );
    if (found) {
      const before = await this.db
        .select({ contents: courses.contents })
        .from(courses)
        .where(week);
      found.push(
        ...newFiles(
          before.flatMap(row =>
            (row.contents ?? []).flatMap(content => content.attachments)
          ),
          list.flatMap(courseFiles)
        )
      );
    }
    return [
      this.db.delete(courses).where(week),
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
    now: Date,
    found?: FoundFile[]
  ): Promise<Write[]> {
    const from = weekStart(now);
    const to = addDays(from, 7);
    const list = uniqueById(
      (await methods.getHomeworks(from)).filter(
        item => item.dueAt >= from && item.dueAt < to
      )
    );
    const week = and(
      eq(homework.serviceId, serviceId),
      gte(homework.dueAt, from),
      lt(homework.dueAt, to)
    );
    if (found) {
      const before = await this.db
        .select({ attachments: homework.attachments })
        .from(homework)
        .where(week);
      found.push(
        ...newFiles(
          before.flatMap(row => row.attachments),
          list.flatMap(item =>
            item.attachments.map(attachment => ({
              attachment,
              module: "taches" as const,
              subject: item.subject,
              date: item.dueAt,
            }))
          )
        )
      );
    }
    return [
      this.db.delete(homework).where(week),
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
    methods: CapabilityMethods["NEWS"],
    found?: FoundFile[]
  ): Promise<Write[]> {
    const rows = await this.db
      .select()
      .from(news)
      .where(eq(news.serviceId, serviceId));
    const known = new Map(
      rows.map(({ serviceId: _serviceId, ...row }): [string, News] => [
        row.id,
        {
          ...row,
          title: row.title ?? undefined,
          category: row.category ?? undefined,
        },
      ])
    );
    const list = uniqueById(await methods.getNews(known));
    found?.push(
      ...newFiles(
        rows.flatMap(row => row.attachments),
        list.flatMap(item =>
          item.attachments.map(attachment => ({
            attachment,
            module: "actualites" as const,
            date: item.date,
          }))
        )
      )
    );
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
