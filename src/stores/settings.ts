// Réglages de l'interface, enregistrés dans le stockage de la WebView. Aucun secret ici.
import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { AverageMethod } from "@/lib/grades";

export type Theme = "system" | "light" | "dark";
export type Language = "fr" | "en";

/** Les langues de l'interface, chacune écrite dans sa propre langue. */
export const LANGUAGES: readonly { id: Language; name: string }[] = [
  { id: "fr", name: "Français" },
  { id: "en", name: "English" },
];

/** La langue de l'ordinateur, si Piéride la parle. */
export const systemLanguage = (): Language =>
  navigator.language.startsWith("en") ? "en" : "fr";

/**
 * Couleurs d'accentuation (maquette 03-personnalisation). L'indigo garde les teintes exactes
 * du thème ; les autres en sont déduites (theme.scss). `onAccent` : texte posé dessus.
 */
export const ACCENTS = [
  { id: "indigo", color: "#2b2bc2" },
  { id: "blue", color: "#007fda" },
  { id: "teal", color: "#26b290" },
  { id: "green", color: "#12bb67" },
  { id: "yellow", color: "#e8b048", onAccent: "#13123a" },
  { id: "orange", color: "#dd6b00" },
  { id: "red", color: "#dd0030" },
  { id: "pink", color: "#c50066" },
  { id: "purple", color: "#962dd8" },
  { id: "ink", color: "#13123a" },
] as const;
export type Accent = (typeof ACCENTS)[number]["id"];

/** Tâches : une colonne par jour, ou une liste par date de rendu. */
export const TASKS_LAYOUTS = ["board", "list"] as const;
export type TasksLayout = (typeof TASKS_LAYOUTS)[number];

/** Échelles proposées pour afficher les notes. */
export const GRADE_SCALES = [10, 20, 100] as const;

/** Widgets de l'accueil. En carte (`mini`), ils sont les raccourcis de la maquette, en haut. */
export const HOME_WIDGETS = [
  "attendance",
  "news",
  "courses",
  "average",
  "tasks",
  "grades",
] as const;
export type HomeWidget = (typeof HOME_WIDGETS)[number];

/**
 * Tailles d'un widget, de la plus petite à la plus grande (modules/accueil/layout.ts). `mini` :
 * une carte d'une ligne, toujours dans la rangée du haut de l'accueil.
 */
export const WIDGET_SIZES = [
  "mini",
  "compact",
  "normal",
  "large",
  "full",
] as const;
export type WidgetSize = (typeof WIDGET_SIZES)[number];

export interface HomeItem {
  id: HomeWidget;
  size: WidgetSize;
  /** En carte : la taille d'avant, rendue quand le widget redescend dans la grille. */
  previous?: WidgetSize;
}

/** La disposition de la maquette 02-accueil : raccourcis, cours, moyenne, tâches, notes. */
export const DEFAULT_HOME_LAYOUT: readonly HomeItem[] = [
  { id: "attendance", size: "mini" },
  { id: "news", size: "mini" },
  { id: "courses", size: "normal" },
  { id: "average", size: "normal" },
  { id: "tasks", size: "normal" },
  { id: "grades", size: "normal" },
];

/** Heures proposées pour le rappel des tâches, la veille du rendu. */
export const REMINDER_TIMES = [
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
] as const;

/** Les réglages simples : une valeur chacun, modifiée avec `setPreference`. */
export interface Preferences {
  theme: Theme;
  language: Language;
  accent: Accent;
  /** Notes ramenées sur cette échelle dans l'interface. */
  gradeScale: (typeof GRADE_SCALES)[number];
  /** Widgets affichés sur l'accueil, dans leur ordre et à leur taille (« Modifier l'accueil »). */
  homeLayout: HomeItem[];
  /** Méthode de calcul de la moyenne générale, choisie sous elle (Notes). */
  averageMethod: AverageMethod;
  showCoefficients: boolean;
  showWeekend: boolean;
  /** Repère de l'heure actuelle dans l'emploi du temps. */
  showNowLine: boolean;
  /** Pause méridienne et récréations dans la liste des cours. */
  showBreaks: boolean;
  showCanteen: boolean;
  tasksLayout: TasksLayout;
  hideDoneTasks: boolean;
  /** Barre latérale en rail d'icônes sous 1280 px (UX §4). */
  sidebarAutoCollapse: boolean;
  /** Pastilles des modules (tâches à faire…). */
  sidebarBadges: boolean;
  /** Lancé à l'ouverture de session : rester dans la barre des tâches. */
  startMinimized: boolean;
  /** Fermer la fenêtre la cache dans la barre des tâches au lieu de quitter. */
  closeToTray: boolean;
  /** Cours actuel et suivant dans le menu de l'icône de la barre des tâches. */
  trayGlance: boolean;
  /** Notifications du système, par sujet (M5 : synchro en arrière-plan). */
  notifyGrades: boolean;
  notifyCourses: boolean;
  notifyHomework: boolean;
  /** Heure du rappel des tâches, la veille du rendu. */
  homeworkReminderTime: (typeof REMINDER_TIMES)[number];
  notifyNews: boolean;
  notifyMorning: boolean;
  /** Retenir les notifications pendant un cours. */
  quietDuringClasses: boolean;
}

