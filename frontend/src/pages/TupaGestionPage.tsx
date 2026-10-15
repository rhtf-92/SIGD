import { useState, type FormEvent } from "react";
import {
  mensajeError,
  tupaApi,
  type TupaBitacora,
  type TupaTramite,
  type TupaVersion,
} from "../services/tupaApi";

interface TramiteEditorProps {
  token: string;
  versionId: string;
  tramite: TupaTramite;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}

function TramiteEditor({ token, versionId, tramite, onSaved, onError }: TramiteEditorProps) {
  const [monto, setMonto] = useState(
    tramite.derecho_monto === null ? "" : String(tramite.derecho_monto),
  );
  const [plazo, setPlazo] = useState(tramite.plazo_texto ?? "");
  const [requisitos, setRequisitos] = useState<Record<string, string>>({});
  const [nuevoRequisito, setNuevoRequisito] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardarTramite(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setGuardando(true);
    try {
      await tupaApi.actualizarTramite(token, versionId, tramite.tramite_version_id, {
        derecho_monto: monto === "" ? null : Number(monto),
        plazo_texto: plazo || null,
      });
      await onSaved();
    } catch (error) {
      onError(mensajeError(error));
    } finally {
      setGuardando(false);
    }
  }

  async function guardarRequisito(requisito: TupaTramite["requisitos"][number]) {
    setGuardando(true);
    try {
      await tupaApi.actualizarRequisito(token, versionId, tramite.tramite_version_id, requisito.requisito_id, {
        texto: requisitos[requisito.requisito_id] ?? requisito.texto,
      });
      await onSaved();
    } catch (error) {
      onError(mensajeError(error));
    } finally {
      setGuardando(false);
    }
  }

  async function agregarRequisito() {
    const texto = nuevoRequisito.trim();
    if (!texto) return;
    setGuardando(true);
    try {
      const orden = Math.max(0, ...tramite.requisitos.map((requisito) => requisito.orden)) + 1;
      await tupaApi.agregarRequisito(token, versionId, tramite.tramite_version_id, orden, texto);
      setNuevoRequisito("");
      await onSaved();
    } catch (error) {
      onError(mensajeError(error));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <div>
        <p className="font-mono text-xs text-blue-700">{tramite.codigo}</p>
        <h3 className="mt-1 font-semibold">{tramite.denominacion}</h3>
      </div>
      <form className="mt-3 grid gap-3 sm:grid-cols-[12rem_1fr_auto]" onSubmit={(evento) => void guardarTramite(evento)}>
        <label className="text-xs font-semibold text-slate-600">
          Derecho (S/)
          <input className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" min="0" onChange={(evento) => setMonto(evento.target.value)} step="0.01" type="number" value={monto} />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Plazo
          <input className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" onChange={(evento) => setPlazo(evento.target.value)} value={plazo} />
        </label>
        <button className="self-end rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={guardando} type="submit">Guardar ficha</button>
      </form>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">Requisitos</h4>
        {tramite.requisitos.length === 0 && <p className="mt-2 text-sm text-slate-500">No hay requisitos registrados.</p>}
        <ul className="mt-2 space-y-2">
          {tramite.requisitos.map((requisito) => (
            <li className="flex flex-wrap gap-2" key={requisito.requisito_id}>
              <input
                aria-label={`Requisito ${requisito.orden}`}
                className="min-w-56 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                onChange={(evento) => setRequisitos((actuales) => ({ ...actuales, [requisito.requisito_id]: evento.target.value }))}
                value={requisitos[requisito.requisito_id] ?? requisito.texto}
              />
              <button className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-50" disabled={guardando || (requisitos[requisito.requisito_id] ?? requisito.texto) === requisito.texto} onClick={() => void guardarRequisito(requisito)} type="button">Guardar requisito</button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <input className="min-w-56 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm" onChange={(evento) => setNuevoRequisito(evento.target.value)} placeholder="Agregar requisito" value={nuevoRequisito} />
          <button className="rounded-md border border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-800 disabled:opacity-50" disabled={guardando || !nuevoRequisito.trim()} onClick={() => void agregarRequisito()} type="button">Agregar requisito</button>
        </div>
      </div>
    </article>
  );
}

export default function TupaGestionPage() {
  const [identificador, setIdentificador] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [usuario, setUsuario] = useState("");
  const [versiones, setVersiones] = useState<TupaVersion[]>([]);
  const [versionId, setVersionId] = useState("");
  const [tramites, setTramites] = useState<TupaTramite[]>([]);
  const [bitacora, setBitacora] = useState<TupaBitacora[]>([]);
  const [codigo, setCodigo] = useState("TUPA-2027-v1.0");
  const [nombre, setNombre] = useState("TUPA 2027 — IESTP Suiza");
  const [fechaVigencia, setFechaVigencia] = useState("2027-01-01");
  const [uit, setUit] = useState("5500");
  const [copiarDesde, setCopiarDesde] = useState("");
  const [numeroResolucion, setNumeroResolucion] = useState("");
  const [fechaResolucion, setFechaResolucion] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  async function cargarVersiones(accessToken: string, seleccionarId?: string) {
    const lista = await tupaApi.versiones(accessToken);
    setVersiones(lista);
    const elegida = seleccionarId ?? versionId;
    if (elegida && lista.some((version) => version.version_id === elegida)) {
      await seleccionarVersion(accessToken, elegida);
    } else {
      setVersionId("");
      setTramites([]);
      setBitacora([]);
    }
    const vigente = lista.find((version) => version.estado === "VIGENTE");
    if (vigente && !copiarDesde) setCopiarDesde(vigente.version_id);
  }

  async function seleccionarVersion(accessToken: string, id: string) {
    setVersionId(id);
    const [fichas, eventos] = await Promise.all([
      tupaApi.tramitesVersion(accessToken, id),
      tupaApi.bitacora(accessToken, id),
    ]);
    setTramites(fichas);
    setBitacora(eventos);
  }

  async function iniciarSesion(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setCargando(true);
    setError("");
    setMensaje("");
    try {
      const sesion = await tupaApi.login(identificador.trim(), password);
      setToken(sesion.accessToken);
      setUsuario(`${sesion.usuario.nombreCompleto} (${sesion.usuario.rol})`);
      setPassword("");
      await cargarVersiones(sesion.accessToken, "");
      setMensaje("Sesión API iniciada. El token se conserva únicamente en memoria.");
    } catch (motivo) {
      setError(mensajeError(motivo));
      setToken(null);
    } finally {
      setCargando(false);
    }
  }

  async function manejarOperacion(operacion: () => Promise<void>, exito: string) {
    setCargando(true);
    setError("");
    setMensaje("");
    try {
      await operacion();
      setMensaje(exito);
    } catch (motivo) {
      setError(mensajeError(motivo));
    } finally {
      setCargando(false);
    }
  }

  async function crearBorrador(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!token) return;
    await manejarOperacion(async () => {
      const nueva = await tupaApi.crearVersion(token, {
        codigo,
        nombre,
        fecha_vigencia: fechaVigencia,
        uit_vigente: Number(uit),
        ...(copiarDesde ? { copiarDesdeVersionId: copiarDesde } : {}),
      });
      await cargarVersiones(token, nueva.version_id);
    }, "Borrador creado. Revise los trámites antes de publicar.");
  }

  async function subirPdf() {
    if (!token || !versionId || !archivo) return;
    await manejarOperacion(async () => {
      await tupaApi.subirResolucion(token, versionId, archivo);
      await cargarVersiones(token, versionId);
      setArchivo(null);
    }, "PDF cargado y huella SHA-256 registrada.");
  }

  async function publicarVersion() {
    const seleccionada = versiones.find((version) => version.version_id === versionId);
    if (!token || !seleccionada || !window.confirm(`¿Publicar ${seleccionada.codigo}? La versión vigente pasará a SUPERSEDIDA.`)) return;
    await manejarOperacion(async () => {
      await tupaApi.publicar(token, versionId, {
        resolucion_numero: numeroResolucion,
        resolucion_fecha: fechaResolucion,
        fecha_vigencia: fechaVigencia,
      });
      await cargarVersiones(token, versionId);
    }, "Versión publicada; la anterior quedó supersedida y la bitácora se actualizó.");
  }

  async function descargarPdf(id: string, codigoVersion: string) {
    if (!token) return;
    await manejarOperacion(async () => {
      const blob = await tupaApi.descargarResolucion(token, id);
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `resolucion-${codigoVersion}.pdf`;
      enlace.click();
      URL.revokeObjectURL(url);
    }, "Descarga iniciada.");
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <header className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Administración TUPA</p>
        <h1 className="mt-1 text-3xl font-bold">Gestión de versiones</h1>
        <p className="mt-2 text-sm text-slate-600">Acceso administrativo separado; las credenciales y el token no se guardan en el navegador.</p>
      </header>

      {!token ? (
        <form className="max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={(evento) => void iniciarSesion(evento)}>
          <h2 className="text-lg font-bold">Iniciar sesión con la API real</h2>
          <label className="mt-4 block text-sm font-medium">Usuario o correo
            <input autoComplete="username" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" onChange={(evento) => setIdentificador(evento.target.value)} required value={identificador} />
          </label>
          <label className="mt-3 block text-sm font-medium">Contraseña
            <input autoComplete="current-password" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" onChange={(evento) => setPassword(evento.target.value)} required type="password" value={password} />
          </label>
          <button className="mt-4 rounded-lg bg-blue-800 px-4 py-2 font-semibold text-white disabled:opacity-50" disabled={cargando} type="submit">{cargando ? "Validando…" : "Iniciar sesión"}</button>
        </form>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[19rem_1fr]">
          <aside className="space-y-5">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div><h2 className="font-bold">Sesión API</h2><p className="mt-1 text-xs text-slate-600">{usuario}</p></div>
                <button className="text-xs font-semibold text-blue-800 underline" onClick={() => { setToken(null); setVersiones([]); setVersionId(""); setTramites([]); setBitacora([]); }} type="button">Salir</button>
              </div>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-bold">Versiones</h2>
              <ul className="mt-3 space-y-2">
                {versiones.map((version) => (
                  <li key={version.version_id}>
                    <button className={`w-full rounded-lg border p-3 text-left ${version.version_id === versionId ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`} onClick={() => void manejarOperacion(() => seleccionarVersion(token, version.version_id), "Versión cargada.")} type="button">
                      <span className="block font-mono text-xs">{version.codigo}</span>
                      <span className="mt-1 block text-sm font-semibold">{version.nombre}</span>
                      <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${version.estado === "VIGENTE" ? "bg-green-100 text-green-800" : version.estado === "BORRADOR" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>{version.estado}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-bold">Implementar nueva versión</h2>
              <form className="mt-3 space-y-3" onSubmit={(evento) => void crearBorrador(evento)}>
                <label className="block text-xs font-semibold">Código
                  <input className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" onChange={(evento) => setCodigo(evento.target.value)} required value={codigo} />
                </label>
                <label className="block text-xs font-semibold">Nombre
                  <input className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" onChange={(evento) => setNombre(evento.target.value)} required value={nombre} />
                </label>
                <label className="block text-xs font-semibold">Fecha de vigencia
                  <input className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" onChange={(evento) => setFechaVigencia(evento.target.value)} required type="date" value={fechaVigencia} />
                </label>
                <label className="block text-xs font-semibold">UIT vigente
                  <input className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" min="1" onChange={(evento) => setUit(evento.target.value)} required step="0.01" type="number" value={uit} />
                </label>
                <label className="block text-xs font-semibold">Clonar desde
                  <select className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" onChange={(evento) => setCopiarDesde(evento.target.value)} value={copiarDesde}>
                    <option value="">Sin trámites iniciales</option>
                    {versiones.map((version) => <option key={version.version_id} value={version.version_id}>{version.codigo} · {version.estado}</option>)}
                  </select>
                </label>
                <button className="w-full rounded-md bg-blue-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={cargando} type="submit">Crear borrador</button>
              </form>
            </section>
          </aside>

          <section className="min-w-0 space-y-5">
            {versionId ? (
              <>
                {(() => {
                  const version = versiones.find((item) => item.version_id === versionId);
                  if (!version) return null;
                  return (
                    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div><p className="font-mono text-xs text-blue-700">{version.codigo}</p><h2 className="mt-1 text-xl font-bold">{version.nombre}</h2><p className="mt-1 text-sm text-slate-600">Estado: {version.estado} · {tramites.length} trámites</p></div>
                        {version.tiene_resolucion && <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold" onClick={() => void descargarPdf(version.version_id, version.codigo)} type="button">Descargar resolución PDF</button>}
                      </div>
                      {version.estado === "BORRADOR" && (
                        <div className="mt-5 grid gap-4 border-t border-slate-100 pt-4 xl:grid-cols-2">
                          <div>
                            <h3 className="font-semibold">Resolución aprobatoria</h3>
                            <label className="mt-2 block text-xs font-semibold">PDF (máximo 10 MB)
                              <input accept="application/pdf,.pdf" className="mt-1 block w-full text-sm" onChange={(evento) => setArchivo(evento.target.files?.[0] ?? null)} type="file" />
                            </label>
                            <button className="mt-2 rounded-md border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50" disabled={!archivo || cargando} onClick={() => void subirPdf()} type="button">Subir PDF</button>
                          </div>
                          <div>
                            <h3 className="font-semibold">Publicar versión</h3>
                            <label className="mt-2 block text-xs font-semibold">Número de resolución
                              <input className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" onChange={(evento) => setNumeroResolucion(evento.target.value)} value={numeroResolucion} />
                            </label>
                            <label className="mt-2 block text-xs font-semibold">Fecha de resolución
                              <input className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" onChange={(evento) => setFechaResolucion(evento.target.value)} type="date" value={fechaResolucion} />
                            </label>
                            <button className="mt-3 rounded-md bg-green-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={cargando || !version.tiene_resolucion || !numeroResolucion || !fechaResolucion} onClick={() => void publicarVersion()} type="button">Publicar con confirmación</button>
                            {!version.tiene_resolucion && <p className="mt-2 text-xs text-amber-800">Cargue el PDF antes de publicar.</p>}
                          </div>
                        </div>
                      )}
                    </section>
                  );
                })()}
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-bold">Trámites de la versión</h2>
                  {tramites.length === 0 ? <p className="mt-3 text-sm text-slate-600">Esta versión todavía no tiene trámites.</p> : (
                    <div className="mt-4 space-y-3">
                      {tramites.map((tramite) => (
                        <TramiteEditor
                          key={tramite.tramite_version_id}
                          onError={setError}
                          onSaved={() => manejarOperacion(
                            async () => setTramites(await tupaApi.tramitesVersion(token, versionId)),
                            "Cambios guardados.",
                          )}
                          token={token}
                          tramite={tramite}
                          versionId={versionId}
                        />
                      ))}
                    </div>
                  )}
                </section>
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-bold">Bitácora inmutable</h2>
                  {bitacora.length === 0 ? <p className="mt-3 text-sm text-slate-600">Sin eventos registrados.</p> : (
                    <ol className="mt-3 space-y-3">
                      {bitacora.map((evento) => <li className="border-l-2 border-blue-300 pl-3 text-sm" key={evento.bitacora_id}><p className="font-semibold">{evento.accion} · {evento.estado_anterior ?? "—"} → {evento.estado_nuevo}</p><p className="text-xs text-slate-500">{new Date(evento.fecha_hora).toLocaleString()}</p></li>)}
                    </ol>
                  )}
                </section>
              </>
            ) : (
              <section className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600 shadow-sm">Seleccione una versión o cree un borrador nuevo.</section>
            )}
          </section>
        </div>
      )}

      {mensaje && <p className="mt-5 rounded-lg bg-green-50 p-3 text-sm text-green-900" role="status">{mensaje}</p>}
      {error && <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      {cargando && token && <p className="mt-3 text-sm text-slate-500">Procesando operación…</p>}
    </main>
  );
}
