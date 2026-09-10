import { useState } from "react";
import { Link } from "react-router-dom";

import FirmaBatchDrawer from "../../components/firma/FirmaBatchDrawer";
import RefirmaConnectorModal from "../../components/firma/RefirmaConnectorModal";
import type {
  DocumentoOficial,
  RefirmaRespuestaDTO,
} from "../../types/firmaDigital";

const DOCUMENTOS_INICIALES: DocumentoOficial[] = [
  {
    idDocumento: 1,
    idTramite: 412,
    tipoActo: "RD",
    numeroCorrelativo: "RD N.° 0412-2026-DG-IESTP-SUIZA",
    anio: 2026,
    asunto:
      "Confiere Título Profesional Técnico en Desarrollo de Sistemas de Información al administrado Carlos Mendoza Ríos.",
    urlPdfOriginal: "/pdfs/rd-0412-2026.pdf",
    hashSha256:
      "a3f2c1e9b8d74f6a0c5e8b2d91f7a4c3e6b0d5f2a8c1e7b4d9f6a3c0e5b8d2f7",
    estadoFirma: "PENDIENTE",
    fechaGeneracion: "2026-09-05T11:42:15-05:00",
  },
  {
    idDocumento: 2,
    idTramite: 413,
    tipoActo: "ACTA",
    numeroCorrelativo: "ACT-DSI-2026-2-007",
    anio: 2026,
    asunto: "Acta consolidada de evaluación semestral 2026-2 de la Unidad Didáctica Taller de Programación Web.",
    urlPdfOriginal: "/pdfs/act-dsi-2026-2-007.pdf",
    hashSha256:
      "7d1b4c9e2a8f6d3b5c0e7a4f9b2d1c8e6f3a5d7b0c2e9f4a1b8d6c3e5f0a7b9d",
    estadoFirma: "PENDIENTE",
    fechaGeneracion: "2026-09-05T12:10:00-05:00",
  },
  {
    idDocumento: 3,
    idTramite: 414,
    tipoActo: "ACTA",
    numeroCorrelativo: "ACT-DSI-2026-2-008",
    anio: 2026,
    asunto: "Acta consolidada de evaluación semestral 2026-2 de la Unidad Didáctica Base de Datos.",
    urlPdfOriginal: "/pdfs/act-dsi-2026-2-008.pdf",
    hashSha256:
      "9f0e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8",
    estadoFirma: "PENDIENTE",
    fechaGeneracion: "2026-09-05T12:11:00-05:00",
  },
  {
    idDocumento: 4,
    idTramite: 415,
    tipoActo: "CERTIFICADO",
    numeroCorrelativo: "CER-2026-000318",
    anio: 2026,
    asunto: "Certificado oficial de estudios modulares del egresado Luis Alberto Sánchez Tello.",
    urlPdfOriginal: "/pdfs/cer-2026-000318.pdf",
    hashSha256:
      "2b6a8c4e0f3d7b1a9c5e8d6f4a2b0c1e7f9d3a5b8c0e2f4a6b8d0c2e4f6a8b0d",
    estadoFirma: "PENDIENTE",
    fechaGeneracion: "2026-09-05T13:05:00-05:00",
  },
];

const INSIGNIA_ESTADO: Record<DocumentoOficial["estadoFirma"], string> = {
  PENDIENTE: "border-amber-200 bg-amber-50 text-amber-700",
  FIRMADO: "border-emerald-200 bg-emerald-50 text-emerald-700",
  OBSERVADO: "border-red-200 bg-red-50 text-red-700",
};

const ETIQUETA_ESTADO: Record<DocumentoOficial["estadoFirma"], string> = {
  PENDIENTE: "Pendiente de firma",
  FIRMADO: "Firmado digitalmente",
  OBSERVADO: "Observado",
};

export default function PasarelaFirmaPage() {
  const [documentos, setDocumentos] = useState<DocumentoOficial[]>(
    DOCUMENTOS_INICIALES,
  );
  const [modalAbierto, setModalAbierto] = useState(false);
  const [documentoActivo, setDocumentoActivo] = useState<DocumentoOficial | null>(
    null,
  );
  const [drawerAbierto, setDrawerAbierto] = useState(false);

  const abrirFirmaUnica = (documento: DocumentoOficial) => {
    setDocumentoActivo(documento);
    setModalAbierto(true);
  };

  const manejarFirmado = (resultado: RefirmaRespuestaDTO) => {
    setDocumentos((actuales) =>
      actuales.map((documento) =>
        documento.idDocumento === documentoActivo?.idDocumento
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
            <code>refirma://sign?token=&hash=&callback=</code> · Firma PAdES-BES
            con sellado de tiempo TSA (RFC 3161).
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
            onClick={() => setDrawerAbierto(true)}
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
          >
            Firmar en lote (Secretaría)
          </button>
        </div>

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
                  <tr key={documento.idDocumento}>
                    <td className="px-5 py-4">
                      <p className="text-sm font-bold text-slate-800">
                        {documento.tipoActo} · {documento.numeroCorrelativo}
                      </p>
                      <p className="text-xs text-slate-500">
                        HASH: {documento.hashSha256.slice(0, 12)}…
                      </p>
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
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[0.65rem] font-bold ${INSIGNIA_ESTADO[documento.estadoFirma]}`}
                      >
                        {ETIQUETA_ESTADO[documento.estadoFirma]}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      {documento.estadoFirma === "PENDIENTE" && (
                        <button
                          type="button"
                          onClick={() => abrirFirmaUnica(documento)}
                          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                        >
                          Firmar
                        </button>
                      )}
                      {documento.estadoFirma === "FIRMADO" && (
                        <span className="text-xs font-bold text-emerald-700">
                          ✓ Suscrito
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
          dispositivo seguro (DNIe / Token). El backend valida la vigencia del
          certificado contra CRL / OCSP y el hash SHA-256 del archivo firmado
          coincide con la vista previa antes de emitir la resolución.
        </div>
      </section>

      <RefirmaConnectorModal
        abierto={modalAbierto}
        documento={documentoActivo}
        firmanteDni="40601034"
        onCerrar={() => setModalAbierto(false)}
        onFirmado={manejarFirmado}
      />

      <FirmaBatchDrawer
        abierto={drawerAbierto}
        documentos={documentos.filter(
          (documento) => documento.estadoFirma === "PENDIENTE",
        )}
        onCerrar={() => setDrawerAbierto(false)}
      />
    </main>
  );
}