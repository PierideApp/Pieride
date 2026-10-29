// Apparence d'une matière : le nom, la couleur et l'emoji choisis dans Paramètres > Matières,
// sinon des valeurs par défaut stables, déduites du nom donné par le service.

/** Couleurs proposées (maquette 06-modifier-matiere), éclaircies en thème sombre (CSS). */
export const SUBJECT_COLORS = [
  "#c50017",
  "#da2400",
  "#dd6b00",
  "#e8901c",
  "#e8b048",
  "#6bae00",
  "#37bb12",
  "#12bb67",
  "#26b290",
  "#26abb2",
  "#2db9d8",
  "#009ec5",
  "#007fda",
  "#3a56d0",
  "#7600ca",
  "#962dd8",
  "#b300ca",
  "#c50066",
  "#dd004a",
  "#dd0030",
] as const;

/** Emojis suggérés en premier dans l'éditeur. */
export const SUBJECT_EMOJIS = [
  "📐",
  "📘",
  "🌍",
  "💬",
  "🧪",
  "🧬",
  "🤸",
  "📊",
  "💻",
  "🎨",
  "🎵",
  "📚",
] as const;

/** Mots du nom (sans accents) et l'emoji qui va avec ; le premier qui correspond gagne. */
const KEYWORDS: readonly [RegExp, string][] = [
  [/math/, "📐"],
  [/histoire|geo/, "🌍"],
  [/francais|lettres|litterature/, "📘"],
  [
    /anglais|espagnol|allemand|italien|portugais|chinois|arabe|langue|\blv\d/,
    "💬",
  ],
  // Avant la physique : PRONOTE écrit souvent « ED.PHYSIQUE & SPORT. ».
  [/\beps\b|sport/, "🤸"],
  [/physique|chimie/, "🧪"],
  [/svt|sciences de la vie|biologie/, "🧬"],
  [/econom|\bses\b|gestion/, "📊"],
  [/informatique|\bnsi\b|numerique|\bsnt\b/, "💻"],
  [/philo/, "🤔"],
  [/musique|musical/, "🎵"],
  [/arts? plastiques|\barts?\b|dessin/, "🎨"],
  [/techno/, "⚙️"],
  [/\bemc\b|civique|morale/, "⚖️"],
  [/latin|grec/, "🏛️"],
];

/** Sans accents ni majuscules, pour comparer et chercher. */
export const simplify = (name: string) =>
  name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export function defaultSubjectEmoji(name: string): string {
  const text = simplify(name);
  return KEYWORDS.find(([pattern]) => pattern.test(text))?.[1] ?? "📚";
}

/** Toujours la même couleur pour un même nom. */
export function defaultSubjectColor(name: string): string {
  let hash = 0;
  for (const char of simplify(name)) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 1_000_003;
  }
  return SUBJECT_COLORS[hash % SUBJECT_COLORS.length] ?? SUBJECT_COLORS[0];
}

/** Le premier caractère visible (un emoji peut faire plusieurs points de code). */
export function firstGrapheme(text: string): string {
  const [first] = new Intl.Segmenter().segment(text.trim());
  return first?.segment ?? "";
}

/** Une matière telle que l'app l'affiche. */
export interface SubjectView {
  /** Le nom donné par le service, qui identifie la matière. */
  name: string;
  /** Le nom affiché : celui choisi par l'élève, sinon celui du service. */
  label: string;
  color: string;
  emoji: string;
  /** L'élève a changé le nom, la couleur ou l'emoji. */
  customized: boolean;
  /** Le dernier enseignant vu dans l'emploi du temps. */
  teacher?: string;
}

interface SubjectRow {
  name: string;
  displayName: string | null;
  color: string | null;
  emoji: string | null;
}

/**
 * Une ligne par matière, même fournie par plusieurs services (le choix de l'élève l'emporte),
 * triée par nom affiché. `taught` : les cours du plus récent au plus ancien.
 */
export function resolveSubjects(
  rows: readonly SubjectRow[],
  taught: readonly { subject: string; teacher: string | null }[],
  locale: string
): SubjectView[] {
  const byName = new Map<string, SubjectRow[]>();
  for (const row of rows) {
    byName.set(row.name, [...(byName.get(row.name) ?? []), row]);
  }
  return [...byName]
    .map(([name, same]) => {
      const displayName = same.find(row => row.displayName)?.displayName;
      const color = same.find(row => row.color)?.color;
      const emoji = same.find(row => row.emoji)?.emoji;
      return {
        name,
        label: displayName ?? name,
        color: color ?? defaultSubjectColor(name),
        emoji: emoji ?? defaultSubjectEmoji(name),
        customized: Boolean(displayName ?? color ?? emoji),
        teacher:
          taught.find(course => course.subject === name && course.teacher)
            ?.teacher ?? undefined,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, locale));
}
