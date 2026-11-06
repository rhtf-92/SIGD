/**
 * Padrón demo determinista para el lector de DNI digital.
 *
 * No representa una consulta real a RENIEC: permite demostrar el flujo de
 * lectura de PDF417 + autocompletado sin depender de servicios externos.
 * Cualquier DNI de 8 dígitos devuelve una persona estable y plausible.
 */

export interface PersonaDniDemo {
  dni: string;
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  fechaNacimiento: string;
  sexo: "MASCULINO" | "FEMENINO";
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
  fuente: "padron-demo";
}

const NOMBRES_M = [
  "JUAN CARLOS",
  "LUIS MIGUEL",
  "JORGE ANDRÉS",
  "CARLOS ENRIQUE",
  "PEDRO PABLO",
  "MIGUEL ÁNGEL",
  "JOSÉ ANTONIO",
  "FRANCISCO JAVIER",
  "RENATO ALONSO",
  "DIEGO ARMANDO",
  "ÁLVARO SEBASTIÁN",
  "CRISTIAN EDUARDO",
];

const NOMBRES_F = [
  "MARÍA FERNANDA",
  "ANA LUCÍA",
  "CARMEN ROSA",
  "LUZ MARINA",
  "PATRICIA ELENA",
  "ROSA DEL PILAR",
  "GABRIELA ISABEL",
  "VALERIA SOFÍA",
  "CAMILA ANDREA",
  "DANIELA MERCEDES",
  "JULIA ESTEFANÍA",
  "FIORELLA ALEXANDRA",
];

const APELLIDOS_A = [
  "QUISPE",
  "FLORES",
  "SÁNCHEZ",
  "ROJAS",
  "VARGAS",
  "RAMÍREZ",
  "MENDOZA",
  "GARCÍA",
  "TORRES",
  "CHÁVEZ",
  "RÍOS",
  "SALAZAR",
];

const APELLIDOS_B = [
  "MORALES",
  "HUAMÁN",
  "CASTILLO",
  "GUTIÉRREZ",
  "PANDURO",
  "TAMANI",
  "SIFUENTES",
  "AGUILAR",
  "CORDOVA",
  "ZEGARRA",
  "PINEDO",
  "YUPANQUI",
];

const DISTRITOS = [
  { distrito: "CALLERÍA", provincia: "CORONEL PORTILLO", ubigeo: "250101" },
  { distrito: "YARINACOCHA", provincia: "CORONEL PORTILLO", ubigeo: "250102" },
  { distrito: "MANANTAY", provincia: "CORONEL PORTILLO", ubigeo: "250104" },
  { distrito: "PUCALLPA", provincia: "CORONEL PORTILLO", ubigeo: "250101" },
  { distrito: "CAMPO VERDE", provincia: "CORONEL PORTILLO", ubigeo: "250103" },
  { distrito: "NUEVA REQUENA", provincia: "CORONEL PORTILLO", ubigeo: "250105" },
];

const VIAS = [
  "Jr. Tarapacá",
  "Av. Túpac Amaru",
  "Jr. Inmaculada",
  "Av. Centenario",
  "Jr. Amazonas",
  "Av. San Martín",
  "Jr. Ucayali",
  "Av. Arequipa",
  "Jr. Raymondi",
  "Av. Agustín Cauper",
];

const ESTADOS_CIVILES = ["SOLTERO(A)", "CASADO(A)", "CONVIVIENTE", "VIUDO(A)", "DIVORCIADO(A)"];

const REGISTRO: Record<string, Partial<PersonaDniDemo>> = {
  "12345678": {
    nombres: "JUAN CARLOS",
    apellidos: "QUISPE MORALES",
    fechaNacimiento: "1992-04-18",
    sexo: "MASCULINO",
    estadoCivil: "SOLTERO(A)",
    direccion: "Jr. Tarapacá N° 645, Callería",
    distrito: "CALLERÍA",
    ubigeo: "250101",
    correo: "juan.quispe@ejemplo.pe",
    telefono: "987654321",
  },
  "74561234": {
    nombres: "MARÍA FERNANDA",
    apellidos: "ROJAS PANDURO",
    fechaNacimiento: "1988-11-07",
    sexo: "FEMENINO",
    estadoCivil: "CASADO(A)",
    direccion: "Av. Centenario Km 4.5, Manantay",
    distrito: "MANANTAY",
    ubigeo: "250104",
    correo: "maria.rojas@ejemplo.pe",
    telefono: "956781234",
  },
};

function digito(dni: string, posicion: number): number {
  return Number(dni[posicion] ?? "0");
}

