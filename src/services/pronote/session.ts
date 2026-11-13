// Session PRONOTE avec pawnote (@blockshub/pawnote-lts, GPLv3), comme Papillon
// (services/pronote/refresh.ts et errors.ts, GPLv3) : https://github.com/PapillonApp/Papillon
// Le mot de passe n'est jamais gardé. PRONOTE donne un jeton à usage unique, remplacé à chaque
// connexion : le trousseau garde le dernier, avec ce qui va avec (`PronoteSecret`). Le patch de
// pawnote repris de Papillon (patches/) donne ce jeton avant la dernière requête de la connexion.
import {
  AccessDeniedError,
  AccountDisabledError,
  AccountKind,
  AuthenticateError,
  BadCredentialsError,
  BusyPageError,
  createSessionHandle,
  loginCredentials,
  loginToken,
  PageUnavailableError,
  RateLimitedError,
  type RefreshInformation,
  SecurityError,
  ServerSideError,
  SessionExpiredError,
  type SessionHandle,
  SuspendedIPError,
  UnreachableError,
} from "@blockshub/pawnote-lts";

import { devExchange, devResult } from "@/lib/devlog";
import { pronoteFetcher } from "@/lib/http";
import type {
  AuthFailure,
  AuthTracker,
  ServiceAuth,
} from "@/services/shared/auth";
import {
  AuthenticationError,
  SecurityChallenge,
  ServiceUnavailable,
} from "@/services/shared/errors";

/** L'instance de démonstration publique de PRONOTE et son compte élève, publics eux aussi. */
export const DEMO_URL = "https://demo.index-education.net/pronote";
export const DEMO_CREDENTIALS = {
  username: "demonstration",
  password: "pronotevs",
};

/** Au-delà, la session est refaite avant une requête : PRONOTE oublie les sessions inactives. */
export const SESSION_TTL = 5 * 60_000;

/** Une connexion coupée par une panne passagère est retentée une fois, après ce délai. */
export const RETRY_DELAY = 2000;

/**
 * Une session pawnote neuve. Sous `pnpm tauri dev`, chaque échange déchiffré va à la console
 * (`onExchange`, ajouté par notre patch de pawnote ; lib/devlog.ts).
 */
export function createHandle(): SessionHandle {
  const handle = createSessionHandle(pronoteFetcher);
  if (import.meta.env.DEV) {
    handle.onExchange = devExchange;
  }
  return handle;
}

/** Ce que le trousseau garde d'un compte PRONOTE. */
export interface PronoteSecret {
  url: string;
  username: string;
  token: string;
  /** Le jeton ne vaut que pour cet appareil. */
  deviceUUID: string;
  kind: AccountKind;
  navigatorIdentifier?: string;
}

/** Le secret lu dans le trousseau, ou `null` s'il est illisible. */
export function parseSecret(text: string): PronoteSecret | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const fields: Partial<Record<keyof PronoteSecret, unknown>> = value;
  const { url, username, token, deviceUUID, kind, navigatorIdentifier } =
    fields;
  if (
    typeof url !== "string" ||
    typeof username !== "string" ||
    typeof token !== "string" ||
    typeof deviceUUID !== "string" ||
    (kind !== AccountKind.STUDENT && kind !== AccountKind.PARENT) ||
    (navigatorIdentifier !== undefined &&
      typeof navigatorIdentifier !== "string")
  ) {
    return null;
  }
  return { url, username, token, deviceUUID, kind, navigatorIdentifier };
}

/**
 * Traduit une erreur de pawnote en erreur des services, avec un message fixe : celui de
 * pawnote peut reprendre une réponse du serveur. Les autres erreurs passent telles quelles.
 */
export function toServiceError(error: unknown): unknown {
  if (error instanceof SecurityError) {
    console.error(
      "PRONOTE : Échec de la connexion, une erreur de sécurité est survenue.",
      error
    );
    return new SecurityChallenge("PRONOTE demande une vérification");
  }
  if (
    error instanceof BadCredentialsError ||
    error instanceof AccessDeniedError ||
    error instanceof AccountDisabledError
  ) {
    console.error(
      "PRONOTE : Échec de la connexion, PRONOTE a refusé l'authentification.",
      error
    );
    return new AuthenticationError(
      "Une erreur d'authentification est survenue"
    );
  }
  if (error instanceof SuspendedIPError || error instanceof RateLimitedError) {
    console.error(
      "PRONOTE : Échec de la connexion, l'adresse IP a été temporairement bloquée.",
      error
    );
    return new ServiceUnavailable(
      "Ton adresse IP a été bloquée de manière temporaire par PRONOTE"
    );
  }
  // Fermeture, maintenance, page indisponible : le jeton reste bon.
  if (
    error instanceof AuthenticateError ||
    error instanceof BusyPageError ||
    error instanceof PageUnavailableError ||
    error instanceof ServerSideError ||
    error instanceof SessionExpiredError ||
    error instanceof UnreachableError
  ) {
    console.error(
      "PRONOTE : Échec de la connexion, l'instante PRONOTE ne semble pas être disponible.",
      error
    );
    return new ServiceUnavailable("PRONOTE est indisponible");
  }
  return error;
}

/**
 * La raison d'un échec de connexion (Papillon : services/pronote/errors.ts). Fermeture,
 * maintenance ou session oubliée sont laissées aux règles communes : le jeton reste bon.
 */
