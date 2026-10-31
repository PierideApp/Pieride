// Cocher un devoir depuis le tableau, la liste ou le détail : chez le service puis dans la
// base (AccountManager), et les écrans relisent la base. Une erreur s'affiche par sa clé i18n.
import { useState } from "react";

import type { HomeworkView } from "@/hooks/useHomework";
import { log } from "@/lib/log";
import { accountManager } from "@/services";
import {
  AuthenticationError,
  SecurityChallenge,
  ServiceUnavailable,
  UnsupportedService,
} from "@/services/shared/errors";
import { useSyncStore } from "@/stores/sync";

function errorKey(error: unknown): string {
  return error instanceof AuthenticationError ||
    error instanceof ServiceUnavailable ||
    error instanceof SecurityChallenge ||
    error instanceof UnsupportedService
    ? `errors.${error.name}`
    : "errors.Unknown";
}

export function useToggleHomework() {
  const reload = useSyncStore(state => state.reload);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const toggle = async (item: HomeworkView) => {
    setError(null);
    setPending(item.id);
    try {
      await accountManager.setHomeworkDone(item.serviceId, item.id, !item.done);
      reload("homework");
    } catch (failure) {
      const key = errorKey(failure);
      // Le type d'erreur seulement : le message d'une bibliothèque peut contenir un jeton.
      log("warn", "tasks", `Devoir non coché : ${key}`);
      setError(key);
    } finally {
      setPending(null);
    }
  };

  return { toggle, error, pending };
}
