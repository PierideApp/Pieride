// Matières (maquettes 05-matieres et 06-modifier-matiere) : nom, couleur et emoji de chaque
// matière du compte affiché, partout dans Piéride. Un clic ouvre l'éditeur de la matière.
// Les choix vont dans la base (`subjects`), via l'AccountManager.
import { ChevronRight, Emoji } from "@getpapillon/papicons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button/Button";
import { Card } from "@/components/Card/Card";
import { ColorSwatches } from "@/components/ColorSwatches/ColorSwatches";
import { ConfirmDialog } from "@/components/ConfirmDialog/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState/EmptyState";
import { Notice } from "@/components/Notice/Notice";
import { SearchField } from "@/components/SearchField/SearchField";
import { Section } from "@/components/Section/Section";
import { SettingRow } from "@/components/SettingRow/SettingRow";
import { SubPageHeader } from "@/components/SubPageHeader/SubPageHeader";
import { TextField } from "@/components/TextField/TextField";
import { useSubjects } from "@/hooks/useSubjects";
import {
  firstGrapheme,
  simplify,
  SUBJECT_COLORS,
  SUBJECT_EMOJIS,
  subjectStyle,
  type SubjectView,
} from "@/lib/subjects";
import { accountManager } from "@/services";
import { useSyncStore } from "@/stores/sync";

import type { SettingsSectionProps } from "./Settings";
import styles from "./settings.module.scss";

type Choice = Parameters<typeof accountManager.updateSubject>[2];

/** Un emoji, pas une lettre : pictogramme ou drapeau. */
const isEmoji = (text: string) =>
  /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(text);

function SubjectTile({ subject }: { subject: SubjectView }) {
  return (
    <span
      className={styles.subjectTile}
      style={subjectStyle(subject.color)}
      aria-hidden="true"
    >
      {subject.emoji}
    </span>
  );
}

