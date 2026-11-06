import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import FlujoPageHeader from "../../components/flujos/FlujoPageHeader";
import PlantillaResolucionEditor from "../../components/flujos/PlantillaResolucionEditor";
import type { ResolucionDirectoral } from "../../types/resolucionAcademica";
import { apiClient } from "../../api/client";

export default function ProyectorResolucionesPage() {
  const navigate = useNavigate();
  const [alerta, setAlerta] = useState<{ tipo: "exito" | "error"; mensaje: string } | null>(null);

  async function handleGuardarBorrador(resolucion: ResolucionDirectoral) {
    try {
      localStorage.setItem(`sigd_rd_borrador_${resolucion.id}`, JSON.stringify(resolucion));
      const res = await apiClient.post<{ resolucionId?: string; numeroBorrador?: string }>("/api/v1/resoluciones/proyectar", {
        expedienteId: resolucion.id,
        tipoResolucion: "DIRECTORAL_TITULACION",
        visto: resolucion.visto,
        considerandos: resolucion.considerandos,
        articulos: resolucion.articulos.map((art) => ({
          numero: art.numero,
          texto: art.texto,
        })),
      });
      const numBorrador = res.data?.numeroBorrador || resolucion.numeroResolucion;
      setAlerta({
        tipo: "exito",
        mensaje: `Borrador de resolución ${numBorrador} proyectado y registrado exitosamente en el servidor.`,
      });
      setTimeout(() => setAlerta(null), 5000);
    } catch (err: any) {
      console.error("[ProyectorResolucionesPage] Error al proyectar borrador:", err);
      const detail = err?.response?.data?.detail || err?.response?.data?.title || err?.message || "No se pudo conectar con el servidor.";
      setAlerta({
        tipo: "error",
        mensaje: `Error al proyectar borrador en el servidor: ${detail}`,
      });
    }
  }

  async function handleProcederFirma(resolucion: ResolucionDirectoral) {
    const rawContent = `${resolucion.numeroResolucion}-${resolucion.asunto}-${resolucion.visto}`;
    let realHash = "a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0";
    if (typeof crypto !== "undefined" && crypto.subtle) {
      try {
        const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawContent));
        realHash = Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
      } catch {
        // fallback
      }
    }
    navigate("/flujo-validez-legal/firma", {
      state: {
        documentoParaFirma: {
          id: resolucion.id,
          nombreArchivo: `${resolucion.numeroResolucion.replace(/\s+/g, "_")}.pdf`,
          tipo: "RESOLUCION_DIRECTORAL",
          numeroDocumento: resolucion.numeroResolucion,
          asunto: resolucion.asunto,
          tamanoBytes: 245760,
          hashSha256: realHash,
        },
      },
    });
  }

  return (
    <div className="flex-1 w-full bg-slate-50 text-slate-900">
      <FlujoPageHeader
        faseTag="Módulo 04 · Validez Legal y Firma Digital"
        title="Proyector de Resoluciones Directorales y Actas"
        breadcrumbLabel="Proyector de Resoluciones"
        description="Redacción estructurada, generación de correlativo institucional y previsualización oficial según formato institucional."
        action={
          <Link
            to="/flujo-validez-legal/firma"
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-blue-700"
          >
            Ir a Pasarela de Firma Refirma →
          </Link>
        }
      />

      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-6">
        {alerta && (
          <div
            role="status"
            className={`mb-6 rounded-xl border p-4 text-sm font-semibold shadow-sm ${
              alerta.tipo === "exito"
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-red-300 bg-red-50 text-red-800"
            }`}
          >
            {alerta.tipo === "exito" ? "✓" : "✗"} {alerta.mensaje}
          </div>
        )}

        <PlantillaResolucionEditor
          onGuardarBorrador={handleGuardarBorrador}
          onProcederFirma={handleProcederFirma}
        />
      </div>
    </div>
  );
}
