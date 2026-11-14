// Connexion aux services : chaque étape est écrite en base, un échec est classé, et la connexion
// suivante attend en conséquence. D'après Papillon (services/auth/coordinator.ts, policy.ts et
// types.ts, GPLv3) : https://github.com/PapillonApp/Papillon
import { log } from "@/lib/log";

import {
  AuthenticationError,
  SecurityChallenge,
  ServiceUnavailable,
} from "./errors";

/**
 * Où en est la connexion d'un service. Écrite en base à chaque changement : une app coupée sait
 * au lancement suivant où elle s'est arrêtée.
 * - `starting` : rien n'est encore parti, s'arrêter ici ne coûte rien.
 * - `credential_sent` : le jeton enregistré est parti, le serveur l'accepte encore.
 * - `awaiting_new_credential` : point de non-retour, le serveur a pu consommer l'ancien jeton.
 * - `credential_received` : le nouveau jeton est dans le trousseau.
 */
export type AuthStep =
  | "starting"
  | "credential_sent"
  | "awaiting_new_credential"
  | "credential_received"
  | "ready"
  | "failed";

const ACTIVE_STEPS: readonly (AuthStep | null)[] = [
  "starting",
  "credential_sent",
  "awaiting_new_credential",
  "credential_received",
];

/**
 * Pourquoi une connexion a échoué. `credential_lost` : refusée après un renouvellement coupé,
 * le nouveau jeton n'est jamais arrivé.
 */
export type AuthFailure =
  | "credential_rejected"
  | "credential_lost"
  | "account_disabled"
  | "security_challenge"
  | "suspended"
  | "unavailable";

/** Seule une reconnexion de l'utilisateur y remédie. */
const RELINK: readonly AuthFailure[] = [
  "credential_rejected",
  "credential_lost",
  "account_disabled",
];

const BACKOFF_BASE = 30_000;
const BACKOFF_MAX = 15 * 60_000;
/** PRONOTE lève une suspension en quelques minutes : attendre juste assez pour ne pas la prolonger. */
export const SUSPENSION_COOLDOWN = 5 * 60_000;
/** Ce qu'on laisse au plus à une connexion en cours avant de quitter (`closeLogins`). */
export const CLOSE_WAIT = 30_000;

/** Les connexions en cours, tous services confondus. */
const running = new Set<Promise<unknown>>();
/** Vrai une fois l'arrêt demandé : plus aucune connexion ne part. */
let closing = false;

/**
 * Avant de quitter ou de redémarrer. Couper l'app pendant que le service remplace le jeton le
 * perd : le nouveau n'est jamais écrit, et seule une reconnexion y remédie (relevé aussi par
 * l'intégration PRONOTE de Home Assistant). Plus aucune connexion ne part, et celles en cours
 * ont jusqu'à `maxWait` pour finir.
 */
export async function closeLogins(maxWait = CLOSE_WAIT): Promise<void> {
  closing = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    Promise.allSettled([...running]),
    new Promise(resolve => {
      timer = setTimeout(resolve, maxWait);
    }),
  ]);
  clearTimeout(timer);
}

/** L'arrêt n'a pas eu lieu (installation en échec, ou terminée sans redémarrer) : on reprend. */
export function reopenLogins(): void {
  closing = false;
}

/** Ce que la base garde de la connexion d'un service. */
export interface AuthRecord {
  step: AuthStep | null;
  failure: AuthFailure | null;
}

/** Ce qu'une connexion signale en avançant, entre ses requêtes. */
export interface AuthTracker {
  credentialSent: () => void;
  awaitingNewCredential: () => void;
  /** À appeler une fois le nouveau jeton enregistré. */
  credentialReceived: () => void;
}

export interface LoginOptions {
  /** Le service donne un nouveau jeton à chaque connexion (PRONOTE). */
  rotatesCredential: boolean;
  /** Les erreurs propres au service ; `undefined` laisse les règles communes décider. */
  classify?: (error: unknown) => AuthFailure | undefined;
}

function classifyError(
  error: unknown,
  classify?: LoginOptions["classify"]
): AuthFailure {
  const failure = classify?.(error);
  if (failure) {
    return failure;
  }
  if (error instanceof AuthenticationError) {
    return "credential_rejected";
  }
  if (error instanceof SecurityChallenge) {
    return "security_challenge";
  }
  return "unavailable";
}

/** L'erreur renvoyée sans rien envoyer tant qu'un échec retient la connexion. */
function heldError(failure: AuthFailure): Error {
  if (RELINK.includes(failure)) {
    return new AuthenticationError("Reconnexion nécessaire");
  }
  return new ServiceUnavailable(
    failure === "suspended"
      ? "Ton adresse IP a été bloquée de manière temporaire"
      : "Nouvel essai dans un moment"
  );
}

/**
 * La connexion d'un service pendant ce lancement. L'AccountManager en garde une par service :
 * elle survit aux sessions refaites, donc un jeton refusé n'est pas renvoyé à chaque donnée.
 */
export class ServiceAuth {
  /** L'échec qui retient la connexion suivante, jusqu'à `until`. Vaut pour ce lancement seulement. */
  private hold: { failure: AuthFailure; until: number } | null = null;
  private failures = 0;
  private running = false;
  /** Les écritures en base, dans l'ordre. */
  private saving = Promise.resolve();

