import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { contarPaginasPdfArchivo } from '../../utils/foliacionPdf';
import {
  obtenerCatalogoProcedimientosTupa,
  obtenerRequisitosProcedimiento,
  type DtoRequisitosProcedimiento,
  type DtoRequisitoTupa,
} from '../../services/procedimientosTupa.service';
import type { ProcedimientoTupa } from '../../types/procedimientoTupa';
import { Button } from '../../components/ui/Button';
import { ProcessStepper } from '../../components/ui/ProcessStepper';
import { ContextualHelp } from '../../components/ui/ContextualHelp';
import {
  sanitizarNumeroDocumento,
  validarNumeroDocumento,
  obtenerTextoAyudaDocumento,
  obtenerPlaceholderDocumento,
} from '../../utils/documentValidation';
import { useAuthStore } from '../../stores/authStore';
import processingImg from '../../assets/sigd/processing-documents.webp';

interface ArchivoAdjuntoState {
  idRequisito?: string;
  esSolicitudPrincipal?: boolean;
  nombreArchivo: string;
  archivo: File;
  paginas: number;
  folioInicio: number;
  folioFin: number;
  base64: string;
}

interface ResultadoRadicacionPublica {
  expedienteId: string;
  cut: string;
  anioFiscal: number;
  fechaEnvioReal: string;
  fechaRadicacionLegal: string;
  diferidoPorCorte: boolean;
  totalFolios: number;
  trackingUrl: string;
  cargoDigital: {
    codigo: string;
    qrContenido: string;
    totalFolios: number;
  };
  ordenPago?: {
    ordenPagoId: string;
    codigoPago: string;
    monto: number;
    concepto: string;
    fechaVencimiento: string;
  };
  mensajeLegal: string;
}

