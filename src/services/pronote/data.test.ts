// Exemples écrits à la main au format de pawnote : aucune vraie donnée d'élève.
import {
  AccountKind,
  type Assignment,
  AssignmentDifficulty,
  AssignmentReturnKind,
  AttachmentKind,
  createSessionHandle,
  type Grade,
  GradeKind,
  news,
  newsDetails,
  type NewsInformation,
  type NewsQuestion,
  NewsQuestionKind,
  type NewsSurvey,
  SessionExpiredError,
  TabLocation,
  type TimetableClassLesson,
} from "@blockshub/pawnote-lts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getLog } from "@/lib/log";

import { ServiceAuth } from "../shared/auth";
import { ServiceUnavailable } from "../shared/errors";
import type { Course } from "../shared/models";
import {
  capabilities,
  newsWithContent,
  pickFile,
  pickNews,
  toCourse,
  toGrade,
  toHomework,
  toNews,
} from "./data";
import { lostExchange, PronoteSession } from "./session";

vi.mock("@/lib/http", () => ({}));
vi.mock("./session", async original => ({
  ...(await original<typeof import("./session")>()),
  lostExchange: vi.fn(() => false),
}));
vi.mock("@blockshub/pawnote-lts", async original => ({
  ...(await original<typeof import("@blockshub/pawnote-lts")>()),
  news: vi.fn(),
  newsDetails: vi.fn(),
}));

const MATHS = { id: "s1", name: "MATHEMATIQUES", inGroups: false };
const START = new Date(2026, 9, 26, 8);
const END = new Date(2026, 9, 26, 9);

function lesson(changes: Partial<TimetableClassLesson> = {}) {
  const base: TimetableClassLesson = {
    is: "lesson",
    id: "c1",
    kind: 0,
    startDate: START,
    endDate: END,
    blockLength: 2,
    blockPosition: 0,
    weekNumber: 9,
    canceled: false,
    exempted: false,
    test: false,
    virtualClassrooms: [],
    personalNames: [],
    teacherNames: ["M. BERNARD"],
    classrooms: ["B12"],
    groupNames: [],
    subject: MATHS,
  };
  return { ...base, ...changes };
}

const points = (value: number) => ({ kind: GradeKind.Grade, points: value });

function grade(changes: Partial<Grade> = {}): Grade {
  return {
    id: "g1",
    value: points(14),
    outOf: points(20),
    date: START,
    subject: MATHS,
    average: points(11.5),
    max: points(18),
    min: points(4),
    coefficient: 2,
    comment: "Contrôle chapitre 3",
    isBonus: false,
    isOptional: false,
    isOutOf20: true,
    ...changes,
  };
}

describe("toCourse", () => {
  it("reprend un cours", () => {
    expect(toCourse(lesson())).toEqual({
      id: `c1@${START.toISOString()}`,
      subject: "MATHEMATIQUES",
      from: START,
      to: END,
      room: "B12",
      teacher: "M. BERNARD",
      group: undefined,
      status: undefined,
    });
  });

  it("joint à la séance son cahier de textes", () => {
    const contents = new Map([
      ["r1", [{ title: "Les suites", category: "Cours", attachments: [] }]],
    ]);
    expect(
      toCourse(lesson({ lessonResourceID: "r1" }), contents).contents
    ).toEqual([{ title: "Les suites", category: "Cours", attachments: [] }]);
    expect(toCourse(lesson(), contents).contents).toBeUndefined();
  });

  it("distingue les séances d'un cours qui revient chaque semaine", () => {
    const nextWeek = new Date(2026, 10, 2, 8);
    expect(toCourse(lesson({ startDate: nextWeek })).id).not.toBe(
      toCourse(lesson()).id
    );
  });

  it.each<[Partial<TimetableClassLesson>, Course["status"]]>([
    [{ canceled: true }, "canceled"],
    [{ status: "Prof. absent" }, "canceled"],
    [{ test: true }, "evaluated"],
    [{ status: "Changement de salle" }, "edited"],
    [{ virtualClassrooms: ["https://visio.exemple.fr"] }, "online"],
  ])("traduit le statut %o", (changes, status) => {
    expect(toCourse(lesson(changes)).status).toBe(status);
  });

  it("nomme une retenue et une activité sans matière", () => {
    expect(
      toCourse({
        is: "detention",
        id: "r1",
        startDate: START,
        endDate: END,
        blockLength: 2,
        blockPosition: 0,
        weekNumber: 9,
        personalNames: [],
        teacherNames: [],
        classrooms: [],
      }).subject
    ).toBe("Retenue");
    expect(
      toCourse({
        is: "activity",
        id: "a1",
        startDate: START,
        endDate: END,
        blockLength: 2,
        blockPosition: 0,
        weekNumber: 9,
        title: "Sortie au musée",
        attendants: [],
        resourceTypeName: "",
        resourceValue: "",
      }).subject
    ).toBe("Sortie au musée");
  });
});

