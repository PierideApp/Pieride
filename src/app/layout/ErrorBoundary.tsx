import { Component, type ReactNode } from "react";

import { startScreen } from "@/app/layout/StartScreen";
import i18n from "@/lib/i18n";
import { report } from "@/lib/log";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
  };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Erreur lors du montage de React :", error, info);
    report("app", error);
    window.appError(i18n.t("errors.crashed"));
  }

  render() {
    if (this.state.hasError) {
      return startScreen(i18n.t("errors.crashed"), "alert");
    }

    return this.props.children;
  }
}
