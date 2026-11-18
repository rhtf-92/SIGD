import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  FileText,
  Image as ImageIcon,
  File,
  Search,
  ShieldCheck,
  ArrowLeft,
  type LucideIcon,
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ProcessStepper, type ProcessStep } from '../../components/ui/ProcessStepper';
import { EmptyState } from '../../components/ui/EmptyState';
import { TechnicalDetails } from '../../components/ui/TechnicalDetails';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { ContextualHelp } from '../../components/ui/ContextualHelp';
import ConsultaCutIllustration from '../../components/tramite/ConsultaCutIllustration';

export interface DtoDocumentoPublico {
  nombreArchivo: string;
  contentType: string;
  hashSha256: string;
}

export interface DtoProveidoPublico {
  numero: string;
  fechaEmision: string;
  resumen: string;
}

export interface DtoConsultaPublica {
  cut: string;
  anioFiscal: number;
  estadoTramite: string;
  tipoTramite: string | null;
  asunto: string;
  fechaEnvioReal: string;
  fechaRadicacionLegal: string;
  fueraDeHorario: boolean;
  canalRecepcion: string;
  totalFolios: number;
  areaActual?: string;
  pasoSiguiente: string;
  estadoPago: string;
  administrado?: {
    documentoEnmascarado?: string | null;
    nombreEnmascarado?: string | null;
  };
  documentos: DtoDocumentoPublico[];
  proveidos: DtoProveidoPublico[];
  mensajeLegal: string;
}

function obtenerTipoDocumentalVisual(contentType: string, nombreArchivo: string): { label: string; icon: LucideIcon } {
  const ct = (contentType || '').toLowerCase();
  const name = (nombreArchivo || '').toLowerCase();
  if (ct.includes('pdf') || name.endsWith('.pdf')) {
    return { label: 'PDF', icon: FileText };
  }
  if (ct.includes('image') || name.match(/\.(jpg|jpeg|png|webp|gif)$/)) {
    return { label: 'Imagen', icon: ImageIcon };
  }
  return { label: 'Documento', icon: File };
}

