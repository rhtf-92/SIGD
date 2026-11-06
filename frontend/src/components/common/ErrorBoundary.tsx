import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  correlationId: string;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    correlationId: "",
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    const correlationId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `CORR-${Date.now()}`;
    return { hasError: true, error, correlationId };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Registro de excepción en auditoría de cliente
    console.error("[ErrorBoundary SIGD] Excepción capturada en renderizado:", {
      error,
      componentStack: errorInfo.componentStack,
      correlationId: this.state.correlationId,
      timestamp: new Date().toISOString(),
    });
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      correlationId: "",
      showDetails: false,
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleVolverInicio = () => {
    this.handleReset();
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  public render() {
    if (this.state.hasError) {
      const title = this.props.fallbackTitle || "Ocurrió una contingencia en la aplicación";
      const errorMessage =
        this.state.error?.message || "Error no especificado en el árbol de componentes.";

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="min-h-[350px] w-full flex items-center justify-center p-6 bg-slate-50 text-slate-800"
        >
          <div className="max-w-xl w-full bg-white rounded-xl shadow-lg border border-slate-200 p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-xl">
                ⚠️
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{title}</h2>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  X-Correlation-ID: {this.state.correlationId}
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-6">
              El Sistema Integral de Gestión Documentaria (SIGD) ha interceptado un error inesperado.
              Puede reintentar la operación o volver a la página principal.
            </p>

            <div className="flex flex-wrap items-center gap-3 mb-6">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 text-sm font-semibold rounded-lg text-white bg-blue-700 hover:bg-blue-800 focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition-colors"
              >
                Reintentar operación
              </button>
              <button
                type="button"
                onClick={this.handleVolverInicio}
                className="px-4 py-2 text-sm font-semibold rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors"
              >
                Volver al inicio
              </button>
              <button
                type="button"
                onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                className="text-xs text-blue-700 underline hover:text-blue-900 ml-auto"
              >
                {this.state.showDetails ? "Ocultar detalles técnicos" : "Ver detalles técnicos"}
              </button>
            </div>

            {this.state.showDetails && (
              <div className="mt-4 p-3 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto">
                <p className="text-red-400 font-semibold mb-1">Detalle del Error:</p>
                <p className="whitespace-pre-wrap">{errorMessage}</p>
                {this.state.error?.stack && (
                  <details className="mt-2 text-slate-400">
                    <summary className="cursor-pointer text-slate-300">Stack Trace</summary>
                    <pre className="mt-1 text-[11px] leading-relaxed whitespace-pre-wrap">
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
