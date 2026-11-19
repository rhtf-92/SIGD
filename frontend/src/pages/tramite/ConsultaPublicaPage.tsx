import { ShieldCheck, LogIn } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import ConsultaExpedientePublico from '../../components/tramite/ConsultaExpedientePublico';
import '../../styles/consulta-publica.css';

export type {
  DtoDocumentoPublico,
  DtoProveidoPublico,
  DtoConsultaPublica,
} from '../../components/tramite/ConsultaExpedientePublico';

export default function ConsultaPublicaPage() {
  const { cut } = useParams<{ cut: string }>();

  return (
    <main className="sigd-public-page">
      <div className="sigd-public-shell">
        <ConsultaExpedientePublico
          initialCut={cut}
          syncUrl
          mostrarEnlacePortal
          asPageHeading
        />

        <section className="sigd-public-cta">
          <div className="sigd-public-cta-copy">
            <h2>Otros servicios institucionales</h2>
            <p>
              ¿Necesitas verificar la autenticidad de un documento firmado o ingresar a tus notificaciones privadas?
            </p>
          </div>
          <div className="sigd-public-cta-actions">
            <Link to="/validador-cvd" className="sigd-public-btn-secondary">
              <ShieldCheck size={16} aria-hidden="true" />
              <span>Validar documento firmado (CVD)</span>
            </Link>
            <Link to="/login" className="sigd-public-btn-primary">
              <LogIn size={16} aria-hidden="true" />
              <span>Iniciar sesión con cuenta institucional</span>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
