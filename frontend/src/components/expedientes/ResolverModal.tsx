import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { ModalAccionProps, ResultadoResolver, SolicitudResolver } from "../../types/expedienteActions";
import { useFormularioExpediente } from "../../hooks/useFormularioExpediente";
import { apiClient } from "../../api/client";
import { useAuthStore } from "../../stores/authStore";
import { obtenerAdaptadorDnie } from "../../services/dnie/dnieAdapter.factory";
import type { EstadoDispositivoDnie } from "../../services/dnie/dnieAdapter.types";
import AccionModal from "./AccionModal";

export type ResolverModalProps = ModalAccionProps<SolicitudResolver, ResultadoResolver>;

export default function ResolverModal(props: ResolverModalProps) {
  return props.open ? <FormularioResolver key={props.expediente.id} {...props} /> : null;
}

interface PreparacionFirmaResponse {
  preparacionId: string;
  expedienteId: string;
  cut: string;
  documentoId: string;
  documentoNombre: string;
  hashSha256: string;
  algoritmoRecomendado: string;
}

interface RegistroFirmaResponse {
  ok: boolean;
  documentoId: string;
  cvd: string;
  estado: string;
  verificacion: {
    firmaValida: boolean;
    certificadoVigente: boolean;
    cadenaConfiable: boolean;
    revocacion: string;
    titular: { dni: string; nombre: string };
  };
}

