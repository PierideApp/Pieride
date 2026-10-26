import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDb } from "@/database/client";
import { migrate } from "@/database/migrate";
import { nodeDriver } from "@/database/node-driver";
import { courses, grades, services, syncState } from "@/database/schema";
import { allowInstance } from "@/lib/http";
import { deleteSecret, getSecret, setSecret } from "@/lib/keyring";

import { AccountManager, weekStart } from "./account-manager";
import { AuthenticationError, ServiceUnavailable } from "./shared/errors";
import type { Course } from "./shared/models";
import type { CapabilityMethods, SchoolServicePlugin } from "./shared/plugin";

const secrets = vi.hoisted(() => new Map<string, string>());
vi.mock("@/lib/keyring", () => ({
  getSecret: vi.fn(async (id: string) => secrets.get(id) ?? null),
  setSecret: vi.fn(
    async (id: string, value: string) => void secrets.set(id, value)
  ),
  deleteSecret: vi.fn(async (id: string) => void secrets.delete(id)),
}));
vi.mock("@/lib/http", () => ({ allowInstance: vi.fn(async () => undefined) }));

// Lundi 26 octobre 2026, 10 h : la semaine va du 26 au 2 novembre.
const NOW = new Date(2026, 9, 26, 10);
const at = (day: number, hour: number) => new Date(2026, 9, day, hour);

function course(id: string, from: Date): Course {
  return { id, subject: "Maths", from, to: from };
}

let timetable: CapabilityMethods["TIMETABLE"]["getWeeklyTimetable"];
let gradesPeriods: CapabilityMethods["GRADES"]["getGradesPeriods"];
const connect = vi.fn(async (): Promise<SchoolServicePlugin> => ({
  kind: "pronote",
  capabilities: {
    TIMETABLE: { getWeeklyTimetable: weekStart => timetable(weekStart) },
    GRADES: {
      getGradesPeriods: () => gradesPeriods(),
      getGradesForPeriod: async period => [
        {
          id: `note-${period.id}`,
          subject: "Maths",
          periodId: period.id,
          title: "Contrôle",
          date: period.start,
          value: 15,
          outOf: 20,
          coefficient: 1,
          bonus: false,
          optional: false,
        },
      ],
    },
  },
}));

async function setup() {
  const driver = nodeDriver();
  await migrate(driver);
  const db = createDb(driver);
  const manager = new AccountManager(db, { pronote: connect, mock: connect });
  await manager.addAccount({
    id: "camille",
    firstName: "Camille",
    lastName: "Test",
  });
  await manager.linkService(
    {
      id: "pronote-1",
      accountId: "camille",
      kind: "pronote",
      instanceUrl: "https://0000000a.index-education.net/pronote/",
    },
    "jeton"
  );
  return { db, manager };
}

beforeEach(() => {
  secrets.clear();
  connect.mockClear();
  vi.mocked(allowInstance).mockClear();
  timetable = async () => [
    course("lundi", at(26, 8)),
    course("mardi", at(27, 9)),
  ];
  gradesPeriods = async () => [
    { id: "t1", name: "Trimestre 1", start: at(1, 0), end: at(30, 0) },
  ];
});

describe("weekStart", () => {
  it("renvoie le lundi 0 h, même un dimanche ou un jour de changement d'heure", () => {
    expect(weekStart(new Date(2026, 10, 1, 23))).toEqual(new Date(2026, 9, 26));
    expect(weekStart(new Date(2026, 9, 25, 12))).toEqual(new Date(2026, 9, 19));
    expect(weekStart(new Date(2026, 9, 26))).toEqual(new Date(2026, 9, 26));
  });
});

