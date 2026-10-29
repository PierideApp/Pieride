import {
  AccountKind,
  BadCredentialsError,
  loginToken,
  SecurityError,
  SessionExpiredError,
  SuspendedIPError,
} from "@blockshub/pawnote-lts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AuthenticationError,
  SecurityChallenge,
  ServiceUnavailable,
} from "@/services/shared/errors";
import type { LinkedService } from "@/services/shared/models";

import { connectPronote } from ".";
import {
  parseSecret,
  type PronoteSecret,
  PronoteSession,
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

beforeEach(() => {
  saved = [];
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

describe("PronoteSession", () => {
  it("enregistre le nouveau jeton et s'en sert à la connexion suivante", async () => {
    vi.useFakeTimers();
    const session = new PronoteSession(SECRET, saveSecret);
    await session.handle();
    vi.advanceTimersByTime(SESSION_TTL);
    await session.handle();

    expect(login.mock.calls.map(([, auth]) => auth.token)).toEqual([
      "jeton-0",
      "jeton-1",
    ]);
    expect(saved.map(secret => secret.token)).toEqual(["jeton-1", "jeton-2"]);
    expect(saved[0]).toMatchObject({
      deviceUUID: "appareil",
      navigatorIdentifier: "navigateur",
    });
  });

  it("garde la session ouverte et ne se connecte qu'une fois à la fois", async () => {
    const session = new PronoteSession(SECRET, saveSecret);
    await Promise.all([session.handle(), session.handle()]);
    await session.handle();
    expect(login).toHaveBeenCalledOnce();
  });

  it("refait la session oubliée par PRONOTE et rejoue la requête", async () => {
    const session = new PronoteSession(SECRET, saveSecret);
    const request = vi
      .fn()
      .mockRejectedValueOnce(new SessionExpiredError())
      .mockResolvedValueOnce("notes");
    await expect(session.run(request)).resolves.toBe("notes");
    expect(login).toHaveBeenCalledTimes(2);
  });

  it("traduit un refus en erreur des services", async () => {
    login.mockRejectedValue(new BadCredentialsError());
    const session = new PronoteSession(SECRET, saveSecret);
    await expect(session.handle()).rejects.toThrow(AuthenticationError);
    expect(saveSecret).not.toHaveBeenCalled();
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
    await expect(connectPronote(service, "{}", saveSecret)).rejects.toThrow(
      AuthenticationError
    );
  });

  it("se connecte tout de suite pour vérifier le jeton", async () => {
    await connectPronote(service, JSON.stringify(SECRET), saveSecret);
    expect(login).toHaveBeenCalledOnce();
  });
});
