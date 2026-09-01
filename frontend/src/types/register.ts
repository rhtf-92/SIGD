// Estructura de datos del formulario de registro de usuario externo
export interface RegisterFormData {
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string;
  departamento: string;
  provincia: string;
  distrito: string;
  direccion: string;
  referencia: string;
}

// Errores de validación (uno por campo, string vacío = sin error)
export interface RegisterFormErrors {
  nombres?: string;
  apellidos?: string;
  correo?: string;
  telefono?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  direccion?: string;
}

// Estructura de datos del formulario de registro de usuario externo
export interface RegisterFormData {
  nombres: string;
  apellidos: string;
  dni: string;
  fechaNacimiento: string;
  correo: string;
  telefono: string;
  departamento: string;
  provincia: string;
  distrito: string;
  direccion: string;
  referencia: string;
  declaracionJurada: boolean;
}

// Errores de validación (uno por campo, string vacío = sin error)
export interface RegisterFormErrors {
  nombres?: string;
  apellidos?: string;
  dni?: string;
  fechaNacimiento?: string;
  correo?: string;
  telefono?: string;
  provincia?: string;
  distrito?: string;
  direccion?: string;
  declaracionJurada?: string;
}