  constructor(
    private readonly label: string,
    private record: AuthRecord,
    private readonly save: (record: AuthRecord) => Promise<void>
  ) {}

  private update(patch: Partial<AuthRecord>): void {
    const record = { ...this.record, ...patch };
    this.record = record;
    this.saving = this.saving
      .then(() => this.save(record))
      .catch((error: unknown) => {
        // Le type seulement : l'étape sert au diagnostic, une écriture manquée ne bloque rien.
        log(
          "warn",
          "sync",
          `${this.label} étape non écrite : ${error instanceof Error ? error.name : "Unknown"}`
        );
      });
  }

  /**
   * Après un échec, la raison et l'attente avant la connexion suivante : jusqu'à la reconnexion
   * pour un jeton refusé, 5 minutes pour une suspension, sinon de plus en plus longue.
   * Papillon ne fait pas attendre une vérification demandée (`security_challenge`), mais il ne
   * se connecte qu'une fois par actualisation ; l'AccountManager, lui, refait la connexion pour
   * chaque donnée, d'où l'attente ordinaire.
   */
  private fail(failure: AuthFailure): void {
    this.failures += 1;
    const now = Date.now();
    this.hold = {
      failure,
      until: RELINK.includes(failure)
        ? Infinity
        : failure === "suspended"
          ? now + SUSPENSION_COOLDOWN
          : now +
            Math.min(BACKOFF_BASE * 2 ** (this.failures - 1), BACKOFF_MAX),
    };
    this.update({ step: "failed", failure });
  }

  private held(): AuthFailure | null {
    return this.hold && Date.now() < this.hold.until ? this.hold.failure : null;
  }

  /**
   * Toute connexion passe par ici : refusée sans rien envoyer si un échec la retient, chaque
   * étape écrite en base, l'échec classé. Une connexion à la fois : c'est à l'appelant de
   * partager celle en cours (`PronoteSession.handle`).
   */
  async login<T>(
    options: LoginOptions,
    run: (tracker: AuthTracker) => Promise<T>
  ): Promise<T> {
    // Avant toute étape : rien n'est parti, s'arrêter ici ne coûte rien.
    if (closing) {
      throw new ServiceUnavailable("Piéride se ferme");
    }
    const task = this.attempt(options, run);
    running.add(task);
    try {
      return await task;
    } finally {
      running.delete(task);
    }
  }

  private async attempt<T>(
    options: LoginOptions,
    run: (tracker: AuthTracker) => Promise<T>
  ): Promise<T> {
    const held = this.held();
    if (held) {
      throw heldError(held);
    }
    // Encore active : l'app s'est arrêtée pendant cette étape.
    const interrupted = ACTIVE_STEPS.includes(this.record.step)
      ? this.record.step
      : null;
    if (interrupted) {
      log(
        "warn",
        "sync",
        `${this.label} : connexion précédente interrompue (${interrupted})`
      );
    }
    // Vrai quand un renouvellement a été coupé après le point de non-retour : un refus qui suit
    // veut dire que le jeton a été perdu, pas qu'il était faux.
    let rotationInterrupted =
      options.rotatesCredential && interrupted === "awaiting_new_credential";

    this.running = true;
    this.update({ step: "starting" });
    const tracker: AuthTracker = {
      credentialSent: () => {
        if (
          options.rotatesCredential &&
          this.record.step === "awaiting_new_credential"
        ) {
          rotationInterrupted = true;
        }
        this.update({ step: "credential_sent" });
      },
      awaitingNewCredential: () =>
        this.update({ step: "awaiting_new_credential" }),
      credentialReceived: () => {
        rotationInterrupted = false;
        this.update({ step: "credential_received" });
      },
    };

    try {
      const result = await run(tracker);
      this.failures = 0;
      this.hold = null;
      this.update({ step: "ready", failure: null });
      return result;
    } catch (error) {
      let failure = classifyError(error, options.classify);
      if (failure === "credential_rejected" && rotationInterrupted) {
        failure = "credential_lost";
      }
      const step = this.record.step;
      this.fail(failure);
      log(
        "warn",
        "sync",
        `${this.label} : connexion en échec (${step}, ${failure})`
      );
      throw error;
    } finally {
      this.running = false;
      await this.saving;
    }
  }

  /** Avant chaque requête : aucune ne part tant que le service suspend cette adresse IP. */
  assertUsable(): void {
    if (this.held() === "suspended") {
      throw heldError("suspended");
    }
  }

  /** Le service a suspendu l'adresse IP pendant une requête, après la connexion. */
  reportSuspended(): void {
    // Une connexion en cours note elle-même son échec.
    if (!this.running) {
      this.fail("suspended");
      log("warn", "sync", `${this.label} : adresse IP suspendue`);
    }
  }

  /**
   * L'utilisateur redemande tout de suite (`Ctrl R`) : l'attente est levée, pas une suspension,
   * que le service impose et que réessayer prolongerait, ni un refus, que seule la reconnexion
   * lève (renvoyer le même jeton compte comme une erreur d'authentification de plus).
   */
  allowRetry(): void {
    if (
      this.hold &&
      this.hold.failure !== "suspended" &&
      !RELINK.includes(this.hold.failure)
    ) {
      this.hold = null;
    }
  }
}
