import { useState } from "react";
import { useNavigate } from "react-router-dom";

const TIPOS_TRAMITE = [
  "Solicitud de certificado",
  "Constancia de estudios",
  "Permiso especial",
  "Cambio de turno",
  "Otros",
] as const;

const ESTADOS = [
  "Pendiente",
  "En proceso",
  "Atendido",
  "Archivado",
] as const;

type FormDatos = {
  codigo: string;
  tipo: string;
  asunto: string;
  solicitante: string;
  dni: string;
  fecha: string;
  estado: string;
  observaciones: string;
};

const CLASES_INPUT =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";

const FORM_INICIAL: FormDatos = {
  codigo: "",
  tipo: TIPOS_TRAMITE[0],
  asunto: "",
  solicitante: "",
  dni: "",
  fecha: hoyIso(),
  estado: ESTADOS[0],
  observaciones: "",
};

function hoyIso() {
  return new Date().toISOString().slice(0, 10);
}

function generarCodigo() {
  const numero = String(Math.floor(1000 + Math.random() * 9000));
  return `TR-${new Date().getFullYear()}-${numero}`;
}

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

export default function RegistroTramitePage() {
  const [form, setForm] = useState<FormDatos>(FORM_INICIAL);
  const [registrado, setRegistrado] = useState<string | null>(null);
  const navigate = useNavigate();

  function setCampo(campo: keyof FormDatos, valor: string) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
    setRegistrado(null);
  }

  function limpiarFormulario() {
    setForm(FORM_INICIAL);
    setRegistrado(null);
  }

  function manejarRegistro(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datosAMostrar = form.codigo
      ? form
      : { ...form, codigo: generarCodigo() };
    localStorage.setItem("sigd:tramites", JSON.stringify([datosAMostrar]));
    setForm(datosAMostrar);
    setRegistrado(
      `Trámite ${datosAMostrar.codigo} registrado correctamente.`,
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-slate-50 px-4 py-10 text-slate-900">
      <div className="w-full max-w-2xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Registro de trámite
            </h1>
            <p className="text-sm text-slate-500">
              Complete los datos del trámite documentario.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            ← Volver
          </button>
        </header>

        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <form onSubmit={manejarRegistro} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Campo label="Código del trámite">
              <input
                type="text"
                value={form.codigo}
                onChange={(e) => setCampo("codigo", e.target.value)}
                placeholder="TR-2026-0001"
                className={CLASES_INPUT}
              />
            </Campo>

            <Campo label="Tipo de trámite">
              <select
                value={form.tipo}
                onChange={(e) => setCampo("tipo", e.target.value)}
                className={CLASES_INPUT}
              >
                {TIPOS_TRAMITE.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo label="Solicitante">
              <input
                type="text"
                value={form.solicitante}
                onChange={(e) => setCampo("solicitante", e.target.value)}
                placeholder="Nombre y apellidos"
                className={CLASES_INPUT}
              />
            </Campo>

            <Campo label="DNI">
              <input
                type="text"
                inputMode="numeric"
                value={form.dni}
                onChange={(e) => setCampo("dni", e.target.value)}
                placeholder="00000000"
                className={CLASES_INPUT}
              />
            </Campo>

            <Campo label="Fecha de registro">
              <input
                type="date"
                value={form.fecha}
                onChange={(e) => setCampo("fecha", e.target.value)}
                className={CLASES_INPUT}
              />
            </Campo>

            <Campo label="Estado">
              <select
                value={form.estado}
                onChange={(e) => setCampo("estado", e.target.value)}
                className={CLASES_INPUT}
              >
                {ESTADOS.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado}
                  </option>
                ))}
              </select>
            </Campo>

            <div className="md:col-span-2">
              <Campo label="Asunto">
                <input
                  type="text"
                  value={form.asunto}
                  onChange={(e) => setCampo("asunto", e.target.value)}
                  placeholder="Descripción breve del trámite"
                  className={CLASES_INPUT}
                />
              </Campo>
            </div>

            <div className="md:col-span-2">
              <Campo label="Observaciones">
                <textarea
                  rows={3}
                  value={form.observaciones}
                  onChange={(e) => setCampo("observaciones", e.target.value)}
                  placeholder="Información adicional (opcional)"
                  className={CLASES_INPUT}
                />
              </Campo>
            </div>

            {registrado && (
              <p
                role="status"
                className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 md:col-span-2"
              >
                {registrado}
              </p>
            )}

            <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4 md:col-span-2">
              <button
                type="submit"
                className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
              >
                Registrar trámite
              </button>

              <button
                type="button"
                onClick={() => limpiarFormulario()}
                className="rounded-md border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Limpiar
              </button>

              <button
                type="button"
                onClick={() => setCampo("codigo", generarCodigo())}
                className="rounded-md border border-indigo-200 bg-indigo-50 px-5 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
              >
                Generar código
              </button>

              <button
                type="button"
                onClick={() => navigate(-1)}
                className="rounded-md border border-red-200 bg-red-50 px-5 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}