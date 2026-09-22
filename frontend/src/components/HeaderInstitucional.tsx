export default function HeaderInstitucional({ title, description }: { title?: string; description?: string }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-5">
        <p className="text-sm font-bold text-blue-700">SIGD</p>
        <h1 className="text-2xl font-bold">{title || "Institución de Gestión de Expedientes"}</h1>
        <p className="mt-1 text-sm text-slate-500">{description || "Gestión integral de expedientes documentales"}</p>
      </div>
    </header>
  );
}
