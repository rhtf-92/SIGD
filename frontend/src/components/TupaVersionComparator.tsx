import { useRef, useState } from "react";
import { compararTramites, type TupaDifference } from "../services/tupaComparator";
import { mensajeError, tupaApi, type TupaVersion } from "../services/tupaApi";

interface TupaVersionComparatorProps {
  token: string;
  versiones: TupaVersion[];
}

export default function TupaVersionComparator({ token, versiones }: TupaVersionComparatorProps) {
  const [versionAnterior, setVersionAnterior] = useState("");
  const [versionNueva, setVersionNueva] = useState("");
  const [diferencias, setDiferencias] = useState<TupaDifference[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const solicitudActual = useRef(0);

  async function comparar(versionVieja: string, versionReciente: string) {
    const solicitud = ++solicitudActual.current;
    setCargando(true);
    setError("");
    try {
      const [antes, despues] = await Promise.all([
        tupaApi.tramitesVersion(token, versionVieja),
        tupaApi.tramitesVersion(token, versionReciente),
      ]);
      if (solicitud === solicitudActual.current) setDiferencias(compararTramites(antes, despues));
    } catch (motivo) {
      if (solicitud === solicitudActual.current) setError(mensajeError(motivo));
    } finally {
      if (solicitud === solicitudActual.current) setCargando(false);
    }
  }

  function cambiarVersionAnterior(id: string) {
    setVersionAnterior(id);
    setDiferencias(null);
    setError("");
    if (id && versionNueva && id !== versionNueva) {
      void comparar(id, versionNueva);
    } else {
      solicitudActual.current += 1;
      setCargando(false);
    }
  }

  function cambiarVersionNueva(id: string) {
    setVersionNueva(id);
    setDiferencias(null);
    setError("");
    if (versionAnterior && id && versionAnterior !== id) {
      void comparar(versionAnterior, id);
    } else {
      solicitudActual.current += 1;
      setCargando(false);
    }
  }

  return (
    <section className="sigd-card sigd-version-comparator" aria-labelledby="tupa-comparator-title">
      <h2 id="tupa-comparator-title">Comparador de versiones</h2>
      <p>Compara los trámites y datos obtenidos de las versiones seleccionadas.</p>
      <div className="sigd-comparator-selects">
        <label>
          Versión anterior
          <select onChange={(evento) => cambiarVersionAnterior(evento.target.value)} value={versionAnterior}>
            <option value="">Elige una versión</option>
            {versiones.map((version) => (
              <option key={version.version_id} value={version.version_id}>{version.codigo} · {version.estado}</option>
            ))}
          </select>
        </label>
        <label>
          Versión nueva
          <select onChange={(evento) => cambiarVersionNueva(evento.target.value)} value={versionNueva}>
            <option value="">Elige una versión</option>
            {versiones.map((version) => (
              <option disabled={version.version_id === versionAnterior} key={version.version_id} value={version.version_id}>
                {version.codigo} · {version.estado}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="sigd-alert-error" role="alert">{error}</p>}
      {cargando && <p className="sigd-loading" role="status">Cargando versiones seleccionadas…</p>}
      {versionAnterior && versionNueva && versionAnterior !== versionNueva && diferencias && !cargando && !diferencias.length && (
        <p className="sigd-empty">No se encontraron diferencias entre estas versiones.</p>
      )}
      {versionAnterior && versionNueva && versionAnterior !== versionNueva && diferencias && diferencias.length > 0 && (
        <ul className="sigd-comparator-list">
          {diferencias.map((diferencia) => (
            <li key={`${diferencia.tipo}-${diferencia.codigo}`}>
              <div>
                <span className={`sigd-badge sigd-diff-${diferencia.tipo.toLowerCase()}`}>{diferencia.tipo}</span>
                <span className="sigd-comparator-code">{diferencia.codigo}</span>
                <h3>{diferencia.denominacion}</h3>
              </div>
              {diferencia.cambios.length > 0 && (
                <dl>
                  {diferencia.cambios.map((cambio) => (
                    <div key={cambio.campo}>
                      <dt>{cambio.campo}</dt>
                      <dd><span>Antes: {cambio.antes}</span><span>Después: {cambio.despues}</span></dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