function SubjectEditor({
  subject,
  onBack,
  onChange,
}: {
  subject: SubjectView;
  onBack: () => void;
  onChange: (choice: Choice) => void;
}) {
  const { t } = useTranslation();
  const chosenLabel = subject.label === subject.name ? "" : subject.label;
  const [label, setLabel] = useState(chosenLabel);
  const [other, setOther] = useState("");
  const emojis = [...new Set([subject.emoji, ...SUBJECT_EMOJIS])];
  const colors = [...new Set([...SUBJECT_COLORS, subject.color])];

  return (
    <>
      <SubPageHeader
        back={t("settings.subjects.all")}
        onBack={onBack}
        title={subject.label}
        text={t("settings.subjects.everywhere")}
      />

      <Section title={t("settings.subjects.preview")} level={4}>
        <Card className={styles.padded}>
          <SettingRow
            className={styles.coursePreview}
            style={subjectStyle(subject.color)}
            media={<SubjectTile subject={subject} />}
            title={subject.label}
            text={subject.teacher ?? t("settings.subjects.previewText")}
          />
        </Card>
      </Section>

      <Section title={t("settings.subjects.name")} level={4}>
        <Card className={styles.padded}>
          <TextField
            label={t("settings.subjects.original", { name: subject.name })}
            value={label}
            placeholder={subject.name}
            maxLength={60}
            onChange={event => setLabel(event.target.value)}
            onBlur={() => {
              const next = label.trim();
              if (next !== chosenLabel) {
                onChange({
                  displayName: next && next !== subject.name ? next : null,
                });
              }
            }}
            onKeyDown={event => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
          />
        </Card>
      </Section>

      <Section
        title={t("settings.subjects.emoji")}
        titleId="subject-emoji"
        level={4}
      >
        <Card className={styles.padded}>
          <div
            className={styles.emojis}
            role="radiogroup"
            aria-labelledby="subject-emoji"
          >
            {emojis.map(emoji => (
              <label
                key={emoji}
                className={styles.emojiChoice}
                data-checked={emoji === subject.emoji || undefined}
              >
                <input
                  type="radio"
                  name="subject-emoji"
                  aria-label={emoji}
                  checked={emoji === subject.emoji}
                  onChange={() => onChange({ emoji })}
                />
                {emoji}
              </label>
            ))}
          </div>
          <TextField
            label={t("settings.subjects.otherEmoji")}
            className={styles.emojiInput}
            value={other}
            placeholder="✏️"
            onChange={event => {
              const emoji = firstGrapheme(event.target.value);
              setOther(emoji);
              if (isEmoji(emoji)) {
                onChange({ emoji });
              }
            }}
          />
        </Card>
      </Section>

      <Section
        title={t("settings.subjects.color")}
        titleId="subject-color"
        level={4}
      >
        <Card className={styles.padded}>
          <ColorSwatches
            name="subject-color"
            labelledBy="subject-color"
            value={subject.color}
            options={colors.map((color, index) => ({
              value: color,
              color,
              label: t("settings.subjects.colorNumber", { number: index + 1 }),
            }))}
            onChange={color => onChange({ color })}
          />
        </Card>
      </Section>

      {subject.customized && (
        <Button
          onClick={() => {
            setLabel("");
            onChange({ displayName: null, color: null, emoji: null });
          }}
        >
          {t("settings.subjects.resetOne")}
        </Button>
      )}
    </>
  );
}

export function SubjectsSettings({ account }: SettingsSectionProps) {
  const { t } = useTranslation();
  const list = useSubjects(account?.id);
  const reload = useSyncStore(state => state.reload);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!account) {
    return <Notice>{t("settings.account.noAccount")}</Notice>;
  }
  if (list.status === "loading") {
    return null;
  }
  if (list.status === "error") {
    return (
      <p className={styles.error} role="alert">
        {t("errors.database")}
      </p>
    );
  }
  const run = async (task: () => Promise<void>) => {
    setFailed(false);
    try {
      await task();
      reload();
    } catch (error) {
      // Seul un code d'erreur de la base remonte ici.
      // eslint-disable-next-line no-console
      console.error(error);
      setFailed(true);
    }
  };
  const error = failed && (
    <p className={styles.error} role="alert">
      {t("errors.database")}
    </p>
  );

  const subject = list.data.find(({ name }) => name === editing);
  if (subject) {
    return (
      <>
        <SubjectEditor
          key={subject.name}
          subject={subject}
          onBack={() => setEditing(null)}
          onChange={choice =>
            void run(() =>
              accountManager.updateSubject(account.id, subject.name, choice)
            )
          }
        />
        {error}
      </>
    );
  }
  if (list.data.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Emoji}
          title={t("settings.subjects.emptyTitle")}
          text={t("settings.subjects.emptyText")}
        />
      </Card>
    );
  }
  const words = simplify(query).split(/\s+/).filter(Boolean);
  const shown = list.data.filter(({ label, name }) =>
    words.every(word => simplify(`${label} ${name}`).includes(word))
  );

  return (
    <>
      <div className={styles.toolbar}>
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder={t("settings.subjects.search")}
        />
        <Button
          variant="danger"
          disabled={!list.data.some(({ customized }) => customized)}
          onClick={() => setResetting(true)}
        >
          {t("settings.subjects.reset")}
        </Button>
      </div>
      {error}
      {shown.length === 0 ? (
        <Notice>{t("settings.subjects.noMatch")}</Notice>
      ) : (
        <Card as="ul" rows>
          {shown.map(item => (
            <li key={item.name}>
              <SettingRow
                as="button"
                media={<SubjectTile subject={item} />}
                title={item.label}
                text={item.teacher}
                onClick={() => setEditing(item.name)}
              >
                <span
                  className={styles.subjectDot}
                  style={subjectStyle(item.color)}
                  aria-hidden="true"
                />
                <ChevronRight size={14} aria-hidden="true" />
              </SettingRow>
            </li>
          ))}
        </Card>
      )}

      <ConfirmDialog
        open={resetting}
        title={t("settings.subjects.resetTitle")}
        text={t("settings.subjects.resetText")}
        confirm={t("settings.subjects.reset")}
        danger
        onCancel={() => setResetting(false)}
        onConfirm={() => {
          setResetting(false);
          void run(() => accountManager.resetSubjects(account.id));
        }}
      />
    </>
  );
}