describe("toHomework", () => {
  it("reprend le devoir et ses pièces jointes, sans l'identifiant de session", () => {
    const assignment: Assignment = {
      id: "h1",
      subject: MATHS,
      description: "<p>Exercices 12 à 15</p>",
      backgroundColor: "#ffffff",
      done: true,
      deadline: END,
      attachments: [
        {
          kind: AttachmentKind.Link,
          name: "Cours",
          url: "https://exemple.fr/cours",
          id: "l1",
        },
        {
          kind: AttachmentKind.File,
          name: "sujet.pdf",
          url: "https://exemple.fr/f/sujet.pdf?Session=1234",
          id: "f1",
        },
      ],
      difficulty: AssignmentDifficulty.None,
      themes: [],
      return: { kind: AssignmentReturnKind.None, canUpload: false },
    };
    expect(toHomework(assignment, 9)).toEqual({
      id: "h1",
      subject: "MATHEMATIQUES",
      content: "<p>Exercices 12 à 15</p>",
      dueAt: END,
      done: true,
      attachments: [
        { kind: "link", name: "Cours", url: "https://exemple.fr/cours" },
        {
          kind: "file",
          name: "sujet.pdf",
          url: "https://exemple.fr/f/sujet.pdf",
          // Où redemander une adresse valable : les devoirs de la semaine 9.
          ref: JSON.stringify({ source: "homework", week: 9, file: "f1" }),
        },
      ],
    });
  });
});