export default function ConsultaPublicaPage() {
  const { cut } = useParams<{ cut: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [cutInput, setCutInput] = useState(cut ?? '');
  const [documentoInput, setDocumentoInput] = useState(searchParams.get('documento') ?? '');
  const [resultado, setResultado] = useState<DtoConsultaPublica | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cut) {
      setCutInput(cut);
      const docParam = searchParams.get('documento');
      if (docParam) {
        setDocumentoInput(docParam);
        consultar(cut, docParam);
      }
    }
  }, [cut, searchParams]);

  const consultar = async (codigoCut: string, documento: string) => {
    const trimmedCut = codigoCut.trim().toUpperCase();
    const trimmedDoc = documento.trim().replace(/[-\s]/g, '');

    if (!trimmedCut) {
      setError('Por favor, ingrese un código CUT válido (ejemplo: EXP-2026-000001).');
      return;
    }

    if (!trimmedDoc) {
      setError('Por protección de datos (Ley N° 29733), debe ingresar el documento de identidad del solicitante (DNI, CE o RUC).');
      return;
    }

    setCargando(true);
    setError(null);

    try {
      const res = await apiClient.get<DtoConsultaPublica>(
        `/api/v1/tramites/consulta-publica/${encodeURIComponent(trimmedCut)}`,
        {
          params: { documento: trimmedDoc },
        }
      );
      setResultado(res.data);
    } catch {
      setResultado(null);
      setError(
        'No se encontró ningún expediente con los datos provistos o los datos de identidad no coinciden.'
      );
    } finally {
      setCargando(false);
    }
  };

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cutInput.trim()) {
      setError('Por favor, ingrese el código CUT del expediente.');
      return;
    }
    if (!documentoInput.trim()) {
      setError('Por favor, ingrese el número de documento de identidad del solicitante.');
      return;
    }

    const trimmedCut = cutInput.trim().toUpperCase();
    const trimmedDoc = documentoInput.trim().replace(/[-\s]/g, '');

    navigate(`/consulta/${encodeURIComponent(trimmedCut)}?documento=${encodeURIComponent(trimmedDoc)}`);
    consultar(trimmedCut, trimmedDoc);
  };

  const formatearEstadoPago = (estado: string) => {
    switch (estado) {
      case 'PAGADO':
      case 'CONFIRMADO':
        return { label: 'Tasa Pagada', variant: 'success' as const };
      case 'PENDIENTE':
      case 'PENDIENTE_PAGO':
        return { label: 'Pago Pendiente', variant: 'warning' as const };
      case 'EXONERADO':
      case 'NO_APLICA':
      default:
        return { label: 'Gratuito / No Aplica', variant: 'neutral' as const };
    }
  };

  // Construir etapas de progreso psicológico real
  const calcularEtapas = (r: DtoConsultaPublica): ProcessStep[] => {
    const estado = (r.estadoTramite || '').toUpperCase();
    const pago = (r.estadoPago || '').toUpperCase();
    const pagoCompletado = pago === 'CONFIRMADO' || pago === 'PAGADO' || pago === 'EXONERADO' || pago === 'NO_APLICA';

    return [
      {
        id: '1',
        title: 'Trámite registrado',
        description: 'Ingreso oficial a Mesa de Partes',
        status: 'completed',
      },
      {
        id: '2',
        title: 'Pago institucional',
        description: pagoCompletado ? 'Arancel confirmado' : 'Pendiente de pago',
        status: pagoCompletado ? 'completed' : 'current',
      },
      {
        id: '3',
        title: 'En evaluación',
        description: 'Revisión técnica de requisitos',
        status:
          estado === 'RESUELTO' || estado === 'ARCHIVADO' || estado === 'ATENDIDO'
            ? 'completed'
            : estado === 'OBSERVADO'
            ? 'error'
            : estado === 'EN_TRAMITE' || estado === 'ASIGNADO' || estado === 'EN_REVISION'
            ? 'current'
            : 'pending',
      },
      {
        id: '4',
        title: 'Pendiente de resolución',
        description: 'Acto resolutivo formal',
        status:
          estado === 'RESUELTO' || estado === 'ARCHIVADO'
            ? 'completed'
            : estado === 'POR_FIRMAR'
            ? 'current'
            : 'pending',
      },
      {
        id: '5',
        title: 'Resultado disponible',
        description: 'Notificación oficial emitida',
        status:
          estado === 'RESUELTO' || estado === 'ATENDIDO'
            ? 'completed'
            : estado === 'RECHAZADO'
            ? 'error'
            : 'pending',
      },
    ];
  };

  return (
    <main className="min-h-screen bg-surface-page py-8 px-4 sm:px-6 lg:px-8 text-slate-900">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Cabecera Institucional */}
        <header className="rounded-3xl border border-slate-200 bg-white shadow-md overflow-hidden">
          {/* Banner institucional */}
          <div className="relative bg-gradient-to-br from-[#0a2f6b] via-[#0b4f9e] to-[#1473d6] px-6 py-7 sm:px-9 sm:py-9 text-white">
            <div className="pointer-events-none absolute -right-10 -top-12 h-52 w-52 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute right-24 -bottom-16 h-40 w-40 rounded-full bg-amber-300/15" />
            <div className="pointer-events-none absolute left-0 bottom-0 h-1.5 w-full bg-gradient-to-r from-amber-300 via-amber-400 to-transparent" />

            <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-bold text-white border border-white/25 mb-3">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-300" />
                  Consulta Pública de Trámites y Expedientes
                </div>
                <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
                  Consulta tu trámite <span className="text-amber-300">en línea</span>
                </h1>
                <p className="text-xs sm:text-sm text-blue-100 mt-2 max-w-xl">
                  IESTP &quot;Suiza&quot; — Sede Digital y Transparencia Documentaria
                  <span className="block text-[11px] text-blue-200/90 mt-0.5">Ley N° 27444 · Ley N° 29733</span>
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link to="/mesa-partes">
                  <Button variant="secondary" size="sm" className="bg-white text-blue-950 border-white hover:bg-blue-50 font-bold shadow-sm">
                    Mesa de Partes
                  </Button>
                </Link>
                <Link to="/">
                  <Button variant="ghost" size="sm" className="text-white hover:bg-white/15">
                    <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                    Inicio
                  </Button>
                </Link>
              </div>
            </div>

            {/* Pasos guiados */}
            <ol className="relative mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {[
                ['1', 'Ingresa tu CUT', 'Lo encuentras en tu cargo de recepción'],
                ['2', 'Valida tu documento', 'DNI, CE o RUC del titular'],
                ['3', 'Revisa el avance', 'Estado, área y pago en tiempo real'],
              ].map(([n, t, d]) => (
                <li key={n} className="flex items-center gap-3 rounded-xl bg-white/10 border border-white/20 px-3 py-2.5 backdrop-blur-sm">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-300 text-blue-950 font-black">{n}</span>
                  <span>
                    <strong className="block text-white">{t}</strong>
                    <span className="text-blue-100">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="p-6 sm:p-8 space-y-6">

          {/* Formulario de Búsqueda Seguro (CUT + Documento) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <form onSubmit={handleBuscar} className="space-y-4 lg:col-span-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  id="cut-input"
                  label="Código Único de Trámite (CUT)"
                  labelSuffix={
                    <ContextualHelp
                      title="¿Qué es el código CUT?"
                      content="Es el identificador oficial (ej. EXP-2026-000001) asignado a su expediente al momento de ingresar por la Mesa de Partes Digital. Lo encuentra en su cargo de recepción."
                    />
                  }
                  required
                  placeholder="Ejemplo: EXP-2026-000001"
                  value={cutInput}
                  onChange={(e) => setCutInput(e.target.value)}
                  helperText="Identificador oficial entregado en su cargo digital"
                />

                <Input
                  id="doc-input"
                  label="Documento del Solicitante"
                  labelSuffix={
                    <ContextualHelp
                      title="Validación de titularidad"
                      content="Por protección de datos personales (Ley N° 29733), solo el titular de la solicitud o su representante legal pueden consultar el detalle del expediente con su DNI, CE o RUC."
                    />
                  }
                  required
                  placeholder="Ejemplo: 45678901"
                  maxLength={15}
                  value={documentoInput}
                  onChange={(e) => setDocumentoInput(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
                  helperText="Ingresa el DNI (8 dígitos), RUC (11 dígitos) o CE del solicitante"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-sm">🔒</span>
                  <span>Por seguridad y confidencialidad (Ley N° 29733), se valida que el número de documento corresponda al titular del expediente.</span>
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={cargando}
                  loadingText="Consultando..."
                  className="w-full sm:w-auto shrink-0 bg-blue-900 hover:bg-blue-800 text-white font-bold shadow-sm"
                >
                  <Search className="h-4 w-4 mr-1.5" />
                  Consultar Estado
                </Button>
              </div>
            </form>

            <div className="flex lg:col-span-4 justify-center items-center p-2 rounded-2xl bg-gradient-to-br from-blue-50 via-white to-amber-50/60 border border-blue-100 shadow-2xs">
              <ConsultaCutIllustration className="h-56 w-auto" />
            </div>
          </div>

          {error && (
            <div className="mt-4">
              <EmptyState
                title="No encontramos un trámite con esos datos"
                description={error}
              />
            </div>
          )}
          </div>
        </header>

        {/* Loading skeleton */}
        {cargando && !resultado && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
            <SkeletonCard />
          </div>
        )}

        {/* Detalle del Expediente */}
        {resultado && (
          <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs space-y-0">
            {/* 1. Header con Información Principal */}
            <div className="bg-slate-900 px-6 py-5 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">
                  Expediente Encontrado
                </span>
                <h2 className="text-2xl font-mono font-extrabold text-white tracking-wide mt-0.5">
                  {resultado.cut}
                </h2>
                <p className="text-sm text-slate-300 font-medium mt-1">
                  {resultado.tipoTramite ?? resultado.asunto}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={resultado.estadoTramite} />
                {resultado.estadoPago && (
                  <Badge variant={formatearEstadoPago(resultado.estadoPago).variant}>
                    {formatearEstadoPago(resultado.estadoPago).label}
                  </Badge>
                )}
              </div>
            </div>

            {/* 2. Resumen Inmediato y Orientación */}
            <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="font-bold uppercase tracking-wider text-slate-400 block text-[10px]">
                  Área Responsable
                </span>
                <p className="font-bold text-slate-900 mt-0.5 text-sm">
                  {resultado.areaActual ?? 'Área de Trámite General'}
                </p>
              </div>

              <div>
                <span className="font-bold uppercase tracking-wider text-slate-400 block text-[10px]">
                  Foliación Oficial
                </span>
                <p className="font-semibold text-slate-800 mt-0.5 text-sm">
                  {resultado.totalFolios} {resultado.totalFolios === 1 ? 'folio certificado' : 'folios certificados'}
                </p>
              </div>

              <div>
                <span className="font-bold uppercase tracking-wider text-slate-400 block text-[10px]">
                  Fecha Radicación Legal
                </span>
                <p className="font-medium text-slate-800 mt-0.5 text-sm">
                  {resultado.fechaRadicacionLegal
                    ? new Date(resultado.fechaRadicacionLegal).toLocaleDateString('es-PE')
                    : 'En trámite'}
                </p>
              </div>
            </div>

            {/* 3. Progreso por Etapas Reales (ProcessStepper) */}
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
                Progreso del Procedimiento
              </h3>
              <ProcessStepper steps={calcularEtapas(resultado)} />
            </div>

            {/* 4. Próximo Paso y Datos del Solicitante */}
            <div className="p-6 border-b border-slate-200 space-y-4">
              <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-suiza-primary block">
                  Próximo Paso / Orientación al Administrado
                </span>
                <p className="text-sm font-semibold text-slate-900 mt-1">
                  {resultado.pasoSiguiente}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">
                    Asunto / Petitorio
                  </span>
                  <p className="font-medium text-slate-800 mt-0.5">{resultado.asunto}</p>
                </div>

                {resultado.administrado && (resultado.administrado.nombreEnmascarado || resultado.administrado.documentoEnmascarado) && (
                  <div>
                    <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">
                      Solicitante Titular (Ley 29733)
                    </span>
                    <p className="font-medium text-slate-800 mt-0.5">
                      {resultado.administrado.nombreEnmascarado ?? 'Ciudadano Administrado'}
                    </p>
                    <p className="text-slate-500 font-mono text-[11px]">
                      Doc: {resultado.administrado.documentoEnmascarado ?? 'Protegido'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 5. Documentos Oficiales Registrados (Sin MIME types técnicos) */}
            {resultado.documentos.length > 0 && (
              <div className="p-6 border-b border-slate-200 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                  <span>Documentos Oficiales Registrados</span>
                  <span className="font-normal text-slate-400">{resultado.documentos.length} archivo(s)</span>
                </h3>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {resultado.documentos.map((doc, idx) => {
                    const tipoVisual = obtenerTipoDocumentalVisual(doc.contentType, doc.nombreArchivo);
                    const TipoIcono = tipoVisual.icon;

                    return (
                      <div key={idx} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm hover:bg-slate-50/80 transition">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-slate-100 text-suiza-primary flex items-center justify-center shrink-0">
                            <TipoIcono className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{doc.nombreArchivo}</p>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 mt-0.5">
                              {tipoVisual.label}
                            </span>
                          </div>
                        </div>

                        {/* Huella Criptográfica en TechnicalDetails */}
                        <div className="sm:max-w-xs w-full">
                          <TechnicalDetails
                            title="Huella Digital (SHA-256)"
                            items={[
                              {
                                label: 'SHA-256',
                                value: doc.hashSha256,
                                copyable: true,
                              },
                            ]}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 6. Proveídos y Actuaciones Oficiales */}
            {resultado.proveidos.length > 0 && (
              <div className="p-6 border-b border-slate-200 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Actuaciones y Proveídos Institucionales
                </h3>
                <div className="space-y-2">
                  {resultado.proveidos.map((prov, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                      <div className="flex justify-between items-center font-bold text-slate-800">
                        <span>{prov.numero}</span>
                        <span className="text-slate-500 font-normal">{new Date(prov.fechaEmision).toLocaleDateString('es-PE')}</span>
                      </div>
                      <p className="text-slate-700 leading-relaxed">{prov.resumen}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 7. Mensaje Legal al pie */}
            {resultado.mensajeLegal && (
              <div className="p-4 bg-slate-50 text-[11px] text-slate-500 italic text-center">
                {resultado.mensajeLegal}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
