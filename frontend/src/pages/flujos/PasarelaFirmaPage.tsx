import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

import FirmaBatchDrawer from "../../components/firma/FirmaBatchDrawer";
import RefirmaConnectorModal from "../../components/firma/RefirmaConnectorModal";
import type {
  DocumentoOficial,
  RefirmaRespuestaDTO,
} from "../../types/firmaDigital";
import { apiClient } from "../../api/client";

const INSIGNIA_ESTADO: Record<DocumentoOficial["estadoFirma"], string> = {
  PENDIENTE: "border-amber-200 bg-amber-50 text-amber-700",
  FIRMADO: "border-emerald-200 bg-emerald-50 text-emerald-700",
  OBSERVADO: "border-red-200 bg-red-50 text-red-700",
};

const ETIQUETA_ESTADO: Record<DocumentoOficial["estadoFirma"], string> = {
  PENDIENTE: "Pendiente de firma",
  FIRMADO: "Firma registrada",
  OBSERVADO: "Observado",
};

interface DocumentoFila extends DocumentoOficial {
  keyFila: string;
  estadoDesconocido?: boolean;
  estadoOriginal?: string;
}

export default function PasarelaFirmaPage() {
  const [documentos, setDocumentos] = useState<DocumentoFila[]>([]);
  const [errorCola, setErrorCola] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [consulta, setConsulta] = useState(0);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [documentoActivo, setDocumentoActivo] = useState<DocumentoFila | null>(null);
  const [drawerAbierto, setDrawerAbierto] = useState(false);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setErrorCola(null);
    apiClient
      .get<{ documentos: Array<Record<string, unknown>> }>("/api/v1/firmas/cola-firmantes")
      .then((res) => {
        if (!activo) return;
        const docs = res.data?.documentos;
        if (!Array.isArray(docs)) throw new Error("Respuesta de la cola de firma inválida.");
        setDocumentos(docs.map((d, index) => {
          const tieneDocumentoId = typeof d.documentoId === "string" && d.documentoId.trim().length > 0;
          const hashValido = typeof d.hashSha256 === "string" && /^[a-f0-9]{64}$/i.test(d.hashSha256.trim());
          const tienePdfPreview = typeof d.s3PreviewUrl === "string" && d.s3PreviewUrl.trim().length > 0;
          const esCompleto = tieneDocumentoId && hashValido && tienePdfPreview;

          let puedeFirmar = esCompleto && d.puedeFirmar === true;
          let motivoNoHabilitado = "";

          if (!tieneDocumentoId) {
            puedeFirmar = false;
            motivoNoHabilitado = "Documento sin archivo adjunto asociado.";
          } else if (!hashValido) {
            puedeFirmar = false;
            motivoNoHabilitado = "Hash SHA-256 no disponible o formato inválido.";
          } else if (!tienePdfPreview) {
            puedeFirmar = false;
            motivoNoHabilitado = "Vista previa del documento PDF no disponible en almacenamiento.";
          } else if (d.puedeFirmar !== true) {
            puedeFirmar = false;
            motivoNoHabilitado = String(d.motivoNoHabilitado ?? "El funcionario no tiene facultad de despacho activa.");
          }

          let estadoFirma: DocumentoOficial["estadoFirma"] = "PENDIENTE";
          let estadoDesconocido = false;
          let estadoOriginal: string | undefined = undefined;

          if (d.estadoFirma === undefined) {
            // Contrato DocumentoPendienteFirma: propiedad omitida indica borrador pendiente de firma
            estadoFirma = "PENDIENTE";
          } else if (typeof d.estadoFirma === "string") {
            const raw = d.estadoFirma.trim();
            const upper = raw.toUpperCase();
            if (upper === "FIRMADO_DIGITALMENTE" || upper === "FIRMADO") {
              estadoFirma = "FIRMADO";
            } else if (upper === "OBSERVADO") {
              estadoFirma = "OBSERVADO";
              puedeFirmar = false;
              motivoNoHabilitado = motivoNoHabilitado || "Documento con observaciones pendientes de subsanación.";
            } else if (upper === "PENDIENTE" || upper === "BORRADOR_PENDIENTE_FIRMA") {
              estadoFirma = "PENDIENTE";
            } else if (raw === "") {
              estadoDesconocido = true;
              estadoOriginal = "SIN_ESTADO";
              estadoFirma = "OBSERVADO";
              puedeFirmar = false;
              motivoNoHabilitado = motivoNoHabilitado || "Estado documental no especificado o vacío.";
            } else {
              estadoDesconocido = true;
              estadoOriginal = raw;
              estadoFirma = "OBSERVADO";
              puedeFirmar = false;
              motivoNoHabilitado = motivoNoHabilitado || `Estado no habilitado para firma (${raw}).`;
            }
          } else {
            estadoDesconocido = true;
            estadoOriginal = "NO_DEFINIDO";
            estadoFirma = "OBSERVADO";
            puedeFirmar = false;
            motivoNoHabilitado = motivoNoHabilitado || "Estado documental no disponible.";
          }

          const fechaRaw = typeof d.fechaProyeccion === "string" ? d.fechaProyeccion.trim() : "";
          const fechaParsed = fechaRaw ? Date.parse(fechaRaw) : NaN;
          const tieneFechaValida = Number.isFinite(fechaParsed);
          const anio = tieneFechaValida ? new Date(fechaParsed).getFullYear() : 0;
          const fechaGeneracion = tieneFechaValida ? new Date(fechaParsed).toISOString() : "";

          const keyFila = tieneDocumentoId
            ? `doc-${String(d.documentoId).trim()}`
            : `draft-${String(d.resolucionId ?? d.expedienteId ?? "fila")}-${index}`;

          return {
            keyFila,
            idDocumento: tieneDocumentoId ? String(d.documentoId).trim() : "",
            idTramite: String(d.expedienteId ?? d.cut ?? ""),
            tipoActo: "RD",
            numeroCorrelativo: String(d.numeroBorrador ?? d.cut ?? "S/N"),
            anio,
            asunto: String(d.asunto ?? "Sin asunto"),
            urlPdfOriginal: String(d.s3PreviewUrl ?? ""),
            hashSha256: hashValido ? String(d.hashSha256).trim() : "",
            estadoFirma,
            estadoDesconocido,
            estadoOriginal,
            fechaGeneracion,
            puedeFirmar,
            motivoNoHabilitado,
          };
        }));
      })
      .catch((error: unknown) => {
        if (activo) {
          setDocumentos([]);
          setErrorCola(error instanceof Error ? error.message : "No se pudo consultar la cola de firma.");
        }
      }).finally(() => { if (activo) setCargando(false); });
    return () => {
      activo = false;
    };
  }, [consulta]);

  const abrirFirmaUnica = (documento: DocumentoFila) => {
    if (!documento || !documento.idDocumento) return;

    if (documento.estadoFirma === "FIRMADO") {
      setDocumentoActivo(documento);
      setModalAbierto(true);
      return;
    }

    if (documento.estadoFirma !== "PENDIENTE" || documento.estadoDesconocido) {
      return;
    }

    if (
      documento.puedeFirmar !== true ||
      !documento.urlPdfOriginal ||
      !documento.hashSha256 ||
      !/^[a-f0-9]{64}$/i.test(documento.hashSha256)
    ) {
      return;
    }

    setDocumentoActivo(documento);
    setModalAbierto(true);
  };

  const manejarFirmado = (resultado: RefirmaRespuestaDTO) => {
    if (!documentoActivo?.idDocumento) return;
    const docIdActivo = String(documentoActivo.idDocumento).trim();

    setDocumentos((actuales) =>
      actuales.map((documento) =>
        documento.idDocumento && String(documento.idDocumento).trim() === docIdActivo
          ? {
              ...documento,
              estadoFirma: "FIRMADO",
              cvd: resultado.cvd,
              urlPdfFirmado: resultado.urlFirmado,
            }
          : documento,
      ),
    );
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <Link
            to="/"
            className="mb-4 mr-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            ← Volver al inicio
          </Link>
          <Link
            to="/flujo-validez-legal"
            className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            ← Volver al módulo
          </Link>
          <p className="text-sm font-bold text-blue-700">
            ENT-M04-03 · Adriano David Espinoza Ramírez (R/A) · Mayra (R)
          </p>
          <h1 className="text-2xl font-bold">
            Pasarela Frontend de Despacho de Firma Digital (Refirma RENIEC)
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Invocación del agente local mediante el protocolo{" "}
            <code>refirma://</code>. El resultado requiere evidencia persistida
            del servicio de firma.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <h2 className="text-lg font-bold">Documentos pendientes de suscripción</h2>
            <p className="text-sm text-slate-500">
              Bandeja criptográfica de la Dirección General y Secretaría Académica.
            </p>
          </div>

          <button
            type="button"
            disabled={cargando || documentos.filter((d) => d.estadoFirma === "PENDIENTE" && !d.estadoDesconocido && d.puedeFirmar === true && Boolean(d.idDocumento) && Boolean(d.urlPdfOriginal) && Boolean(d.hashSha256) && /^[a-f0-9]{64}$/i.test(d.hashSha256)).length === 0}
            onClick={() => setDrawerAbierto(true)}
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
          >
            Firmar en lote (Secretaría)
          </button>
        </div>

        {cargando && <p role="status">Consultando documentos pendientes…</p>}
        {errorCola && <div role="alert">{errorCola} <button type="button" disabled={cargando} onClick={() => setConsulta(v => v + 1)}>Reintentar consulta</button></div>}
        {!cargando && !errorCola && documentos.length === 0 && <p role="status">No hay documentos pendientes de firma.</p>}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3" scope="col">
                    Documento
                  </th>
                  <th className="px-4 py-3" scope="col">
                    Asunto
                  </th>
                  <th className="px-4 py-3" scope="col">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-right" scope="col">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documentos.map((documento) => (
                  <tr key={documento.keyFila}>
                    <td className="px-5 py-4">
                      <p className="text-sm font-bold text-slate-800">
                        {documento.tipoActo} · {documento.numeroCorrelativo}
                      </p>
                      <p className="text-xs text-slate-500">
                        {documento.hashSha256
                          ? `HASH: ${documento.hashSha256.slice(0, 12)}…`
                          : "HASH: No disponible"}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {documento.fechaGeneracion
                          ? `Fecha: ${documento.fechaGeneracion.slice(0, 10)}`
                          : "Fecha no disponible"}
                      </p>
                      {documento.motivoNoHabilitado && !documento.puedeFirmar && (
                        <p className="mt-0.5 text-[11px] text-amber-700">
                          {documento.motivoNoHabilitado}
                        </p>
                      )}
                    </td>
                    <td className="max-w-xs px-4 py-4 text-sm text-slate-600">
                      {documento.asunto}
                      {documento.cvd && (
                        <p className="mt-1 text-xs font-semibold text-emerald-700">
                          CVD: {documento.cvd}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {documento.estadoDesconocido ? (
                        <span className="inline-flex rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-[0.65rem] font-bold text-slate-700">
                          {documento.estadoOriginal && documento.estadoOriginal !== "SIN_ESTADO" && documento.estadoOriginal !== "NO_DEFINIDO" ? `Estado: ${documento.estadoOriginal}` : "Estado no disponible"}
                        </span>
                      ) : (
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[0.65rem] font-bold ${INSIGNIA_ESTADO[documento.estadoFirma]}`}
                        >
                          {ETIQUETA_ESTADO[documento.estadoFirma]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {!documento.estadoDesconocido && documento.estadoFirma === "PENDIENTE" && (
                        <button
                          type="button"
                          disabled={!documento.puedeFirmar}
                          title={documento.motivoNoHabilitado}
                          onClick={() => abrirFirmaUnica(documento)}
                          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                        >
                          Firmar
                        </button>
                      )}
                      {!documento.estadoDesconocido && documento.estadoFirma === "FIRMADO" && (
                        <button type="button" onClick={() => abrirFirmaUnica(documento)} className="text-xs font-bold text-emerald-700">
                          Consultar firma
                        </button>
                      )}
                      {(documento.estadoDesconocido || documento.estadoFirma === "OBSERVADO") && (
                        <span className="text-xs font-medium text-slate-400">
                          No habilitado
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500">
          La pasarela nunca solicita, intercepta ni almacena la clave privada o
          el PIN del firmante: la operación criptográfica ocurre en el
          dispositivo seguro (DNIe / Token). Invocar el agente no acredita por
          sí solo la firma, la vigencia del certificado ni un sello de tiempo.
        </div>
      </section>

      <RefirmaConnectorModal
        abierto={modalAbierto}
        documento={documentoActivo}
        soloConsulta={documentoActivo?.estadoFirma === "FIRMADO"}
        firmanteDni=""
        onCerrar={() => setModalAbierto(false)}
        onFirmado={manejarFirmado}
      />

      <FirmaBatchDrawer
        abierto={drawerAbierto}
        documentos={documentos.filter(
          (documento) =>
            documento.estadoFirma === "PENDIENTE" &&
            !documento.estadoDesconocido &&
            documento.puedeFirmar === true &&
            Boolean(documento.idDocumento) &&
            Boolean(documento.urlPdfOriginal) &&
            Boolean(documento.hashSha256) &&
            /^[a-f0-9]{64}$/i.test(documento.hashSha256),
        )}
        onCerrar={() => setDrawerAbierto(false)}
      />
    </main>
  );
}
