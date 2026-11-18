import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import PersonaNaturalForm from "../../components/registro/PersonaNaturalForm";
import PersonaJuridicaForm from "../../components/registro/PersonaJuridicaForm";
import InsigniaGiratoria from "../../components/common/InsigniaGiratoria";
import { useRegistroEffects } from "../../hooks/useRegistroEffects";
import type { Natural, Juridical } from "../../types/registroCiudadano";
import "../../styles/registro.css";

export default function RegistroCiudadanoPage() {
  const [activeTab, setActiveTab] = useState<"NATURAL" | "JURIDICA">("NATURAL");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Solo diseño: efectos visuales y porcentaje de avance
  const pageRef = useRef<HTMLDivElement>(null);
  useRegistroEffects(pageRef);

  const handleNaturalSubmit = async (data: Natural) => {
    // TODO: reemplazar por llamada real a la API cuando el backend defina el endpoint
    console.log("POST /api/v1/auth/registro-ciudadano", data);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setSuccessMessage(
      `Registro completado. Tu casilla electrónica ha sido creada: ${data.numeroDocumento}@casilla.iestpsuiza.edu.pe`
    );
  };

  const handleJuridicaSubmit = async (data: Juridical) => {
    // TODO: reemplazar por llamada real a la API cuando el backend defina el endpoint
    console.log("POST /api/v1/auth/registro-ciudadano", data);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setSuccessMessage(
      `Registro completado. Tu casilla electrónica ha sido creada: ${data.ruc}@casilla.iestpsuiza.edu.pe`
    );
  };

  const handleClearSuccess = () => setSuccessMessage(null);

  return (
    <div className="reg-page" ref={pageRef}>
      <div className="reg-card">
        <div className="reg-prog" aria-hidden="true">
          <i />
        </div>

        <div className="reg-top">
          <Link to="/" className="reg-back">
            ← Volver al inicio
          </Link>
          <span className="reg-pct">0% completo</span>
          <InsigniaGiratoria size={68} />
        </div>

        <h1 className="reg-title">Registro de Usuario Externo</h1>
        <p className="reg-sub">
          Complete sus datos para crear su cuenta y Casilla Electrónica
          Institucional
        </p>

        <div
          role="tablist"
          aria-label="Tipo de persona"
          className="reg-tabs"
          data-active={activeTab}
        >
          <span className="reg-pill" aria-hidden="true" />
          <button
            role="tab"
            aria-selected={activeTab === "NATURAL"}
            aria-controls="panel-natural"
            id="tab-natural"
            data-t="n"
            onClick={() => {
              setActiveTab("NATURAL");
              setSuccessMessage(null);
            }}
            className={`reg-tab ${activeTab === "NATURAL" ? "is-on" : ""}`}
          >
            Persona Natural
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "JURIDICA"}
            aria-controls="panel-juridica"
            id="tab-juridica"
            data-t="j"
            onClick={() => {
              setActiveTab("JURIDICA");
              setSuccessMessage(null);
            }}
            className={`reg-tab ${activeTab === "JURIDICA" ? "is-on" : ""}`}
          >
            Persona Jurídica
          </button>
        </div>

        <div
          role="tabpanel"
          id="panel-natural"
          aria-labelledby="tab-natural"
          hidden={activeTab !== "NATURAL"}
          className="reg-panel"
        >
          {activeTab === "NATURAL" && (
            <PersonaNaturalForm onSubmit={handleNaturalSubmit} />
          )}
        </div>

        <div
          role="tabpanel"
          id="panel-juridica"
          aria-labelledby="tab-juridica"
          hidden={activeTab !== "JURIDICA"}
          className="reg-panel"
        >
          {activeTab === "JURIDICA" && (
            <PersonaJuridicaForm onSubmit={handleJuridicaSubmit} />
          )}
        </div>

        {successMessage && (
          <div className="reg-ok" role="status" aria-live="polite">
            <span>{successMessage}</span>
            <button
              onClick={handleClearSuccess}
              className="reg-ok__close"
              aria-label="Cerrar mensaje de éxito"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}