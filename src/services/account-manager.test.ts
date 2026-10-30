import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDb } from "@/database/client";
import { migrate } from "@/database/migrate";
import { nodeDriver } from "@/database/node-driver";
import {
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
import { addDays } from "@/lib/week";

import {
  AccountManager,
  MANUAL_SYNC_INTERVAL,
  SYNC_INTERVAL,
} from "./account-manager";
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
/** Assez tard pour que la synchro de `NOW` soit à refaire. */
const LATER = new Date(NOW.getTime() + SYNC_INTERVAL);
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
      getGradesForPeriod: async period => ({
        grades: [
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
        // Une matière du relevé sans note.
        averages: [
          { subject: "Maths", student: 15, classAverage: 12, outOf: 20 },
          { subject: "Latin", outOf: 20 },
        ],
        overall: { student: 15, classAverage: 12 },
      }),
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
    await manager.refresh("camille", "TIMETABLE", LATER);

    const stored = await db.select().from(courses);
    expect(stored.map(c => [c.id, c.from])).toEqual([["mardi", at(27, 10)]]);
    expect(await db.select().from(syncState)).toEqual([
      {
        serviceId: "pronote-1",
        capability: "TIMETABLE",
        lastSync: LATER,
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
    await manager.refresh("camille", "TIMETABLE", LATER);

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

  it("ne redemande pas une donnée synchronisée il y a moins de 30 minutes", async () => {
    const { manager } = await setup();
    const fetchTimetable = vi.fn(timetable);
    timetable = fetchTimetable;
    await manager.refresh("camille", "TIMETABLE", NOW);
    await manager.refresh(
      "camille",
      "TIMETABLE",
      new Date(LATER.getTime() - 1)
    );
    expect(fetchTimetable).toHaveBeenCalledOnce();
    await manager.refresh("camille", "TIMETABLE", LATER);
    expect(fetchTimetable).toHaveBeenCalledTimes(2);
  });

  it("redemande à `Ctrl R` une donnée de 5 minutes, pas avant", async () => {
    const { manager } = await setup();
    const fetchTimetable = vi.fn(timetable);
    timetable = fetchTimetable;
    await manager.refresh("camille", "TIMETABLE", NOW);
    const after = (delay: number) => new Date(NOW.getTime() + delay);
    await manager.refresh(
      "camille",
      "TIMETABLE",
      after(MANUAL_SYNC_INTERVAL - 1),
      MANUAL_SYNC_INTERVAL
    );
    expect(fetchTimetable).toHaveBeenCalledOnce();
    await manager.refresh(
      "camille",
      "TIMETABLE",
      after(MANUAL_SYNC_INTERVAL),
      MANUAL_SYNC_INTERVAL
    );
    expect(fetchTimetable).toHaveBeenCalledTimes(2);
  });

  it("charge une autre semaine une seule fois, sans toucher à la synchro", async () => {
    const { db, manager } = await setup();
    const nextWeek = new Date(2026, 10, 4, 12);
    const fetchTimetable = vi.fn(async (monday: Date) => [
      course("mardi-suivant", new Date(2026, 10, 3, 8)),
      // Hors de la semaine demandée : ignoré.
      course("plus-tard", addDays(monday, 7)),
    ]);
    timetable = fetchTimetable;

    expect(await manager.loadWeek("camille", nextWeek, NOW)).toBe(true);
    expect(fetchTimetable).toHaveBeenCalledWith(new Date(2026, 10, 2));
    const stored = await db.select().from(courses);
    expect(stored.map(c => c.id)).toEqual(["mardi-suivant"]);
    expect(await db.select().from(syncState)).toEqual([]);

    expect(await manager.loadWeek("camille", nextWeek, NOW)).toBe(false);
    expect(fetchTimetable).toHaveBeenCalledOnce();
  });

  it("garde le cours de la semaine quand le même revient la semaine d'après", async () => {
    const { db, manager } = await setup();
    const monday = new Date(2026, 10, 2, 8);
    timetable = async () => [
      course("maths", monday),
      course("maths", addDays(monday, 7)),
    ];
    expect(await manager.loadWeek("camille", monday, NOW)).toBe(true);
    const stored = await db.select().from(courses);
    expect(stored.map(c => c.from)).toEqual([monday]);
  });

  it("laisse la semaine en cours à la synchro", async () => {
    const { manager } = await setup();
    expect(await manager.loadWeek("camille", at(30, 8), NOW)).toBe(false);
    expect(connect).not.toHaveBeenCalled();
  });

  it("redemande une semaine qui n'a pas pu être chargée", async () => {
    const { db, manager } = await setup();
    const nextWeek = new Date(2026, 10, 2);
    timetable = async () => {
      throw new ServiceUnavailable("hors ligne");
    };
    expect(await manager.loadWeek("camille", nextWeek, NOW)).toBe(false);

    timetable = async () => [course("lundi-suivant", new Date(2026, 10, 2, 8))];
    expect(await manager.loadWeek("camille", nextWeek, NOW)).toBe(true);
    expect(await db.select().from(courses)).toHaveLength(1);
  });

  it("reconnecte un service refusé avec son nouveau secret", async () => {
    const { db, manager } = await setup();
    timetable = async () => {
      throw new AuthenticationError("refusé");
    };
    await manager.refresh("camille", "TIMETABLE", NOW);
    await manager.relinkService("pronote-1", "nouveau-jeton");

    const [service] = await db.select().from(services);
    expect(service?.needsLogin).toBe(false);
    expect(secrets.get("pronote-1")).toBe("nouveau-jeton");
  });

  it("coche un devoir chez le service, puis dans la base", async () => {
    const { db, manager } = await setup();
    const setCompletion = vi.fn(async (id: string, done: boolean) => {
      if (id === "refus") {
        throw new ServiceUnavailable(`hors ligne ${done}`);
      }
    });
    connect.mockImplementationOnce(async () => ({
      kind: "pronote",
      capabilities: {
        HOMEWORK: {
          getHomeworks: async () => [],
          setHomeworkCompletion: setCompletion,
        },
      },
    }));
    const row = {
      serviceId: "pronote-1",
      subject: "Maths",
      content: "DM",
      dueAt: at(27, 8),
      done: false,
      attachments: [],
    };
    await db.insert(homework).values([
      { ...row, id: "dm" },
      { ...row, id: "refus" },
    ]);

    await manager.setHomeworkDone("pronote-1", "dm", true);
    await expect(
      manager.setHomeworkDone("pronote-1", "refus", true)
    ).rejects.toThrow(ServiceUnavailable);

    expect(setCompletion).toHaveBeenCalledWith("dm", true);
    const stored = await db.select().from(homework).orderBy(homework.id);
    expect(stored.map(item => [item.id, item.done])).toEqual([
      ["dm", true],
      ["refus", false],
    ]);
  });

  it("synchronise actualités et carnet, sans doublon entre périodes", async () => {
    const { db, manager } = await setup();
    const absence = {
      id: "a1",
      kind: "absence" as const,
      from: at(20, 8),
      to: at(20, 10),
      durationMinutes: 120,
      justified: false,
    };
    connect.mockImplementationOnce(async () => ({
      kind: "pronote",
      capabilities: {
        NEWS: {
          getNews: async () => [
            {
              id: "n1",
              author: "Direction",
              date: at(20, 8),
              content: "<p>Bonjour</p>",
              read: false,
              attachments: [],
            },
          ],
          setNewsAsAcknowledged: async () => undefined,
        },
        ATTENDANCE: {
          getAttendancePeriods: async () => [
            { id: "t1", name: "T1", start: at(1, 0), end: at(30, 0) },
            { id: "an", name: "Année", start: at(1, 0), end: at(30, 0) },
          ],
          // L'année recoupe le trimestre : même absence, même retard d'identifiant égal.
          getAttendanceForPeriod: async () => [
            absence,
            { ...absence, kind: "delay", durationMinutes: 5 },
          ],
        },
      },
    }));
    await manager.refresh("camille", "NEWS", NOW);
    await manager.refresh("camille", "ATTENDANCE", NOW);

    expect((await db.select().from(news)).map(item => item.id)).toEqual(["n1"]);
    expect(
      (await db.select().from(attendance)).map(item => item.kind).sort()
    ).toEqual(["absence", "delay"]);
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
    expect(
      (await db.select().from(subjects)).map(subject => subject.name).sort()
    ).toEqual(["Latin", "Maths"]);
    expect(
      (await db.select().from(subjectAverages)).map(row => [
        row.periodId,
        row.subject,
        row.student,
      ])
    ).toEqual([
      ["t1", "Maths", 15],
      ["t1", "Latin", null],
      ["t2", "Maths", 15],
      ["t2", "Latin", null],
    ]);
    const [first] = await db.select().from(periods);
    expect(first).toMatchObject({ average: 15, classAverage: 12 });
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

  it("applique le choix d'une matière à tous les services du compte, et à eux seuls", async () => {
    const { db, manager } = await setup();
    await manager.addAccount({ id: "leo", firstName: "Léo", lastName: "Test" });
    await manager.linkService({
      id: "mock-1",
      accountId: "camille",
      kind: "mock",
    });
    await manager.linkService({ id: "mock-2", accountId: "leo", kind: "mock" });
    await db.insert(subjects).values([
      { serviceId: "pronote-1", name: "Maths" },
      { serviceId: "mock-1", name: "Maths" },
      { serviceId: "mock-2", name: "Maths" },
      { serviceId: "pronote-1", name: "SVT" },
    ]);
    const emojis = async () =>
      (await db.select().from(subjects))
        .map(row => `${row.serviceId} ${row.name} ${row.emoji}`)
        .sort();

    await manager.updateSubject("camille", "Maths", { emoji: "📐" });
    expect(await emojis()).toEqual([
      "mock-1 Maths 📐",
      "mock-2 Maths null",
      "pronote-1 Maths 📐",
      "pronote-1 SVT null",
    ]);

    await manager.resetSubjects("camille");
    expect(await emojis()).toEqual([
      "mock-1 Maths null",
      "mock-2 Maths null",
      "pronote-1 Maths null",
      "pronote-1 SVT null",
    ]);
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

  it("attend l'adresse rouverte avant de se connecter (synchro du lancement)", async () => {
    const { manager } = await setup();
    let open: () => void = () => undefined;
    vi.mocked(allowInstance).mockImplementationOnce(
      () => new Promise(resolve => (open = () => resolve(undefined)))
    );
    const starting = manager.start();
    const syncing = manager.refresh("camille", "TIMETABLE", NOW);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(connect).not.toHaveBeenCalled();
    open();
    await Promise.all([starting, syncing]);
    expect(connect).toHaveBeenCalledOnce();
  });
});
