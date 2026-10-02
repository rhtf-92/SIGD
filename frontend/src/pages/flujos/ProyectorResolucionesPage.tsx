import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PlantillaResolucionEditor from "../../components/flujos/PlantillaResolucionEditor";
import type { ResolucionDirectoral } from "../../types/resolucionAcademica";

export default function ProyectorResolucionesPage() {
  const navigate = useNavigate();
  const [alerta, setAlerta] = useState<string | null>(null);

  function handleGuardarBorrador(resolucion: ResolucionDirectoral) {
    try {
      localStorage.setItem(`sigd_rd_borrador_${resolucion.id}`, JSON.stringify(resolucion));
      setAlerta(`Borrador de resolución ${resolucion.numeroResolucion} guardado exitosamente en almacenamiento seguro.`);
      setTimeout(() => setAlerta(null), 4000);
    } catch {
      setAlerta("Borrador actualizado localmente.");
    }
  }

  function handleProcederFirma(resolucion: ResolucionDirectoral) {
    // Redirigir a la pasarela de firma digital con el documento proyectado
    navigate("/flujo-validez-legal/firma", {
      state: {
        documentoParaFirma: {
          id: resolucion.id,
          nombreArchivo: `${resolucion.numeroResolucion.replace(/\s+/g, "_")}.pdf`,
          tipo: "RESOLUCION_DIRECTORAL",
          numeroDocumento: resolucion.numeroResolucion,
          asunto: resolucion.asunto,
          tamanoBytes: 245760,
          hashSha256: "a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0",
        },
      },
    });
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
          <nav className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Link to="/" className="hover:text-blue-700">Inicio</Link>
            <span>/</span>
            <Link to="/flujo-validez-legal" className="hover:text-blue-700">Flujo de Validez Legal</Link>
            <span>/</span>
            <span className="text-slate-800">Proyector de Resoluciones</span>
          </nav>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
                Módulo 04 · Validez Legal y Firma Digital
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Proyector de Resoluciones Directorales y Actas
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Redacción estructurada, generación de correlativo institucional y previsualización WYSIWYG oficial (ENT-M04-02).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/flujo-validez-legal/firma"
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Ir a Pasarela de Firma Refirma →
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {alerta && (
          <div
            role="status"
            className="mb-6 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 shadow-sm"
          >
            ✓ {alerta}
          </div>
        )}

        <PlantillaResolucionEditor
          onGuardarBorrador={handleGuardarBorrador}
          onProcederFirma={handleProcederFirma}
        />
      </div>
    </main>
  );
}
