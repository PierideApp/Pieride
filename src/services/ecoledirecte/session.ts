import {
  type Account,
  Client,
  Invalid2FAKey,
  InvalidCredentials,
  Require2FA,
} from "@blockshub/blocksdirecte";

import {
  AuthenticationError,
  SecurityChallenge,
  ServiceUnavailable,
} from "../shared/errors";

/** Jeton de renouvellement et identifiant du profil, conservés uniquement dans le trousseau. */
export interface EcoledirecteSecret {
  username: string;
  accessToken: string;
  accountId: number;
  accountKind: Account["typeCompte"];
  deviceUUID: string;
}

export interface EcoledirecteLogin {
  secret: EcoledirecteSecret;
  account: Account;
}

export interface TwoFactorChallenge {
  question: string;
  propositions: string[];
  finish(answer: string): Promise<EcoledirecteLogin>;
}

export class InvalidSecurityAnswer extends Error {
  name = "InvalidSecurityAnswer";
}

export type LoginResult =
  | { kind: "login"; login: EcoledirecteLogin }
  | { kind: "challenge"; challenge: TwoFactorChallenge };

/** L'ÉcoleDirecte utilise des appels Buffer, alors que Piéride tourne dans une WebView. */
function installBufferPolyfill(): void {
  type EncodedBuffer = { toString(encoding?: string): string };
  type BufferConstructor = {
    from(value: string, encoding?: string): EncodedBuffer;
  };
  const runtime = globalThis as unknown as {
    Buffer?: BufferConstructor;
  };
  if (runtime.Buffer) {
    return;
  }
  runtime.Buffer = {
    from(value: string, encoding?: string) {
      const bytes =
        encoding === "base64"
          ? Uint8Array.from(atob(value), character => character.charCodeAt(0))
          : new TextEncoder().encode(value);
      return {
        toString(outputEncoding?: string) {
          if (outputEncoding !== "base64") {
            return new TextDecoder().decode(bytes);
          }
          let binary = "";
          for (let index = 0; index < bytes.length; index += 0x8000) {
            binary += String.fromCharCode(
              ...bytes.subarray(index, index + 0x8000)
            );
          }
          return btoa(binary);
        },
      };
    },
  };
}

installBufferPolyfill();

export function parseEcoledirecteSecret(
  value: string
): EcoledirecteSecret | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  if (
    !("username" in parsed) ||
    typeof parsed.username !== "string" ||
    !parsed.username.trim() ||
    !("accessToken" in parsed) ||
    typeof parsed.accessToken !== "string" ||
    !parsed.accessToken ||
    !("accountId" in parsed) ||
    typeof parsed.accountId !== "number" ||
    !Number.isSafeInteger(parsed.accountId) ||
    !("accountKind" in parsed) ||
    !isAccountKind(parsed.accountKind) ||
    !("deviceUUID" in parsed) ||
    typeof parsed.deviceUUID !== "string" ||
    !parsed.deviceUUID
  ) {
    return null;
  }
  return {
    username: parsed.username,
    accessToken: parsed.accessToken,
    accountId: parsed.accountId,
    accountKind: parsed.accountKind,
    deviceUUID: parsed.deviceUUID,
  };
}

function isAccountKind(value: unknown): value is Account["typeCompte"] {
  return (
    value === "E" ||
    value === "1" ||
    value === "2" ||
    value === "A" ||
    value === "P"
  );
}

function selectedAccount(client: Client, accounts: Account[]): Account {
  const index = accounts.findIndex(
    account => String(account.typeCompte) === "E"
  );
  if (index < 0) {
    throw new AuthenticationError(
      "Aucun profil élève n'est associé à ce compte ÉcoleDirecte"
    );
  }
  client.auth.setAccount(index);
  return client.auth.getAccount();
}

function finishLogin(
  client: Client,
  username: string,
  deviceUUID: string,
  accounts: Account[]
): EcoledirecteLogin {
  const account = selectedAccount(client, accounts);
  return {
    account,
    secret: {
      username,
      accessToken: account.accessToken,
      accountId: account.id,
      accountKind: account.typeCompte,
      deviceUUID,
    },
  };
}

