import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type AuthFailure,
  type AuthRecord,
  type AuthTracker,
  ServiceAuth,
  SUSPENSION_COOLDOWN,
} from "./auth";
import { AuthenticationError, ServiceUnavailable } from "./errors";

const ROTATES = { rotatesCredential: true };

let saved: AuthRecord[];
const save = vi.fn(async (record: AuthRecord) => {
  saved.push(record);
});

function auth(record: AuthRecord = { step: null, failure: null }) {
  return new ServiceAuth("pronote", record, save);
}

const fails = (error: Error) => async () => {
  throw error;
};

beforeEach(() => {
  saved = [];
  save.mockClear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ServiceAuth", () => {
  it("écrit chaque étape en base, dans l'ordre", async () => {
    await auth().login(ROTATES, async tracker => {
      tracker.credentialSent();
      tracker.awaitingNewCredential();
      tracker.credentialReceived();
    });
    expect(saved.map(record => record.step)).toEqual([
      "starting",
      "credential_sent",
      "awaiting_new_credential",
      "credential_received",
      "ready",
    ]);
  });

  it("ne renvoie pas un jeton refusé avant la reconnexion", async () => {
    const service = auth();
    const run = vi.fn(fails(new AuthenticationError("refusé")));
    await expect(service.login(ROTATES, run)).rejects.toThrow(
      AuthenticationError
    );
    vi.advanceTimersByTime(60 * 60_000);
    await expect(service.login(ROTATES, run)).rejects.toThrow(
      AuthenticationError
    );
    expect(run).toHaveBeenCalledOnce();
    expect(saved.at(-1)).toEqual({
      step: "failed",
      failure: "credential_rejected",
    });
  });

  it("classe en jeton perdu un refus après une connexion coupée au point de non-retour", async () => {
    await expect(
      auth({ step: "awaiting_new_credential", failure: null }).login(
        ROTATES,
        fails(new AuthenticationError("refusé"))
      )
    ).rejects.toThrow(AuthenticationError);
    expect(saved.at(-1)?.failure).toBe("credential_lost");
  });

  it("classe en jeton perdu un refus après un essai coupé au point de non-retour", async () => {
    const run = async (tracker: AuthTracker) => {
      tracker.credentialSent();
      tracker.awaitingNewCredential();
      // Panne passagère, puis nouvel essai avec l'ancien jeton.
      tracker.credentialSent();
      throw new AuthenticationError("refusé");
    };
    await expect(auth().login(ROTATES, run)).rejects.toThrow();
    expect(saved.at(-1)?.failure).toBe("credential_lost");
  });

  it("garde le refus ordinaire quand le nouveau jeton est arrivé", async () => {
    await expect(
      auth({ step: "credential_received", failure: null }).login(
        ROTATES,
        fails(new AuthenticationError("refusé"))
      )
    ).rejects.toThrow();
    expect(saved.at(-1)?.failure).toBe("credential_rejected");
  });

  it("n'envoie plus rien pendant une suspension, même après Ctrl R", async () => {
    const service = auth();
    const run = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("bloqué"))
      .mockResolvedValue("session");
    const classify = (): AuthFailure => "suspended";
    await expect(
      service.login({ rotatesCredential: true, classify }, run)
    ).rejects.toThrow("bloqué");

    service.allowRetry();
    expect(() => service.assertUsable()).toThrow(ServiceUnavailable);
    await expect(service.login(ROTATES, run)).rejects.toThrow(
      ServiceUnavailable
    );
    expect(run).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(SUSPENSION_COOLDOWN);
    service.assertUsable();
    await expect(service.login(ROTATES, run)).resolves.toBe("session");
  });

  it("note une suspension reçue pendant une requête", async () => {
    const service = auth();
    service.reportSuspended();
    expect(() => service.assertUsable()).toThrow(ServiceUnavailable);
    await vi.waitFor(() =>
      expect(saved.at(-1)).toEqual({ step: "failed", failure: "suspended" })
    );
  });

  it("attend de plus en plus longtemps après une panne, sauf après Ctrl R", async () => {
    const service = auth();
    const run = vi.fn(fails(new ServiceUnavailable("panne")));
    await expect(service.login(ROTATES, run)).rejects.toThrow();
    vi.advanceTimersByTime(29_000);
    await expect(service.login(ROTATES, run)).rejects.toThrow(
      "Nouvel essai dans un moment"
    );
    vi.advanceTimersByTime(1000);
    await expect(service.login(ROTATES, run)).rejects.toThrow("panne");
    // Deuxième échec : une minute.
    vi.advanceTimersByTime(30_000);
    await expect(service.login(ROTATES, run)).rejects.toThrow(
      "Nouvel essai dans un moment"
    );
    expect(run).toHaveBeenCalledTimes(2);

    service.allowRetry();
    await expect(service.login(ROTATES, run)).rejects.toThrow("panne");
    expect(run).toHaveBeenCalledTimes(3);
  });

  it("repart de zéro après une connexion réussie", async () => {
    const service = auth();
    await expect(
      service.login(ROTATES, fails(new ServiceUnavailable("panne")))
    ).rejects.toThrow();
    service.allowRetry();
    await service.login(ROTATES, async () => undefined);
    expect(saved.at(-1)).toEqual({ step: "ready", failure: null });
    await expect(
      service.login(ROTATES, fails(new ServiceUnavailable("panne")))
    ).rejects.toThrow();
    // Premier échec depuis la réussite : 30 secondes, pas une minute.
    vi.advanceTimersByTime(30_000);
    await expect(service.login(ROTATES, async () => "session")).resolves.toBe(
      "session"
    );
  });
});
