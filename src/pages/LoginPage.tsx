import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { permisosIniciales } from "../hooks/useRbacConfig";
import { useRegistroEffects } from "../hooks/useRegistroEffects";
import InsigniaGiratoria from "../components/common/InsigniaGiratoria";
import {
  Mail,
  FileUp,
  FolderKanban,
  ShieldCheck,
  FileSignature,
  UserCheck,
} from "lucide-react";
import "../styles/login.css";

const CLAVE_TOKEN = "sigd_token";
const CLAVE_ROL = "sigd_rol";
const CLAVE_PERMISOS = "sigd_permisos";

const ROLES_CANONICOS = [
  { id: "SUPER_ADMIN", label: "SUPER_ADMIN — Super Administrador", destino: "/administracion" },
  { id: "DIRECTOR", label: "DIRECTOR — Director General", destino: "/administracion" },
  { id: "DOCENTE", label: "DOCENTE — Docente / Coordinador", destino: "/flujos/titulacion" },
  { id: "MESA_PARTES", label: "MESA_DE_PARTES — Mesa de Partes / Ventanilla", destino: "/tramite/ventanilla-presencial" },
  { id: "ESTUDIANTE", label: "ESTUDIANTE — Estudiante / Administrado", destino: "/casilla" },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const [rol, setRol] = useState("SUPER_ADMIN");

  // Solo diseño: efectos visuales (chispas del mouse y ondas en botones)
  const pageRef = useRef<HTMLElement>(null);
  useRegistroEffects(pageRef);

  function iniciarSesionDemo(e: React.FormEvent) {
    e.preventDefault();
    window.localStorage.setItem(CLAVE_TOKEN, "demo-jwt-" + Date.now());
    window.localStorage.setItem(CLAVE_ROL, rol);
    window.localStorage.setItem(CLAVE_PERMISOS, JSON.stringify(permisosIniciales));
    const encontrado = ROLES_CANONICOS.find((item) => item.id === rol);
    const destino = encontrado ? encontrado.destino : "/administracion";
    navigate(destino, { replace: true });
  }

  return (
    <main className="lg-page" ref={pageRef}>
      <div className="lg-photo" aria-hidden="true" />

      {/* PANEL IZQUIERDO: IDENTIDAD INSTITUCIONAL Y SERVICIOS */}
      <section className="lg-left">
        <span className="lg-chip">Gobernanza Digital MGD-PCM</span>

        <div className="lg-brand">
          <InsigniaGiratoria size={92} />
          <div>
            <span className="lg-lic">Licenciado por el MINEDU</span>
            <span>
              Instituto de Educación Superior Tecnológico Público “Suiza” — Pucallpa
            </span>
          </div>
        </div>

        <p className="lg-hello">Bienvenido a</p>
        <h1 className="lg-big">
          SIGD
          <br />
          SUIZA
        </h1>

        <p className="lg-sub">
          Plataforma oficial del Sistema Integral de Gestión Documentaria. Gestión
          automatizada de trámites, expedientes digitales y Casilla Electrónica con
          validez legal.
        </p>

        {/* SERVICIOS REALES DEL SISTEMA */}
        <div className="lg-feat">
          <div>
            <FileUp aria-hidden="true" />
            Mesa de Partes Virtual
          </div>
          <div>
            <Mail aria-hidden="true" />
            Casilla Electrónica
          </div>
          <div>
            <FolderKanban aria-hidden="true" />
            Bandeja de Expedientes
          </div>
          <div>
            <ShieldCheck aria-hidden="true" />
            Validador CVD
          </div>
          <div>
            <FileSignature aria-hidden="true" />
            Flujo y Validez Legal
          </div>
        </div>
      </section>

      {/* PANEL DERECHO: FORMULARIO DE ACCESO */}
      <section className="lg-card">
        <Link to="/" className="lg-back">
          ← Volver al inicio
        </Link>

        <span className="lg-kick">Autenticación Segura</span>
        <h2 className="lg-title">Iniciar sesión</h2>
        <p className="lg-lead">
          Seleccione su rol institucional canónico para acceder al control de acceso
          basado en roles (RBAC).
        </p>

        <form onSubmit={iniciarSesionDemo}>
          <label htmlFor="rol">Rol institucional canónico</label>
          <div className="lg-sel">
            <UserCheck aria-hidden="true" />
            <select
              id="rol"
              value={rol}
              onChange={(event) => setRol(event.target.value)}
            >
              {ROLES_CANONICOS.map((opcion) => (
                <option key={opcion.id} value={opcion.id}>
                  {opcion.label}
                </option>
              ))}
            </select>
          </div>

          <button type="submit">Ingresar al sistema</button>

          <p className="lg-links">
            ¿Eres usuario externo? <a href="#registro">Regístrate aquí</a>
          </p>
        </form>
      </section>

      <div className="lg-foot">
        <span>Programa de Estudios de Desarrollo de Sistemas de Información (PE DSI)</span>
        <span>© 2026</span>
      </div>
    </main>
  );
}