/** Connexion initiale, avec question de sécurité ÉcoleDirecte si elle est demandée. */
export async function loginEcoledirecte(
  username: string,
  password: string,
  deviceUUID = crypto.randomUUID()
): Promise<LoginResult> {
  const client = new Client();
  try {
    const result = await client.auth.loginUsername(
      username.trim(),
      password,
      undefined,
      undefined,
      true,
      deviceUUID
    );
    return {
      kind: "login",
      login: finishLogin(client, username.trim(), deviceUUID, result.accounts),
    };
  } catch (error) {
    if (!(error instanceof Require2FA)) {
      throw toEcoledirecteError(error);
    }
    try {
      const question = await client.auth.get2FAQuestion(error.token);
      return {
        kind: "challenge",
        challenge: {
          question: question.question,
          propositions: question.propositions,
          finish: async answer => {
            try {
              const keys = await client.auth.send2FAQuestion(
                answer,
                error.token
              );
              const result = await client.auth.loginUsername(
                username.trim(),
                password,
                keys.cn,
                keys.cv,
                true,
                deviceUUID
              );
              return finishLogin(
                client,
                username.trim(),
                deviceUUID,
                result.accounts
              );
            } catch (failure) {
              throw toEcoledirecteError(failure);
            }
          },
        },
      };
    } catch (failure) {
      throw toEcoledirecteError(failure);
    }
  }
}

/** Traduit les erreurs de la bibliothèque sans remonter de réponse qui pourrait contenir un jeton. */
export function toEcoledirecteError(error: unknown): Error {
  if (
    error instanceof AuthenticationError ||
    error instanceof SecurityChallenge
  ) {
    return error;
  }
  if (error instanceof InvalidCredentials) {
    return new AuthenticationError("ÉcoleDirecte a refusé les identifiants");
  }
  if (error instanceof Invalid2FAKey) {
    return new SecurityChallenge("La vérification ÉcoleDirecte a expiré");
  }
  if (error instanceof Error && error.name === "BadAnswer2FA") {
    return new InvalidSecurityAnswer(
      "La réponse à la question de sécurité est incorrecte"
    );
  }
  if (error instanceof Require2FA) {
    return new SecurityChallenge(
      "ÉcoleDirecte demande une nouvelle vérification"
    );
  }
  if (error instanceof ServiceUnavailable) {
    return error;
  }
  return new ServiceUnavailable("ÉcoleDirecte ne répond pas pour l'instant");
}

/** Client réutilisable pour une session; le jeton renouvelable tourne dans le trousseau. */
export class EcoledirecteSession {
  private account: Account | null = null;
  private refreshedAt = 0;
  private pendingRefresh: Promise<void> | null = null;

  constructor(
    readonly client: Client,
    private secret: EcoledirecteSecret,
    private readonly saveSecret: (secret: string) => Promise<void>
  ) {}

  get selectedAccount(): Account {
    if (!this.account) {
      throw new AuthenticationError(
        "La session ÉcoleDirecte n'est pas ouverte"
      );
    }
    return this.account;
  }

  async open(): Promise<void> {
    await this.ensureFresh();
  }

  async run<T>(request: (client: Client) => Promise<T>): Promise<T> {
    await this.ensureFresh();
    try {
      return await request(this.client);
    } catch (error) {
      throw toEcoledirecteError(error);
    }
  }

  private async ensureFresh(): Promise<void> {
    if (Date.now() - this.refreshedAt < 10 * 60_000) {
      return;
    }
    this.pendingRefresh ??= this.refresh().finally(() => {
      this.pendingRefresh = null;
    });
    await this.pendingRefresh;
  }

  private async refresh(): Promise<void> {
    try {
      const result = await this.client.auth.refreshToken(
        this.secret.username,
        this.secret.accountKind,
        this.secret.accessToken,
        undefined,
        undefined,
        this.secret.deviceUUID
      );
      const accountIndex = result.accounts.findIndex(
        account => account.id === this.secret.accountId
      );
      if (accountIndex < 0) {
        throw new AuthenticationError("Profil ÉcoleDirecte introuvable");
      }
      this.client.auth.setAccount(accountIndex);
      this.account = this.client.auth.getAccount();
      this.secret = { ...this.secret, accessToken: this.account.accessToken };
      await this.saveSecret(JSON.stringify(this.secret));
      this.refreshedAt = Date.now();
    } catch (error) {
      if (error instanceof Require2FA) {
        throw new AuthenticationError(
          "Reconnecte-toi à ton compte ÉcoleDirecte"
        );
      }
      throw toEcoledirecteError(error);
    }
  }
}