describe("toNews", () => {
  const CREATED = new Date(2026, 9, 13, 16, 42);
  const item = {
    id: "n1",
    title: "Sortie au musée",
    category: { id: "c1", name: "Histoire-géographie", default: false },
    creationDate: CREATED,
    startDate: new Date(2026, 9, 14),
    endDate: new Date(2026, 10, 14),
    author: "Mme Leroy",
    public: null,
    read: false,
  };
  const question = (changes: Partial<NewsQuestion>): NewsQuestion => ({
    id: "q1",
    position: 1,
    kind: NewsQuestionKind.InformationText,
    fullTitle: "",
    title: "",
    shouldRespectMaximumChoices: false,
    maximumChoices: 0,
    maximumLength: 0,
    attachments: [],
    content: "",
    answerID: "r1",
    shouldAnswer: false,
    choices: [],
    answered: false,
    ...changes,
  });
  const PDF = {
    kind: AttachmentKind.File,
    name: "autorisation.pdf",
    url: "https://exemple.fr/f/autorisation.pdf?Session=1234",
    id: "f1",
  };

  const KEY = `${CREATED.getTime()}|Mme Leroy|Sortie au musée`;
  const information: NewsInformation = {
    ...item,
    is: "information",
    question: question({ content: "<p>Départ à 8h</p>", shouldAnswer: true }),
    content: "<p>Départ à 8h</p>",
    attachments: [PDF],
    acknowledged: false,
    acknowledgedDate: undefined,
    needToAcknowledge: true,
  };

  it("reprend une information, sa rubrique, sa date de création et l'accusé demandé", () => {
    expect(toNews(information)).toEqual({
      id: KEY,
      kind: "information",
      title: "Sortie au musée",
      category: "Histoire-géographie",
      author: "Mme Leroy",
      date: CREATED,
      content: "<p>Départ à 8h</p>",
      read: false,
      needsAcknowledgement: true,
      acknowledged: false,
      attachments: [
        {
          kind: "file",
          name: "autorisation.pdf",
          url: "https://exemple.fr/f/autorisation.pdf",
          ref: JSON.stringify({ source: "news", news: KEY, file: "f1" }),
        },
      ],
    });
  });

  it("garde le même id d'une session à l'autre, pas d'une actualité à l'autre", () => {
    // Une autre session : PRONOTE renvoie la même actualité avec un autre id.
    expect(toNews({ ...information, id: "n2" }).id).toBe(KEY);
    expect(toNews({ ...information, title: "Sortie au cinéma" }).id).not.toBe(
      KEY
    );
    expect(toNews({ ...information, author: "M. Martin" }).id).not.toBe(KEY);
    expect(
      toNews({ ...information, creationDate: new Date(2026, 9, 20) }).id
    ).not.toBe(KEY);
  });

  it("garde un sondage : le texte et les pièces jointes de ses questions", () => {
    const survey: NewsSurvey = {
      ...item,
      is: "survey",
      isAnonymous: false,
      questions: [
        question({ content: "<p>Viendras-tu ?</p>", attachments: [PDF] }),
        question({ id: "q2", content: "<p>Avec qui ?</p>" }),
      ],
    };
    expect(toNews(survey)).toMatchObject({
      kind: "survey",
      content: "<p>Viendras-tu ?</p><p>Avec qui ?</p>",
      needsAcknowledgement: false,
      acknowledged: false,
      attachments: [{ kind: "file", name: "autorisation.pdf" }],
    });
  });

  describe("pickNews", () => {
    // Une nouvelle session : les mêmes actualités, avec d'autres id.
    const other = { ...information, id: "n7", title: "Réunion" };

    it("retrouve l'actualité synchronisée dans une nouvelle session", () => {
      const session = [other, { ...information, id: "n8" }];
      expect(pickNews(session, KEY).id).toBe("n8");
    });

    it("refuse une actualité disparue au lieu de ne rien faire", () => {
      expect(() => pickNews([other], KEY)).toThrow(ServiceUnavailable);
    });
  });

  describe("newsWithContent", () => {
    // Le format des versions récentes de PRONOTE : la liste arrive sans le contenu.
    const summary: NewsInformation = {
      ...information,
      question: undefined,
      content: "",
      attachments: [],
      needToAcknowledge: false,
    };
    const other: NewsInformation = { ...summary, id: "n9", title: "Réunion" };
    const handle = createSessionHandle(vi.fn());

    it("ne demande le contenu que des actualités pas encore en base", async () => {
      vi.mocked(news).mockResolvedValue({
        categories: [],
        items: [summary, { ...other, read: true }],
      });
      vi.mocked(newsDetails).mockImplementation(async (_, item) => ({
        ...item,
        question: question({ content: "<p>Salle B12</p>" }),
        content: "<p>Salle B12</p>",
      }));
      const list = await newsWithContent(
        handle,
        new Map([[KEY, toNews(information)]])
      );

      expect(newsDetails).toHaveBeenCalledOnce();
      expect(newsDetails).toHaveBeenCalledWith(
        handle,
        expect.objectContaining({ title: "Réunion" })
      );
      // Le contenu vient de la base, le reste de la liste.
      expect(list[0]).toMatchObject({
        id: KEY,
        content: "<p>Départ à 8h</p>",
        needsAcknowledgement: true,
        attachments: [{ name: "autorisation.pdf" }],
        read: false,
      });
      expect(list[1]).toMatchObject({
        title: "Réunion",
        content: "<p>Salle B12</p>",
        read: true,
      });
    });

    it("ne demande rien quand PRONOTE envoie le contenu avec la liste", async () => {
      vi.mocked(newsDetails).mockClear();
      vi.mocked(news).mockResolvedValue({
        categories: [],
        items: [information],
      });
      expect(await newsWithContent(handle, new Map())).toMatchObject([
        { content: "<p>Départ à 8h</p>" },
      ]);
      expect(newsDetails).not.toHaveBeenCalled();
    });

    describe("quand un contenu échoue", () => {
      const third: NewsInformation = { ...summary, id: "n8", title: "Cantine" };
      const withContent: typeof newsDetails = async (_, item) => ({
        ...item,
        question: question({ content: "<p>Salle B12</p>" }),
        content: "<p>Salle B12</p>",
      });

      beforeEach(() => {
        vi.mocked(newsDetails).mockReset();
        vi.mocked(news).mockResolvedValue({
          categories: [],
          items: [other, third],
        });
      });

      it("garde l'actualité sans texte et continue avec les autres", async () => {
        vi.mocked(newsDetails)
          .mockRejectedValueOnce(new TypeError("e.texte is undefined"))
          .mockImplementation(withContent);
        const list = await newsWithContent(handle, new Map());

        expect(newsDetails).toHaveBeenCalledTimes(2);
        expect(list).toMatchObject([
          { title: "Réunion", content: "", attachments: [] },
          { title: "Cantine", content: "<p>Salle B12</p>" },
        ]);
        expect(getLog().entries.at(-1)).toMatchObject({
          level: "warn",
          message: expect.stringContaining(
            "1 contenu(s) manquant(s), TypeError"
          ),
        });
      });

      it("n'insiste pas après une requête restée sans réponse", async () => {
        vi.mocked(newsDetails).mockRejectedValue(
          new ServiceUnavailable("Requête impossible : timeout")
        );
        vi.mocked(lostExchange).mockReturnValueOnce(true);
        const list = await newsWithContent(handle, new Map());

        expect(newsDetails).toHaveBeenCalledOnce();
        expect(list).toMatchObject([{ content: "" }, { content: "" }]);
      });

      it("laisse la session expirée à PronoteSession, qui rejoue tout", async () => {
        vi.mocked(newsDetails).mockRejectedValue(new SessionExpiredError());
        await expect(newsWithContent(handle, new Map())).rejects.toThrow(
          SessionExpiredError
        );
      });

      it("redemande le contenu d'une actualité gardée sans texte", async () => {
        vi.mocked(newsDetails).mockImplementation(withContent);
        const saved = toNews(other);
        const [first] = await newsWithContent(
          handle,
          new Map([[saved.id, saved]])
        );
        expect(newsDetails).toHaveBeenCalledTimes(2);
        expect(first).toMatchObject({ content: "<p>Salle B12</p>" });
      });
    });
  });
});

