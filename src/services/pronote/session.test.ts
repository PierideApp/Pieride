import {
  AccountDisabledError,
  AccountKind,
  BadCredentialsError,
  loginToken,
  RateLimitedError,
  SecurityError,
  SessionExpiredError,
  SuspendedIPError,
  UnreachableError,
} from "@blockshub/pawnote-lts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type AuthRecord, ServiceAuth } from "@/services/shared/auth";
import {
  AuthenticationError,
  SecurityChallenge,
  ServiceUnavailable,
} from "@/services/shared/errors";
import type { LinkedService } from "@/services/shared/models";

import { connectPronote } from ".";
import {
  classifyPronoteError,
  parseSecret,
  type PronoteSecret,
  PronoteSession,
  RETRY_DELAY,
  SESSION_TTL,
  toServiceError,
} from "./session";

vi.mock("@/lib/http", () => ({ pronoteFetcher: vi.fn() }));
vi.mock("@blockshub/pawnote-lts", async original => ({
  ...(await original<typeof import("@blockshub/pawnote-lts")>()),
  createSessionHandle: vi.fn(() => ({
    user: { authorizations: { tabs: [] } },
  })),
  loginToken: vi.fn(),
}));
const login = vi.mocked(loginToken);

const SECRET: PronoteSecret = {
  url: "https://0000000a.index-education.net/pronote",
  username: "camille",
  token: "jeton-0",
  deviceUUID: "appareil",
  kind: AccountKind.STUDENT,
};

let saved: PronoteSecret[];
const saveSecret = vi.fn(async (text: string) => {
  const secret = parseSecret(text);
  if (secret) {
    saved.push(secret);
  }
});

let steps: AuthRecord[];
let auth: ServiceAuth;
const session = () => new PronoteSession(SECRET, saveSecret, auth);

