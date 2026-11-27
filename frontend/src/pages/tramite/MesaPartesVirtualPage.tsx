import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useHorarioCorte } from "../../hooks/useHorarioCorte";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/stores/authStore";

interface TramiteTupa {
  id: string;
  codigo: string;
  denominacion: string;
}

async function calcularSha256(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export default function MesaPartesVirtualPage() {
  const queryClient = useQueryClient();
  const { isAfterCutoff, requiresProjection, legalDate } = useHorarioCorte();
  const esCorteSuperado = isAfterCutoff || requiresProjection;
  const proximoDiaHabil = legalDate;
  const correoSesion = useAuthStore((state) => state.usuario?.correo ?? "");

  const [solicitante, setSolicitante] = useState("");
  const [asunto, setAsunto] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [estadoCarga, setEstadoCarga] = useState("Pendiente de archivo");
  const [resultado, setResultado] = useState("Pendiente");
  const [sha256Hash, setSha256Hash] = useState("---");
  const [timestampTecnico, setTimestampTecnico] = useState("---");
  const [timestampLegal, setTimestampLegal] = useState("---");
  const [idPersona, setIdPersona] = useState("");
  const [correo, setCorreo] = useState(correoSesion);
  const [tramites, setTramites] = useState<TramiteTupa[]>([]);
  const [idTipoTramite, setIdTipoTramite] = useState("");
  const [error, setError] = useState<string | null>(null);

  const esExitoso = resultado.includes("exitosamente") || estadoCarga.includes("Completado");

  useEffect(() => {
    void (async () => {
      try {
        const [perfil, catalogo] = await Promise.all([
          apiClient.get<{ idPersona?: string; correo?: string }>("/api/v1/auth/me"),
          apiClient.get<TramiteTupa[]>("/api/v1/tramites/tipos"),
        ]);
        setIdPersona(perfil.data.idPersona ?? "");
        setCorreo(perfil.data.correo ?? correoSesion);
        setTramites(catalogo.data);
        if (catalogo.data.length > 0) setIdTipoTramite(catalogo.data[0].id);
      } catch {
        setError("Inicie sesión para radicar un trámite con su identidad institucional.");
      }
    })();
  }, [correoSesion]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("El documento debe ser un archivo PDF.");
      return;
    }
    try {
      setError(null);
      setArchivo(file);
      setSha256Hash(await calcularSha256(file));
      setEstadoCarga(`Archivo listo: ${file.name}`);
    } catch {
      setError("No fue posible calcular el hash SHA-256 del documento.");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!archivo || !idPersona || !idTipoTramite || !correo) {
      setError("Debe iniciar sesión, escoger un trámite y adjuntar un PDF válido.");
      return;
    }

    try {
      setEstadoCarga("Solicitando URL prefirmada...");
      setResultado("Procesando radicación...");
      const { data: presign } = await apiClient.post<{
        uploadUrl: string;
        s3Key: string;
      }>("/api/v1/storage/presigned-url", {
        nombreArchivo: archivo.name,
        tamanoBytes: archivo.size,
        mimeType: "application/pdf",
        sha256Hash: sha256Hash,
      });

      setEstadoCarga("Transmitiendo documento...");
      await apiClient.put(
        "/api/v1/storage/upload-binario",
        archivo,
        {
          params: { s3Key: presign.s3Key },
          headers: {
            "Content-Type": "application/pdf",
            "X-SHA256": sha256Hash,
          },
          timeout: 60_000,
        },
      );

      setEstadoCarga("Radicando en el sistema...");
      const { data } = await apiClient.post<{
        cut: string;
        fechaEnvioReal: string;
        fechaRadicacionLegal: string;
      }>("/api/v1/tramites/radicacion-virtual", {
        asunto,
        idTipoTramiteTupa: idTipoTramite,
        idPersona,
        nombreSolicitante: solicitante,
        correo,
        totalFolios: 1,
        documentos: [
          {
            nombreArchivo: archivo.name,
            contentType: "application/pdf",
            tamanoBytes: archivo.size,
            hashSha256: sha256Hash,
            storagePath: presign.s3Key,
          },
        ],
      });

      setEstadoCarga("Completado");
      setResultado(`Radicado exitosamente con CUT ${data.cut}`);
      setTimestampTecnico(data.fechaEnvioReal);
      setTimestampLegal(data.fechaRadicacionLegal);
      void queryClient.invalidateQueries({ queryKey: ["expedientes"] });
    } catch (err) {
      setEstadoCarga("Error en la transferencia");
      setResultado("Fallido");
      setError(err instanceof Error ? err.message : "No fue posible radicar el trámite.");
    }
  }

  return (
    <main className="min-h-screen w-full bg-gradient-to-br from-sky-200 via-sky-300 to-sky-400 text-slate-800 pb-12 px-4 sm:px-6 lg:px-8">
      {/* Cabecera de ancho completo */}
      <header className="border-b border-sky-300/60 bg-sky-100/40 backdrop-blur-md shadow-sm -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-5 mb-8">
        <div className="max-w-7xl mx-auto">
          <nav className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-700">
            <Link to="/" className="hover:text-blue-700">Inicio</Link>
            <span>/</span>
            <Link to="/tramite" className="hover:text-blue-700">Trámite Documentario</Link>
            <span>/</span>
            <span className="text-slate-900 font-semibold">Mesa de Partes Virtual</span>
          </nav>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="inline-block rounded bg-blue-100/80 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-blue-900 border border-blue-300 mb-1">
                SIGD · Módulo 01 Institucional
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Mesa de Partes Virtual
              </h1>
              <p className="mt-1 text-sm text-slate-700">
                Plataforma oficial para la recepción segura de documentos y control de horario legal LPAG.
              </p>
            </div>
            <Link
              to="/"
              className="rounded-lg bg-white/90 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-white border border-slate-300 transition"
            >
              ← Volver al inicio
            </Link>
          </div>
        </div>
      </header>

      {/* Contenedor principal de ancho fluido */}
      <div className="max-w-7xl mx-auto space-y-6">
        {error && (
          <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-xs font-medium text-red-800">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-sky-300/60 bg-white/90 p-4 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-md">
          <p>
            <strong className="text-blue-900">Nota técnica:</strong> El hash SHA-256 se calcula sobre el PDF real y la transmisión usa una URL prefirmada del repositorio institucional.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
          {/* SECCIÓN 1: DATOS DEL TRÁMITE */}
          <div className="space-y-4 rounded-2xl border border-sky-300/60 bg-white/90 p-6 shadow-lg backdrop-blur-md md:col-span-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b border-sky-100 pb-2">
              1. Datos del Solicitante y Trámite
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Solicitante *</label>
                <input
                  type="text"
                  required
                  value={solicitante}
                  onChange={(e) => setSolicitante(e.target.value)}
                  placeholder="Nombres y Apellidos del administrado"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Correo para notificaciones *</label>
                <input
                  type="email"
                  required
                  readOnly
                  value={correo}
                  className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Procedimiento TUPA *</label>
                <select
                  required
                  value={idTipoTramite}
                  onChange={(e) => setIdTipoTramite(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-2 text-sm text-slate-800"
                >
                  {tramites.map((tramite) => (
                    <option key={tramite.id} value={tramite.id}>
                      {tramite.codigo} — {tramite.denominacion}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Asunto / Petitorio *</label>
                <input
                  type="text"
                  required
                  value={asunto}
                  onChange={(e) => setAsunto(e.target.value)}
                  placeholder="Descripción detallada del trámite"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: CARGA DOCUMENTARIA */}
          <div className="space-y-4 rounded-2xl border border-sky-300/60 bg-white/90 p-6 shadow-lg backdrop-blur-md">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b border-sky-100 pb-2">
              2. Carga Documentaria (PDF)
            </h2>

            <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-sky-300 bg-sky-50/40 p-6 text-center cursor-pointer hover:bg-sky-50/80 transition">
              <span className="text-xs font-semibold text-slate-700">
                {archivo ? `Archivo seleccionado: ${archivo.name}` : "Haga clic para adjuntar archivo PDF"}
              </span>
              <span className="mt-1 text-[11px] text-slate-500">Documento principal firmado digitalmente (Máx. 25 MB)</span>
              <input type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
            </label>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 font-medium">
              <div className="flex items-center gap-1.5 bg-slate-50/80 p-2 rounded border border-slate-200">Validación MIME real</div>
              <div className="flex items-center gap-1.5 bg-slate-50/80 p-2 rounded border border-slate-200">Hash SHA-256 real</div>
              <div className="flex items-center gap-1.5 bg-slate-50/80 p-2 rounded border border-slate-200">URL PUT prefirmada</div>
              <div className="flex items-center gap-1.5 bg-slate-50/80 p-2 rounded border border-slate-200">Radicación con CUT</div>
            </div>
          </div>

          {/* SECCIÓN 3: CONTROL DE HORARIO LPAG */}
          <div className="space-y-4 rounded-2xl border border-sky-300/60 bg-white/90 p-6 shadow-lg backdrop-blur-md">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b border-sky-100 pb-2">
              3. Control de Horario LPAG
            </h2>
            <p className="text-xs text-slate-600">
              El servidor aplica el horario oficial de America/Lima y proyecta la fecha legal cuando supera la corte de las 16:30.
            </p>

            {esCorteSuperado && (
              <div className="rounded-lg border border-amber-300 bg-amber-50/90 p-3 text-xs text-amber-900 shadow-sm">
                <p className="font-bold">Aviso legal de recepción:</p>
                <p className="mt-0.5">
                  Las solicitudes presentadas posterior al horario de corte se consideran ingresadas a las 08:00 hrs del día hábil siguiente (<strong className="font-mono">{proximoDiaHabil}</strong>).
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
              <div className="bg-slate-50/80 p-2.5 rounded border border-slate-200">
                <span className="block font-bold text-[10px] text-slate-400 uppercase">Condición</span>
                <span className="font-medium">{esCorteSuperado ? "Fuera de jornada" : "Jornada ordinaria"}</span>
              </div>
              <div className="bg-slate-50/80 p-2.5 rounded border border-slate-200">
                <span className="block font-bold text-[10px] text-slate-400 uppercase">Efecto legal</span>
                <span className="font-mono font-medium">{proximoDiaHabil}</span>
              </div>
            </div>
          </div>

          {/* BOTÓN DE ACCIÓN INSTITUCIONAL */}
          <div className="md:col-span-2 flex justify-end pt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-800 transition"
            >
              ✓ Iniciar Carga Segura y Registrar Trámite
            </button>
          </div>
        </form>

        {/* SECCIÓN 4: RESULTADO DE RADICACIÓN (TODOS VERDES CUANDO ES EXITOSO) */}
        <div className="space-y-4 rounded-2xl border border-sky-300/60 bg-white/90 p-6 shadow-lg backdrop-blur-md">
          <h2 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b border-sky-100 pb-2">
            4. Resultado Institucional de Radicación
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 text-xs">
            {/* Estado de Transmisión */}
            <div className={`p-3 rounded-lg border transition-colors ${esExitoso ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-medium shadow-sm" : "bg-slate-50/80 border-slate-200 text-slate-800"}`}>
              <span className={`block font-bold uppercase text-[10px] ${esExitoso ? "text-emerald-700" : "text-slate-400"}`}>Estado de Transmisión</span>
              <span className="font-semibold">{estadoCarga}</span>
            </div>

            {/* Resultado de Radicación */}
            <div className={`p-3 rounded-lg border transition-colors ${esExitoso ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-medium shadow-sm" : "bg-slate-50/80 border-slate-200 text-slate-800"}`}>
              <span className={`block font-bold uppercase text-[10px] ${esExitoso ? "text-emerald-700" : "text-slate-400"}`}>Resultado de Radicación</span>
              <span className="font-semibold">{resultado}</span>
            </div>

            {/* Timestamp Técnico */}
            <div className={`p-3 rounded-lg border transition-colors ${esExitoso ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-medium shadow-sm" : "bg-slate-50/80 border-slate-200 text-slate-800"}`}>
              <span className={`block font-bold uppercase text-[10px] ${esExitoso ? "text-emerald-700" : "text-slate-400"}`}>Timestamp Técnico</span>
              <span className="font-mono text-[11px]">{timestampTecnico}</span>
            </div>

            {/* Timestamp Legal (LPAG) */}
            <div className={`p-3 rounded-lg border transition-colors ${esExitoso ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-medium shadow-sm" : "bg-slate-50/80 border-slate-200 text-slate-800"}`}>
              <span className={`block font-bold uppercase text-[10px] ${esExitoso ? "text-emerald-700" : "text-slate-400"}`}>Timestamp Legal (LPAG)</span>
              <span className="font-mono text-[11px]">{timestampLegal}</span>
            </div>

            {/* Solicitante Registrado */}
            <div className={`p-3 rounded-lg border transition-colors ${esExitoso ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-medium shadow-sm" : "bg-slate-50/80 border-slate-200 text-slate-800"}`}>
              <span className={`block font-bold uppercase text-[10px] ${esExitoso ? "text-emerald-700" : "text-slate-400"}`}>Solicitante Registrado</span>
              <span className="font-medium">{solicitante || "---"}</span>
            </div>

            {/* Asunto Declarado */}
            <div className={`p-3 rounded-lg border transition-colors ${esExitoso ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-medium shadow-sm" : "bg-slate-50/80 border-slate-200 text-slate-800"}`}>
              <span className={`block font-bold uppercase text-[10px] ${esExitoso ? "text-emerald-700" : "text-slate-400"}`}>Asunto Declarado</span>
              <span className="font-medium">{asunto || "---"}</span>
            </div>

            {/* Hash SHA-256 */}
            <div className={`sm:col-span-2 p-3 rounded-lg border transition-colors ${esExitoso ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-medium shadow-sm" : "bg-slate-50/80 border-slate-200 text-slate-800"}`}>
              <span className={`block font-bold uppercase text-[10px] ${esExitoso ? "text-emerald-700" : "text-slate-400"}`}>Hash SHA-256 (Verificación Íntegra)</span>
              <span className="font-mono text-[11px] break-all">{sha256Hash}</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-600 pt-2 border-t border-sky-100">
            Validación automatizada del sistema. Suite de pruebas configurada en <code className="bg-sky-100 px-1 py-0.5 rounded text-blue-900 font-mono">tests/unit</code> y <code className="bg-sky-100 px-1 py-0.5 rounded text-blue-900 font-mono">tests/integration/m2</code>.
          </p>
        </div>
      </div>
    </main>
  );
}