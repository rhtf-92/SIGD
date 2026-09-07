import { useNavigate } from "react-router-dom";

interface AdminPageHeaderProps {
  title: string;
  description: string;
}

export default function AdminPageHeader({
  title,
  description,
}: AdminPageHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-5">
        <button
          type="button"
          onClick={() => navigate("/administracion")}
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          ← Volver al panel
        </button>

        <p className="text-sm font-bold text-blue-700">SIGD</p>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
    </header>
  );
}