describe("pickFile", () => {
  const file = (id: string, name: string) => ({
    kind: AttachmentKind.File,
    name,
    url: `https://exemple.fr/f/${name}`,
    id,
  });
  const files = [file("f8", "menu.pdf"), file("f9", "autorisation.pdf")];

  it("prend le fichier par son id", () => {
    expect(
      pickFile(files, { source: "news", news: "k", file: "f8" }, "autre.pdf")
    ).toBe(files[0]);
  });

  it("retombe sur le nom dans une actualité dont l'id a changé", () => {
    expect(
      pickFile(
        files,
        { source: "news", news: "k", file: "f1" },
        "autorisation.pdf"
      )
    ).toBe(files[1]);
  });

  it("ne devine pas par le nom dans une semaine de devoirs", () => {
    expect(
      pickFile(
        files,
        { source: "homework", week: 9, file: "f1" },
        "autorisation.pdf"
      )
    ).toBeUndefined();
  });
});

describe("toGrade", () => {
  it("reprend une note et les résultats de la classe", () => {
    expect(toGrade(grade(), "t1")).toMatchObject({
      id: "g1",
      subject: "MATHEMATIQUES",
      periodId: "t1",
      title: "Contrôle chapitre 3",
      value: 14,
      status: undefined,
      outOf: 20,
      coefficient: 2,
      classAverage: 11.5,
      min: 4,
      max: 18,
    });
  });

  it("garde le statut d'une note sans points, et le 0 d'une absence qui compte", () => {
    const absent = toGrade(
      grade({ value: { kind: GradeKind.Absent, points: 0 } }),
      "t1"
    );
    expect(absent).toMatchObject({ value: undefined, status: "Abs." });
    const zero = toGrade(
      grade({ value: { kind: GradeKind.AbsentZero, points: 0 } }),
      "t1"
    );
    expect(zero).toMatchObject({ value: 0, status: "Abs.*" });
  });

  it("ignore une moyenne vide (NaN) et retombe sur 20 sans barème", () => {
    const result = toGrade(
      grade({
        average: points(Number.NaN),
        outOf: { kind: GradeKind.Error, points: 0 },
      }),
      "t1"
    );
    expect(result.classAverage).toBeUndefined();
    expect(result.outOf).toBe(20);
  });
});

describe("capabilities", () => {
  // Aucune requête : les méthodes ne sont pas appelées.
  const session = new PronoteSession(
    {
      url: "https://0000000a.index-education.net/pronote",
      username: "camille",
      token: "jeton",
      deviceUUID: "appareil",
      kind: AccountKind.STUDENT,
    },
    async () => undefined,
    new ServiceAuth(
      "pronote",
      { step: null, failure: null },
      async () => undefined
    )
  );

  it("ne déclare que les onglets ouverts à l'élève", () => {
    expect(
      Object.keys(
        capabilities(session, [TabLocation.Timetable, TabLocation.Grades])
      )
    ).toEqual(["TIMETABLE", "GRADES"]);
  });
});
