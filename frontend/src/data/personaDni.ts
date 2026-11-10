export interface PersonaDni {
  dni: string;
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  fechaNacimiento: string;
  sexo: string;
  estadoCivil: string;
  nacionalidad: string;
  direccion: string;
  departamento: string;
  provincia: string;
  distrito: string;
  ubigeo: string;
  correo: string;
  telefono: string;
  fechaEmision: string;
  fechaCaducidad: string;
  codigoVerificacion: string;
  fuente: "RENIEC";
}

const CLAVE_GUARDADOS = "sigd_personas_dni_v1";

export function normalizarDni(valor: string): string {
  return valor.replace(/\D/g, "").slice(0, 8);
}

export function esDniValido(valor: string): boolean {
  return /^\d{8}$/.test(normalizarDni(valor));
}

export function extraerDni(texto: string): string | null {
  const coincidencia = texto.match(/(?<!\d)(\d{8})(?!\d)/);
  if (coincidencia) return coincidencia[1];
  const soloDigitos = texto.replace(/\D/g, "");
  return soloDigitos.length === 8 ? soloDigitos : null;
}

export function obtenerDnisGuardados(): PersonaDni[] {
  try {
    const crudo = window.localStorage.getItem(CLAVE_GUARDADOS);
    if (!crudo) return [];
    const datos: unknown = JSON.parse(crudo);
    if (!Array.isArray(datos)) return [];
    return datos.filter(
      (item): item is PersonaDni =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as PersonaDni).dni === "string" &&
        typeof (item as PersonaDni).nombreCompleto === "string",
    );
  } catch {
    return [];
  }
}

export function guardarPersonaDni(persona: PersonaDni): void {
  try {
    const actuales = obtenerDnisGuardados().filter((item) => item.dni !== persona.dni);
    const siguientes = [persona, ...actuales].slice(0, 8);
    window.localStorage.setItem(CLAVE_GUARDADOS, JSON.stringify(siguientes));
  } catch {
    // localStorage puede estar bloqueado; el flujo continúa en memoria.
  }
}
