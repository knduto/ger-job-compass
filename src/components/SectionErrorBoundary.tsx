import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { reportLovableError } from "@/lib/lovable-error-reporting";

type Props = {
  children: ReactNode;
  title: string;
};

type State = {
  error: Error | null;
};

export class SectionErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    reportLovableError(error, {
      boundary: "section_error_boundary",
      componentStack: info.componentStack ?? "",
    });
  }

  override render() {
    if (this.state.error) {
      return (
        <section className="rounded-lg border border-destructive bg-card p-4" role="alert">
          <h2 className="font-semibold">{this.props.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Dieser Bereich konnte nicht geladen werden. Der restliche Live-Abruf bleibt verfügbar.
          </p>
          <Button className="mt-3" variant="outline" onClick={() => this.setState({ error: null })}>
            Erneut versuchen
          </Button>
        </section>
      );
    }

    return this.props.children;
  }
}