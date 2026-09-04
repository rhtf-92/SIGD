import { useState, type FormEvent } from 'react';
import type { RegisterFormData, RegisterFormErrors } from '../types/register';
import { UCAYALI_PROVINCIAS } from '../data/ucayali';
import fachadaSuiza from '../assets/fachada-suiza.png';
import logoSuiza from '../assets/logo-suiza.jpeg';
import './RegisterPage.css';

const initialFormData: RegisterFormData = {
  nombres: '',
  apellidos: '',
  dni: '',
  fechaNacimiento: '',
  correo: '',
  telefono: '',
  departamento: 'Ucayali',
  provincia: '',
  distrito: '',
  direccion: '',
  referencia: '',
  declaracionJurada: false,
};

export default function RegisterPage() {
  const [formData, setFormData] = useState<RegisterFormData>(initialFormData);
  const [errors, setErrors] = useState<RegisterFormErrors>({});
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Distritos disponibles según la provincia elegida
  const distritosDisponibles =
    UCAYALI_PROVINCIAS.find((p) => p.nombre === formData.provincia)
      ?.distritos ?? [];

  const handleChange = (
    campo: keyof RegisterFormData,
    valor: string | boolean
  ) => {
    setFormData((prev) => {
      const actualizado = { ...prev, [campo]: valor };
      if (campo === 'provincia') {
        actualizado.distrito = '';
      }
      return actualizado;
    });
    if (errors[campo as keyof RegisterFormErrors]) {
      setErrors((prev) => ({ ...prev, [campo]: undefined }));
    }
  };

  const validar = (): RegisterFormErrors => {
    const nuevosErrores: RegisterFormErrors = {};

    if (!formData.nombres.trim()) {
      nuevosErrores.nombres = 'Ingresa tus nombres.';
    }
    if (!formData.apellidos.trim()) {
      nuevosErrores.apellidos = 'Ingresa tus apellidos.';
    }

    const dniValido = /^\d{8}$/.test(formData.dni.trim());
    if (!formData.dni.trim()) {
      nuevosErrores.dni = 'Ingresa tu DNI.';
    } else if (!dniValido) {
      nuevosErrores.dni = 'El DNI debe tener 8 dígitos.';
    }

    if (!formData.fechaNacimiento) {
      nuevosErrores.fechaNacimiento = 'Selecciona tu fecha de nacimiento.';
    }

    const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.correo);
    if (!formData.correo.trim()) {
      nuevosErrores.correo = 'Ingresa un correo electrónico.';
    } else if (!correoValido) {
      nuevosErrores.correo = 'El correo no tiene un formato válido.';
    }

    const telefonoValido = /^\d{9}$/.test(formData.telefono.trim());
    if (!formData.telefono.trim()) {
      nuevosErrores.telefono = 'Ingresa un número de teléfono.';
    } else if (!telefonoValido) {
      nuevosErrores.telefono = 'El teléfono debe tener 9 dígitos.';
    }

    if (!formData.provincia) {
      nuevosErrores.provincia = 'Selecciona una provincia.';
    }
    if (!formData.distrito) {
      nuevosErrores.distrito = 'Selecciona un distrito.';
    }
    if (!formData.direccion.trim()) {
      nuevosErrores.direccion = 'Ingresa tu dirección.';
    }

    if (!formData.declaracionJurada) {
      nuevosErrores.declaracionJurada =
        'Debes aceptar la declaración jurada para continuar.';
    }

    return nuevosErrores;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const erroresEncontrados = validar();
    if (Object.keys(erroresEncontrados).length > 0) {
      setErrors(erroresEncontrados);
      return;
    }

    setEnviando(true);

    // TODO: reemplazar por la llamada real a la API cuando el backend
    // defina el endpoint POST /api/usuarios-externos
    console.log('Contrato de datos a enviar al backend:', formData);

    await new Promise((resolve) => setTimeout(resolve, 600));

    setEnviando(false);
    setEnviado(true);
  };

  if (enviado) {
    return (
      <div
        className="register-page"
        style={{ backgroundImage: `url(${fachadaSuiza})` }}
      >
        <div className="register-card">
          <div className="register-success">
            ✅ Registro enviado correctamente. Pronto podrás usar tus
            credenciales para hacer seguimiento a tus trámites.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="register-page"
      style={{ backgroundImage: `url(${fachadaSuiza})` }}
    >
      <div className="register-card">
        <img src={logoSuiza} alt="Instituto Suiza" className="register-logo" />

        <div className="register-header">
          <h1>Registro de usuario</h1>
          <p>Completa tus datos para crear tu cuenta en el SIGD</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="register-section-label">Datos personales</div>

          <div className="register-field">
            <label htmlFor="nombres">Nombres</label>
            <input
              id="nombres"
              type="text"
              value={formData.nombres}
              onChange={(e) => handleChange('nombres', e.target.value)}
              className={errors.nombres ? 'input-error' : ''}
            />
            {errors.nombres && (
              <div className="error-message">{errors.nombres}</div>
            )}
          </div>

          <div className="register-field">
            <label htmlFor="apellidos">Apellidos</label>
            <input
              id="apellidos"
              type="text"
              value={formData.apellidos}
              onChange={(e) => handleChange('apellidos', e.target.value)}
              className={errors.apellidos ? 'input-error' : ''}
            />
            {errors.apellidos && (
              <div className="error-message">{errors.apellidos}</div>
            )}
          </div>

          <div className="register-row">
            <div className="register-field">
              <label htmlFor="dni">DNI</label>
              <input
                id="dni"
                type="text"
                inputMode="numeric"
                maxLength={8}
                value={formData.dni}
                onChange={(e) => handleChange('dni', e.target.value)}
                className={errors.dni ? 'input-error' : ''}
                placeholder="12345678"
              />
              {errors.dni && (
                <div className="error-message">{errors.dni}</div>
              )}
            </div>

            <div className="register-field">
              <label htmlFor="fechaNacimiento">Fecha de nacimiento</label>
              <input
                id="fechaNacimiento"
                type="date"
                value={formData.fechaNacimiento}
                onChange={(e) =>
                  handleChange('fechaNacimiento', e.target.value)
                }
                className={errors.fechaNacimiento ? 'input-error' : ''}
              />
              {errors.fechaNacimiento && (
                <div className="error-message">{errors.fechaNacimiento}</div>
              )}
            </div>
          </div>

          <div className="register-section-label">Datos de contacto</div>

          <div className="register-field">
            <label htmlFor="correo">Correo electrónico</label>
            <input
              id="correo"
              type="email"
              value={formData.correo}
              onChange={(e) => handleChange('correo', e.target.value)}
              className={errors.correo ? 'input-error' : ''}
            />
            {errors.correo && (
              <div className="error-message">{errors.correo}</div>
            )}
          </div>

          <div className="register-field">
            <label htmlFor="telefono">Teléfono</label>
            <input
              id="telefono"
              type="tel"
              value={formData.telefono}
              onChange={(e) => handleChange('telefono', e.target.value)}
              className={errors.telefono ? 'input-error' : ''}
              placeholder="987654321"
            />
            {errors.telefono && (
              <div className="error-message">{errors.telefono}</div>
            )}
          </div>

          <div className="register-section-label">Domicilio</div>

          <div className="register-row">
            <div className="register-field">
              <label htmlFor="provincia">Provincia</label>
              <select
                id="provincia"
                value={formData.provincia}
                onChange={(e) => handleChange('provincia', e.target.value)}
                className={errors.provincia ? 'input-error' : ''}
              >
                <option value="">Selecciona una provincia</option>
                {UCAYALI_PROVINCIAS.map((p) => (
                  <option key={p.nombre} value={p.nombre}>
                    {p.nombre}
                  </option>
                ))}
              </select>
              {errors.provincia && (
                <div className="error-message">{errors.provincia}</div>
              )}
            </div>

            <div className="register-field">
              <label htmlFor="distrito">Distrito</label>
              <select
                id="distrito"
                value={formData.distrito}
                onChange={(e) => handleChange('distrito', e.target.value)}
                disabled={!formData.provincia}
                className={errors.distrito ? 'input-error' : ''}
              >
                <option value="">
                  {formData.provincia
                    ? 'Selecciona un distrito'
                    : 'Primero elige provincia'}
                </option>
                {distritosDisponibles.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              {errors.distrito && (
                <div className="error-message">{errors.distrito}</div>
              )}
            </div>
          </div>

          <div className="register-field">
            <label htmlFor="direccion">Dirección exacta</label>
            <input
              id="direccion"
              type="text"
              value={formData.direccion}
              onChange={(e) => handleChange('direccion', e.target.value)}
              className={errors.direccion ? 'input-error' : ''}
              placeholder="Jr. Los Álamos 123"
            />
            {errors.direccion && (
              <div className="error-message">{errors.direccion}</div>
            )}
          </div>

          <div className="register-field">
            <label htmlFor="referencia">Referencia (opcional)</label>
            <input
              id="referencia"
              type="text"
              value={formData.referencia}
              onChange={(e) => handleChange('referencia', e.target.value)}
              placeholder="Cerca al mercado, frente al parque..."
            />
          </div>

          <div className="register-declaracion">
            <label>
              <input
                type="checkbox"
                checked={formData.declaracionJurada}
                onChange={(e) =>
                  handleChange('declaracionJurada', e.target.checked)
                }
              />
              <span>
                Declaro bajo juramento que la información proporcionada es
                verdadera y correcta.
              </span>
            </label>
            {errors.declaracionJurada && (
              <div className="error-message">{errors.declaracionJurada}</div>
            )}
          </div>

          <button type="submit" className="register-submit" disabled={enviando}>
            {enviando ? 'Registrando...' : 'Registrar'}
          </button>
        </form>
      </div>
    </div>
  );
}