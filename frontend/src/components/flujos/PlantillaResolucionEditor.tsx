import { useState, type ChangeEvent } from "react";
import type {
  ArticuloResolucion,
  ResolucionDirectoral,
  TipoResolucion,
} from "../../types/resolucionAcademica";

interface PlantillaResolucionEditorProps {
  resolucionInicial?: ResolucionDirectoral;
  onGuardarBorrador: (resolucion: ResolucionDirectoral) => void;
  onProcederFirma: (resolucion: ResolucionDirectoral) => void;
  modoEdicion?: boolean;
}

const PLANTILLA_TITULACION_DEFAULT: ResolucionDirectoral = {
  id: "RD-TMP-2026-001",
  numeroResolucion: "RD N.° 0412-2026-DG-IESTP-SUIZA",
  anio: 2026,
  tipo: "TITULACION",
  asunto: "Conferir Título Profesional Técnico en Desarrollo de Sistemas de Información",
  unidadOrganica: "Dirección General",
  fechaEmision: new Date().toISOString(),
  expedienteRelacionado: "EXP-2026-000155",
  administradoNombre: "Carlos Enrique Mendoza Ríos",
  administradoDocumento: "74561238",
  programaEstudios: "Desarrollo de Sistemas de Información",
  visto:
    "El Expediente N.° EXP-2026-000155, que contiene el Informe Técnico Favorable N.° 045-2026-SA-IESTP-SUIZA emitido por la Secretaría Académica, respecto al cumplimiento satisfactorio de los requisitos para la obtención del Título Profesional Técnico.",
  considerandos: [
    "Que, la Ley N.° 30512, Ley de Institutos y Escuelas de Educación Superior y de la Carrera Pública de sus Docentes, establece las condiciones y procedimientos para el otorgamiento de títulos profesionales técnicos.",
    "Que, mediante Acta de Titulación N.° 018-2026-DSI-IESTP-SUIZA de fecha 28 de febrero de 2026, el jurado calificador aprobó por unanimidad la sustentación del proyecto de titulación presentado por el egresado.",
    "Que, de la revisión del legajo académico se verifica el cumplimiento de las 120 horas lectivas, créditos reglamentarios y prácticas pre-profesionales acreditadas ante la coordinación de la carrera.",
    "Que, estando a lo opinado por la Secretaría Académica y de conformidad con las facultades conferidas al Director General por el Reglamento Institucional.",
  ],
  articulos: [
    {
      id: "art-1",
      numero: 1,
      texto:
        "CONFERIR el TÍTULO PROFESIONAL TÉCNICO en DESARROLLO DE SISTEMAS DE INFORMACIÓN a don CARLOS ENRIQUE MENDOZA RÍOS, identificado con DNI N.° 74561238, por haber cumplido con los requisitos de ley.",
    },
    {
      id: "art-2",
      numero: 2,
      texto:
        "DISPONER la inscripción del referido Título en el Registro Institucional de Títulos y su posterior remisión al Ministerio de Educación para los fines pertinentes.",
    },
    {
      id: "art-3",
      numero: 3,
      texto:
        "NOTIFICAR la presente Resolución Directoral a la Secretaría Académica, Coordinación de Informática y al interesado para su conocimiento y fines.",
    },
  ],
  firmanteCargo: "Director General",
  firmanteNombre: "Lic. Julio César Mori Paredes",
  estado: "BORRADOR",
};