export default function MesaPartesDigitalPage() {
  const [searchParams] = useSearchParams();
  const paramProcedimiento =
    searchParams.get('procedimiento') ||
    searchParams.get('codigo') ||
    searchParams.get('tupa') ||
    searchParams.get('registroVersionId') ||
    searchParams.get('id') ||
    '';
  const usuario = useAuthStore((s) => s.usuario);
  const token = useAuthStore((s) => s.accessToken);
  const contextoActivo = useAuthStore((s) => s.contextoActivo);
  const cambiarContexto = useAuthStore((s) => s.cambiarContexto);
  const esContextoInstitucional = Boolean(
    token && (usuario?.contexto === 'INSTITUCIONAL' || contextoActivo === 'INSTITUCIONAL')
  );
  const [identidadBloqueada, setIdentidadBloqueada] = useState(false);

  const [paso, setPaso] = useState<number>(1);

  // 1. Datos del Solicitante
  const [tipoPersona, setTipoPersona] = useState<'NATURAL' | 'JURIDICA'>('NATURAL');
  const [tipoDocumento, setTipoDocumento] = useState<'DNI' | 'CE' | 'RUC'>('DNI');
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [errorDocumento, setErrorDocumento] = useState<string | null>(null);
  const [nombres, setNombres] = useState('');
  const [apellidoPaterno, setApellidoPaterno] = useState('');
  const [apellidoMaterno, setApellidoMaterno] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [representanteLegal, setRepresentanteLegal] = useState('');
  const [dniRepresentante, setDniRepresentante] = useState('');
  const [errorDniRepresentante, setErrorDniRepresentante] = useState<string | null>(null);
  const [correo, setCorreo] = useState('');
  const [celular, setCelular] = useState('');
  const [direccion, setDireccion] = useState('');

  // 2. Procedimiento TUPA
  const [catalogoTupa, setCatalogoTupa] = useState<ProcedimientoTupa[]>([]);
  const [busquedaTupa, setBusquedaTupa] = useState('');
  const [procedimientoSeleccionado, setProcedimientoSeleccionado] = useState<ProcedimientoTupa | null>(null);
  const [cambiandoTramite, setCambiandoTramite] = useState(false);
  const [requisitosEstructurados, setRequisitosEstructurados] = useState<DtoRequisitosProcedimiento | null>(null);
  const [cargandoRequisitos, setCargandoRequisitos] = useState(false);
  const [errorRequisitos, setErrorRequisitos] = useState<string | null>(null);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false);
  const [asunto, setAsunto] = useState('');

  // 3. Documentos y Foliación
  const [adjuntos, setAdjuntos] = useState<ArchivoAdjuntoState[]>([]);
  const [procesandoArchivo, setProcesandoArchivo] = useState(false);
  const [errorValidacionDocumentos, setErrorValidacionDocumentos] = useState<string | null>(null);

  // Clasificación de requisitos por tipología y obligatoriedad
  const {
    requisitosDocumentales,
    requisitosFinancieros,
    requisitosInternos,
    tieneSolicitudEspecifica,
  } = useMemo(() => {
    if (!requisitosEstructurados?.requisitos) {
      return {
        requisitosDocumentales: [] as DtoRequisitoTupa[],
        requisitosFinancieros: [] as DtoRequisitoTupa[],
        requisitosInternos: [] as DtoRequisitoTupa[],
        tieneSolicitudEspecifica: false,
      };
    }
    const reqs = requisitosEstructurados.requisitos;
    const documentales = reqs.filter(
      (r) =>
        r.tipoRequisito === 'DOCUMENTAL' ||
        (r.esAnexoDigital && r.tipoRequisito !== 'FINANCIERO' && r.tipoRequisito !== 'INTERNO'),
    );
    const financieros = reqs.filter((r) => r.tipoRequisito === 'FINANCIERO');
    const internos = reqs.filter(
      (r) => r.tipoRequisito === 'INTERNO' || r.tipoRequisito === 'DECLARATIVO' || r.tipoRequisito === 'AMBIGUO',
    );
    const tieneSol = documentales.some((r) =>
      /solicitud|fut|formulario único|petitorio/i.test(r.nombre),
    );

    return {
      requisitosDocumentales: documentales,
      requisitosFinancieros: financieros,
      requisitosInternos: internos,
      tieneSolicitudEspecifica: tieneSol,
    };
  }, [requisitosEstructurados]);

  // 4. Envío y Resultados
  const [declaracionAceptada, setDeclaracionAceptada] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoRadicacionPublica | null>(null);

  // Inicializar y bloquear identidad del usuario si está autenticado
  useEffect(() => {
    if (!token) {
      setIdentidadBloqueada(false);
      return;
    }
    const controller = new AbortController();
    fetch('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('No se pudo obtener el perfil autenticado.');
        return res.json() as Promise<{
          idPersona?: string;
          numeroDocumento?: string;
          tipoDocumento?: 'DNI' | 'CE' | 'RUC';
          nombres?: string;
          apellidos?: string;
          correo?: string;
          telefono?: string;
          direccion?: string;
        }>;
      })
      .then((perfil) => {
        if (controller.signal.aborted) return;
        if (perfil.numeroDocumento && perfil.tipoDocumento) {
          setTipoPersona(perfil.tipoDocumento === 'RUC' ? 'JURIDICA' : 'NATURAL');
          setTipoDocumento(perfil.tipoDocumento);
          setNumeroDocumento(perfil.numeroDocumento);
          if (perfil.nombres) setNombres(perfil.nombres);
          if (perfil.apellidos) {
            const partes = perfil.apellidos.trim().split(/\s+/);
            if (partes.length >= 2) {
              setApellidoPaterno(partes.slice(0, -1).join(' '));
              setApellidoMaterno(partes[partes.length - 1]);
            } else {
              setApellidoPaterno(perfil.apellidos);
            }
          }
          if (perfil.correo) setCorreo((prev) => prev || perfil.correo!);
          if (perfil.telefono) setCelular((prev) => prev || perfil.telefono!);
          if (perfil.direccion) setDireccion((prev) => prev || perfil.direccion!);
          setIdentidadBloqueada(true);
        }
      })
      .catch(() => {
        // Fallback defensivo a datos de sesión en authStore
        if (usuario && usuario.nombreCompleto) {
          const partes = usuario.nombreCompleto.trim().split(/\s+/);
          if (partes.length >= 3) {
            setNombres((prev) => prev || partes.slice(0, -2).join(' '));
            setApellidoPaterno((prev) => prev || partes[partes.length - 2]);
            setApellidoMaterno((prev) => prev || partes[partes.length - 1]);
          } else if (partes.length === 2) {
            setNombres((prev) => prev || partes[0]);
            setApellidoPaterno((prev) => prev || partes[1]);
          } else {
            setNombres((prev) => prev || usuario.nombreCompleto);
          }
          if (usuario.correo) setCorreo((prev) => prev || usuario.correo);
        }
      });
    return () => controller.abort();
  }, [token, usuario]);

  // Cargar catálogo de procedimientos y preseleccionar según parámetro de URL
  useEffect(() => {
    async function cargarProcedimientos() {
      setCargandoCatalogo(true);
      try {
        const datos = await obtenerCatalogoProcedimientosTupa();
        setCatalogoTupa(datos);

        if (paramProcedimiento && datos.length > 0) {
          const match = datos.find(
            (p) =>
              p.codigo?.toLowerCase() === paramProcedimiento.toLowerCase() ||
              p.registroVersionId?.toLowerCase() === paramProcedimiento.toLowerCase() ||
              p.fuente?.referenciaFila?.toLowerCase() === paramProcedimiento.toLowerCase()
          );
          if (match) {
            void handleSeleccionarProcedimiento(match);
          }
        }
      } catch (err) {
        console.error('Error al cargar catálogo TUPA:', err);
      } finally {
        setCargandoCatalogo(false);
      }
    }
    void cargarProcedimientos();
  }, [paramProcedimiento]);

  // Al seleccionar procedimiento, cargar sus requisitos estructurados
  const handleSeleccionarProcedimiento = async (proc: ProcedimientoTupa) => {
    setProcedimientoSeleccionado(proc);
    setCambiandoTramite(false);
    setRequisitosEstructurados(null);
    setAdjuntos([]);
    setErrorValidacionDocumentos(null);
    setAsunto(`Solicitud de ${proc.denominacion}`);

    const idParaBuscar = proc.registroVersionId || proc.codigo;
    if (idParaBuscar) {
      setCargandoRequisitos(true);
      setErrorRequisitos(null);
      try {
        const res = await obtenerRequisitosProcedimiento(idParaBuscar);
        if (res && Array.isArray(res.requisitos)) {
          setRequisitosEstructurados(res);
        }
      } catch (err) {
        console.warn('No se pudieron obtener requisitos estructurados del backend:', err);
        setErrorRequisitos('No se pudieron cargar los requisitos en línea. Se presentará el formulario estándar.');
      } finally {
        setCargandoRequisitos(false);
      }
    }
  };

  const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB por archivo individual
  const MAX_TOTAL_SIZE_BYTES = 35 * 1024 * 1024; // 35 MB total combinado para resguardar la expansión base64

  const limpiarTexto = (texto?: string | null): string => {
    if (!texto) return '';
    return texto
      .replace(/Actuaci\?n/gi, 'Actuación')
      .replace(/verificaci\?n/gi, 'verificación')
      .replace(/secretar\?a/gi, 'secretaría')
      .replace(/t\?cnica/gi, 'técnica')
      .replace(/Tesorer\?a/gi, 'Tesorería')
      .replace(/cat\?logo/gi, 'catálogo')
      .replace(/Condici\?n/gi, 'Condición')
      .replace(/instituci\?n/gi, 'institución')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Cargar archivo PDF y calcular páginas
  const handleAdjuntarArchivo = async (
    e: React.ChangeEvent<HTMLInputElement>,
    idRequisito?: string,
    nombreRequisito?: string,
    esSolicitudPrincipal?: boolean,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Solo se admiten documentos en formato PDF.');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      alert('El archivo seleccionado supera el límite técnico institucional de 25 MB permitido por documento.');
      return;
    }

    const tamanoAcumulado = adjuntos
      .filter((a) => {
        if (esSolicitudPrincipal) return !a.esSolicitudPrincipal;
        if (idRequisito) return a.idRequisito !== idRequisito;
        return a.nombreArchivo !== file.name;
      })
      .reduce((acc, a) => acc + (a.archivo?.size || 0), 0);

    if (tamanoAcumulado + file.size > MAX_TOTAL_SIZE_BYTES) {
      alert('El conjunto de documentos supera el límite máximo acumulado de 35 MB permitido para la radicación digital.');
      return;
    }

    setProcesandoArchivo(true);
    setErrorValidacionDocumentos(null);
    try {
      const paginas = await contarPaginasPdfArchivo(file);

      // Convertir a base64
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result as string;
        const base64 = res.includes(',') ? res.split(',')[1] : res;

        setAdjuntos((prev) => {
          // Reemplazar si ya existía para ese requisito o solicitud principal
          const sinActual = prev.filter((a) => {
            if (esSolicitudPrincipal) return !a.esSolicitudPrincipal;
            if (idRequisito) return a.idRequisito !== idRequisito;
            return a.nombreArchivo !== file.name;
          });

          const nuevo: ArchivoAdjuntoState = {
            idRequisito,
            esSolicitudPrincipal,
            nombreArchivo: nombreRequisito ? `${nombreRequisito} - ${file.name}` : file.name,
            archivo: file,
            paginas,
            folioInicio: 1,
            folioFin: paginas,
            base64,
          };

          // Ordenar: primero Solicitud Principal, luego requisitos documentales
          const todos = [...sinActual, nuevo];
          todos.sort((a, b) => {
            if (a.esSolicitudPrincipal && !b.esSolicitudPrincipal) return -1;
            if (!a.esSolicitudPrincipal && b.esSolicitudPrincipal) return 1;
            return 0;
          });

          let cursor = 0;
          return todos.map((item) => {
            const actual = {
              ...item,
              folioInicio: cursor + 1,
              folioFin: cursor + item.paginas,
            };
            cursor += item.paginas;
            return actual;
          });
        });
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Error al procesar el archivo PDF:', err);
      alert('No se pudo procesar el archivo PDF. Verifique que no esté dañado o protegido con contraseña.');
    } finally {
      setProcesandoArchivo(false);
      e.target.value = '';
    }
  };

  const handleRemoverAdjunto = (index: number) => {
    setAdjuntos((prev) => {
      const filtrados = prev.filter((_, i) => i !== index);
      let cursor = 0;
      return filtrados.map((item) => {
        const itemActualizado = {
          ...item,
          folioInicio: cursor + 1,
          folioFin: cursor + item.paginas,
        };
        cursor += item.paginas;
        return itemActualizado;
      });
    });
    setErrorValidacionDocumentos(null);
  };

  const handleAvanzarAPaso4 = () => {
    setErrorValidacionDocumentos(null);

    // 1. Validar que la solicitud principal esté presente
    const tieneSolicitud =
      adjuntos.some((a) => a.esSolicitudPrincipal) ||
      (tieneSolicitudEspecifica &&
        adjuntos.some((a) => {
          const req = requisitosDocumentales.find((r) => r.idRequisito === a.idRequisito);
          return req && /solicitud|fut|formulario único|petitorio/i.test(req.nombre);
        }));

    if (!tieneSolicitud && !tieneSolicitudEspecifica) {
      setErrorValidacionDocumentos(
        'Debe adjuntar la Solicitud o Escrito de Petición formal en formato PDF (Art. 113 LPAG — D.S. 006-2026-JUS) como documento principal.',
      );
      return;
    }

    // 2. Validar requisitos documentales obligatorios
    const faltantes = requisitosDocumentales.filter(
      (r) => r.obligatorio && !adjuntos.some((a) => a.idRequisito === r.idRequisito),
    );

    if (faltantes.length > 0) {
      const nombres = faltantes.map((f) => `«${f.nombre}»`).join(', ');
      setErrorValidacionDocumentos(
        `Debe adjuntar los siguientes requisitos obligatorios antes de continuar: ${nombres}.`,
      );
      return;
    }

    // 3. Validar que exista al menos 1 documento adjunto en total
    if (adjuntos.length === 0) {
      setErrorValidacionDocumentos('Debe adjuntar al menos un documento en formato PDF.');
      return;
    }

    setPaso(4);
  };

  const totalFolios = adjuntos.reduce((acc, curr) => acc + curr.paginas, 0);

  // Enviar radicación digital
  const handleRadicar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!procedimientoSeleccionado?.registroVersionId) {
      setErrorEnvio('Debe seleccionar un procedimiento TUPA vigente.');
      return;
    }
    if (adjuntos.length === 0) {
      setErrorEnvio('Debe adjuntar al menos un documento o requisito en formato PDF.');
      return;
    }
    if (!declaracionAceptada) {
      setErrorEnvio('Debe aceptar la declaración jurada de veracidad documentaria.');
      return;
    }
    if (esContextoInstitucional) {
      setErrorEnvio('Para radicar trámites como usuario autenticado debe cambiar a Contexto Personal.');
      return;
    }

    setEnviando(true);
    setErrorEnvio(null);

    const payload = {
      tipoPersona,
      tipoDocumento,
      numeroDocumento: numeroDocumento.trim(),
      nombres: tipoPersona === 'NATURAL' ? nombres.trim() : undefined,
      apellidoPaterno: tipoPersona === 'NATURAL' ? apellidoPaterno.trim() : undefined,
      apellidoMaterno: tipoPersona === 'NATURAL' ? apellidoMaterno.trim() : undefined,
      razonSocial: tipoPersona === 'JURIDICA' ? razonSocial.trim() : undefined,
      representanteLegal: tipoPersona === 'JURIDICA' ? representanteLegal.trim() : undefined,
      dniRepresentante: tipoPersona === 'JURIDICA' ? dniRepresentante.trim() : undefined,
      correo: correo.trim().toLowerCase(),
      celular: celular.trim(),
      direccion: direccion.trim() || undefined,
      asunto: asunto.trim(),
      registroVersionId: procedimientoSeleccionado.registroVersionId,
      documentos: adjuntos.map((a) => ({
        idRequisito: a.idRequisito,
        nombreArchivo: a.nombreArchivo,
        mimeType: 'application/pdf',
        base64Content: a.base64,
        totalPaginas: a.paginas,
      })),
    };

    try {
      const res = await apiClient.post<ResultadoRadicacionPublica>(
        '/api/v1/tramites/mesa-partes-digital',
        payload
      );
      setResultado(res.data);
    } catch (err: any) {
      const resp = err?.response?.data;
      let mensaje = resp?.message || resp?.detail;
      if (resp?.invalidParams && Array.isArray(resp.invalidParams) && resp.invalidParams.length > 0) {
        const detalles = resp.invalidParams.map((p: any) => p.reason || p.message || p.name).join('. ');
        mensaje = detalles;
      }
      setErrorEnvio(mensaje || 'Ocurrió un error al procesar la radicación digital. Verifique los datos ingresados.');
    } finally {
      setEnviando(false);
    }
  };

  // Filtrado de procedimientos
  const procedimientosFiltrados = catalogoTupa.filter((p) => {
    const term = busquedaTupa.toLowerCase().trim();
    if (!term) return true;
    const ref = p.fuente?.referenciaFila || p.codigo || '';
    return (
      p.denominacion.toLowerCase().includes(term) ||
      ref.toLowerCase().includes(term)
    );
  });

  return (
    <main className="w-full bg-surface-page py-4 sm:py-6 px-4 sm:px-6 lg:px-8 text-slate-900">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Cabecera Oficial */}
        <section className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs space-y-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Mesa de Partes Digital
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Presenta tus solicitudes y documentos al IESTP SUIZA de forma sencilla y segura.
            </p>
          </div>

          {/* Stepper Oficial */}
          {!resultado && (
            <div className="pt-1 border-t border-slate-100">
              <ProcessStepper
                steps={[
                  {
                    id: '1',
                    title: 'Tus datos',
                    description: 'Identificación',
                    status: paso === 1 ? 'current' : paso > 1 ? 'completed' : 'pending',
                  },
                  {
                    id: '2',
                    title: 'Tu trámite',
                    description: 'Procedimiento',
                    status: paso === 2 ? 'current' : paso > 2 ? 'completed' : 'pending',
                  },
                  {
                    id: '3',
                    title: 'Documentos',
                    description: 'Requisitos PDF',
                    status: paso === 3 ? 'current' : paso > 3 ? 'completed' : 'pending',
                  },
                  {
                    id: '4',
                    title: 'Confirmación',
                    description: 'Revisión final',
                    status: paso === 4 ? 'current' : 'pending',
                  },
                ]}
              />
            </div>
          )}
        </section>

        {/* Formulario o Resultado */}
        {resultado ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50/50 p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-2xl font-black">
                ✓
              </div>
              <div>
                <h2 className="text-2xl font-bold text-emerald-950">
                  ¡Trámite Presentado Exitosamente!
                </h2>
                <p className="text-sm text-emerald-800">
                  Su expediente ha ingresado oficialmente a través de la Mesa de Partes Digital.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-emerald-100 p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-slate-400 font-semibold uppercase">Código Único de Trámite (CUT)</span>
                  <div className="text-2xl font-black text-cyan-900 tracking-wide font-mono">
                    {resultado.cut}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-semibold uppercase">Folios Registrados</span>
                  <div className="text-xl font-bold text-slate-800">
                    {resultado.totalFolios} páginas foliadas
                  </div>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-semibold uppercase">Fecha y Hora Legal</span>
                  <div className="text-sm font-semibold text-slate-700">
                    {new Date(resultado.fechaRadicacionLegal).toLocaleString('es-PE')}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-semibold uppercase">Notificación</span>
                  <div className="text-sm font-semibold text-slate-700">
                    {correo}
                  </div>
                </div>
              </div>

              {resultado.ordenPago && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 uppercase">Orden de Pago Generada</span>
                    <span className="text-lg font-black text-amber-950 font-mono">{resultado.ordenPago.codigoPago}</span>
                  </div>
                  <p className="text-xs text-amber-800">
                    Concepto: <strong>{resultado.ordenPago.concepto}</strong> — Importe oficial: <strong>S/ {resultado.ordenPago.monto.toFixed(2)}</strong>.
                  </p>
                  <p className="text-xs text-amber-700">
                    Vence el {new Date(resultado.ordenPago.fechaVencimiento).toLocaleDateString('es-PE')}. Puede cancelar en la ventanilla de Tesorería del instituto o mediante los canales de pago autorizados.
                  </p>
                </div>
              )}

              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                {resultado.mensajeLegal}
              </div>
            </div>

            {token ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-blue-950">✓ Expediente vinculado a su cuenta ciudadana</p>
                  <p className="text-[11px] text-blue-800">
                    Puede revisar las actuaciones y notificaciones en tiempo real desde sus bandejas oficiales.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    to="/mis-expedientes"
                    className="px-3.5 py-2 rounded-lg bg-blue-700 text-white font-bold text-xs hover:bg-blue-800 transition"
                  >
                    Mis Expedientes
                  </Link>
                  <Link
                    to="/casilla"
                    className="px-3.5 py-2 rounded-lg border border-blue-300 bg-white text-blue-800 font-bold text-xs hover:bg-blue-50 transition"
                  >
                    Casilla Electrónica
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p>
                  ¿Desea hacer seguimiento centralizado y recibir notificaciones oficiales en línea?
                </p>
                <Link
                  to="/registro"
                  className="px-3.5 py-2 rounded-lg bg-cyan-700 text-white font-bold text-xs hover:bg-cyan-800 transition shrink-0"
                >
                  Crear mi cuenta ciudadana
                </Link>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <Link
                to={`/consulta/${encodeURIComponent(resultado.cut)}?documento=${encodeURIComponent(numeroDocumento)}`}
                className="w-full sm:w-auto text-center px-6 py-3 rounded-xl bg-cyan-800 text-white font-semibold text-sm hover:bg-cyan-900 transition shadow-sm"
              >
                Ir al Seguimiento en Línea
              </Link>
              {token && (
                <Link
                  to="/mis-expedientes"
                  className="w-full sm:w-auto text-center px-6 py-3 rounded-xl bg-blue-700 text-white font-semibold text-sm hover:bg-blue-800 transition shadow-sm"
                >
                  Ver en Mis Expedientes
                </Link>
              )}
              <button
                type="button"
                onClick={() => {
                  setResultado(null);
                  setPaso(1);
                  setAdjuntos([]);
                  setProcedimientoSeleccionado(null);
                  if (!identidadBloqueada) setNumeroDocumento('');
                }}
                className="w-full sm:w-auto text-center px-5 py-3 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 transition"
              >
                Presentar Otra Solicitud
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleRadicar} className="space-y-4">
            {errorEnvio && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                <strong>Error al procesar:</strong> {errorEnvio}
              </div>
            )}

            {/* PASO 1: Tus datos personales / Datos de la entidad */}
            {paso === 1 && (
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 space-y-4 shadow-2xs">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                    {identidadBloqueada
                      ? 'Verifica tus datos'
                      : tipoPersona === 'NATURAL'
                      ? 'Tus datos personales'
                      : 'Datos de la entidad o empresa'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {identidadBloqueada
                      ? 'Sus datos oficiales han sido precargados desde su sesión verificada.'
                      : 'Comienza indicando quién presenta la solicitud.'}
                  </p>
                </div>

                {esContextoInstitucional && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-start gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-600 text-white font-bold text-xs mt-0.5">!</span>
                      <div>
                        <strong className="font-bold text-amber-950">Sesión activa en Contexto Institucional ({usuario?.rol})</strong>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          Para radicar trámites personales como administrado y darles seguimiento en Mis Expedientes, debe operar en <strong>Contexto Personal</strong>.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await cambiarContexto('PERSONAL');
                        } catch (e) {
                          console.error('Error al cambiar a contexto personal:', e);
                        }
                      }}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-700 text-white font-bold hover:bg-amber-800 transition cursor-pointer text-xs"
                    >
                      Cambiar a Contexto Personal
                    </button>
                  </div>
                )}

                {identidadBloqueada && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-900 flex items-center gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white font-bold text-xs">✓</span>
                    <div>
                      <strong className="font-bold text-emerald-950">Identidad oficial verificada de su sesión activa</strong>
                      <p className="text-[11px] text-emerald-800">
                        Sus datos de identidad ({tipoDocumento}: {numeroDocumento}) han sido precargados conforme a su cuenta verificada. El expediente será vinculado automáticamente a su perfil para seguimiento inmediato.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center mb-1">
                      <label className="block text-xs font-semibold text-slate-700">Tipo de solicitante *</label>
                      <ContextualHelp
                        title="Tipo de solicitante"
                        content="Indique si realiza el trámite a título personal (persona natural) o en representación de una empresa, asociación o entidad pública (persona jurídica)."
                      />
                    </div>
                    <select
                      value={tipoPersona}
                      disabled={identidadBloqueada}
                      onChange={(e) => {
                        const val = e.target.value as 'NATURAL' | 'JURIDICA';
                        setTipoPersona(val);
                        setTipoDocumento(val === 'NATURAL' ? 'DNI' : 'RUC');
                        setNumeroDocumento('');
                        setErrorDocumento(null);
                      }}
                      className={`w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500 ${
                        identidadBloqueada ? 'bg-slate-50 cursor-not-allowed text-slate-700' : ''
                      }`}
                    >
                      <option value="NATURAL">Persona natural</option>
                      <option value="JURIDICA">Empresa o entidad (Persona jurídica)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Documento *</label>
                    <select
                      value={tipoDocumento}
                      disabled={identidadBloqueada}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setTipoDocumento(val);
                        setNumeroDocumento('');
                        setErrorDocumento(null);
                      }}
                      className={`w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500 ${
                        identidadBloqueada ? 'bg-slate-50 cursor-not-allowed text-slate-700' : ''
                      }`}
                    >
                      {tipoPersona === 'NATURAL' ? (
                        <>
                          <option value="DNI">DNI</option>
                          <option value="CE">Carné de Extranjería (CE)</option>
                        </>
                      ) : (
                        <option value="RUC">RUC</option>
                      )}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">Número de Documento *</label>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {numeroDocumento.length} / {tipoDocumento === 'RUC' ? '11 dígitos' : (tipoDocumento === 'CE' ? '8-12 car.' : '8 dígitos')}
                      </span>
                    </div>
                    <input
                      type="text"
                      inputMode={tipoDocumento === 'CE' ? 'text' : 'numeric'}
                      maxLength={tipoDocumento === 'RUC' ? 11 : (tipoDocumento === 'CE' ? 12 : 8)}
                      required
                      readOnly={identidadBloqueada}
                      value={numeroDocumento}
                      onChange={(e) => {
                        if (identidadBloqueada) return;
                        const sanitizado = sanitizarNumeroDocumento(e.target.value, tipoDocumento);
                        setNumeroDocumento(sanitizado);
                        if (errorDocumento) {
                          const res = validarNumeroDocumento(sanitizado, tipoDocumento);
                          if (res.esValido) setErrorDocumento(null);
                        }
                      }}
                      onBlur={() => {
                        if (numeroDocumento && !identidadBloqueada) {
                          const val = validarNumeroDocumento(numeroDocumento, tipoDocumento);
                          if (!val.esValido) setErrorDocumento(val.mensajeError || null);
                        }
                      }}
                      placeholder={obtenerPlaceholderDocumento(tipoDocumento)}
                      className={`w-full px-3 py-2 rounded-xl border text-sm focus:ring-2 focus:ring-cyan-500 font-mono transition ${
                        identidadBloqueada
                          ? 'border-slate-200 bg-slate-50 cursor-not-allowed text-slate-700'
                          : errorDocumento
                          ? 'border-rose-400 bg-rose-50/30 text-rose-900 focus:border-rose-500 focus:ring-rose-200'
                          : 'border-slate-200 bg-white'
                      }`}
                    />
                    {errorDocumento ? (
                      <p className="mt-1 text-xs font-medium text-rose-600 flex items-center gap-1">
                        <span>⚠</span> {errorDocumento}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-500">
                        {obtenerTextoAyudaDocumento(tipoDocumento)}
                      </p>
                    )}
                  </div>

                  {tipoPersona === 'NATURAL' ? (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Nombres *</label>
                        <input
                          type="text"
                          required
                          readOnly={identidadBloqueada}
                          value={nombres}
                          onChange={(e) => {
                            if (!identidadBloqueada) setNombres(e.target.value);
                          }}
                          className={`w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500 ${
                            identidadBloqueada ? 'bg-slate-50 cursor-not-allowed text-slate-700' : ''
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Apellido Paterno *</label>
                        <input
                          type="text"
                          required
                          readOnly={identidadBloqueada}
                          value={apellidoPaterno}
                          onChange={(e) => {
                            if (!identidadBloqueada) setApellidoPaterno(e.target.value);
                          }}
                          className={`w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500 ${
                            identidadBloqueada ? 'bg-slate-50 cursor-not-allowed text-slate-700' : ''
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Apellido Materno *</label>
                        <input
                          type="text"
                          required
                          readOnly={identidadBloqueada}
                          value={apellidoMaterno}
                          onChange={(e) => {
                            if (!identidadBloqueada) setApellidoMaterno(e.target.value);
                          }}
                          className={`w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500 ${
                            identidadBloqueada ? 'bg-slate-50 cursor-not-allowed text-slate-700' : ''
                          }`}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Razón Social *</label>
                        <input
                          type="text"
                          required
                          readOnly={identidadBloqueada}
                          value={razonSocial}
                          onChange={(e) => {
                            if (!identidadBloqueada) setRazonSocial(e.target.value);
                          }}
                          className={`w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500 ${
                            identidadBloqueada ? 'bg-slate-50 cursor-not-allowed text-slate-700' : ''
                          }`}
                        />
                      </div>
                      <div>
                        <div className="flex items-center mb-1">
                          <label className="block text-xs font-semibold text-slate-700">Representante legal *</label>
                          <ContextualHelp
                            title="Representante legal"
                            content="Nombre y apellidos de la persona acreditada con facultades de representación legal inscritas en SUNARP o poder formal ante la institución."
                          />
                        </div>
                        <input
                          type="text"
                          required
                          readOnly={identidadBloqueada}
                          value={representanteLegal}
                          onChange={(e) => {
                            if (!identidadBloqueada) setRepresentanteLegal(e.target.value);
                          }}
                          className={`w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500 ${
                            identidadBloqueada ? 'bg-slate-50 cursor-not-allowed text-slate-700' : ''
                          }`}
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-slate-700">DNI del Representante *</label>
                          <span className="text-[11px] text-slate-400 font-mono">{dniRepresentante.length} / 8 dígitos</span>
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={8}
                          required
                          readOnly={identidadBloqueada}
                          value={dniRepresentante}
                          onChange={(e) => {
                            if (identidadBloqueada) return;
                            const sanitizado = sanitizarNumeroDocumento(e.target.value, 'DNI');
                            setDniRepresentante(sanitizado);
                            if (errorDniRepresentante) {
                              const res = validarNumeroDocumento(sanitizado, 'DNI');
                              if (res.esValido) setErrorDniRepresentante(null);
                            }
                          }}
                          onBlur={() => {
                            if (dniRepresentante) {
                              const val = validarNumeroDocumento(dniRepresentante, 'DNI');
                              if (!val.esValido) setErrorDniRepresentante(val.mensajeError || null);
                            }
                          }}
                          placeholder="45872315"
                          className={`w-full px-3 py-2 rounded-xl border text-sm focus:ring-2 focus:ring-cyan-500 font-mono transition ${
                            errorDniRepresentante
                              ? 'border-rose-400 bg-rose-50/30 text-rose-900 focus:border-rose-500 focus:ring-rose-200'
                              : 'border-slate-200 bg-white'
                          }`}
                        />
                        {errorDniRepresentante ? (
                          <p className="mt-1 text-xs font-medium text-rose-600 flex items-center gap-1">
                            <span>⚠</span> {errorDniRepresentante}
                          </p>
                        ) : (
                          <p className="mt-1 text-[11px] text-slate-500">Ingresa los 8 dígitos del DNI</p>
                        )}
                      </div>
                    </>
                  )}

                  <div>
                    <div className="flex items-center mb-1">
                      <label className="block text-xs font-semibold text-slate-700">Correo para avisos y constancias *</label>
                      <ContextualHelp
                        title="Notificaciones oficiales"
                        content="A esta casilla electrónica enviaremos el cargo digital de presentación, el código CUT y las comunicaciones oficiales emitidas por la institución."
                      />
                    </div>
                    <input
                      type="email"
                      required
                      value={correo}
                      onChange={(e) => setCorreo(e.target.value)}
                      placeholder="ejemplo@correo.com"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Número de teléfono celular *</label>
                    <input
                      type="tel"
                      required
                      value={celular}
                      onChange={(e) => setCelular(e.target.value)}
                      placeholder="987654321"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Dirección o domicilio</label>
                    <input
                      type="text"
                      value={direccion}
                      onChange={(e) => setDireccion(e.target.value)}
                      placeholder="Av. Ucayali 123, Pucallpa"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const valDoc = validarNumeroDocumento(numeroDocumento, tipoDocumento);
                      if (!valDoc.esValido) {
                        setErrorDocumento(valDoc.mensajeError || 'Documento inválido.');
                        return;
                      }
                      if (tipoPersona === 'JURIDICA') {
                        const valDniRep = validarNumeroDocumento(dniRepresentante, 'DNI');
                        if (!valDniRep.esValido) {
                          setErrorDniRepresentante(valDniRep.mensajeError || 'DNI de representante inválido.');
                          return;
                        }
                      }
                      if (!correo || !celular) {
                        alert('Por favor complete los campos obligatorios de identificación y contacto.');
                        return;
                      }
                      setErrorDocumento(null);
                      setErrorDniRepresentante(null);
                      setPaso(2);
                    }}
                    className="px-6 py-2.5 rounded-xl bg-cyan-800 text-white font-semibold text-sm hover:bg-cyan-900 transition"
                  >
                    Continuar: Elegir trámite →
                  </button>
                </div>
              </div>
            )}

            {/* PASO 2: Tu trámite */}
            {paso === 2 && (
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 space-y-4 shadow-2xs">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">Tu trámite</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Selecciona el procedimiento en el catálogo institucional y describe el motivo de tu solicitud.
                  </p>
                </div>

                {!procedimientoSeleccionado || cambiandoTramite ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Buscar en el catálogo de trámites</label>
                      <input
                        type="text"
                        value={busquedaTupa}
                        onChange={(e) => setBusquedaTupa(e.target.value)}
                        placeholder="Escriba el nombre del trámite (ej. certificado, constancia, rectificación)..."
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-100 rounded-2xl p-2 bg-slate-50/50">
                      {cargandoCatalogo ? (
                        <div className="p-4 text-center text-xs text-slate-400">Cargando catálogo de trámites...</div>
                      ) : procedimientosFiltrados.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400">No se encontraron trámites coincidentes.</div>
                      ) : (
                        procedimientosFiltrados.map((proc) => {
                          const sel = procedimientoSeleccionado?.registroVersionId === proc.registroVersionId;
                          const etiquetaTramite = proc.codigo && !proc.codigo.toLowerCase().includes('fila')
                            ? proc.codigo
                            : 'Trámite Oficial';

                          return (
                            <div
                              key={proc.registroVersionId || proc.id}
                              onClick={() => handleSeleccionarProcedimiento(proc)}
                              className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between gap-3 ${
                                sel
                                  ? 'border-cyan-600 bg-cyan-50 text-cyan-950 font-bold'
                                  : 'border-white bg-white hover:border-cyan-200 text-slate-800'
                              }`}
                            >
                              <div>
                                <div className="text-xs text-cyan-700 font-semibold">{etiquetaTramite}</div>
                                <div className="text-sm font-semibold">{proc.denominacion}</div>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="inline-block px-2 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
                                  {proc.monto || 'Gratuito'}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {cambiandoTramite && procedimientoSeleccionado && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setCambiandoTramite(false)}
                          className="text-xs text-slate-500 hover:text-slate-800 underline font-medium"
                        >
                          Cancelar cambio y mantener trámite seleccionado
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4 sm:p-5 space-y-4 shadow-2xs">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-cyan-800 uppercase tracking-wider block">
                          Trámite seleccionado:
                        </span>
                        <h3 className="text-base font-extrabold text-cyan-950">
                          {procedimientoSeleccionado.denominacion}
                        </h3>
                        <p className="text-xs text-cyan-800">
                          Tarifa oficial: <strong>{procedimientoSeleccionado.monto || 'Gratuito'}</strong> • Plazo legal: <strong>30 días hábiles</strong>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-white text-cyan-900 border border-cyan-200 shadow-2xs">
                          Tarifa: {procedimientoSeleccionado.monto || 'Gratuito'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCambiandoTramite(true)}
                          className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-cyan-300 bg-white hover:bg-cyan-100/70 text-cyan-900 transition shadow-2xs cursor-pointer"
                        >
                          Cambiar trámite
                        </button>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-cyan-200/70">
                      <div className="flex items-center mb-1">
                        <label className="block text-xs font-semibold text-slate-700">
                          ¿Qué solicita en este trámite? (Asunto) *
                        </label>
                        <ContextualHelp
                          title="Asunto de la solicitud"
                          content="Escriba un resumen breve y claro de su pedido (por ejemplo: 'Solicito emisión de certificado de estudios del ciclo IV de Contabilidad')."
                        />
                      </div>
                      <textarea
                        required
                        rows={2}
                        value={asunto}
                        onChange={(e) => setAsunto(e.target.value)}
                        placeholder="Describa brevemente el objeto de su petición..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500 bg-white"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setPaso(1)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50"
                  >
                    ← Volver
                  </button>
                  <button
                    type="button"
                    disabled={!procedimientoSeleccionado || !asunto.trim()}
                    onClick={() => setPaso(3)}
                    className="px-6 py-2.5 rounded-xl bg-cyan-800 text-white font-semibold text-sm hover:bg-cyan-900 transition disabled:opacity-50"
                  >
                    Continuar: Adjuntar documentos →
                  </button>
                </div>
              </div>
            )}

            {/* PASO 3: Documentos */}
            {paso === 3 && (
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 space-y-4 shadow-2xs">
                <div>
                  <div className="flex items-center">
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight">Documentos y requisitos</h2>
                    <ContextualHelp
                      title="Documentos en formato PDF"
                      content="Adjunte cada documento en archivo PDF legible (máximo 25 MB). El sistema organizará y foliará las páginas de manera automática para su expediente oficial."
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Presenta los documentos requeridos para tu trámite. El sistema organizará la foliación oficial en orden correlativo.
                  </p>
                </div>

                {/* Banner de procedimiento seleccionado */}
                {procedimientoSeleccionado && (
                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-3.5 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                    <div>
                      <span className="text-[11px] font-bold text-cyan-800 uppercase tracking-wider block">
                        Trámite Seleccionado:
                      </span>
                      <p className="text-sm font-extrabold text-cyan-950">
                        {procedimientoSeleccionado.denominacion}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-cyan-100 text-cyan-900 border border-cyan-200">
                        Tarifa: {procedimientoSeleccionado.monto || 'Gratuito'}
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white text-slate-700 border border-slate-200">
                        Plazo: 30 días hábiles
                      </span>
                    </div>
                  </div>
                )}

                {/* Estados de carga o error de requisitos */}
                {cargandoRequisitos && (
                  <div className="flex items-center gap-2 p-3 bg-cyan-50 border border-cyan-200 rounded-xl text-xs text-cyan-800 animate-pulse">
                    <span className="animate-spin">●</span>
                    <span>Consultando requisitos oficiales del catálogo TUPA...</span>
                  </div>
                )}
                {errorRequisitos && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                    <span>ℹ️ {errorRequisitos}</span>
                  </div>
                )}

                {/* SECCIÓN 1: Solicitud o Escrito de Petición Principal (Art. 113 TUO Ley N° 27444 — D.S. 006-2026-JUS) */}
                {(!tieneSolicitudEspecifica || requisitosDocumentales.length === 0) && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            1. Solicitud o Escrito de Petición (Documento Principal)
                          </span>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">
                            Obligatorio *
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-slate-500">
                          Base legal: Art. 113 del TUO de la Ley N° 27444 (LPAG — D.S. N.° 006-2026-JUS)
                        </p>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">Formato PDF (Máx. 25 MB)</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Documento formal en formato PDF dirigido al IESTP Suiza donde expone de manera clara y fundamentada su petitorio (motivo del trámite, hechos y solicitud concreta).
                    </p>

                    {adjuntos.find((a) => a.esSolicitudPrincipal) ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-50/60 p-3 rounded-xl border border-emerald-200">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="text-emerald-700 font-bold text-xs">✓ PDF Adjuntado:</span>
                          <span className="text-xs font-bold text-slate-800 truncate max-w-xs sm:max-w-md">
                            {adjuntos.find((a) => a.esSolicitudPrincipal)?.nombreArchivo}
                          </span>
                          <span className="text-xs bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded font-mono font-bold">
                            Folio {adjuntos.find((a) => a.esSolicitudPrincipal)?.folioInicio} al {adjuntos.find((a) => a.esSolicitudPrincipal)?.folioFin} ({adjuntos.find((a) => a.esSolicitudPrincipal)?.paginas} {adjuntos.find((a) => a.esSolicitudPrincipal)?.paginas === 1 ? 'pág' : 'págs'})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const idx = adjuntos.findIndex((a) => a.esSolicitudPrincipal);
                            if (idx !== -1) handleRemoverAdjunto(idx);
                          }}
                          className="text-xs text-rose-600 hover:text-rose-800 hover:underline font-semibold"
                        >
                          Quitar
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center p-3.5 border-2 border-dashed border-cyan-300 rounded-xl cursor-pointer hover:border-cyan-600 bg-cyan-50/30 hover:bg-cyan-50/60 transition">
                        <span className="text-xs text-cyan-900 font-bold">
                          + Adjuntar Solicitud en PDF (Obligatorio)
                        </span>
                        <input
                          type="file"
                          accept=".pdf,application/pdf"
                          className="hidden"
                          onChange={(e) =>
                            handleAdjuntarArchivo(
                              e,
                              undefined,
                              `Solicitud - ${procedimientoSeleccionado?.denominacion || 'Trámite'}`,
                              true,
                            )
                          }
                        />
                      </label>
                    )}
                  </div>
                )}

                {/* SECCIÓN 2: Requisitos Documentales Específicos del Catálogo TUPA */}
                {requisitosDocumentales.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Requisitos Documentales Específicos del Trámite
                      </h3>
                      <span className="text-xs font-semibold text-slate-500">
                        {adjuntos.filter((a) => a.idRequisito && requisitosDocumentales.some((r) => r.idRequisito === a.idRequisito)).length} de {requisitosDocumentales.length} adjuntados
                      </span>
                    </div>

                    {requisitosDocumentales.map((req, idx) => {
                      const adjunto = adjuntos.find((a) => a.idRequisito === req.idRequisito);
                      const esObligatorio = req.obligatorio;
                      const numeroItem = tieneSolicitudEspecifica ? idx + 1 : idx + 2;

                      return (
                        <div
                          key={req.idRequisito}
                          className={`p-4 rounded-2xl border transition space-y-2.5 ${
                            adjunto
                              ? 'border-emerald-300 bg-emerald-50/30'
                              : esObligatorio
                              ? 'border-slate-200 bg-white hover:border-cyan-300'
                              : 'border-slate-200 bg-slate-50/50'
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900">
                                  {numeroItem}. {req.nombre}
                                </span>
                                {esObligatorio ? (
                                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">
                                    Obligatorio *
                                  </span>
                                ) : (
                                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                    Opcional
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-[11px] font-mono text-slate-400">Formato PDF (Máx. 25 MB)</span>
                          </div>

                          {req.descripcion && (
                            <p className="text-xs text-slate-600">{req.descripcion}</p>
                          )}

                          {/* Descarga de plantilla oficial si existe archivo válido y activo */}
                          {req.anexo && req.anexo.esDescargable && req.anexo.activo && (
                            <div className="pt-1">
                              <a
                                href={`/api/v1/tramites/tupa/anexos/${encodeURIComponent(req.anexo.codigo)}/descargar`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-800 hover:text-cyan-950 underline"
                              >
                                <span>📥</span> Descargar plantilla oficial: {req.anexo.nombre} (.pdf)
                              </a>
                            </div>
                          )}

                          {adjunto ? (
                            <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-50/60 p-3 rounded-xl border border-emerald-200">
                              <div className="flex items-center gap-2 overflow-hidden">
                                <span className="text-emerald-700 font-bold text-xs">✓ PDF Adjuntado:</span>
                                <span className="text-xs font-bold text-slate-800 truncate max-w-xs sm:max-w-md">
                                  {adjunto.nombreArchivo}
                                </span>
                                <span className="text-xs bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded font-mono font-bold">
                                  Folio {adjunto.folioInicio} al {adjunto.folioFin} ({adjunto.paginas} {adjunto.paginas === 1 ? 'pág' : 'págs'})
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoverAdjunto(adjuntos.indexOf(adjunto))}
                                className="text-xs text-rose-600 hover:text-rose-800 hover:underline font-semibold"
                              >
                                Quitar
                              </button>
                            </div>
                          ) : (
                            <label className="flex items-center justify-center p-3 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-cyan-500 bg-white transition">
                              <span className="text-xs text-cyan-900 font-semibold">
                                + Adjuntar PDF para este requisito {esObligatorio ? '(Obligatorio)' : '(Opcional)'}
                              </span>
                              <input
                                type="file"
                                accept=".pdf,application/pdf"
                                className="hidden"
                                onChange={(e) => handleAdjuntarArchivo(e, req.idRequisito, req.nombre, false)}
                              />
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
                    <p className="font-semibold text-slate-800">
                      ℹ️ Requisitos documentales específicos:
                    </p>
                    <p>
                      Este procedimiento no contempla requisitos documentales específicos adicionales conforme al TUPA oficial vigente. Para iniciar el expediente formal únicamente se requiere la Solicitud o Escrito de Petición principal (Punto 1).
                    </p>
                  </div>
                )}

                {/* SECCIÓN 3: Requisitos Financieros y Gestión de Pago */}
                {(requisitosFinancieros.length > 0 || (procedimientoSeleccionado && procedimientoSeleccionado.monto && procedimientoSeleccionado.monto !== 'Gratuito')) && (
                  <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">💳</span>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-sky-950">
                          Información Financiera y Orden de Pago Oficial
                        </h3>
                      </div>
                      <span className="text-xs font-extrabold px-2.5 py-0.5 rounded bg-sky-100 text-sky-900 border border-sky-200">
                        Tarifa: {procedimientoSeleccionado?.monto || 'Gratuito'}
                      </span>
                    </div>

                    <div className="text-xs text-sky-900 space-y-1">
                      {requisitosFinancieros.map((rf) => (
                        <p key={rf.idRequisito} className="font-semibold">
                          • {limpiarTexto(rf.nombre)}: {limpiarTexto(rf.descripcion) || 'Tasa oficial liquidada mediante orden de pago en Tesorería.'}
                        </p>
                      ))}
                      <p className="text-slate-600 text-[11px] pt-1">
                        <strong>Aviso importante:</strong> La orden de pago oficial se generará automáticamente tras la radicación digital de su solicitud. Podrá cancelarla en la ventanilla de Tesorería del IESTP Suiza o a través de los canales autorizados. <em>El pago previo no es obligatorio para presentar su trámite.</em>
                      </p>
                    </div>

                    {/* Opción voluntaria de adjuntar comprobante previo si el usuario ya canceló */}
                    {requisitosFinancieros.length > 0 && (() => {
                      const reqFin = requisitosFinancieros[0];
                      const adjFin = adjuntos.find((a) => a.idRequisito === reqFin.idRequisito);

                      return (
                        <div className="pt-2 border-t border-sky-200/60">
                          <p className="text-[11px] font-semibold text-sky-950 mb-1.5">
                            ¿Ya canceló el derecho previamente en caja o banco? (Opcional):
                          </p>
                          {adjFin ? (
                            <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-sky-200">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-emerald-700">✓ Comprobante previo:</span>
                                <span className="text-xs font-semibold text-slate-800 truncate max-w-xs">
                                  {adjFin.nombreArchivo}
                                </span>
                                <span className="text-xs bg-sky-100 text-sky-900 px-2 py-0.5 rounded font-mono font-bold">
                                  Folio {adjFin.folioInicio} al {adjFin.folioFin}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoverAdjunto(adjuntos.indexOf(adjFin))}
                                className="text-xs text-rose-600 hover:underline font-semibold"
                              >
                                Quitar
                              </button>
                            </div>
                          ) : (
                            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-sky-300 bg-white hover:bg-sky-50 text-xs font-semibold text-sky-900 cursor-pointer transition">
                              <span>+ Adjuntar Comprobante de Pago previo (Opcional)</span>
                              <input
                                type="file"
                                accept=".pdf,application/pdf"
                                className="hidden"
                                onChange={(e) => handleAdjuntarArchivo(e, reqFin.idRequisito, 'Comprobante de Pago', false)}
                              />
                            </label>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* SECCIÓN 4: Actuaciones y Verificaciones Internas */}
                {requisitosInternos.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🏛️</span>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Actuaciones y Verificaciones Internas Institucionales
                      </h3>
                    </div>
                    <div className="text-xs text-slate-600 space-y-1">
                      {requisitosInternos.map((ri) => (
                        <div key={ri.idRequisito} className="flex items-start gap-1.5">
                          <span className="text-slate-400 font-bold">•</span>
                          <div>
                            <span className="font-bold text-slate-800">{limpiarTexto(ri.nombre)}:</span>{' '}
                            <span>
                              {limpiarTexto(ri.descripcion) ||
                                'Actuación o verificación interna institucional. No requiere trámite del administrado.'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Alerta de validación de documentos */}
                {errorValidacionDocumentos && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium flex items-center gap-2">
                    <span className="text-base">⚠️</span>
                    <span>{errorValidacionDocumentos}</span>
                  </div>
                )}

                {/* Resumen de Foliación Automática */}
                {adjuntos.length > 0 && (
                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="text-xs font-bold text-cyan-950 uppercase tracking-wide">
                          Foliación oficial de su expediente
                        </span>
                        <ContextualHelp
                          title="¿Qué es la foliación?"
                          content="De acuerdo con la Ley N° 27444, cada página del expediente debe numerarse correlativamente desde la primera hasta la última para garantizar la integridad de los actuados."
                        />
                      </div>
                      <span className="text-sm font-black text-cyan-900">
                        Total: {totalFolios} {totalFolios === 1 ? 'folio' : 'folios'}
                      </span>
                    </div>
                    <ul className="text-xs text-cyan-900 space-y-1">
                      {adjuntos.map((a, idx) => (
                        <li key={idx} className="flex justify-between border-b border-cyan-100/60 pb-1">
                          <span className="truncate max-w-sm">{a.nombreArchivo}</span>
                          <span className="font-mono font-bold">
                            F. {a.folioInicio} a {a.folioFin} ({a.paginas} {a.paginas === 1 ? 'pág' : 'págs'})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setPaso(2)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50"
                  >
                    ← Volver
                  </button>
                  <button
                    type="button"
                    disabled={adjuntos.length === 0 || procesandoArchivo}
                    onClick={handleAvanzarAPaso4}
                    className="px-6 py-2.5 rounded-xl bg-cyan-800 text-white font-semibold text-sm hover:bg-cyan-900 transition disabled:opacity-50"
                  >
                    Continuar: Revisar y presentar →
                  </button>
                </div>
              </div>
            )}

            {/* PASO 4: Confirmación */}
            {paso === 4 && (
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 space-y-4 shadow-2xs">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">Confirmación de la solicitud</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Verifica cuidadosamente tus datos y documentos antes de enviar la solicitud formal.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 font-semibold">Solicitante:</span>
                      <div className="font-bold text-slate-800">
                        {tipoPersona === 'NATURAL' ? `${nombres} ${apellidoPaterno} ${apellidoMaterno}` : razonSocial}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold">{tipoDocumento}:</span>
                      <div className="font-bold text-slate-800 font-mono">{numeroDocumento}</div>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold">Correo de Notificación:</span>
                      <div className="font-bold text-slate-800">{correo}</div>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold">Procedimiento:</span>
                      <div className="font-bold text-slate-800">{procedimientoSeleccionado?.denominacion}</div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-semibold">Total de páginas foliadas:</span>
                      <span className="text-sm font-black text-cyan-900 font-mono">{totalFolios} folios</span>
                    </div>
                    <ul className="text-[11px] text-slate-500 space-y-0.5">
                      {adjuntos.map((a, i) => (
                        <li key={i} className="flex justify-between">
                          <span className="truncate max-w-xs sm:max-w-md">• {a.nombreArchivo}</span>
                          <span className="font-mono font-bold text-slate-700">
                            F. {a.folioInicio} a {a.folioFin} ({a.paginas} {a.paginas === 1 ? 'pág' : 'págs'})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-cyan-200 bg-cyan-50/50 space-y-2">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={declaracionAceptada}
                      onChange={(e) => setDeclaracionAceptada(e.target.checked)}
                      className="mt-0.5 rounded text-cyan-800 focus:ring-cyan-500 w-4 h-4"
                    />
                    <span className="text-xs text-slate-700 leading-relaxed">
                      <strong>Declaración Jurada de Veracidad:</strong> Declaro bajo juramento que los datos y
                      documentos adjuntos corresponden a la verdad, sujetándome a las sanciones administrativas y
                      penales previstas en el TUO de la Ley N° 27444. Acepto recibir notificaciones en el correo electrónico consignado.
                    </span>
                  </label>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setPaso(3)}
                  >
                    ← Modificar Archivos
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={enviando || !declaracionAceptada}
                    isLoading={enviando}
                    loadingText="Registrando trámite..."
                  >
                    Presentar trámite
                  </Button>
                </div>
              </div>
            )}
          </form>
        )}

        {/* Diálogo Institucional de Procesamiento Documental */}
        {enviando && (
          <div
            role="status"
            aria-live="polite"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          >
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-slate-200 text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <img
                src={processingImg}
                alt="Procesando trámite"
                width={112}
                height={112}
                loading="lazy"
                decoding="async"
                className="mx-auto h-28 w-28 object-contain aspect-square"
              />
              <div>
                <h3 className="text-base font-bold text-slate-900">Procesando radicación digital</h3>
                <p className="text-xs text-slate-500 mt-0.5">Sistema de Gestión Documentaria — IESTP Suiza</p>
              </div>
              <div className="space-y-2 text-xs text-slate-700 text-left bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <p className="flex items-center gap-2 text-emerald-700 font-semibold">
                  <span>✓</span> Validando información y requisitos
                </p>
                <p className="flex items-center gap-2 text-suiza-primary font-semibold">
                  <span className="animate-pulse">●</span> Registrando expediente y foliación
                </p>
                <p className="flex items-center gap-2 text-slate-400">
                  <span>○</span> Generando Código Único de Trámite (CUT)
                </p>
              </div>
              <p className="text-[11px] text-slate-400 italic">
                Por favor no cierre la ventana mientras se completa la radicación.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