describe("AccountManager", () => {
  it("lie un service : adresse ouverte, secret dans le trousseau, rien en base", async () => {
    const { db } = await setup();
    expect(allowInstance).toHaveBeenCalledWith(
      "https://0000000a.index-education.net/pronote/"
    );
    expect(secrets.get("pronote-1")).toBe("jeton");
    expect(JSON.stringify(await db.select().from(services))).not.toContain(
      "jeton"
    );
  });

  it("enregistre l'emploi du temps de la semaine et remplace l'ancien", async () => {
    const { db, manager } = await setup();
    await manager.refresh("camille", "TIMETABLE", NOW);
    timetable = async () => [
      course("mardi", at(27, 10)),
      course("semaine-suivante", at(3, 8)),
    ];
    await manager.refresh("camille", "TIMETABLE", NOW);

    const stored = await db.select().from(courses);
    expect(stored.map(c => [c.id, c.from])).toEqual([["mardi", at(27, 10)]]);
    expect(await db.select().from(syncState)).toEqual([
      {
        serviceId: "pronote-1",
        capability: "TIMETABLE",
        lastSync: NOW,
        lastError: null,
      },
    ]);
    expect(connect).toHaveBeenCalledOnce();
  });

  it("garde le cache quand le service est en panne", async () => {
    const { db, manager } = await setup();
    await manager.refresh("camille", "TIMETABLE", NOW);
    timetable = async () => {
      throw new ServiceUnavailable("Requête impossible : https://exemple.fr");
    };
    await manager.refresh("camille", "TIMETABLE", NOW);

    expect(await db.select().from(courses)).toHaveLength(2);
    const [state] = await db.select().from(syncState);
    expect(state).toMatchObject({
      lastSync: NOW,
      lastError: "ServiceUnavailable",
    });
  });

  it("marque le service à reconnecter et ne note que le type d'erreur", async () => {
    const { db, manager } = await setup();
    timetable = async () => {
      throw new AuthenticationError("jeton expiré : abc123");
    };
    await manager.refresh("camille", "TIMETABLE", NOW);
    await manager.refresh("camille", "TIMETABLE", NOW);

    const [service] = await db.select().from(services);
    expect(service?.needsLogin).toBe(true);
    const [state] = await db.select().from(syncState);
    expect(state?.lastError).toBe("AuthenticationError");
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it("ignore un service qui ne fournit pas la capability", async () => {
    const { db, manager } = await setup();
    await manager.refresh("camille", "HOMEWORK", NOW);
    expect(await db.select().from(syncState)).toEqual([]);
  });

  it("synchronise les notes de chaque période", async () => {
    const { db, manager } = await setup();
    gradesPeriods = async () => [
      { id: "t1", name: "T1", start: at(1, 0), end: at(30, 0) },
      { id: "t2", name: "T2", start: at(31, 0), end: at(31, 0) },
    ];
    await manager.refreshAll("camille", NOW);
    expect((await db.select().from(grades)).map(g => g.id)).toEqual([
      "note-t1",
      "note-t2",
    ]);
  });

  it("retire un compte : secrets puis données", async () => {
    const { db, manager } = await setup();
    await manager.refresh("camille", "TIMETABLE", NOW);
    await manager.removeAccount("camille");
    expect(secrets.size).toBe(0);
    expect(await db.select().from(services)).toEqual([]);
    expect(await db.select().from(courses)).toEqual([]);
  });

  it("ne garde pas de service si le trousseau refuse le secret", async () => {
    const { db, manager } = await setup();
    vi.mocked(setSecret).mockRejectedValueOnce("keyring_unavailable");
    await expect(
      manager.linkService(
        { id: "turboself-1", accountId: "camille", kind: "turboself" },
        "mot de passe"
      )
    ).rejects.toBe("keyring_unavailable");
    expect((await db.select().from(services)).map(s => s.id)).toEqual([
      "pronote-1",
    ]);
  });

  it("lie et délie un service sans identifiants sans toucher au trousseau", async () => {
    const { db, manager } = await setup();
    await manager.linkService({
      id: "mock-1",
      accountId: "camille",
      kind: "mock",
    });
    await manager.refresh("camille", "TIMETABLE", NOW);
    const ofMock = async () =>
      (await db.select().from(courses)).filter(c => c.serviceId === "mock-1");
    expect(await ofMock()).toHaveLength(2);

    await manager.unlinkService("mock-1");
    expect(await ofMock()).toEqual([]);
    expect((await db.select().from(services)).map(s => s.id)).toEqual([
      "pronote-1",
    ]);
    for (const keyring of [getSecret, setSecret, deleteSecret]) {
      expect(keyring).not.toHaveBeenCalledWith("mock-1");
    }
  });

  it("refuse de lier sans secret un service qui en demande un", async () => {
    const { db, manager } = await setup();
    await expect(
      manager.linkService({ id: "izly-1", accountId: "camille", kind: "izly" })
    ).rejects.toBeInstanceOf(AuthenticationError);
    expect((await db.select().from(services)).map(s => s.id)).toEqual([
      "pronote-1",
    ]);
  });

  it("efface les données même si le trousseau est indisponible", async () => {
    const { db, manager } = await setup();
    await manager.refresh("camille", "TIMETABLE", NOW);
    vi.mocked(deleteSecret).mockRejectedValueOnce("keyring_unavailable");
    expect(await manager.removeAccount("camille")).toEqual(["pronote-1"]);
    expect(await db.select().from(services)).toEqual([]);
    expect(await db.select().from(courses)).toEqual([]);
  });

  it("distingue un service non pris en charge d'une panne", async () => {
    const { db, manager } = await setup();
    await manager.linkService(
      { id: "izly-1", accountId: "camille", kind: "izly" },
      "jeton"
    );
    await manager.refresh("camille", "TIMETABLE", NOW);
    const states = await db.select().from(syncState);
    expect(states.find(s => s.serviceId === "izly-1")?.lastError).toBe(
      "UnsupportedService"
    );
  });

  it("garde « à reconnecter » quand une panne suit un refus d'identifiants", async () => {
    const { db, manager } = await setup();
    timetable = async () => {
      throw new AuthenticationError("refusé");
    };
    await manager.refresh("camille", "TIMETABLE", NOW);
    timetable = async () => {
      throw new ServiceUnavailable("injoignable");
    };
    await manager.refresh("camille", "TIMETABLE", NOW);
    const [service] = await db.select().from(services);
    expect(service?.needsLogin).toBe(true);
  });

  it("garde le dimanche soir dans la semaine du changement d'heure", async () => {
    const { db, manager } = await setup();
    // Le 25 octobre 2026 dure 25 h à Paris : une semaine n'y fait pas 7 × 24 h.
    timetable = async () => [course("dimanche", new Date(2026, 9, 25, 23, 30))];
    await manager.refresh("camille", "TIMETABLE", new Date(2026, 9, 21));
    expect((await db.select().from(courses)).map(c => c.id)).toEqual([
      "dimanche",
    ]);
  });

  it("rouvre au démarrage l'adresse des services enregistrés", async () => {
    const { manager } = await setup();
    vi.mocked(allowInstance).mockClear();
    await manager.start();
    expect(allowInstance).toHaveBeenCalledOnce();
  });
});
