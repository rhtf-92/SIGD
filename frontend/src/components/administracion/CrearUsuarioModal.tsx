import { memo, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { apiClient } from "../../api/client";
import { extraerInvalidParams } from "../../services/adminUsuariosService";
import { resolverModulo, resolverDescripcion, type RolInstitucional, type PermisoInstitucional } from "../../hooks/useRbacConfig";
import type { CrearUsuarioDTO, OpcionDirectorio, TipoDocumentoDirectorio } from "../../types/usuarioAdmin";

interface Props {
  areas: OpcionDirectorio[];
  cargos: OpcionDirectorio[];
  roles?: OpcionDirectorio[];
  tiposDocumento: TipoDocumentoDirectorio[];
  pending: boolean;
  onClose: () => void;
  onSave: (datos: CrearUsuarioDTO, rolesSeleccionados?: string[]) => Promise<unknown>;
  rolesCatalogo?: RolInstitucional[];
  permisosCatalogo?: PermisoInstitucional[];
}

const inputBase =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 transition-colors focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400";
const labelBase = "block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5";
const helperBase = "mt-1.5 text-xs text-slate-500";
const errorBase = "mt-1.5 text-xs font-medium text-red-600";

const initialForm = {
  tipoDocumentoId: "",
  numeroDocumento: "",
  nombres: "",
  apellidoPaterno: "",
  apellidoMaterno: "",
  telefono: "",
  correo: "",
  username: "",
  passwordInicial: "",
  confirmarPassword: "",
  areaId: "",
  cargoId: "",
};

// Roles que corresponden a usuarios externos y no a trabajadores institucionales
const ROLES_EXTERNOS = ["CIUDADANO", "ESTUDIANTE"];

// Mapeo canónico de contingencia para permisos por rol en caso de fallo de red en la consulta
const PERMISOS_DEFAULT_POR_ROL: Record<string, string[]> = {
  // Roles Canónicos Vigentes Institucionales (Migración 22)
  ADMINISTRADOR: ["ADMIN_USUARIOS"],
  DIRECTOR: ["EXPEDIENTE_DERIVAR", "EXPEDIENTE_LEER", "EXPEDIENTE_RESOLVER", "FIRMA_FIRMAR", "REPORTE_LEER"],
  JEFE_UNIDAD_ACADEMICA: ["EXPEDIENTE_DERIVAR", "EXPEDIENTE_LEER", "EXPEDIENTE_RESOLVER"],
  COORDINADOR_AREA: ["EXPEDIENTE_DERIVAR", "EXPEDIENTE_LEER", "EXPEDIENTE_ASIGNAR"],
  SECRETARIO: ["EXPEDIENTE_DERIVAR", "EXPEDIENTE_LEER", "EXPEDIENTE_RESOLVER", "FIRMA_FIRMAR"],
  MESA_PARTES: ["EXPEDIENTE_REGISTRAR", "EXPEDIENTE_DERIVAR", "EXPEDIENTE_LEER"],
  DOCENTE: ["EXPEDIENTE_LEER", "EXPEDIENTE_DERIVAR"],
  CIUDADANO: ["EXPEDIENTE_CREAR", "EXPEDIENTE_LEER"],
  ESTUDIANTE: ["EXPEDIENTE_CREAR", "EXPEDIENTE_LEER"],

  // Compatibilidad con catálogos legados en pruebas frontend
  DIRECTOR_GENERAL: ["EXPEDIENTE_DERIVAR", "EXPEDIENTE_LEER", "EXPEDIENTE_RESOLVER", "FIRMA_FIRMAR", "REPORTE_LEER"],
  SECRETARIO_GENERAL: ["EXPEDIENTE_DERIVAR", "EXPEDIENTE_LEER", "EXPEDIENTE_RESOLVER", "FIRMA_FIRMAR"],
  JEFE_UNIDAD: ["EXPEDIENTE_DERIVAR", "EXPEDIENTE_LEER", "EXPEDIENTE_RESOLVER"],
  SECRETARIA: ["EXPEDIENTE_DERIVAR", "EXPEDIENTE_LEER"],
  OPERADOR_TRAMITE: ["EXPEDIENTE_DERIVAR", "EXPEDIENTE_LEER", "TRAMICORE_DEVOLUCION_EVALUAR"],
  TESORERO: [
    "EXPEDIENTE_LEER",
    "TESORERIA_DEVOLUCION_APROBAR",
    "TESORERIA_DEVOLUCION_EJECUTAR",
    "TESORERIA_DEVOLUCION_EVALUAR",
    "TESORERIA_LEER",
    "TESORERIA_PAGO_REGISTRAR",
    "TESORERIA_PAGO_VERIFICAR",
    "TESORERIA_REPORTES",
    "TESORERIA_TARIFA_PROPONER",
    "TESORERIA_TARIFA_VALIDAR",
  ],
  ARCHIVO_CENTRAL: ["EXPEDIENTE_LEER"],
};

interface SeccionRolesPermisosProps {
  rolesRbac: RolInstitucional[];
  permisosRbac: PermisoInstitucional[];
  rolesSeleccionados: string[];
  rolASeleccionar: string;
  pending: boolean;
  onSelectRolASeleccionar: (id: string) => void;
  onAgregarRol: (id: string) => void;
  onRetirarRol: (id: string) => void;
}

// Subcomponente memoizado para evitar re-renderizados durante la digitación de datos personales
const SeccionRolesPermisos = memo(function SeccionRolesPermisos({
  rolesRbac,
  permisosRbac,
  rolesSeleccionados,
  rolASeleccionar,
  pending,
  onSelectRolASeleccionar,
  onAgregarRol,
  onRetirarRol,
}: SeccionRolesPermisosProps) {
  // Filtrar roles internos vigentes para trabajadores (excluyendo CIUDADANO y ESTUDIANTE)
  const rolesInternosDisponibles = useMemo(() => {
    return rolesRbac.filter(r => {
      const cod = (r.codigo || "").toUpperCase();
      const nom = (r.nombre || "").toUpperCase();
      const esExterno = ROLES_EXTERNOS.includes(cod) || nom.includes("CIUDADANO") || nom.includes("ESTUDIANTE");
      return r.vigente !== false && !esExterno;
    });
  }, [rolesRbac]);

  // Permisos consolidados y deduplicados de los roles seleccionados
  const permisosEfectivos = useMemo(() => {
    const codigosVistos = new Set<string>();
    for (const rolId of rolesSeleccionados) {
      const rol = rolesRbac.find(r => r.id === rolId);
      if (rol && Array.isArray(rol.permisos)) {
        for (const p of rol.permisos) {
          codigosVistos.add(p);
        }
      }
    }

    return Array.from(codigosVistos)
      .map(codigo => {
        const pObj = permisosRbac.find(p => p.codigo === codigo);
        return {
          codigo,
          nombre: pObj?.nombre ?? codigo,
          ambito: pObj?.ambito ?? "GLOBAL",
          modulo: pObj ? resolverModulo(pObj) : "General",
          descripcion: pObj ? resolverDescripcion(pObj) : codigo,
        };
      })
      .sort((a, b) => a.modulo.localeCompare(b.modulo) || a.nombre.localeCompare(b.nombre));
  }, [rolesSeleccionados, rolesRbac, permisosRbac]);

  return (
    <fieldset className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 transition hover:border-slate-300">
      <div className="flex items-center gap-2.5 mb-1">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">3</span>
        <legend className="text-base font-bold tracking-tight text-slate-900">
          SECCIÓN 3. ASIGNACIÓN DE ROLES Y PERMISOS
        </legend>
      </div>
      <p className="text-xs text-slate-500 mb-4 ml-8.5">
        Selecciona los roles institucionales que tendrá el trabajador dentro del SIGD. Los permisos se asignarán según la configuración vigente de cada rol.
      </p>

      {/* Selector de rol */}
      <div className="space-y-4">
        <div>
          <label htmlFor="selector-rol-agregar" className={labelBase}>
            Roles institucionales disponibles
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              id="selector-rol-agregar"
              aria-label="Roles institucionales disponibles"
              disabled={pending || rolesInternosDisponibles.length === 0}
              className={inputBase}
              value={rolASeleccionar}
              onChange={e => onSelectRolASeleccionar(e.target.value)}
            >
              <option value="">-- Seleccionar un rol institucional para agregar --</option>
              {rolesInternosDisponibles
                .filter(r => !rolesSeleccionados.includes(r.id))
                .map(r => (
                  <option key={r.id} value={r.id}>
                    {r.nombre} ({r.codigo})
                  </option>
                ))}
            </select>
            <button
              type="button"
              disabled={pending || !rolASeleccionar}
              onClick={() => onAgregarRol(rolASeleccionar)}
              className="shrink-0 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-50"
            >
              Agregar rol
            </button>
          </div>
          {rolesInternosDisponibles.length === 0 && (
            <p className="mt-1 text-xs text-slate-400">
              No existen roles internos configurados en el catálogo.
            </p>
          )}
        </div>

        {/* Roles seleccionados */}
        <div>
          <span className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            Roles seleccionados para el trabajador ({rolesSeleccionados.length})
          </span>
          {rolesSeleccionados.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center">
              <p className="text-xs text-slate-500">
                No se han seleccionado roles todavía. Puede seleccionar uno o varios roles para asignar al trabajador.
              </p>
              <p className="text-2xs text-amber-700 mt-1 font-medium">
                Atención: Si registra al trabajador sin roles, la cuenta no podrá ser activada hasta que se le asigne al menos un rol vigente en Roles y Permisos.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {rolesSeleccionados.map(idRol => {
                const rolObj = rolesRbac.find(r => r.id === idRol);
                return (
                  <div
                    key={idRol}
                    className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/80 px-3 py-1.5 text-xs text-blue-900 shadow-2xs"
                  >
                    <div>
                      <span className="font-bold">{rolObj?.nombre ?? "Rol"}</span>
                      <span className="ml-1 text-2xs text-blue-700 font-mono">({rolObj?.codigo})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRetirarRol(idRol)}
                      disabled={pending}
                      className="ml-1 rounded-full p-0.5 text-blue-500 hover:bg-blue-200 hover:text-blue-900 transition-colors"
                      aria-label={`Retirar rol ${rolObj?.nombre ?? idRol}`}
                    >
                      <span className="text-sm font-bold leading-none">&times;</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Vista previa de permisos asociados */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Vista previa de permisos efectivos ({permisosEfectivos.length})
            </h4>
            <span className="text-2xs text-slate-400">Deduplicados y consolidados</span>
          </div>

          {permisosEfectivos.length === 0 ? (
            <p className="text-xs text-slate-400 italic">
              Seleccione al menos un rol para visualizar el resumen de facultades asociadas.
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {permisosEfectivos.map(p => (
                <div
                  key={p.codigo}
                  className="rounded-lg border border-slate-200/80 bg-white p-2.5 text-xs shadow-2xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-800">{p.nombre}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-2xs font-bold text-slate-600">
                        {p.modulo}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-2xs font-bold ${
                          p.ambito === "GLOBAL"
                            ? "bg-purple-50 text-purple-700 border border-purple-200"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        {p.ambito}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 text-2xs text-slate-500 leading-snug">{p.descripcion}</p>
                </div>
              ))}
            </div>
          )}

          <p className="mt-3 text-2xs text-slate-400 leading-relaxed border-t border-slate-200/60 pt-2">
            * Vista previa informativa. Los permisos individuales se gestionan y configuran centralizadamente en el módulo independiente de <strong>Roles y Permisos</strong>.
          </p>
        </div>
      </div>
    </fieldset>
  );
});

export default function CrearUsuarioModal({
  areas,
  cargos,
  roles: rolesProps = [],
  tiposDocumento,
  pending,
  onClose,
  onSave,
  rolesCatalogo,
  permisosCatalogo,
}: Props) {
  // Filtrar tipos de documento para personal interno: exclusivo DNI (acuerdo institucional)
  const tiposFiltrados = useMemo(() => {
    const soloDni = tiposDocumento.filter(t => t.codigo?.toUpperCase() === "DNI");
    return soloDni.length > 0 ? soloDni : tiposDocumento;
  }, [tiposDocumento]);

  const defaultTipo = useMemo(
    () => tiposFiltrados.find(t => t.codigo?.toUpperCase() === "DNI")?.id ?? tiposFiltrados[0]?.id ?? "1",
    [tiposFiltrados],
  );

  const [form, setForm] = useState(initialForm);
  const [errorGeneral, setErrorGeneral] = useState("");
  const [invalidos, setInvalidos] = useState<Record<string, string>>({});
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mostrarConfirmarPassword, setMostrarConfirmarPassword] = useState(false);

  // Estado de roles y permisos institucionales inicializado con rolesProps o rolesCatalogo
  const [rolesRbac, setRolesRbac] = useState<RolInstitucional[]>(() => {
    if (rolesCatalogo) return rolesCatalogo;
    if (rolesProps && rolesProps.length > 0) {
      return rolesProps.map(r => {
        const cod = r.codigo ?? r.nombre.toUpperCase().replace(/\s+/g, "_");
        return {
          id: r.id,
          codigo: cod,
          nombre: r.nombre,
          descripcion: null,
          vigente: true,
          usuarios: 0,
          permisos: PERMISOS_DEFAULT_POR_ROL[cod] ?? [],
        };
      });
    }
    return [];
  });
  const [permisosRbac, setPermisosRbac] = useState<PermisoInstitucional[]>(permisosCatalogo ?? []);
  const [rolesSeleccionados, setRolesSeleccionados] = useState<string[]>([]);
  const [rolASeleccionar, setRolASeleccionar] = useState("");

  const valorTipo = form.tipoDocumentoId || defaultTipo;

  // Carga del catálogo completo de roles y permisos desde la API únicamente si no vienen provistos
  useEffect(() => {
    if (rolesCatalogo && permisosCatalogo) {
      setRolesRbac(rolesCatalogo);
      setPermisosRbac(permisosCatalogo);
      return;
    }

    // Si ya disponemos de roles por props o inicialización, no realizamos llamada de red adicional
    if (rolesRbac.length > 0) {
      return;
    }

    let cancelado = false;
    Promise.resolve(
      apiClient.get<{ roles: RolInstitucional[]; catalogoPermisos: PermisoInstitucional[] }>("/api/v1/admin/roles-permisos"),
    )
      .then(res => {
        if (!cancelado && res?.data && Array.isArray(res.data.roles)) {
          setRolesRbac(res.data.roles);
          if (Array.isArray(res.data.catalogoPermisos)) {
            setPermisosRbac(res.data.catalogoPermisos);
          }
        }
      })
      .catch(() => {});

    return () => {
      cancelado = true;
    };
  }, [rolesCatalogo, permisosCatalogo, rolesRbac.length]);

  function updateField(campo: keyof typeof initialForm, valor: string) {
    setForm(prev => ({ ...prev, [campo]: valor }));
    if (invalidos[campo]) {
      setInvalidos(prev => {
        const next = { ...prev };
        delete next[campo];
        return next;
      });
    }
  }

  function handleDniInput(val: string) {
    const soloNumeros = val.replace(/\D/g, "").slice(0, 8);
    updateField("numeroDocumento", soloNumeros);
  }

  const agregarRol = useCallback((idRol: string) => {
    if (!idRol) return;
    setRolesSeleccionados(prev => (prev.includes(idRol) ? prev : [...prev, idRol]));
    setRolASeleccionar("");
  }, []);

  const retirarRol = useCallback((idRol: string) => {
    setRolesSeleccionados(prev => prev.filter(id => id !== idRol));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorGeneral("");
    setInvalidos({});

    const idTipoDoc = Number(valorTipo);
    if (!idTipoDoc || isNaN(idTipoDoc)) {
      setErrorGeneral("Seleccione un tipo de documento válido.");
      return;
    }

    if (form.numeroDocumento.trim().length !== 8) {
      setInvalidos(prev => ({
        ...prev,
        numeroDocumento: "El DNI debe contener exactamente 8 dígitos numéricos.",
      }));
      return;
    }

    if (!form.nombres.trim() || form.nombres.trim().length < 2) {
      setInvalidos(prev => ({
        ...prev,
        nombres: "Los nombres son obligatorios (mínimo 2 caracteres).",
      }));
      return;
    }

    if (!form.apellidoPaterno.trim() || form.apellidoPaterno.trim().length < 2) {
      setInvalidos(prev => ({
        ...prev,
        apellidoPaterno: "El apellido paterno es obligatorio (mínimo 2 caracteres).",
      }));
      return;
    }

    const correoLimpio = form.correo.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(correoLimpio)) {
      setInvalidos(prev => ({
        ...prev,
        correo: "Ingrese una dirección de correo válida (ej. usuario@gmail.com o usuario@iestpsuiza.edu.pe).",
      }));
      return;
    }

    if (!form.areaId) {
      setInvalidos(prev => ({
        ...prev,
        areaId: "Seleccione el área o unidad orgánica de desempeño.",
      }));
      return;
    }

    if (!form.cargoId) {
      setInvalidos(prev => ({
        ...prev,
        cargoId: "Seleccione el cargo institucional asignado.",
      }));
      return;
    }

    if (!form.username.trim() || form.username.trim().length < 4) {
      setInvalidos(prev => ({
        ...prev,
        username: "El nombre de usuario debe tener al menos 4 caracteres.",
      }));
      return;
    }

    if (form.passwordInicial.length < 8) {
      setInvalidos(prev => ({
        ...prev,
        passwordInicial: "La contraseña definitiva debe tener al menos 8 caracteres.",
      }));
      return;
    }

    if (form.confirmarPassword && form.passwordInicial !== form.confirmarPassword) {
      setInvalidos(prev => ({
        ...prev,
        confirmarPassword: "Las contraseñas no coinciden. Verifique la confirmación.",
      }));
      return;
    }

    try {
      await onSave(
        {
          tipoDocumentoId: idTipoDoc,
          numeroDocumento: form.numeroDocumento.trim(),
          nombres: form.nombres.trim(),
          apellidoPaterno: form.apellidoPaterno.trim(),
          apellidoMaterno: form.apellidoMaterno.trim() || undefined,
          telefono: form.telefono.trim() || undefined,
          correo: correoLimpio,
          username: form.username.trim(),
          passwordInicial: form.passwordInicial,
          areaId: form.areaId,
          cargoId: form.cargoId,
        },
        rolesSeleccionados,
      );
    } catch (cause) {
      const erroresCampos: Record<string, string> = {};
      const params = extraerInvalidParams(cause);
      for (const item of params) {
        erroresCampos[item.name] = item.reason;
      }
      setInvalidos(erroresCampos);
      setErrorGeneral(
        cause instanceof Error
          ? cause.message
          : "No se pudo registrar la cuenta institucional. Revise los campos e intente nuevamente.",
      );
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crear-usuario-title"
    >
      <section className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl flex flex-col">
        {/* Cabecera Fija */}
        <div className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur-sm sm:px-8">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-blue-700 border border-blue-200/50">
              IESTP Público «Suiza» · Gestión de Usuarios
            </span>
            <h2 id="crear-usuario-title" className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Nuevo usuario institucional
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Registro del trabajador, asignación de roles iniciales y creación de credenciales de acceso al SIGD.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Cerrar ventana modal"
          >
            <span className="text-xl font-bold leading-none">&times;</span>
          </button>
        </div>

        {/* Banner Institucional Informativo: Configuración de Acceso Institucional */}
        <div className="mx-6 mt-6 rounded-xl border border-blue-200 bg-blue-50/80 p-4 sm:mx-8">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-800 text-xs font-bold border border-blue-300">
              i
            </span>
            <div className="text-xs text-blue-900 leading-relaxed">
              <p className="font-bold text-blue-950 text-sm">
                CONFIGURACIÓN DE ACCESO INSTITUCIONAL
              </p>
              <p className="mt-0.5">
                Selecciona los roles que tendrá el trabajador. La cuenta se registrará inicialmente como <strong>INACTIVA</strong>. Después de verificar sus asignaciones, un administrador autorizado podrá habilitar su acceso al SIGD.
              </p>
            </div>
          </div>
        </div>

        {/* Mensaje de error general */}
        {errorGeneral && (
          <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 p-4 sm:mx-8">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-base font-bold text-red-600">!</span>
              <p role="alert" className="text-sm font-medium text-red-700">
                {errorGeneral}
              </p>
            </div>
          </div>
        )}

        {/* Formulario estructurado en 4 secciones */}
        <form className="space-y-6 px-6 py-6 sm:px-8 flex-1" onSubmit={handleSubmit} noValidate>
          {/* =========================================================
              SECCIÓN 1: DATOS DEL TRABAJADOR
              ========================================================= */}
          <fieldset className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 transition hover:border-slate-300">
            <div className="flex items-center gap-2.5 mb-1">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">1</span>
              <legend className="text-base font-bold tracking-tight text-slate-900">
                SECCIÓN 1. DATOS DEL TRABAJADOR
              </legend>
            </div>
            <p className="text-xs text-slate-500 mb-5 ml-8.5">
              Información de identidad del personal (identificación oficial por DNI).
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="crear-tipo-doc" className={labelBase}>
                  Tipo de documento <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <select
                  id="crear-tipo-doc"
                  aria-label="Tipo de documento"
                  required
                  disabled={pending}
                  className={inputBase}
                  value={valorTipo}
                  onChange={e => updateField("tipoDocumentoId", e.target.value)}
                >
                  {tiposFiltrados.map(tipo => (
                    <option key={tipo.id} value={tipo.id}>
                      {tipo.codigo} - {tipo.nombre}
                    </option>
                  ))}
                </select>
                <p className={helperBase}>Personal interno: exclusivo DNI según directiva institucional.</p>
              </div>

              <div>
                <label htmlFor="crear-numero-doc" className={labelBase}>
                  DNI / documento <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <input
                  id="crear-numero-doc"
                  aria-label="DNI / documento"
                  required
                  disabled={pending}
                  maxLength={8}
                  pattern="\d{8}"
                  className={`${inputBase} ${invalidos.numeroDocumento ? "border-red-500 ring-2 ring-red-100" : ""}`}
                  value={form.numeroDocumento}
                  onChange={e => handleDniInput(e.target.value)}
                  placeholder="8 dígitos numéricos"
                />
                {invalidos.numeroDocumento ? (
                  <p className={errorBase}>{invalidos.numeroDocumento}</p>
                ) : (
                  <p className={helperBase}>Número de DNI del trabajador institucional (8 dígitos).</p>
                )}
              </div>

              <div>
                <label htmlFor="crear-nombres" className={labelBase}>
                  Nombres <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <input
                  id="crear-nombres"
                  aria-label="Nombres"
                  required
                  disabled={pending}
                  maxLength={120}
                  className={`${inputBase} ${invalidos.nombres ? "border-red-500 ring-2 ring-red-100" : ""}`}
                  value={form.nombres}
                  onChange={e => updateField("nombres", e.target.value)}
                  placeholder="Ej. María Elena"
                />
                {invalidos.nombres && <p className={errorBase}>{invalidos.nombres}</p>}
              </div>

              <div>
                <label htmlFor="crear-apellido-paterno" className={labelBase}>
                  Apellido paterno <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <input
                  id="crear-apellido-paterno"
                  aria-label="Apellido paterno"
                  required
                  disabled={pending}
                  maxLength={120}
                  className={`${inputBase} ${invalidos.apellidoPaterno ? "border-red-500 ring-2 ring-red-100" : ""}`}
                  value={form.apellidoPaterno}
                  onChange={e => updateField("apellidoPaterno", e.target.value)}
                  placeholder="Ej. Quispe"
                />
                {invalidos.apellidoPaterno && <p className={errorBase}>{invalidos.apellidoPaterno}</p>}
              </div>

              <div>
                <label htmlFor="crear-apellido-materno" className={labelBase}>
                  Apellido materno
                </label>
                <input
                  id="crear-apellido-materno"
                  aria-label="Apellido materno"
                  disabled={pending}
                  maxLength={120}
                  className={inputBase}
                  value={form.apellidoMaterno}
                  onChange={e => updateField("apellidoMaterno", e.target.value)}
                  placeholder="Ej. Rojas"
                />
              </div>

              <div>
                <label htmlFor="crear-telefono" className={labelBase}>
                  Teléfono / celular
                </label>
                <input
                  id="crear-telefono"
                  aria-label="Teléfono o celular"
                  disabled={pending}
                  maxLength={20}
                  className={inputBase}
                  value={form.telefono}
                  onChange={e => updateField("telefono", e.target.value)}
                  placeholder="Ej. 961234567"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="crear-correo" className={labelBase}>
                  Correo electrónico (personal o institucional) <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <input
                  id="crear-correo"
                  aria-label="Correo institucional"
                  required
                  type="email"
                  disabled={pending}
                  className={`${inputBase} ${invalidos.correo ? "border-red-500 ring-2 ring-red-100" : ""}`}
                  value={form.correo}
                  onChange={e => updateField("correo", e.target.value)}
                  placeholder="usuario@gmail.com o usuario@iestpsuiza.edu.pe"
                />
                {invalidos.correo ? (
                  <p className={errorBase}>{invalidos.correo}</p>
                ) : (
                  <p className={helperBase}>
                    Admite correos personales (Gmail, Outlook, Yahoo, etc.) e institucionales oficiales.
                  </p>
                )}
              </div>
            </div>
          </fieldset>

          {/* =========================================================
              SECCIÓN 2: VINCULACIÓN INSTITUCIONAL
              ========================================================= */}
          <fieldset className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 transition hover:border-slate-300">
            <div className="flex items-center gap-2.5 mb-1">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">2</span>
              <legend className="text-base font-bold tracking-tight text-slate-900">
                SECCIÓN 2. VINCULACIÓN INSTITUCIONAL
              </legend>
            </div>
            <p className="text-xs text-slate-500 mb-5 ml-8.5">
              Área o dependencia orgánica de desempeño y cargo laboral asignado.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="crear-area" className={labelBase}>
                  Unidad orgánica <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <select
                  id="crear-area"
                  aria-label="Unidad orgánica"
                  required
                  disabled={pending}
                  className={`${inputBase} ${invalidos.areaId ? "border-red-500 ring-2 ring-red-100" : ""}`}
                  value={form.areaId}
                  onChange={e => updateField("areaId", e.target.value)}
                >
                  <option value="">Seleccione una unidad orgánica</option>
                  {areas.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.nombre}
                    </option>
                  ))}
                </select>
                {invalidos.areaId ? (
                  <p className={errorBase}>{invalidos.areaId}</p>
                ) : (
                  <p className={helperBase}>Dependencia orgánica donde labora el trabajador.</p>
                )}
              </div>

              <div>
                <label htmlFor="crear-cargo" className={labelBase}>
                  Cargo institucional <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <select
                  id="crear-cargo"
                  aria-label="Cargo"
                  required
                  disabled={pending}
                  className={`${inputBase} ${invalidos.cargoId ? "border-red-500 ring-2 ring-red-100" : ""}`}
                  value={form.cargoId}
                  onChange={e => updateField("cargoId", e.target.value)}
                >
                  <option value="">Seleccione un cargo institucional</option>
                  {cargos.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
                {invalidos.cargoId ? (
                  <p className={errorBase}>{invalidos.cargoId}</p>
                ) : (
                  <p className={helperBase}>Función laboral en el instituto (no otorga privilegios RBAC).</p>
                )}
              </div>
            </div>
          </fieldset>

          {/* =========================================================
              SECCIÓN 3: ASIGNACIÓN DE ROLES Y PERMISOS (MEMOIZADA)
              ========================================================= */}
          <SeccionRolesPermisos
            rolesRbac={rolesRbac}
            permisosRbac={permisosRbac}
            rolesSeleccionados={rolesSeleccionados}
            rolASeleccionar={rolASeleccionar}
            pending={pending}
            onSelectRolASeleccionar={setRolASeleccionar}
            onAgregarRol={agregarRol}
            onRetirarRol={retirarRol}
          />

          {/* =========================================================
              SECCIÓN 4: CREDENCIALES DEFINITIVAS DE ACCESO
              ========================================================= */}
          <fieldset className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 transition hover:border-slate-300">
            <div className="flex items-center gap-2.5 mb-1">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">4</span>
              <legend className="text-base font-bold tracking-tight text-slate-900">
                SECCIÓN 4. CREDENCIALES INICIALES DE ACCESO
              </legend>
            </div>
            <p className="text-xs text-slate-500 mb-5 ml-8.5">
              Nombre de usuario y contraseña permanente para el acceso directo al SIGD (cifrada con Argon2id).
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="crear-username" className={labelBase}>
                  Nombre de usuario <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <input
                  id="crear-username"
                  aria-label="Nombre de usuario"
                  required
                  disabled={pending}
                  minLength={4}
                  maxLength={50}
                  pattern="[a-zA-Z0-9._-]+"
                  className={`${inputBase} ${invalidos.username ? "border-red-500 ring-2 ring-red-100" : ""}`}
                  value={form.username}
                  onChange={e => updateField("username", e.target.value)}
                  autoComplete="off"
                  placeholder="Ej. tesorero.personal"
                />
                {invalidos.username ? (
                  <p className={errorBase}>{invalidos.username}</p>
                ) : (
                  <p className={helperBase}>Mínimo 4 caracteres (letras, números, puntos o guiones).</p>
                )}
              </div>

              <div>
                <label htmlFor="crear-password" className={labelBase}>
                  Contraseña definitiva <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="crear-password"
                    aria-label="Contraseña temporal"
                    required
                    disabled={pending}
                    type={mostrarPassword ? "text" : "password"}
                    minLength={8}
                    maxLength={128}
                    className={`${inputBase} pr-10 ${invalidos.passwordInicial ? "border-red-500 ring-2 ring-red-100" : ""}`}
                    value={form.passwordInicial}
                    onChange={e => updateField("passwordInicial", e.target.value)}
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarPassword(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                    aria-label={mostrarPassword ? "Ocultar contraseña" : "Ver contraseña"}
                  >
                    {mostrarPassword ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {invalidos.passwordInicial ? (
                  <p className={errorBase}>{invalidos.passwordInicial}</p>
                ) : form.passwordInicial.length >= 8 ? (
                  <p className="mt-1.5 text-xs text-emerald-600 font-medium">✓ Mínimo 8 caracteres cumplido.</p>
                ) : (
                  <p className={helperBase}>Contraseña permanente para el acceso directo del usuario.</p>
                )}
              </div>

              <div>
                <label htmlFor="crear-confirmar-password" className={labelBase}>
                  Confirmar contraseña
                </label>
                <div className="relative">
                  <input
                    id="crear-confirmar-password"
                    aria-label="Confirmar contraseña"
                    disabled={pending}
                    type={mostrarConfirmarPassword ? "text" : "password"}
                    minLength={8}
                    maxLength={128}
                    className={`${inputBase} pr-10 ${invalidos.confirmarPassword ? "border-red-500 ring-2 ring-red-100" : ""}`}
                    value={form.confirmarPassword}
                    onChange={e => updateField("confirmarPassword", e.target.value)}
                    autoComplete="new-password"
                    placeholder="Repita la contraseña"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarConfirmarPassword(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                    aria-label={mostrarConfirmarPassword ? "Ocultar confirmación" : "Ver confirmación"}
                  >
                    {mostrarConfirmarPassword ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {invalidos.confirmarPassword ? (
                  <p className={errorBase}>{invalidos.confirmarPassword}</p>
                ) : form.confirmarPassword && form.confirmarPassword === form.passwordInicial ? (
                  <p className="mt-1.5 text-xs text-emerald-600 font-medium">✓ Las contraseñas coinciden.</p>
                ) : (
                  <p className={helperBase}>Confirme la contraseña permanente.</p>
                )}
              </div>
            </div>
          </fieldset>

          {/* Barra de Acciones Fija en Pie */}
          <div className="flex flex-col-reverse justify-end gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              aria-label="Crear usuario"
              disabled={
                pending ||
                !tiposFiltrados.length ||
                !areas.length ||
                !cargos.length
              }
              className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50"
            >
              {pending ? (
                <>
                  <svg
                    className="-ml-1 mr-2 h-4 w-4 animate-spin text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Registrando trabajador y asignando roles…
                </>
              ) : (
                rolesSeleccionados.length > 0
                  ? `Registrar trabajador y asignar ${rolesSeleccionados.length} rol(es)`
                  : "Registrar trabajador y crear cuenta"
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