export function classifyPronoteError(error: unknown): AuthFailure | undefined {
  if (error instanceof SecurityError) {
    return "security_challenge";
  }
  // Papillon laisse `RateLimitedError` à l'attente ordinaire, mais c'est aussi un blocage de
  // l'adresse IP : réessayer avant quelques minutes le prolongerait.
  if (error instanceof SuspendedIPError || error instanceof RateLimitedError) {
    return "suspended";
  }
  if (
    error instanceof AccessDeniedError ||
    error instanceof AccountDisabledError
  ) {
    return "account_disabled";
  }
  if (error instanceof BadCredentialsError) {
    return "credential_rejected";
  }
  return undefined;
}

/** Les pannes passagères, qu'on peut retenter sans risque pour le jeton. */
const isSafeToRetry = (error: unknown) =>
  error instanceof UnreachableError ||
  error instanceof BusyPageError ||
  error instanceof PageUnavailableError;

export class PronoteSession {
  private current: { handle: SessionHandle; openedAt: number } | null = null;
  private pending: Promise<SessionHandle> | null = null;

  constructor(
    private secret: PronoteSecret,
    private readonly saveSecret: (secret: string) => Promise<void>,
    private readonly auth: ServiceAuth
  ) {}

  /** La session ouverte, refaite après `SESSION_TTL`. */
  handle(): Promise<SessionHandle> {
    if (this.current && Date.now() - this.current.openedAt < SESSION_TTL) {
      return Promise.resolve(this.current.handle);
    }
    // Une seule connexion à la fois : le jeton ne sert qu'une fois.
    this.pending ??= this.login().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  /**
   * Lance une requête ; si PRONOTE a oublié la session, la refait et rejoue une fois (il a
   * refusé la requête, rien n'a été écrit). Aucune ne part tant que l'adresse IP est suspendue.
   */
  async run<T>(request: (handle: SessionHandle) => Promise<T>): Promise<T> {
    try {
      return await this.request(request);
    } catch (error) {
      if (!(error instanceof SessionExpiredError)) {
        throw toServiceError(error);
      }
    }
    this.current = null;
    try {
      return await this.request(request);
    } catch (error) {
      throw toServiceError(error);
    }
  }

  private async request<T>(
    request: (handle: SessionHandle) => Promise<T>
  ): Promise<T> {
    this.auth.assertUsable();
    const handle = await this.handle();
    try {
      const result = await request(handle);
      // Seulement sous `pnpm tauri dev` (lib/devlog.ts), juste après les requêtes dans la console.
      if (import.meta.env.DEV) {
        devResult("pronote", result);
      }
      return result;
    } catch (error) {
      if (
        error instanceof SuspendedIPError ||
        error instanceof RateLimitedError
      ) {
        this.auth.reportSuspended();
      }
      throw error;
    }
  }

  private async login(): Promise<SessionHandle> {
    const demo = this.secret.url === DEMO_URL;
    try {
      const handle = await this.auth.login(
        { rotatesCredential: !demo, classify: classifyPronoteError },
        async tracker => {
          for (let attempt = 1; ; attempt++) {
            try {
              return await (demo
                ? this.loginDemo()
                : this.loginWithToken(tracker));
            } catch (error) {
              if (attempt === 2 || !isSafeToRetry(error)) {
                throw error;
              }
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            }
          }
        }
      );
      this.current = { handle, openedAt: Date.now() };
      return handle;
    } catch (error) {
      throw toServiceError(error);
    }
  }

  /** Garde le jeton donné par PRONOTE, en mémoire puis dans le trousseau. */
  private keep(next: RefreshInformation): Promise<void> {
    this.secret = {
      ...this.secret,
      url: next.url,
      username: next.username,
      token: next.token,
      kind: next.kind,
      navigatorIdentifier: next.navigatorIdentifier,
    };
    return this.saveSecret(JSON.stringify(this.secret));
  }

  private async loginDemo(): Promise<SessionHandle> {
    const handle = createHandle();
    const next = await loginCredentials(handle, {
      url: DEMO_URL,
      kind: AccountKind.STUDENT,
      ...DEMO_CREDENTIALS,
      deviceUUID: "0",
    });
    await this.keep(next);
    return handle;
  }

  private async loginWithToken(tracker: AuthTracker): Promise<SessionHandle> {
    const { url, kind, username, token, deviceUUID, navigatorIdentifier } =
      this.secret;
    const handle = createHandle();
    const saving: Promise<void>[] = [];
    const received = (next: RefreshInformation) => {
      saving.push(this.keep(next).then(tracker.credentialReceived));
    };
    try {
      const next = await loginToken(
        handle,
        { url, kind, username, token, deviceUUID, navigatorIdentifier },
        {
          onCredentialSent: tracker.credentialSent,
          onAuthenticationSent: tracker.awaitingNewCredential,
          // Enregistré avant `ParametresUtilisateur` : si cette requête échoue, la connexion
          // suivante a quand même un jeton valable.
          onTokenIssued: information => {
            if (information.token) {
              received(information);
            }
          },
        }
      );
      if (next.token !== this.secret.token) {
        received(next);
      }
    } finally {
      // Même en échec : le jeton reçu en route doit être écrit avant d'aller plus loin.
      await Promise.all(saving);
    }
    return handle;
  }
}
