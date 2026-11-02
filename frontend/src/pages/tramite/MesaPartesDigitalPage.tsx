import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { contarPaginasPdfArchivo } from '../../utils/foliacionPdf';
import { obtenerCatalogoProcedimientosTupa } from '../../services/procedimientosTupa.service';
import type { ProcedimientoTupa } from '../../types/procedimientoTupa';

interface RequisitoEstructurado {
  idRequisito: string;
  nombre: string;
  descripcion?: string;
  tipoRequisito: string;
  esAnexoDigital: boolean;
  obligatorio: boolean;
  orden: number;
}

interface ArchivoAdjuntoState {
  idRequisito?: string;
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
  const [paso, setPaso] = useState<number>(1);

  // 1. Datos del Solicitante
  const [tipoPersona, setTipoPersona] = useState<'NATURAL' | 'JURIDICA'>('NATURAL');
  const [tipoDocumento, setTipoDocumento] = useState<'DNI' | 'CE' | 'RUC'>('DNI');
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidoPaterno, setApellidoPaterno] = useState('');
  const [apellidoMaterno, setApellidoMaterno] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [representanteLegal, setRepresentanteLegal] = useState('');
  const [dniRepresentante, setDniRepresentante] = useState('');
  const [correo, setCorreo] = useState('');
  const [celular, setCelular] = useState('');
  const [direccion, setDireccion] = useState('');

  // 2. Procedimiento TUPA
  const [catalogoTupa, setCatalogoTupa] = useState<ProcedimientoTupa[]>([]);
  const [busquedaTupa, setBusquedaTupa] = useState('');
  const [procedimientoSeleccionado, setProcedimientoSeleccionado] = useState<ProcedimientoTupa | null>(null);
  const [requisitosEstructurados, setRequisitosEstructurados] = useState<RequisitoEstructurado[]>([]);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false);
  const [asunto, setAsunto] = useState('');

  // 3. Documentos y Foliación
  const [adjuntos, setAdjuntos] = useState<ArchivoAdjuntoState[]>([]);
  const [procesandoArchivo, setProcesandoArchivo] = useState(false);

  // 4. Envío y Resultados
  const [declaracionAceptada, setDeclaracionAceptada] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoRadicacionPublica | null>(null);

  // Cargar catálogo de procedimientos
  useEffect(() => {
    async function cargarProcedimientos() {
      setCargandoCatalogo(true);
      try {
        const datos = await obtenerCatalogoProcedimientosTupa();
        setCatalogoTupa(datos);
      } catch (err) {
        console.error('Error al cargar catálogo TUPA:', err);
      } finally {
        setCargandoCatalogo(false);
      }
    }
    cargarProcedimientos();
  }, []);

  // Al seleccionar procedimiento, cargar sus requisitos estructurados
  const handleSeleccionarProcedimiento = async (proc: ProcedimientoTupa) => {
    setProcedimientoSeleccionado(proc);
    setRequisitosEstructurados([]);
    setAdjuntos([]);
    setAsunto(`Solicitud de ${proc.denominacion}`);

    if (proc.registroVersionId) {
      try {
        const res = await apiClient.get<{ requisitos: RequisitoEstructurado[] }>(
          `/api/v1/tramites/tupa/versiones/${proc.registroVersionId}/requisitos`
        );
        if (res.data?.requisitos) {
          setRequisitosEstructurados(res.data.requisitos);
        }
      } catch (e) {
        console.warn('No se pudieron obtener requisitos estructurados, se usará lista canónica:', e);
      }
    }
  };

  // Cargar archivo PDF y calcular páginas
  const handleAdjuntarArchivo = async (
    e: React.ChangeEvent<HTMLInputElement>,
    idRequisito?: string,
    nombreRequisito?: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Solo se admiten documentos en formato PDF.');
      return;
    }

    setProcesandoArchivo(true);
    try {
      const paginas = await contarPaginasPdfArchivo(file);

      // Convertir a base64
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result as string;
        const base64 = res.includes(',') ? res.split(',')[1] : res;

        setAdjuntos((prev) => {
          // Reemplazar si ya existía para ese requisito
          const sinActual = prev.filter((a) => (idRequisito ? a.idRequisito !== idRequisito : a.nombreArchivo !== file.name));
          let cursor = 0;
          const actualizados: ArchivoAdjuntoState[] = [];

          for (const item of sinActual) {
            actualizados.push({
              ...item,
              folioInicio: cursor + 1,
              folioFin: cursor + item.paginas,
            });
            cursor += item.paginas;
          }

          const nuevo: ArchivoAdjuntoState = {
            idRequisito,
            nombreArchivo: nombreRequisito ? `${nombreRequisito} - ${file.name}` : file.name,
            archivo: file,
            paginas,
            folioInicio: cursor + 1,
            folioFin: cursor + paginas,
            base64,
          };
          actualizados.push(nuevo);
          return actualizados;
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
      const mensaje =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        'Ocurrió un error al procesar la radicación digital. Verifique los datos ingresados.';
      setErrorEnvio(mensaje);
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
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/20 to-teal-50/15 py-10 px-4 sm:px-6 lg:px-8 text-slate-900">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Cabecera Oficial */}
        <section className="relative overflow-hidden rounded-3xl border border-white/80 bg-white/90 p-6 sm:p-8 shadow-sm backdrop-blur-md space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-100/70 text-cyan-900 mb-2">
                <span>Trámite Oficial 24x7</span>
                <span>•</span>
                <span>Sin Necesidad de Cuenta Previa</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                Mesa de Partes Digital
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                IESTP "Suiza" — Presentación oficial de solicitudes y expedientes documentarios (TUO Ley N° 27444).
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/consulta"
                className="text-xs font-semibold text-cyan-900 bg-white border border-cyan-200 px-3 py-2 rounded-xl hover:bg-cyan-50 transition"
              >
                Consultar Expediente
              </Link>
              <Link
                to="/login"
                className="text-xs font-semibold text-white bg-cyan-800 px-3 py-2 rounded-xl hover:bg-cyan-900 transition shadow-xs"
              >
                Iniciar Sesión
              </Link>
            </div>
          </div>

          {/* Stepper informativo */}
          {!resultado && (
            <div className="grid grid-cols-4 gap-2 pt-2">
              {[
                { num: 1, label: 'Identificación' },
                { num: 2, label: 'Procedimiento' },
                { num: 3, label: 'Requisitos y PDF' },
                { num: 4, label: 'Radicación' },
              ].map((s) => (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => setPaso(s.num)}
                  className={`text-left p-2.5 rounded-xl border transition ${
                    paso === s.num
                      ? 'border-cyan-600 bg-cyan-50/70 text-cyan-950 font-bold'
                      : paso > s.num
                      ? 'border-slate-200 bg-white text-slate-700'
                      : 'border-transparent text-slate-400 opacity-70'
                  }`}
                >
                  <span className="text-xs text-cyan-800">Paso {s.num}</span>
                  <div className="text-xs sm:text-sm font-semibold truncate">{s.label}</div>
                </button>
              ))}
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
                  ¡Trámite Radicado Exitosamente!
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
                    Vence el {new Date(resultado.ordenPago.fechaVencimiento).toLocaleDateString('es-PE')}. Puede cancelar mediante Tesorería o canal Taypi / DEMO_QR.
                  </p>
                </div>
              )}

              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                {resultado.mensajeLegal}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <Link
                to={`/consulta/${encodeURIComponent(resultado.cut)}?documento=${encodeURIComponent(numeroDocumento)}`}
                className="w-full sm:w-auto text-center px-6 py-3 rounded-xl bg-cyan-800 text-white font-semibold text-sm hover:bg-cyan-900 transition shadow-sm"
              >
                Ir al Seguimiento en Línea
              </Link>
              <button
                type="button"
                onClick={() => {
                  setResultado(null);
                  setPaso(1);
                  setAdjuntos([]);
                  setProcedimientoSeleccionado(null);
                  setNumeroDocumento('');
                }}
                className="w-full sm:w-auto text-center px-5 py-3 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 transition"
              >
                Presentar Otro Trámite
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleRadicar} className="space-y-6">
            {errorEnvio && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                <strong>Error al procesar:</strong> {errorEnvio}
              </div>
            )}

            {/* PASO 1: Identificación del Solicitante */}
            {paso === 1 && (
              <div className="rounded-3xl border border-white/80 bg-white/90 p-6 sm:p-8 space-y-6 shadow-sm">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Paso 1: Identificación y Contacto del Solicitante</h2>
                  <p className="text-xs text-slate-500">
                    Ingrese los datos de la persona natural o jurídica que presenta el trámite.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Solicitante *</label>
                    <select
                      value={tipoPersona}
                      onChange={(e) => {
                        const val = e.target.value as 'NATURAL' | 'JURIDICA';
                        setTipoPersona(val);
                        setTipoDocumento(val === 'NATURAL' ? 'DNI' : 'RUC');
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="NATURAL">Persona Natural (Ciudadano / Estudiante)</option>
                      <option value="JURIDICA">Persona Jurídica (Empresa / Entidad)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Documento *</label>
                    <select
                      value={tipoDocumento}
                      onChange={(e) => setTipoDocumento(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500"
                    >
                      {tipoPersona === 'NATURAL' ? (
                        <>
                          <option value="DNI">DNI (8 dígitos)</option>
                          <option value="CE">Carné de Extranjería (CE)</option>
                        </>
                      ) : (
                        <option value="RUC">RUC (11 dígitos)</option>
                      )}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Número de Documento *</label>
                    <input
                      type="text"
                      required
                      value={numeroDocumento}
                      onChange={(e) => setNumeroDocumento(e.target.value)}
                      placeholder={tipoDocumento === 'DNI' ? '45872315' : 'Número de identificación'}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500 font-mono"
                    />
                  </div>

                  {tipoPersona === 'NATURAL' ? (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Nombres *</label>
                        <input
                          type="text"
                          required
                          value={nombres}
                          onChange={(e) => setNombres(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Apellido Paterno *</label>
                        <input
                          type="text"
                          required
                          value={apellidoPaterno}
                          onChange={(e) => setApellidoPaterno(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Apellido Materno *</label>
                        <input
                          type="text"
                          required
                          value={apellidoMaterno}
                          onChange={(e) => setApellidoMaterno(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500"
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
                          value={razonSocial}
                          onChange={(e) => setRazonSocial(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Representante Legal *</label>
                        <input
                          type="text"
                          required
                          value={representanteLegal}
                          onChange={(e) => setRepresentanteLegal(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">DNI del Representante *</label>
                        <input
                          type="text"
                          required
                          value={dniRepresentante}
                          onChange={(e) => setDniRepresentante(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Correo Electrónico (Notificación) *</label>
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
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono Celular *</label>
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
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Dirección Domiciliaria</label>
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
                      if (!numeroDocumento || !correo || !celular) {
                        alert('Por favor complete los campos obligatorios de identificación y contacto.');
                        return;
                      }
                      setPaso(2);
                    }}
                    className="px-6 py-2.5 rounded-xl bg-cyan-800 text-white font-semibold text-sm hover:bg-cyan-900 transition"
                  >
                    Siguiente: Elegir Procedimiento →
                  </button>
                </div>
              </div>
            )}

            {/* PASO 2: Selección de Procedimiento TUPA */}
            {paso === 2 && (
              <div className="rounded-3xl border border-white/80 bg-white/90 p-6 sm:p-8 space-y-6 shadow-sm">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Paso 2: Procedimiento TUPA y Asunto</h2>
                  <p className="text-xs text-slate-500">
                    Seleccione el trámite oficial aprobado del catálogo institucional vigente.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Buscar Procedimiento TUPA</label>
                  <input
                    type="text"
                    value={busquedaTupa}
                    onChange={(e) => setBusquedaTupa(e.target.value)}
                    placeholder="Escriba el nombre del trámite o código (ej. certificado, rectificación, constancia)..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-100 rounded-2xl p-2 bg-slate-50/50">
                  {cargandoCatalogo ? (
                    <div className="p-4 text-center text-xs text-slate-400">Cargando catálogo TUPA...</div>
                  ) : procedimientosFiltrados.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">No se encontraron procedimientos coincidentes.</div>
                  ) : (
                    procedimientosFiltrados.map((proc) => {
                      const sel = procedimientoSeleccionado?.registroVersionId === proc.registroVersionId;
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
                            <div className="text-xs text-cyan-700 font-semibold">{proc.fuente?.referenciaFila || proc.codigo || "PROC"}</div>
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

                {procedimientoSeleccionado && (
                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-cyan-950">Procedimiento Seleccionado:</span>
                      <span className="text-xs font-bold text-cyan-900 bg-cyan-100 px-2 py-0.5 rounded">
                        {procedimientoSeleccionado.monto || 'Gratuito'}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-cyan-950">
                      {procedimientoSeleccionado.denominacion}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Asunto o Motivo de la Solicitud *
                      </label>
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
                    Siguiente: Carga de Requisitos →
                  </button>
                </div>
              </div>
            )}

            {/* PASO 3: Carga de Requisitos Documentales y Foliación */}
            {paso === 3 && (
              <div className="rounded-3xl border border-white/80 bg-white/90 p-6 sm:p-8 space-y-6 shadow-sm">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Paso 3: Carga de Requisitos Documentales (PDF)</h2>
                  <p className="text-xs text-slate-500">
                    Adjunte los documentos requeridos. El sistema calculará automáticamente las páginas reales y la foliación oficial.
                  </p>
                </div>

                {requisitosEstructurados.length > 0 ? (
                  <div className="space-y-3">
                    {requisitosEstructurados.map((req) => {
                      const adjunto = adjuntos.find((a) => a.idRequisito === req.idRequisito);
                      return (
                        <div key={req.idRequisito} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800">
                              {req.nombre} {req.obligatorio && <span className="text-rose-500">*</span>}
                            </span>
                            <span className="text-xs text-slate-400">PDF</span>
                          </div>
                          {req.descripcion && <p className="text-xs text-slate-500">{req.descripcion}</p>}

                          {adjunto ? (
                            <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-cyan-200">
                              <div className="flex items-center gap-2">
                                <span className="text-cyan-800 font-bold text-xs">PDF</span>
                                <span className="text-xs font-semibold text-slate-800 truncate max-w-xs">
                                  {adjunto.nombreArchivo}
                                </span>
                                <span className="text-xs bg-cyan-100 text-cyan-900 px-2 py-0.5 rounded font-mono font-bold">
                                  Folio {adjunto.folioInicio} al {adjunto.folioFin} ({adjunto.paginas} págs)
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoverAdjunto(adjuntos.indexOf(adjunto))}
                                className="text-xs text-rose-600 hover:underline font-semibold"
                              >
                                Quitar
                              </button>
                            </div>
                          ) : (
                            <label className="flex items-center justify-center p-3 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-cyan-500 bg-white transition">
                              <span className="text-xs text-cyan-900 font-semibold">
                                + Adjuntar PDF para este requisito
                              </span>
                              <input
                                type="file"
                                accept=".pdf,application/pdf"
                                className="hidden"
                                onChange={(e) => handleAdjuntarArchivo(e, req.idRequisito, req.nombre)}
                              />
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 border-2 border-dashed border-slate-300 rounded-2xl text-center space-y-3 bg-slate-50/50">
                    <p className="text-xs text-slate-600">
                      Adjunte su solicitud y anexos en formato PDF para iniciar la radicación.
                    </p>
                    <label className="inline-block px-5 py-2.5 rounded-xl bg-cyan-800 text-white font-semibold text-xs cursor-pointer hover:bg-cyan-900 transition">
                      + Seleccionar Archivo PDF
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        className="hidden"
                        onChange={(e) => handleAdjuntarArchivo(e)}
                      />
                    </label>
                  </div>
                )}

                {/* Resumen de Foliación Automática */}
                {adjuntos.length > 0 && (
                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-cyan-950 uppercase tracking-wide">
                        Resumen de Foliación Automática
                      </span>
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
                    onClick={() => setPaso(4)}
                    className="px-6 py-2.5 rounded-xl bg-cyan-800 text-white font-semibold text-sm hover:bg-cyan-900 transition disabled:opacity-50"
                  >
                    Siguiente: Confirmar y Radicar →
                  </button>
                </div>
              </div>
            )}

            {/* PASO 4: Confirmación y Envío Oficial */}
            {paso === 4 && (
              <div className="rounded-3xl border border-white/80 bg-white/90 p-6 sm:p-8 space-y-6 shadow-sm">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Paso 4: Confirmación y Declaración Jurada</h2>
                  <p className="text-xs text-slate-500">
                    Revise la información consignada antes de formalizar la radicación digital.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 font-semibold">Administrado:</span>
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

                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-slate-600 font-semibold">Total de Folios Calculados:</span>
                    <span className="text-sm font-black text-cyan-900 font-mono">{totalFolios} folios</span>
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
                  <button
                    type="button"
                    onClick={() => setPaso(3)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50"
                  >
                    ← Modificar Archivos
                  </button>
                  <button
                    type="submit"
                    disabled={enviando || !declaracionAceptada}
                    className="px-8 py-3 rounded-xl bg-cyan-800 text-white font-bold text-sm hover:bg-cyan-900 transition shadow-sm disabled:opacity-50 flex items-center gap-2"
                  >
                    {enviando ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        <span>Radicando Trámite...</span>
                      </>
                    ) : (
                      <span>Radicar Trámite Digital 🚀</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
