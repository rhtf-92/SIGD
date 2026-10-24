import { Component, type ErrorInfo, type ReactNode } from "react";

import EscenaErrorConexion from "./EscenaErrorConexion";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary captured:", error, errorInfo);
    try {
      window.dispatchEvent(
        new CustomEvent("sigd:mostrar-error-sistema", {
          detail: { tipo: "bug", motivo: "react-render-error" },
        })
      );
    } catch {
      // ignore
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <main className="flex w-full items-center justify-center py-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
            <EscenaErrorConexion
              codigo="Error del sistema"
              titulo="Fallo o bug detectado"
              descripcion="La página presentó problemas o errores inesperados. Se activó el protocolo de protección del sistema."
            >
              <button
                type="button"
                className="btn-primary"
                onClick={() => window.location.reload()}
              >
                Recargar sistema
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  window.location.href = "/";
                }}
              >
                Volver al inicio
              </button>
            </EscenaErrorConexion>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