function FormularioResolver({ expediente, accion, onClose }: ResolverModalProps) {
  const id = useId();
  const usuario = useAuthStore((s) => s.usuario);
  const [resumen, setResumen] = useState(
    "Se declara PROCEDENTE la atención de la solicitud y se suscribe el acto resolutivo correspondiente con firma digital institucional."
  );
  const [observacionInterna, setObservacionInterna] = useState(
    "Firma digital certificada conforme con DNIe. Expediente resuelto en sede directiva."
  );

  // Estados del dispositivo y hardware DNIe
  const [estadoDisp, setEstadoDisp] = useState<EstadoDispositivoDnie | null>(null);
  const [cargandoDispositivo, setCargandoDispositivo] = useState(true);
  const [errorHardware, setErrorHardware] = useState<string | null>(null);

  // Estados del flujo criptográfico (Preparación -> Firma -> Registro)
  const [pasoFirma, setPasoFirma] = useState<"DETECTANDO" | "PREPARANDO" | "LISTO_PARA_FIRMAR" | "FIRMANDO" | "FIRMADO" | "ERROR">("DETECTANDO");
  const [preparacion, setPreparacion] = useState<PreparacionFirmaResponse | null>(null);
  const [registroFirma, setRegistroFirma] = useState<RegistroFirmaResponse | null>(null);
  const [errorFirma, setErrorFirma] = useState<string | null>(null);

  const resumenRef = useRef<HTMLTextAreaElement>(null);
  const formulario = useFormularioExpediente(accion);
  const resumenValido = resumen.trim().length >= 10;

  // 1. Detectar hardware DNIe al abrir el modal
  useEffect(() => {
    let cancelado = false;
    async function inicializarHardware() {
      setCargandoDispositivo(true);
      setErrorHardware(null);
      try {
        const adaptador = obtenerAdaptadorDnie();
        const disp = await adaptador.detectarDispositivo();
        if (cancelado) return;
        setEstadoDisp(disp);

        if (disp.estado === "CERTIFICADO_VALIDO" && disp.certificados.length > 0) {
          setPasoFirma("PREPARANDO");
          // Disparar preparación en el backend
          try {
            const resp = await apiClient.post<PreparacionFirmaResponse>(
              "/api/v1/firma/dnie/preparar",
              { expedienteId: expediente.id }
            );
            if (cancelado) return;
            setPreparacion(resp.data);
            setPasoFirma("LISTO_PARA_FIRMAR");
          } catch (err: any) {
            if (cancelado) return;
            const msj = err?.response?.data?.message || err?.message || "No se pudo preparar el documento para firma.";
            setErrorFirma(msj);
            setPasoFirma("ERROR");
          }
        } else {
          setPasoFirma("DETECTANDO");
        }
      } catch (err: any) {
        if (cancelado) return;
        setErrorHardware(err?.message || "Error al comunicarse con el adaptador DNIe.");
        setPasoFirma("ERROR");
      } finally {
        if (!cancelado) setCargandoDispositivo(false);
      }
    }

    void inicializarHardware();
    return () => {
      cancelado = true;
    };
  }, [expediente.id]);

  // 2. Ejecutar firma criptográfica con el hardware / adapter
  async function ejecutarFirmaDnie() {
    if (!preparacion || !estadoDisp || estadoDisp.certificados.length === 0) return;
    setPasoFirma("FIRMANDO");
    setErrorFirma(null);

    try {
      const adaptador = obtenerAdaptadorDnie();
      const cert = estadoDisp.certificados[0];

      // Firma criptográfica del hash en el hardware
      const resFirma = await adaptador.firmarHash(
        preparacion.hashSha256,
        cert.id
      );

      // Verificación matemática y registro canónico WORM en el backend
      const respRegistro = await apiClient.post<RegistroFirmaResponse>(
        "/api/v1/firma/dnie/verificar-y-registrar",
        {
          preparacionId: preparacion.preparacionId,
          expedienteId: preparacion.expedienteId,
          documentoId: preparacion.documentoId,
          hashSha256: preparacion.hashSha256,
          firmaB64: resFirma.firmaB64,
          certificadoPem: resFirma.certificadoPem,
          algoritmo: resFirma.algoritmo,
          proveedor: resFirma.proveedor,
        }
      );

      setRegistroFirma(respRegistro.data);
      setPasoFirma("FIRMADO");
    } catch (err: any) {
      const msj = err?.response?.data?.message || err?.message || "Error durante la verificación de la firma digital.";
      setErrorFirma(msj);
      setPasoFirma("ERROR");
    }
  }

  function cerrar() {
    if (!formulario.pending) {
      accion.restablecer();
      onClose();
    }
  }

  // 3. Resolución formal post-firma
  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (formulario.pending || !registroFirma) return;

    if (!resumenValido) {
      resumenRef.current?.focus();
      return;
    }

    const payload: SolicitudResolver = {
      expediente,
      resultado_resumen: resumen.trim(),
      observacion_interna: observacionInterna.trim() || undefined,
    };

    void formulario.enviar(payload, () => {
      setResumen("");
      setObservacionInterna("");
      setRegistroFirma(null);
      setPreparacion(null);
      onClose();
    });
  }

  const certActivo = estadoDisp?.certificados?.[0];

  return (
    <AccionModal
      titulo="Resolver Expediente con Firma Digital DNIe"
      descripcion={`Expediente ${expediente.codigo}. Suscripción criptográfica oficial del acto resolutivo con DNI electrónico.`}
      pending={formulario.pending}
      onClose={cerrar}
    >
      <div className="space-y-4">
        {/* PANEL DE ESTADO DEL DISPOSITIVO DNIe */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span>💳</span> Dispositivo DNIe / Smart Card
            </span>
            {cargandoDispositivo ? (
              <span className="text-slate-500 font-medium animate-pulse">Detectando...</span>
            ) : estadoDisp?.estado === "CERTIFICADO_VALIDO" ? (
              <span className="rounded bg-emerald-100 text-emerald-800 px-2 py-0.5 font-bold">
                ✓ DNIe Conectado y Válido
              </span>
            ) : estadoDisp?.estado === "LECTOR_PRESENTE_SIN_TARJETA" ? (
              <span className="rounded bg-amber-100 text-amber-800 px-2 py-0.5 font-bold">
                Inserte Tarjeta DNIe
              </span>
            ) : estadoDisp?.estado === "BRIDGE_NO_DISPONIBLE" ? (
              <span className="rounded bg-slate-200 text-slate-800 px-2 py-0.5 font-bold">
                Bridge No Configurado
              </span>
            ) : (
              <span className="rounded bg-rose-100 text-rose-800 px-2 py-0.5 font-bold">
                Lector No Detectado
              </span>
            )}
          </div>

          <p className="text-slate-600 mb-2">
            {cargandoDispositivo ? "Consultando lector y certificados..." : estadoDisp?.mensaje}
          </p>

          {/* DETALLES DEL CERTIFICADO ENCONTRADO */}
          {certActivo && (
            <div className="rounded bg-white border border-slate-200 p-2.5 space-y-1 font-mono text-[11px] text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Titular DNIe:</span>
                <span className="font-bold">{certActivo.nombreCompleto}</span>
              </div>
              {usuario && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Sesión Activa:</span>
                  <span className="text-slate-700">{usuario.nombreCompleto}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">DNI en Certificado:</span>
                <span className="font-bold">{certActivo.dni}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Emisor:</span>
                <span>{certActivo.issuer}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Vigencia:</span>
                <span className={certActivo.esVigente ? "text-emerald-700 font-bold" : "text-rose-700 font-bold"}>
                  {certActivo.esVigente ? "Vigente" : "Expirado"} (hasta {certActivo.validTo.slice(0, 10)})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Huella (SHA-256):</span>
                <span>{certActivo.thumbprint.slice(0, 20)}...</span>
              </div>
            </div>
          )}

          {errorHardware && (
            <div className="mt-2 text-rose-700 bg-rose-50 border border-rose-200 rounded p-2 text-xs">
              {errorHardware}
            </div>
          )}
        </div>

        {/* PANEL DE PREPARACIÓN Y FIRMA CRIPTOGRÁFICA */}
        {preparacion && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-indigo-950 uppercase tracking-wider">
                Documento Oficial a Firmar
              </span>
              <span className="text-indigo-700 font-mono text-[11px] font-semibold">
                {preparacion.cut}
              </span>
            </div>

            <div className="bg-white rounded border border-indigo-100 p-2 text-[11px] font-mono space-y-1 text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Archivo:</span>
                <span className="font-semibold">{preparacion.documentoNombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Hash Canónico (SHA-256):</span>
                <span className="text-indigo-800">{preparacion.hashSha256.slice(0, 32)}...</span>
              </div>
            </div>

            {/* BOTÓN O ESTADO DE FIRMA */}
            {pasoFirma !== "FIRMADO" ? (
              <div className="pt-1 flex items-center justify-between">
                <span className="text-slate-600">
                  {pasoFirma === "FIRMANDO" ? "Sujetando firma en dispositivo..." : "El hash debe ser firmado digitalmente antes de resolver."}
                </span>
                <button
                  type="button"
                  onClick={() => void ejecutarFirmaDnie()}
                  disabled={pasoFirma === "FIRMANDO" || !certActivo || !certActivo.esVigente}
                  className="rounded-md bg-indigo-700 px-3 py-1.5 font-bold text-white hover:bg-indigo-800 disabled:opacity-50 transition shadow-xs text-xs"
                >
                  {pasoFirma === "FIRMANDO" ? "Firmando con DNIe..." : "Firmar Documento con DNIe"}
                </button>
              </div>
            ) : (
              <div className="rounded bg-emerald-50 border border-emerald-300 p-2.5 text-xs text-emerald-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                  <span>✓</span> Firma Digital Criptográfica Verificada y Asentada
                </div>
                <p className="text-[11px]">
                  Código de Verificación Digital (CVD): <strong>{registroFirma?.cvd}</strong>. Evidencia inmutable WORM registrada en el sistema.
                </p>
              </div>
            )}

          </div>
        )}

        {errorFirma && (
          <div className="rounded bg-rose-50 border border-rose-200 p-2.5 text-rose-700 text-xs font-medium">
            {errorFirma}
          </div>
        )}

        {/* FORMULARIO DE RESOLUCIÓN FINAL (HABILITADO SOLO TRAS FIRMA VÁLIDA) */}
        <form noValidate onSubmit={enviar} className="space-y-4 pt-1">
          <div>
            <label htmlFor={`${id}-resumen`} className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Resumen del Acto Resolutivo / Dictamen de Atención (obligatorio)
            </label>
            <textarea
              id={`${id}-resumen`}
              ref={resumenRef}
              rows={3}
              className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 shadow-inner"
              required
              value={resumen}
              onChange={(e) => setResumen(e.target.value)}
            />
            {!resumenValido && (
              <p className="mt-1 text-xs text-rose-600 font-medium">
                El resumen del acto resolutivo debe tener al menos 10 caracteres.
              </p>
            )}
          </div>

          <div>
            <label htmlFor={`${id}-obs`} className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Observación Interna de Gestión (opcional)
            </label>
            <textarea
              id={`${id}-obs`}
              rows={2}
              className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 shadow-inner"
              value={observacionInterna}
              onChange={(e) => setObservacionInterna(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={formulario.pending}
              onClick={cerrar}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={formulario.pending || !registroFirma || !resumenValido}
              className="rounded-lg bg-emerald-800 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-900 transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {formulario.pending ? "Resolviendo Expediente..." : "Emitir Resolución Formal"}
            </button>
          </div>
        </form>
      </div>
    </AccionModal>
  );
}