export default function PlantillaResolucionEditor({
  resolucionInicial = PLANTILLA_TITULACION_DEFAULT,
  onGuardarBorrador,
  onProcederFirma,
}: PlantillaResolucionEditorProps) {
  const [resolucion, setResolucion] = useState<ResolucionDirectoral>(resolucionInicial);
  const [vistaPrevia, setVistaPrevia] = useState(true);

  function handleCampoChange(
    campo: keyof ResolucionDirectoral,
    valor: string | number,
  ) {
    setResolucion((prev) => ({
      ...prev,
      [campo]: valor,
    }));
  }

  function handleConsiderandoChange(index: number, nuevoTexto: string) {
    setResolucion((prev) => {
      const actualizados = [...prev.considerandos];
      actualizados[index] = nuevoTexto;
      return { ...prev, considerandos: actualizados };
    });
  }

  function agregarConsiderando() {
    setResolucion((prev) => ({
      ...prev,
      considerandos: [
        ...prev.considerandos,
        "Que, mediante informe complementario se ratifica la procedencia del acto administrativo.",
      ],
    }));
  }

  function quitarConsiderando(index: number) {
    setResolucion((prev) => ({
      ...prev,
      considerandos: prev.considerandos.filter((_, i) => i !== index),
    }));
  }

  function handleArticuloChange(index: number, nuevoTexto: string) {
    setResolucion((prev) => {
      const actualizados = [...prev.articulos];
      actualizados[index] = { ...actualizados[index], texto: nuevoTexto };
      return { ...prev, articulos: actualizados };
    });
  }

  function agregarArticulo() {
    setResolucion((prev) => {
      const nuevoNumero = prev.articulos.length + 1;
      const nuevoArticulo: ArticuloResolucion = {
        id: `art-${Date.now()}`,
        numero: nuevoNumero,
        texto: `ARTÍCULO ${nuevoNumero}°. DISPONER el cumplimiento de las acciones complementarias.`,
      };
      return {
        ...prev,
        articulos: [...prev.articulos, nuevoArticulo],
      };
    });
  }

  function quitarArticulo(index: number) {
    setResolucion((prev) => {
      const filtrados = prev.articulos.filter((_, i) => i !== index);
      const renumerados = filtrados.map((art, i) => ({
        ...art,
        numero: i + 1,
      }));
      return { ...prev, articulos: renumerados };
    });
  }

  return (
    <div className="space-y-6">
      {/* Barra de control superior */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-blue-50 px-3 py-1 font-mono text-xs font-bold text-blue-700">
            {resolucion.numeroResolucion}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
            Estado: {resolucion.estado}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setVistaPrevia(!vistaPrevia)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {vistaPrevia ? "Ocultar Vista Previa" : "Ver Vista Previa A4"}
          </button>
          <button
            type="button"
            onClick={() => onGuardarBorrador(resolucion)}
            className="rounded-lg border border-blue-600 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
          >
            Guardar Borrador
          </button>
          <button
            type="button"
            onClick={() => onProcederFirma(resolucion)}
            className="rounded-lg bg-blue-700 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-800"
          >
            Aprobar y Pasar a Firma Digital →
          </button>
        </div>
      </div>

      <div className={`grid gap-6 ${vistaPrevia ? "lg:grid-cols-2" : "grid-cols-1"}`}>
        {/* Panel Izquierdo: Formulario Estructurado */}
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3">
            Datos del Acto Administrativo
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="tipo-resolucion" className="block text-xs font-semibold text-slate-700 mb-1">
                Tipo de Resolución *
              </label>
              <select
                id="tipo-resolucion"
                value={resolucion.tipo}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  handleCampoChange("tipo", e.target.value as TipoResolucion)
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
              >
                <option value="TITULACION">Titulación Profesional Técnica</option>
                <option value="GRADO_ACADEMICO">Grado Académico</option>
                <option value="CONVALIDACION">Convalidación de Estudios</option>
                <option value="RECTIFICACION_NOTA">Rectificación de Calificaciones</option>
                <option value="DISPOSICION_GENERAL">Disposición General Institucional</option>
              </select>
            </div>

            <div>
              <label htmlFor="exp-relacionado" className="block text-xs font-semibold text-slate-700 mb-1">
                CUT de Expediente Vinculado *
              </label>
              <input
                id="exp-relacionado"
                type="text"
                value={resolucion.expedienteRelacionado || ""}
                onChange={(e) => handleCampoChange("expedienteRelacionado", e.target.value)}
                placeholder="EXP-2026-XXXXXX"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="adm-nombre" className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre del Administrado *
              </label>
              <input
                id="adm-nombre"
                type="text"
                value={resolucion.administradoNombre}
                onChange={(e) => handleCampoChange("administradoNombre", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="adm-doc" className="block text-xs font-semibold text-slate-700 mb-1">
                DNI / Documento Identidad *
              </label>
              <input
                id="adm-doc"
                type="text"
                maxLength={8}
                value={resolucion.administradoDocumento}
                onChange={(e) => handleCampoChange("administradoDocumento", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label htmlFor="adm-programa" className="block text-xs font-semibold text-slate-700 mb-1">
              Programa de Estudios
            </label>
            <input
              id="adm-programa"
              type="text"
              value={resolucion.programaEstudios}
              onChange={(e) => handleCampoChange("programaEstudios", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
            />
          </div>

          {/* VISTO */}
          <div>
            <label htmlFor="visto-text" className="block text-xs font-semibold text-slate-700 mb-1">
              Visto (Expedientes y Actuados Previos) *
            </label>
            <textarea
              id="visto-text"
              rows={3}
              value={resolucion.visto}
              onChange={(e) => handleCampoChange("visto", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none leading-relaxed"
            />
          </div>

          {/* CONSIDERANDOS */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-700">
                Considerandos (Fundamentos de Hecho y Derecho)
              </label>
              <button
                type="button"
                onClick={agregarConsiderando}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                + Añadir Considerando
              </button>
            </div>
            <div className="space-y-2">
              {resolucion.considerandos.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <span className="text-xs font-bold text-slate-400 mt-2">{idx + 1}.</span>
                  <textarea
                    rows={2}
                    value={item}
                    onChange={(e) => handleConsiderandoChange(idx, e.target.value)}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                  />
                  {resolucion.considerandos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => quitarConsiderando(idx)}
                      className="text-xs text-red-500 hover:text-red-700 p-1"
                      title="Eliminar considerando"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* SE RESUELVE */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-700">
                Parte Resolutiva (Artículos)
              </label>
              <button
                type="button"
                onClick={agregarArticulo}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                + Añadir Artículo
              </button>
            </div>
            <div className="space-y-2">
              {resolucion.articulos.map((art, idx) => (
                <div key={art.id} className="flex gap-2 items-start">
                  <span className="text-xs font-bold text-slate-500 mt-2 whitespace-nowrap">
                    Art. {art.numero}°
                  </span>
                  <textarea
                    rows={2}
                    value={art.texto}
                    onChange={(e) => handleArticuloChange(idx, e.target.value)}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                  />
                  {resolucion.articulos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => quitarArticulo(idx)}
                      className="text-xs text-red-500 hover:text-red-700 p-1"
                      title="Eliminar artículo"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Panel Derecho: Previsualización WYSIWYG Hoja A4 Oficial */}
        {vistaPrevia && (
          <div className="rounded-2xl border border-slate-300 bg-white p-8 shadow-md">
            {/* Hoja A4 simulada */}
            <div className="mx-auto max-w-[595px] space-y-5 text-slate-900 font-serif leading-relaxed text-xs">
              {/* Membrete Oficial */}
              <div className="text-center border-b-2 border-slate-800 pb-3">
                <p className="font-sans font-bold text-xs uppercase tracking-wide text-slate-700">
                  Gobierno Regional de Ucayali · Dirección Regional de Educación
                </p>
                <h3 className="font-sans font-extrabold text-sm uppercase tracking-wider text-slate-900 mt-1">
                  Instituto de Educación Superior Tecnológico Público "Suiza"
                </h3>
                <p className="text-[10px] text-slate-500 font-sans">
                  Pucallpa — Ucayali · Creado por D.S. N.° 017-80-ED · Revalidado R.D. N.° 0192-2006-ED
                </p>
              </div>

              {/* Título de Resolución */}
              <div className="text-center py-2">
                <h4 className="font-bold text-sm underline tracking-wide">
                  {resolucion.numeroResolucion}
                </h4>
                <p className="text-[11px] text-slate-600 mt-1 italic">
                  Pucallpa, {new Date(resolucion.fechaEmision).toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" })}
                </p>
              </div>

              {/* VISTO */}
              <div>
                <p className="text-justify indent-6">
                  <span className="font-bold">VISTO: </span>
                  {resolucion.visto}
                </p>
              </div>

              {/* CONSIDERANDO */}
              <div className="space-y-2">
                <p className="font-bold uppercase tracking-wider">Considerando:</p>
                {resolucion.considerandos.map((item, idx) => (
                  <p key={idx} className="text-justify indent-6">
                    {item}
                  </p>
                ))}
              </div>

              {/* SE RESUELVE */}
              <div className="space-y-2.5 pt-2">
                <p className="font-bold uppercase tracking-wider text-center">Se Resuelve:</p>
                {resolucion.articulos.map((art) => (
                  <p key={art.id} className="text-justify">
                    <span className="font-bold">ARTÍCULO {art.numero}°.- </span>
                    {art.texto.replace(/^ARTÍCULO\s+\d+°\.\s*/i, "")}
                  </p>
                ))}
              </div>

              {/* Espacio de Firma */}
              <div className="pt-12 text-center">
                <div className="mx-auto w-56 border-t border-slate-700 pt-1">
                  <p className="font-sans font-bold text-xs uppercase">{resolucion.firmanteNombre}</p>
                  <p className="font-sans text-[11px] text-slate-600">{resolucion.firmanteCargo}</p>
                  <p className="font-sans text-[10px] text-slate-500">IESTP "Suiza" — Pucallpa</p>
                  <div className="mt-2 inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-mono text-[9px] text-slate-600">
                    <span>[Pendiente de Firma Digital Refirma RENIEC]</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
