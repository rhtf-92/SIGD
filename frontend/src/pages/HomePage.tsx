import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import Skeleton from "../components/Skeleton";
import { tupaApi, type TupaVersion } from "../services/tupaApi";

interface AccesoDirecto {
  ruta: string;
  titulo: string;
  descripcion: string;
  icono: string;
  protegida?: boolean;
}

const accesos: AccesoDirecto[] = [
  {
    ruta: "/tramite/mesa-partes-virtual",
    titulo: "Mesa de partes",
    descripcion: "Presenta documentación mediante la Mesa de Partes Virtual.",
    icono: "documento",
  },
  {
    ruta: "/consulta",
    titulo: "Consulta y seguimiento",
    descripcion: "Consultar expediente y revisar su estado con su CUT.",
    icono: "busqueda",
  },
  {
    ruta: "/registro",
    titulo: "Registro de usuarios externos",
    descripcion: "Crea un registro ciudadano en el sistema.",
    icono: "registro",
  },
  {
    ruta: "/login",
    titulo: "Iniciar sesión / Administración",
    descripcion: "Ingresa al sistema o accede al panel de administración.",
    icono: "admin",
  },
];

function AccesoIcono({ tipo }: { tipo: string }) {
  return (
    <span aria-hidden="true" className="sigd-home-icon">
      <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
        {tipo === "casilla" ? (
          <><path d="M3 5h18v14H3z" /><path d="m3 7 9 6 9-6" /></>
        ) : tipo === "tupa" ? (
          <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v5h5M9 12h7M9 16h7" /></>
        ) : tipo === "busqueda" ? (
          <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>
        ) : tipo === "registro" ? (
          <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0M19 8v6m-3-3h6" /></>
        ) : tipo === "admin" ? (
          <><rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>
        ) : (
          <><path d="M4 4h16v16H4z" /><path d="M8 8h8M8 12h8M8 16h5" /></>
        )}
      </svg>
    </span>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState("");
  const [version, setVersion] = useState<TupaVersion | null>(null);
  const [totalTramites, setTotalTramites] = useState<number | null>(null);
  const [cargandoDatos, setCargandoDatos] = useState(true);

  useEffect(() => {
    let activo = true;
    Promise.all([tupaApi.vigente(), tupaApi.listarVigente({ q: "", rubro: "", pagina: 1 })])
      .then(([versionActual, respuesta]) => {
        if (!activo) return;
        setVersion(versionActual);
        setTotalTramites(respuesta.total);
      })
      .catch(() => {
        if (activo) {
          setVersion(null);
          setTotalTramites(null);
        }
      })
      .finally(() => {
        if (activo) setCargandoDatos(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  function buscar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const consulta = busqueda.trim();
    if (!consulta) return;
    navigate(`/tupa?q=${encodeURIComponent(consulta)}`);
  }

  return (
    <main className="sigd-home">
      <section className="sigd-home-hero">
        <div className="sigd-home-hero-content">
          <form className="sigd-home-search" onSubmit={buscar} role="search">
            <h1>Bienvenido al SIGD</h1>
            <p className="sigd-home-lead">Sistema Integral de Gestión Documentaria para consultar y realizar trámites institucionales.</p>
            <label htmlFor="sigd-home-search-input">Busca un trámite del TUPA</label>
            <div>
              <input
                id="sigd-home-search-input"
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder="Ejemplo: certificado de estudios"
                value={busqueda}
              />
              <button className="sigd-button sigd-button-primary" disabled={!busqueda.trim()} type="submit">Buscar</button>
            </div>
          </form>
        </div>
      </section>

      {cargandoDatos ? (
        <div aria-label="Cargando datos del TUPA vigente" aria-busy="true" className="sigd-home-metrics-skeleton">
          <Skeleton variant="line" className="h-10 w-full" />
          <Skeleton variant="line" className="h-10 w-full" />
        </div>
      ) : version && totalTramites !== null ? (
        <section aria-label="Datos del TUPA vigente" className="sigd-home-metrics">
          <div><strong>{totalTramites}</strong><span>trámites en el TUPA vigente</span></div>
          <div><strong>{version.codigo}</strong><span>{version.nombre}</span></div>
        </section>
      ) : null}

      <section className="sigd-home-access">
        <div className="sigd-home-section-heading">
          <div><p>ACCESO DIRECTO</p><h2>¿Qué necesitas hacer?</h2></div>
          <Link to="/tupa">Consultar todos los trámites</Link>
        </div>
        <div className="sigd-home-access-grid">
          {accesos.map((acceso) => (
            <Link className="sigd-home-card" key={acceso.ruta} to={acceso.ruta}>
              <div className="sigd-home-card-head">
                <AccesoIcono tipo={acceso.icono} />
                {acceso.protegida ? <span className="sigd-home-card-badge">Requiere iniciar sesión</span> : null}
              </div>
              <h3>{acceso.titulo}</h3>
              <p>{acceso.descripcion}</p>
              <span className="sigd-home-card-arrow">Ir al servicio <span aria-hidden="true">→</span></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="sigd-home-how">
        <div className="sigd-home-section-heading">
          <div><p>En pocos pasos</p><h2>Cómo funciona</h2></div>
        </div>
        <ol>
          <li><span>1</span><div><h3>Regístrate</h3><p>Completa tu registro ciudadano para usar los servicios del sistema.</p><Link to="/registro">Ir a Registro</Link></div></li>
          <li><span>2</span><div><h3>Presenta tu trámite</h3><p>Revisa los requisitos del TUPA y presenta la documentación por Mesa de Partes Virtual.</p><Link to="/tramite/mesa-partes-virtual">Ir a Mesa de Partes Virtual</Link></div></li>
          <li><span>3</span><div><h3>Sigue tu expediente y recibe notificaciones en tu Casilla</h3><p>Consulta el estado de tu expediente y revisa las notificaciones en tu Casilla Electrónica.</p><div className="sigd-home-step-links"><Link to="/consulta">Consultar expediente</Link><Link to="/casilla">Abrir Casilla</Link></div></div></li>
        </ol>
      </section>
    </main>
  );
}
