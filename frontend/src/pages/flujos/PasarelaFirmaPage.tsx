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
  FIRMADO: "Firmado digitalmente",
  OBSERVADO: "Observado",
};

export default function PasarelaFirmaPage() {
  const [documentos, setDocumentos] = useState<DocumentoOficial[]>([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [documentoActivo, setDocumentoActivo] = useState<DocumentoOficial | null>(
    null,
  );
  const [drawerAbierto, setDrawerAbierto] = useState(false);

  useEffect(() => {
    let activo = true;
    apiClient
      .get<{ documentos: Array<Record<string, unknown>> }>("/api/v1/firmas/cola-firmantes")
      .then((res) => {
        if (!activo) return;
        const docs = res.data?.documentos;
        if (Array.isArray(docs) && docs.length > 0) {
          const mapeados: DocumentoOficial[] = docs.map((d, i) => ({
            idDocumento: i + 1,
            idTramite: 400 + i,
            tipoActo: (String(d.tipoResolucion ?? "").includes("TITULACION") ? "RD" : "ACTA") as "RD" | "ACTA",
            numeroCorrelativo: String(d.numeroBorrador ?? `RD N.° 0${400 + i}-2026-DG`),
            anio: 2026,
            asunto: String(d.asunto ?? "Documento en cola de firma"),
            urlPdfOriginal: String(d.s3PreviewUrl ?? `/pdfs/doc-${i + 1}.pdf`),
            hashSha256: String(d.resolucionId ?? "").replace(/-/g, "").padEnd(64, "0"),
            estadoFirma: "PENDIENTE" as const,
            fechaGeneracion: String(d.fechaProyeccion ?? new Date().toISOString()),
          }));
          setDocumentos(mapeados);
        }
        })
      .catch(() => {
        // Sin datos iniciales falsos: la lista se muestra vacía hasta que haya trámites reales en cola
      });
    return () => {
      activo = false;
    };
  }, []);

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