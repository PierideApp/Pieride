import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDb } from "@/database/client";
import { migrate } from "@/database/migrate";
import { nodeDriver } from "@/database/node-driver";
import {
  attendance,
  attendancePeriods,
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
  saveFile,
} from "@/lib/files";
import { allowInstance } from "@/lib/http";
import { deleteSecret, getSecret, setSecret } from "@/lib/keyring";
import { addDays } from "@/lib/week";

import {
  AccountManager,
  MANUAL_SYNC_INTERVAL,
  SYNC_INTERVAL,
  SYNCED,
} from "./account-manager";
import {
  AuthenticationError,
  ServiceUnavailable,
  UnsupportedService,
} from "./shared/errors";
import type { Attachment, Course, News } from "./shared/models";
import type { CapabilityMethods, ConnectService } from "./shared/plugin";

const MODULES = { cours: "Cours", taches: "Tâches", actualites: "Actualités" };

const secrets = vi.hoisted(() => new Map<string, string>());
vi.mock("@/lib/keyring", () => ({
  getSecret: vi.fn(async (id: string) => secrets.get(id) ?? null),
  setSecret: vi.fn(
    async (id: string, value: string) => void secrets.set(id, value)
  ),
  deleteSecret: vi.fn(async (id: string) => void secrets.delete(id)),
}));
vi.mock("@/lib/http", () => ({ allowInstance: vi.fn(async () => undefined) }));
vi.mock("@/lib/files", () => ({
  openFile: vi.fn(async () => undefined),
  saveFile: vi.fn(
    async (folders: string[], name: string) => `${folders.join("/")}/${name}`
  ),
  openSavedFile: vi.fn(async () => undefined),
  filesInfo: vi.fn(async (paths: string[]): Promise<[string, number][]> =>
    paths.map(path => [`/maison/Documents/Piéride/${path}`, 1000])
  ),
  deleteFiles: vi.fn(async () => undefined),
  forgetFiles: vi.fn(async () => undefined),
  chooseDownloadsFolder: vi.fn(async (): Promise<string[] | null> => null),
}));

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
const connect = vi.fn<ConnectService>(async () => ({
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
            subjectId: "maths-1",
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
        // Deux sous-services de même nom, et une matière du relevé sans note.
        averages: [
          {
            subject: "Maths",
            subjectId: "maths-1",
            student: 15,
            classAverage: 12,
            outOf: 20,
          },
          { subject: "Maths", subjectId: "maths-2", student: 9, outOf: 20 },
          { subject: "Latin", subjectId: "latin", outOf: 20 },
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
  connect.mockReset();
  vi.mocked(allowInstance).mockClear();
  vi.mocked(openFile).mockClear();
  vi.mocked(saveFile).mockClear();
  vi.mocked(forgetFiles).mockClear();
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
    await manager.refresh("camille", "TIMETABLE", LATER);

    const [service] = await db.select().from(services);
    expect(service?.needsLogin).toBe(true);
    const [state] = await db.select().from(syncState);
    expect(state?.lastError).toBe("AuthenticationError");
    // Laissé de côté ensuite : plus aucune connexion jusqu'à la reconnexion.
    expect(connect).toHaveBeenCalledOnce();
  });

  it("ne renvoie un jeton refusé qu'après la reconnexion, même après Ctrl R ou une relance", async () => {
    const { db, manager } = await setup();
    const sent = vi.fn(async () => {
      throw new AuthenticationError("refusé");
    });
    connect.mockImplementation(async (_service, _secret, _save, auth) =>
      auth.login({ rotatesCredential: true }, sent)
    );
    // Une synchro demande cinq données, la suivante autant : un seul envoi.
    await manager.refreshAll("camille", SYNCED, NOW);
    await manager.refreshAll("camille", SYNCED, LATER);
    expect(sent).toHaveBeenCalledOnce();
    const [service] = await db.select().from(services);
    expect(service).toMatchObject({
      needsLogin: true,
      authStep: "failed",
      authFailure: "credential_rejected",
    });

    manager.allowAuthRetries();
    await manager.refreshAll("camille", SYNCED, LATER);
    // Un autre lancement : le refus vient de la base, pas de la mémoire.
    const relaunched = new AccountManager(db, {
      pronote: connect,
      mock: connect,
    });
    await relaunched.refreshAll("camille", SYNCED, LATER);
    expect(sent).toHaveBeenCalledOnce();

    await relaunched.relinkService("pronote-1", "nouveau-jeton");
    const [relinked] = await db.select().from(services);
    expect(relinked).toMatchObject({
      needsLogin: false,
      authStep: null,
      authFailure: null,
    });
    await relaunched.refresh("camille", "TIMETABLE", LATER);
    expect(sent).toHaveBeenCalledTimes(2);
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

  it("ne demande que les données des modules affichés", async () => {
    const { db, manager } = await setup();
    const fetchTimetable = vi.fn(timetable);
    timetable = fetchTimetable;
    await manager.refreshAll("camille", ["GRADES"], NOW);
    expect(fetchTimetable).not.toHaveBeenCalled();
    const synced = await db.select().from(syncState);
    expect(synced.map(row => row.capability)).toEqual(["GRADES"]);
  });

  it("connecte une fois par lancement le service dont tous les modules sont masqués", async () => {
    const { db, manager } = await setup();
    const fetchTimetable = vi.fn(timetable);
    timetable = fetchTimetable;
    await manager.refreshAll("camille", [], NOW);
    await manager.refreshAll("camille", [], LATER);
    expect(connect).toHaveBeenCalledOnce();
    expect(fetchTimetable).not.toHaveBeenCalled();
    expect(await db.select().from(syncState)).toEqual([]);
  });

  it("demande la reconnexion quand cette connexion est refusée", async () => {
    const { db, manager } = await setup();
    connect.mockRejectedValue(new AuthenticationError("refusé"));
    await manager.refreshAll("camille", [], NOW);
    const [service] = await db.select().from(services);
    expect(service?.needsLogin).toBe(true);
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

    expect(await manager.loadWeek("camille", nextWeek, "TIMETABLE", NOW)).toBe(
      true
    );
    expect(fetchTimetable).toHaveBeenCalledWith(new Date(2026, 10, 2));
    const stored = await db.select().from(courses);
    expect(stored.map(c => c.id)).toEqual(["mardi-suivant"]);
    expect(await db.select().from(syncState)).toEqual([]);

    expect(await manager.loadWeek("camille", nextWeek, "TIMETABLE", NOW)).toBe(
      false
    );
    expect(fetchTimetable).toHaveBeenCalledOnce();
  });

  it("garde le cours de la semaine quand le même revient la semaine d'après", async () => {
    const { db, manager } = await setup();
    const monday = new Date(2026, 10, 2, 8);
    timetable = async () => [
      course("maths", monday),
      course("maths", addDays(monday, 7)),
    ];
    expect(await manager.loadWeek("camille", monday, "TIMETABLE", NOW)).toBe(
      true
    );
    const stored = await db.select().from(courses);
    expect(stored.map(c => c.from)).toEqual([monday]);
  });

  it("ne charge que la donnée demandée pour une autre semaine", async () => {
    const { manager } = await setup();
    const fetchTimetable = vi.fn(timetable);
    timetable = fetchTimetable;
    const nextWeek = new Date(2026, 10, 4);
    expect(await manager.loadWeek("camille", nextWeek, "HOMEWORK", NOW)).toBe(
      false
    );
    expect(fetchTimetable).not.toHaveBeenCalled();
  });

  it("laisse la semaine en cours à la synchro", async () => {
    const { manager } = await setup();
    expect(await manager.loadWeek("camille", at(30, 8), "TIMETABLE", NOW)).toBe(
      false
    );
    expect(connect).not.toHaveBeenCalled();
  });

  it("redemande une semaine qui n'a pas pu être chargée", async () => {
    const { db, manager } = await setup();
    const nextWeek = new Date(2026, 10, 2);
    timetable = async () => {
      throw new ServiceUnavailable("hors ligne");
    };
    expect(await manager.loadWeek("camille", nextWeek, "TIMETABLE", NOW)).toBe(
      false
    );

    timetable = async () => [course("lundi-suivant", new Date(2026, 10, 2, 8))];
    expect(await manager.loadWeek("camille", nextWeek, "TIMETABLE", NOW)).toBe(
      true
    );
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

  it("retrouve le compte d'un service déjà lié : même adresse, même secret", async () => {
    const { manager } = await setup();
    const url = "https://0000000a.index-education.net/pronote/";
    const same = (secret: string) => secret === "jeton";

    expect(await manager.findLinkedAccount("pronote", url, same)).toBe(
      "camille"
    );
    expect(
      await manager.findLinkedAccount("pronote", url, () => false)
    ).toBeUndefined();
    expect(
      await manager.findLinkedAccount(
        "pronote",
        "https://0000000b.index-education.net/pronote/",
        same
      )
    ).toBeUndefined();
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
              kind: "information",
              author: "Direction",
              date: at(20, 8),
              content: "<p>Bonjour</p>",
              read: false,
              needsAcknowledgement: false,
              acknowledged: false,
              attachments: [],
            },
          ],
          setNewsAsRead: async () => undefined,
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
    // Les siennes, sans demander les notes.
    expect(
      (await db.select().from(attendancePeriods)).map(period => period.name)
    ).toEqual(["T1", "Année"]);
    expect(await db.select().from(periods)).toEqual([]);
  });

  it("passe au service les actualités déjà en base, pour garder leur contenu", async () => {
    const { manager } = await setup();
    const item: News = {
      id: "n1",
      kind: "information",
      author: "Direction",
      date: at(20, 8),
      content: "<p>Bonjour</p>",
      read: false,
      needsAcknowledgement: false,
      acknowledged: false,
      attachments: [],
    };
    const getNews = vi.fn<CapabilityMethods["NEWS"]["getNews"]>(async () => [
      item,
    ]);
    connect.mockImplementation(async () => ({
      kind: "pronote",
      capabilities: {
        NEWS: {
          getNews,
          setNewsAsRead: async () => undefined,
          setNewsAsAcknowledged: async () => undefined,
        },
      },
    }));
    await manager.refresh("camille", "NEWS", NOW);
    await manager.refresh("camille", "NEWS", LATER);

    expect(getNews.mock.calls[0]?.[0]).toEqual(new Map());
    expect(getNews.mock.calls[1]?.[0]).toEqual(new Map([["n1", item]]));
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
    await manager.refreshAll("camille", SYNCED, NOW);
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
        row.subjectId,
        row.student,
      ])
    ).toEqual([
      ["t1", "Maths", "maths-1", 15],
      ["t1", "Maths", "maths-2", 9],
      ["t1", "Latin", "latin", null],
      ["t2", "Maths", "maths-1", 15],
      ["t2", "Maths", "maths-2", 9],
      ["t2", "Latin", "latin", null],
    ]);
    const [first] = await db.select().from(periods);
    expect(first).toMatchObject({ average: 15, classAverage: 12 });
  });

  it("retire un compte : secrets puis données", async () => {
    const { db, manager } = await setup();
    await manager.refresh("camille", "TIMETABLE", NOW);
    await db.insert(downloads).values({
      serviceId: "pronote-1",
      key: "k1",
      path: "Camille Test/Maths/sujet.pdf",
    });
    await manager.removeAccount("camille");
    expect(secrets.size).toBe(0);
    expect(await db.select().from(services)).toEqual([]);
    expect(await db.select().from(courses)).toEqual([]);
    // Les pièces jointes ouvertes et téléchargées aussi.
    expect(forgetFiles).toHaveBeenCalledWith("pronote-1", [
      "Camille Test/Maths/sujet.pdf",
    ]);
    expect(await db.select().from(downloads)).toEqual([]);
  });

  it("télécharge une pièce jointe chez le service, puis l'ouvre", async () => {
    const { manager } = await setup();
    const bytes = new Uint8Array([37, 80, 68, 70]);
    const downloadAttachment = vi.fn(async () => bytes);
    connect.mockImplementationOnce(async () => ({
      kind: "pronote",
      capabilities: {},
      downloadAttachment,
    }));
    const attachment: Attachment = {
      kind: "file",
      name: "sujet.pdf",
      url: "https://exemple.fr/f/sujet.pdf",
      ref: "r1",
    };

    await manager.openAttachment("pronote-1", attachment);
    expect(downloadAttachment).toHaveBeenCalledWith(attachment);
    expect(openFile).toHaveBeenCalledWith("pronote-1", "sujet.pdf", bytes);
  });

  it("ouvre la copie téléchargée sans rien demander au service", async () => {
    const { db, manager } = await setup();
    const downloadAttachment = vi.fn(async () => new Uint8Array());
    connect.mockImplementationOnce(async () => ({
      kind: "pronote",
      capabilities: {},
      downloadAttachment,
    }));
    const url = "https://exemple.fr/f/sujet.pdf";
    await db.insert(downloads).values({
      serviceId: "pronote-1",
      key: url,
      path: "Camille Test/Maths/sujet.pdf",
    });

    await manager.openAttachment("pronote-1", {
      kind: "file",
      name: "sujet.pdf",
      url,
    });
    expect(openSavedFile).toHaveBeenCalledWith("Camille Test/Maths/sujet.pdf");
    expect(downloadAttachment).not.toHaveBeenCalled();
    expect(openFile).not.toHaveBeenCalled();
  });

  it("garde une pièce jointe téléchargée et la reconnaît à sa clé", async () => {
    const { manager } = await setup();
    const bytes = new Uint8Array([37, 80, 68, 70]);
    connect.mockImplementationOnce(async () => ({
      kind: "pronote",
      capabilities: {},
      downloadAttachment: async () => bytes,
    }));
    const attachment: Attachment = {
      kind: "file",
      name: "sujet.pdf",
      url: "https://exemple.fr/session-1/sujet.pdf",
      key: "k1",
    };

    await manager.saveAttachment("pronote-1", attachment, {
      module: "Tâches",
      subject: "Maths",
      date: at(27, 8),
    });
    expect(saveFile).toHaveBeenCalledWith(
      ["Camille Test", "2026-2027", "Tâches", "Maths"],
      "sujet.pdf",
      bytes,
      at(27, 8)
    );

    // À la synchro suivante, l'adresse change mais pas la clé.
    const again = {
      ...attachment,
      url: "https://exemple.fr/session-2/sujet.pdf",
    };
    const other = {
      ...attachment,
      url: "https://exemple.fr/autre.pdf",
      key: "k2",
    };
    const folders = ["2026-2027", "Tâches", "Maths"];
    expect(await manager.savedAttachments("pronote-1", [again, other])).toEqual(
      new Map([
        [
          again.url,
          {
            folders,
            location:
              "/maison/Documents/Piéride/Camille Test/2026-2027/Tâches/Maths/sujet.pdf",
          },
        ],
      ])
    );

    vi.mocked(filesInfo).mockResolvedValueOnce([null]);
    expect(await manager.savedAttachments("pronote-1", [again])).toEqual(
      new Map([[again.url, { folders, location: undefined }]])
    );
  });

  it("télécharge les pièces jointes des nouvelles actualités seulement", async () => {
    const { manager } = await setup();
    const file = (name: string): Attachment => ({
      kind: "file",
      name,
      url: `https://exemple.fr/${name}`,
      key: name,
    });
    const item = (id: string, attachments: Attachment[]): News => ({
      id,
      kind: "information",
      author: "Direction",
      date: at(20, 8),
      content: "",
      read: false,
      needsAcknowledgement: false,
      acknowledged: false,
      attachments,
    });
    let list = [item("n1", [file("ancienne.pdf")])];
    const downloadAttachment = vi.fn(async () => new Uint8Array([1]));
    connect.mockImplementation(async () => ({
      kind: "pronote",
      capabilities: {
        NEWS: {
          getNews: async () => list,
          setNewsAsRead: async () => undefined,
          setNewsAsAcknowledged: async () => undefined,
        },
      },
      downloadAttachment,
    }));

    // La première synchro ne télécharge pas tout l'historique.
    await manager.refreshAll("camille", SYNCED, NOW);
    expect(await manager.saveNewAttachments("camille", MODULES)).toBe(false);

    list = [
      ...list,
      item("n2", [
        file("sortie.pdf"),
        { kind: "link", name: "Site", url: "https://exemple.fr" },
      ]),
    ];
    await manager.refreshAll("camille", SYNCED, LATER);
    expect(await manager.saveNewAttachments("camille", MODULES)).toBe(true);
    expect(downloadAttachment).toHaveBeenCalledTimes(1);
    expect(saveFile).toHaveBeenCalledWith(
      ["Camille Test", "2026-2027", "Actualités"],
      "sortie.pdf",
      new Uint8Array([1]),
      at(20, 8)
    );
    // Une seule fois par synchro.
    expect(await manager.saveNewAttachments("camille", MODULES)).toBe(false);
  });

  it("télécharge une fois les fichiers ajoutés aux cours et aux devoirs, par matière", async () => {
    const { manager } = await setup();
    const file = (name: string): Attachment => ({
      kind: "file",
      name,
      url: `https://exemple.fr/${name}`,
      key: name,
    });
    let lesson = [file("cours.pdf")];
    let task = [file("sujet.pdf")];
    const downloadAttachment = vi.fn(async (attachment: Attachment) => {
      if (attachment.name === "annexe.pdf") {
        throw new ServiceUnavailable("hors ligne");
      }
      return new Uint8Array([1]);
    });
    connect.mockImplementation(async () => ({
      kind: "pronote",
      capabilities: {
        TIMETABLE: {
          getWeeklyTimetable: async () => [
            {
              ...course("lundi", at(26, 8)),
              contents: [{ attachments: lesson }],
            },
          ],
        },
        HOMEWORK: {
          getHomeworks: async () => [
            {
              id: "dm",
              subject: "Maths",
              content: "DM",
              dueAt: at(27, 8),
              done: false,
              attachments: task,
            },
          ],
          setHomeworkCompletion: async () => undefined,
        },
      },
      downloadAttachment,
    }));
    await manager.refreshAll("camille", SYNCED, NOW);
    expect(await manager.saveNewAttachments("camille", MODULES)).toBe(false);

    await manager.updateSubject("camille", "Maths", {
      displayName: "Mathématiques",
    });
    lesson = [...lesson, file("correction.pdf")];
    task = [
      ...task,
      file("annexe.pdf"),
      { kind: "link", name: "Exercices", url: "https://exemple.fr" },
    ];
    await manager.refreshAll("camille", SYNCED, LATER);
    expect(await manager.saveNewAttachments("camille", MODULES)).toBe(true);
    expect(
      vi.mocked(saveFile).mock.calls.map(call => call.slice(0, 2))
    ).toEqual([
      [
        ["Camille Test", "2026-2027", "Cours", "Mathématiques"],
        "correction.pdf",
      ],
    ]);
    expect(downloadAttachment).toHaveBeenCalledTimes(2);

    // L'échec n'est pas redemandé au service à chaque synchro.
    await manager.refreshAll(
      "camille",
      SYNCED,
      new Date(LATER.getTime() + SYNC_INTERVAL)
    );
    expect(await manager.saveNewAttachments("camille", MODULES)).toBe(false);
    expect(downloadAttachment).toHaveBeenCalledTimes(2);
  });

  it("garde le chemin de chaque fichier déplacé vers le nouveau dossier", async () => {
    const { db, manager } = await setup();
    await db.insert(downloads).values([
      { serviceId: "pronote-1", key: "k1", path: "Camille Test/Maths/a.pdf" },
      { serviceId: "pronote-1", key: "k2", path: "Camille Test/Maths/b.pdf" },
      // Le même fichier pour un cours et un devoir : déplacé une seule fois.
      { serviceId: "pronote-1", key: "k3", path: "Camille Test/Maths/b.pdf" },
    ]);
    expect(await manager.changeDownloadsFolder("Choisis")).toBe(false);

    vi.mocked(chooseDownloadsFolder).mockImplementationOnce(async (_, paths) =>
      paths.map(path => path.replace("b.pdf", "b (2).pdf"))
    );
    expect(await manager.changeDownloadsFolder("Choisis")).toBe(true);
    expect(vi.mocked(chooseDownloadsFolder).mock.calls[1]?.[1]).toEqual([
      "Camille Test/Maths/a.pdf",
      "Camille Test/Maths/b.pdf",
    ]);
    const rows = await db.select().from(downloads).orderBy(downloads.key);
    expect(rows.map(row => row.path)).toEqual([
      "Camille Test/Maths/a.pdf",
      "Camille Test/Maths/b (2).pdf",
      "Camille Test/Maths/b (2).pdf",
    ]);
  });

  it("compte et efface les téléchargements d'une année scolaire", async () => {
    const { db, manager } = await setup();
    const old = "Camille Test/2025-2026/Cours/Maths/a.pdf";
    const current = "Camille Test/2026-2027/Cours/Maths/b.pdf";
    await db.insert(downloads).values([
      { serviceId: "pronote-1", key: "k1", path: old },
      { serviceId: "pronote-1", key: "k2", path: current },
      { serviceId: "pronote-1", key: "k3", path: current },
    ]);
    expect(await manager.downloadsByYear("camille")).toEqual([
      { year: "2026-2027", count: 1, size: 1000 },
      { year: "2025-2026", count: 1, size: 1000 },
    ]);

    await manager.deleteDownloads("camille", "2025-2026");
    expect(deleteFiles).toHaveBeenCalledWith([old]);
    expect(
      (await db.select().from(downloads)).map(row => row.key).sort()
    ).toEqual(["k2", "k3"]);

    // Un fichier ouvert ailleurs : rien n'est oublié, l'élève pourra réessayer.
    vi.mocked(deleteFiles).mockRejectedValueOnce("delete_failed");
    await expect(manager.deleteDownloads("camille", "2026-2027")).rejects.toBe(
      "delete_failed"
    );
    expect(await db.select().from(downloads)).toHaveLength(2);
  });

  it("refuse d'ouvrir la pièce jointe d'un service qui ne la donne pas", async () => {
    const { manager } = await setup();
    connect.mockImplementationOnce(async () => ({
      kind: "pronote",
      capabilities: {},
    }));
    await expect(
      manager.openAttachment("pronote-1", {
        kind: "file",
        name: "sujet.pdf",
        url: "https://exemple.fr/f/sujet.pdf",
      })
    ).rejects.toBeInstanceOf(UnsupportedService);
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
