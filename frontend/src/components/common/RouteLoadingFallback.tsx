export default function RouteLoadingFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[50vh] flex-col items-center justify-center p-8 text-center"
    >
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600 mb-4" />
      <span className="text-sm font-medium text-slate-600">Cargando módulo...</span>
      <span className="sr-only">Cargando contenido del módulo</span>
    </div>
  );
}