beforeEach(() => {
  saved = [];
  steps = [];
  auth = new ServiceAuth(
    "pronote",
    { step: null, failure: null },
    async record => void steps.push(record)
  );
  saveSecret.mockClear();
  login.mockReset();
  // Chaque connexion consomme le jeton et en donne un nouveau.
  login.mockImplementation(async (_handle, auth) => ({
    url: auth.url,
    username: auth.username,
    kind: auth.kind,
    token: `jeton-${login.mock.calls.length}`,
    navigatorIdentifier: "navigateur",
  }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("parseSecret", () => {
  it("relit ce que la session enregistre", () => {
    expect(parseSecret(JSON.stringify(SECRET))).toEqual(SECRET);
  });

  it.each([
    "pas du json",
    "null",
    JSON.stringify({ ...SECRET, token: 42 }),
    JSON.stringify({ ...SECRET, kind: AccountKind.TEACHER }),
    JSON.stringify({ url: SECRET.url }),
  ])("refuse %s", text => {
    expect(parseSecret(text)).toBeNull();
  });
});

/** Une connexion qui donne `token` puis échoue sur `ParametresUtilisateur`, comme le patch. */
function tokenThenFailure(token: string, error: Error) {
  login.mockImplementationOnce(async (_handle, params, hooks) => {
    hooks?.onCredentialSent?.();
    hooks?.onAuthenticationSent?.();
    hooks?.onTokenIssued?.({
      url: params.url,
      username: params.username,
      kind: params.kind,
      token,
      navigatorIdentifier: "navigateur",
    });
    throw error;
  });
}

describe("PronoteSession", () => {
  it("enregistre le nouveau jeton et s'en sert à la connexion suivante", async () => {
    vi.useFakeTimers();
    const pronote = session();
    await pronote.handle();
    vi.advanceTimersByTime(SESSION_TTL);
    await pronote.handle();

    expect(login.mock.calls.map(([, params]) => params.token)).toEqual([
      "jeton-0",
      "jeton-1",
    ]);
    expect(saved.map(secret => secret.token)).toEqual(["jeton-1", "jeton-2"]);
    expect(saved[0]).toMatchObject({
      deviceUUID: "appareil",
      navigatorIdentifier: "navigateur",
    });
  });

  it("garde le jeton donné avant que la fin de la connexion échoue", async () => {
    tokenThenFailure("jeton-neuf", new Error("coupure"));
    const pronote = session();
    await expect(pronote.handle()).rejects.toThrow("coupure");
    expect(saved.map(secret => secret.token)).toEqual(["jeton-neuf"]);
    expect(steps.map(record => record.step)).toContain("credential_received");

    auth.allowRetry();
    await pronote.handle();
    expect(login.mock.calls.at(-1)?.[1].token).toBe("jeton-neuf");
  });

  it("n'écrit le jeton qu'une fois quand le patch l'a déjà donné", async () => {
    login.mockImplementationOnce(async (_handle, params, hooks) => {
      const next = {
        url: params.url,
        username: params.username,
        kind: params.kind,
        token: "jeton-neuf",
        navigatorIdentifier: "navigateur",
      };
      hooks?.onTokenIssued?.(next);
      return next;
    });
    await session().handle();
    expect(saveSecret).toHaveBeenCalledOnce();
  });

  it("retente une fois une panne passagère", async () => {
    vi.useFakeTimers();
    login.mockRejectedValueOnce(new UnreachableError("Identification"));
    const handle = session().handle();
    await vi.advanceTimersByTimeAsync(RETRY_DELAY);
    await handle;
    expect(login).toHaveBeenCalledTimes(2);
  });

  it("ne renvoie pas un jeton refusé quand la session est refaite", async () => {
    login.mockRejectedValue(new BadCredentialsError());
    await expect(session().handle()).rejects.toThrow(AuthenticationError);
    // L'AccountManager refait le plugin, donc la session, pour chaque donnée.
    await expect(session().handle()).rejects.toThrow(AuthenticationError);
    expect(login).toHaveBeenCalledOnce();
    expect(saveSecret).not.toHaveBeenCalled();
  });

  it("garde la session ouverte et ne se connecte qu'une fois à la fois", async () => {
    const pronote = session();
    await Promise.all([pronote.handle(), pronote.handle()]);
    await pronote.handle();
    expect(login).toHaveBeenCalledOnce();
  });

  it("refait la session oubliée par PRONOTE et rejoue la requête", async () => {
    const pronote = session();
    const request = vi
      .fn()
      .mockRejectedValueOnce(new SessionExpiredError())
      .mockResolvedValueOnce("notes");
    await expect(pronote.run(request)).resolves.toBe("notes");
    expect(login).toHaveBeenCalledTimes(2);
  });

  it("n'envoie plus de requête après une suspension de l'adresse IP", async () => {
    const pronote = session();
    const request = vi.fn().mockRejectedValue(new SuspendedIPError());
    await expect(pronote.run(request)).rejects.toThrow(ServiceUnavailable);
    await expect(pronote.run(request)).rejects.toThrow(ServiceUnavailable);
    expect(request).toHaveBeenCalledOnce();
  });
});

describe("classifyPronoteError", () => {
  it.each([
    [new BadCredentialsError(), "credential_rejected"],
    [new AccountDisabledError(), "account_disabled"],
    [new SuspendedIPError(), "suspended"],
    [new RateLimitedError(), "suspended"],
    [Object.create(SecurityError.prototype), "security_challenge"],
    [new SessionExpiredError(), undefined],
  ])("classe %o", (error, expected) => {
    expect(classifyPronoteError(error)).toBe(expected);
  });
});

describe("toServiceError", () => {
  it.each([
    [Object.create(SecurityError.prototype), SecurityChallenge],
    [new BadCredentialsError(), AuthenticationError],
    [new SuspendedIPError(), ServiceUnavailable],
    [new SessionExpiredError(), ServiceUnavailable],
  ])("traduit %o", (error, expected) => {
    expect(toServiceError(error)).toBeInstanceOf(expected);
  });

  it("laisse passer les autres erreurs", () => {
    const error = new TypeError("bogue");
    expect(toServiceError(error)).toBe(error);
  });
});

describe("connectPronote", () => {
  const service: LinkedService = {
    id: "pronote-1",
    accountId: "camille",
    kind: "pronote",
  };

  it("refuse un secret illisible", async () => {
    await expect(
      connectPronote(service, "{}", saveSecret, auth)
    ).rejects.toThrow(AuthenticationError);
  });

  it("se connecte tout de suite pour vérifier le jeton", async () => {
    await connectPronote(service, JSON.stringify(SECRET), saveSecret, auth);
    expect(login).toHaveBeenCalledOnce();
  });
});