function dosDigitos(valor: number): string {
  return String(valor).padStart(2, "0");
}

function normalizarCorreo(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

function fechaDesdeDni(dni: string): string {
  const anio = 1965 + ((digito(dni, 0) * 10 + digito(dni, 1)) % 45);
  const mes = (digito(dni, 2) % 12) + 1;
  const dia = (digito(dni, 3) % 27) + 1;
  return `${anio}-${dosDigitos(mes)}-${dosDigitos(dia)}`;
}

export function esDniValido(valor: string): boolean {
  return /^\d{8}$/.test(valor.replace(/\D/g, ""));
}

export function extraerDni(texto: string): string | null {
  const coincidencia = texto.match(/(?<!\d)(\d{8})(?!\d)/);
  if (coincidencia) return coincidencia[1];
  const soloDigitos = texto.replace(/\D/g, "");
  return soloDigitos.length === 8 ? soloDigitos : null;
}

export function buscarPersonaDni(dniCrudo: string): PersonaDniDemo | null {
  const dni = dniCrudo.replace(/\D/g, "").slice(0, 8);
  if (!esDniValido(dni)) return null;

  const base = REGISTRO[dni];
  const sexo: PersonaDniDemo["sexo"] = digito(dni, 7) % 2 === 0 ? "MASCULINO" : "FEMENINO";
  const nombres = base?.nombres ?? (sexo === "MASCULINO" ? NOMBRES_M : NOMBRES_F)[digito(dni, 6) % 12];
  const apellidos =
    base?.apellidos ??
    `${APELLIDOS_A[digito(dni, 4) % 12]} ${APELLIDOS_B[digito(dni, 5) % 12]}`;
  const ubicacion = DISTRITOS[digito(dni, 3) % DISTRITOS.length];
  const via = VIAS[digito(dni, 2) % VIAS.length];
  const numero = 100 + ((digito(dni, 0) * 10 + digito(dni, 1)) % 890);
  const fechaNacimiento = base?.fechaNacimiento ?? fechaDesdeDni(dni);
  const nombreCompleto = `${nombres} ${apellidos}`;

  return {
    dni,
    nombres,
    apellidos,
    nombreCompleto,
    fechaNacimiento,
    sexo: base?.sexo ?? sexo,
    estadoCivil: base?.estadoCivil ?? ESTADOS_CIVILES[digito(dni, 1) % ESTADOS_CIVILES.length],
    nacionalidad: "PERUANA",
    direccion: base?.direccion ?? `${via} N° ${numero}, ${ubicacion.distrito}`,
    departamento: "UCAYALI",
    provincia: ubicacion.provincia,
    distrito: base?.distrito ?? ubicacion.distrito,
    ubigeo: base?.ubigeo ?? ubicacion.ubigeo,
    correo: base?.correo ?? `${normalizarCorreo(nombres.split(" ")[0])}.${normalizarCorreo(apellidos.split(" ")[0])}@ejemplo.pe`,
    telefono: base?.telefono ?? `9${dni.slice(0, 8).split("").reverse().join("")}`,
    fechaEmision: `${2021 + (digito(dni, 0) % 4)}-${dosDigitos((digito(dni, 1) % 12) + 1)}-${dosDigitos((digito(dni, 2) % 27) + 1)}`,
    fechaCaducidad: `${2027 + (digito(dni, 0) % 5)}-${dosDigitos((digito(dni, 1) % 12) + 1)}-${dosDigitos((digito(dni, 2) % 27) + 1)}`,
    codigoVerificacion: `${dni.slice(0, 4)}-${dni.slice(4)}-${(digito(dni, 0) + digito(dni, 7)) % 10}${digito(dni, 3)}`,
    fuente: "padron-demo",
  };
}

const CLAVE_GUARDADOS = "sigd_padron_dni_guardados_v1";

export function obtenerDnisGuardados(): PersonaDniDemo[] {
  try {
    const crudo = window.localStorage.getItem(CLAVE_GUARDADOS);
    if (!crudo) return [];
    const datos = JSON.parse(crudo) as PersonaDniDemo[];
    return Array.isArray(datos) ? datos : [];
  } catch {
    return [];
  }
}

export function guardarPersonaDni(persona: PersonaDniDemo): void {
  try {
    const actuales = obtenerDnisGuardados().filter((item) => item.dni !== persona.dni);
    const siguientes = [persona, ...actuales].slice(0, 8);
    window.localStorage.setItem(CLAVE_GUARDADOS, JSON.stringify(siguientes));
  } catch {
    // localStorage puede estar bloqueado; el flujo continúa en memoria.
  }
}
