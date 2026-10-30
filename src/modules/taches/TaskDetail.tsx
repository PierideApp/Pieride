// Détail d'un devoir dans le panneau de droite (maquette 04-taches/02-tableau-detail,
// `task_inspector`) : état (Espace le change), consigne, pièces jointes, date et enseignant.
// Relu dans la base à chaque synchro : il suit le devoir coché depuis le tableau.
import { Calendar, Check, User } from "@getpapillon/papicons";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { AttachmentList } from "@/components/AttachmentList/AttachmentList";
import { Card } from "@/components/Card/Card";
import { Section } from "@/components/Section/Section";
import { SettingRow } from "@/components/SettingRow/SettingRow";
import { capitalize, useDateFormats } from "@/hooks/useFormats";
import { useHomework } from "@/hooks/useHomework";
import { useSubjects } from "@/hooks/useSubjects";
import { subjectStyle } from "@/lib/subjects";

import styles from "./taches.module.scss";
import { TaskCheck } from "./TaskCheck";
import { useToggleHomework } from "./toggle";

/** Une touche tapée dans un champ ou sur un bouton ne coche pas le devoir. */
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "SUMMARY"].includes(
      target.tagName
    ));

export function TaskDetail({
  accountId,
  dueAt,
  serviceId,
  id,
}: {
  accountId: string | undefined;
  dueAt: Date;
  serviceId: string;
  id: string;
}) {
  const { t } = useTranslation();
  const formats = useDateFormats();
  const tasks = useHomework(accountId, dueAt);
  const subjects = useSubjects(accountId);
  const { toggle, error, pending } = useToggleHomework();
  const item =
    tasks.status === "ready"
      ? tasks.data.find(task => task.serviceId === serviceId && task.id === id)
      : undefined;

  useEffect(() => {
    if (!item) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === " " &&
        !event.repeat &&
        !isTyping(event.target) &&
        !document.querySelector("dialog[open]")
      ) {
        event.preventDefault();
        void toggle(item);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [item, toggle]);

  if (!item) {
    return null;
  }
  const teacher =
    subjects.status === "ready"
      ? subjects.data.find(subject => subject.name === item.subject)?.teacher
      : undefined;

  return (
    <div className={styles.detail} style={subjectStyle(item.color)}>
      <Section title={t("taches.state")}>
        <Card className={styles.stateCard}>
          <TaskCheck
            item={item}
            size={24}
            busy={pending === item.id}
            onToggle={toggle}
          />
          <strong>{t(item.done ? "taches.done" : "taches.notDone")}</strong>
          <kbd className={styles.kbd}>{t("taches.space")}</kbd>
          <button
            type="button"
            className={styles.softButton}
            disabled={pending === item.id}
            onClick={() => void toggle(item)}
          >
            {!item.done && <Check size={16} aria-hidden="true" />}
            {t(item.done ? "taches.markTodo" : "taches.done")}
          </button>
        </Card>
        {error && (
          <p className={styles.error} role="alert">
            {t(error)}
          </p>
        )}
      </Section>
      <Section title={t("taches.description")}>
        <Card className={styles.descriptionCard}>
          <p>{item.content}</p>
        </Card>
      </Section>
      {item.attachments.length > 0 && (
        <Section title={t("taches.attachments")}>
          <AttachmentList attachments={item.attachments} />
        </Section>
      )}
      <Section title={t("taches.information")}>
        <Card rows>
          {item.givenAt && (
            <SettingRow
              icon={Calendar}
              tone="subject"
              title={t("taches.givenAt")}
              value={capitalize(
                formats.longDate.format(item.givenAt),
                formats.locale
              )}
            />
          )}
          {teacher && (
            <SettingRow
              icon={User}
              tone="subject"
              title={t("cours.teacher")}
              value={teacher}
            />
          )}
          <SettingRow
            icon={Calendar}
            tone="subject"
            title={t("taches.dueAt")}
            value={capitalize(
              formats.longDate.format(item.dueAt),
              formats.locale
            )}
          />
        </Card>
      </Section>
    </div>
  );
}
