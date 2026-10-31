// Session PRONOTE avec pawnote (@blockshub/pawnote-lts, GPLv3), comme Papillon
// (services/pronote/refresh.ts et errors.ts, GPLv3) : https://github.com/PapillonApp/Papillon
// Le mot de passe n'est jamais gardé. PRONOTE donne un jeton à usage unique, remplacé à chaque
// connexion : le trousseau garde le dernier, avec ce qui va avec (`PronoteSecret`).
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
  SecurityError,
  ServerSideError,
  SessionExpiredError,
  type SessionHandle,
  SuspendedIPError,
  UnreachableError,
} from "@blockshub/pawnote-lts";

import { pronoteFetcher } from "@/lib/http";
import {
  AuthenticationError,
  SecurityChallenge,
  ServiceUnavailable,
} from "@/services/shared/errors";

/** L'URL de l'instance de démonstration PRONOTE. */
const demoURL = "https://demo.index-education.net/pronote"

/** Au-delà, la session est refaite avant une requête : PRONOTE oublie les sessions inactives. */
export const SESSION_TTL = 5 * 60_000;

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
    console.error("PRONOTE : Échec de la connexion, une erreur de sécurité est survenue.", error)
    return new SecurityChallenge("PRONOTE demande une vérification");
  }
  if (
    error instanceof BadCredentialsError ||
    error instanceof AccessDeniedError ||
    error instanceof AccountDisabledError
  ) {
    console.error("PRONOTE : Échec de la connexion, PRONOTE a refusé l'authentification.", error)
    return new AuthenticationError("Une erreur d'authentification est survenue");
  }
  if (error instanceof SuspendedIPError || error instanceof RateLimitedError) {
    console.error("PRONOTE : Échec de la connexion, l'adresse IP a été temporairement bloquée.", error)
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
    console.error("PRONOTE : Échec de la connexion, l'instante PRONOTE ne semble pas être disponible.", error)
    return new ServiceUnavailable("PRONOTE est indisponible");
  }
  return error;
}

export class PronoteSession {
  private current: { handle: SessionHandle; openedAt: number } | null = null;
  private pending: Promise<SessionHandle> | null = null;

  constructor(
    private secret: PronoteSecret,
    private readonly saveSecret: (secret: string) => Promise<void>
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

  /** Lance une requête ; si PRONOTE a oublié la session, la refait et rejoue une fois. */
  async run<T>(request: (handle: SessionHandle) => Promise<T>): Promise<T> {
    try {
      return await request(await this.handle());
    } catch (error) {
      if (!(error instanceof SessionExpiredError)) {
        throw toServiceError(error);
      }
    }
    this.current = null;
    try {
      return await request(await this.handle());
    } catch (error) {
      throw toServiceError(error);
    }
  }

  private async loginDemo(): Promise<SessionHandle> {
    const handle = createSessionHandle(pronoteFetcher);
    try {
      const next = await loginCredentials(handle, {
        url: demoURL,
        kind: AccountKind.STUDENT,
        username: "demonstration",
        password: "pronotevs",
        deviceUUID: "0"
      })
      this.secret = {
        ...this.secret,
        url: next.url,
        username: next.username,
        token: next.token,
        kind: next.kind,
        navigatorIdentifier: next.navigatorIdentifier,
      };
    } catch (error) {
      throw toServiceError(error);
    }
    await this.saveSecret(JSON.stringify(this.secret));
    this.current = { handle, openedAt: Date.now() };
    return handle;
  }

  private async login(): Promise<SessionHandle> {
    const { url, kind, username, token, deviceUUID, navigatorIdentifier } =
      this.secret;
    if(url === demoURL) { return this.loginDemo(); };
    const handle = createSessionHandle(pronoteFetcher);
    try {
      const next = await loginToken(handle, {
        url,
        kind,
        username,
        token,
        deviceUUID,
        navigatorIdentifier,
      });
      this.secret = {
        ...this.secret,
        url: next.url,
        username: next.username,
        token: next.token,
        kind: next.kind,
        navigatorIdentifier: next.navigatorIdentifier,
      };
    } catch (error) {
      throw toServiceError(error);
    }
    // ponytail: si la connexion échoue après que PRONOTE a donné le nouveau jeton, il est
    // perdu et il faut se reconnecter. Papillon le récupère plus tôt avec un patch de pawnote.
    await this.saveSecret(JSON.stringify(this.secret));
    this.current = { handle, openedAt: Date.now() };
    return handle;
  }
}