/** Les réglages qui s'activent par un interrupteur. */
export type Toggle = {
  [K in keyof Preferences]: Preferences[K] extends boolean ? K : never;
}[keyof Preferences];

interface SettingsState extends Preferences {
  /** Modules masqués de la barre latérale, par compte (`disabledTabsByAccount` de Papillon). */
  hiddenModules: Record<string, string[]>;
  /** Ordre choisi des modules, par compte. Absent : celui du registre. */
  moduleOrder: Record<string, string[]>;
  setPreference: <K extends keyof Preferences>(
    key: K,
    value: Preferences[K]
  ) => void;
  setModuleHidden: (
    accountId: string,
    moduleId: string,
    hidden: boolean
  ) => void;
  setModuleOrder: (accountId: string, order: string[]) => void;
  /** Oublie les réglages d'un compte supprimé. */
  forgetAccount: (accountId: string) => void;
}

/**
 * Version 1 : `homeWidgets` et `homeShortcuts` (ordre des widgets et raccourcis gardés) deviennent
 * `homeLayout`, avec les tailles par défaut. Version 2 : la carte d'une ligne devient la taille
 * `mini` ; `compact` est désormais un petit bloc.
 */
function migrateSettings(persisted: unknown, version: number): unknown {
  if (typeof persisted !== "object" || persisted === null) {
    return persisted;
  }
  if (version === 1) {
    const current: { homeLayout?: unknown } = persisted;
    return {
      ...persisted,
      homeLayout: Array.isArray(current.homeLayout)
        ? current.homeLayout.map((item: unknown) =>
            typeof item === "object" &&
            item !== null &&
            "id" in item &&
            "size" in item &&
            (item.id === "attendance" || item.id === "news") &&
            item.size === "compact"
              ? { ...item, size: "mini" }
              : item
          )
        : [...DEFAULT_HOME_LAYOUT],
    };
  }
  if (version > 1) {
    return persisted;
  }
  const old: { homeWidgets?: unknown; homeShortcuts?: unknown } = persisted;
  const kept = [old.homeShortcuts, old.homeWidgets]
    .flatMap(list => (Array.isArray(list) ? list : []))
    .flatMap(id =>
      DEFAULT_HOME_LAYOUT.filter(item => item.id === id).map(item => ({
        ...item,
      }))
    );
  return {
    ...persisted,
    homeLayout: kept.length > 0 ? kept : [...DEFAULT_HOME_LAYOUT],
  };
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    set => ({
      theme: "system",
      language: systemLanguage(),
      accent: "indigo",
      gradeScale: 20,
      averageMethod: "subjects",
      homeLayout: [...DEFAULT_HOME_LAYOUT],
      showCoefficients: true,
      showWeekend: false,
      showNowLine: true,
      showBreaks: true,
      showCanteen: true,
      tasksLayout: "board",
      hideDoneTasks: false,
      sidebarAutoCollapse: true,
      sidebarBadges: true,
      startMinimized: true,
      closeToTray: false,
      trayGlance: true,
      notifyGrades: true,
      notifyCourses: true,
      notifyHomework: true,
      homeworkReminderTime: "18:00",
      notifyNews: false,
      notifyMorning: false,
      quietDuringClasses: true,
      hiddenModules: {},
      moduleOrder: {},
      setPreference: (key, value) => set({ [key]: value }),
      setModuleHidden: (accountId, moduleId, hidden) =>
        set(state => {
          const others = (state.hiddenModules[accountId] ?? []).filter(
            id => id !== moduleId
          );
          return {
            hiddenModules: {
              ...state.hiddenModules,
              [accountId]: hidden ? [...others, moduleId] : others,
            },
          };
        }),
      setModuleOrder: (accountId, order) =>
        set(state => ({
          moduleOrder: { ...state.moduleOrder, [accountId]: order },
        })),
      forgetAccount: accountId =>
        set(({ hiddenModules, moduleOrder }) => ({
          hiddenModules: Object.fromEntries(
            Object.entries(hiddenModules).filter(([id]) => id !== accountId)
          ),
          moduleOrder: Object.fromEntries(
            Object.entries(moduleOrder).filter(([id]) => id !== accountId)
          ),
        })),
    }),
    {
      name: "pieride-settings",
      version: 2,
      migrate: migrateSettings,
    }
  )
);
