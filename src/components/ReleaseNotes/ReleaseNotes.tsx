// Les notes d'une version, lues dans `.github/changelog/` (lib/changelog.ts) : titre, rubriques, listes.
// Partagées par les Paramètres et le dialogue qui suit une mise à jour.
import { parseInline, parseNotes } from "@/lib/changelog";

import styles from "./ReleaseNotes.module.scss";

function Inline({ text }: { text: string }) {
  return parseInline(text).map((part, index) =>
    part.kind === "strong" ? (
      <strong key={index}>{part.text}</strong>
    ) : part.kind === "code" ? (
      <code key={index}>{part.text}</code>
    ) : (
      part.text
    )
  );
}

export function ReleaseNotes({
  title,
  body,
}: {
  title?: string;
  /** Le Markdown de la version (`Release.body`). */
  body: string;
}) {
  return (
    <div className={styles.notes}>
      {title && <h3>{title}</h3>}
      {parseNotes(body).map((block, index) =>
        block.kind === "heading" ? (
          <h4 key={index}>
            <Inline text={block.text} />
          </h4>
        ) : block.kind === "list" ? (
          <ul key={index}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <Inline text={item} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={index}>
            <Inline text={block.text} />
          </p>
        )
      )}
    </div>
  );
}
