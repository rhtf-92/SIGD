import { describe, it, expect } from "vitest";
import {
  naturalSchema,
  juridicalSchema,
  registroCiudadanoSchema,
} from "../../schemas/registroCiudadano.schema";

type Ubigeo = {
  departamentoCodigo: string;
  provinciaCodigo: string;
  distritoCodigo: string;
  direccionExacta: string;
  referencia?: string;
};

type PersonaNatural = {
  tipoPersona: "NATURAL";
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
  correo: string;
  celular: string;
  domicilio: Ubigeo;
  tipoDocumento: "DNI" | "CE";
  numeroDocumento: string;
  declaracionJuradaAceptada: boolean;
  consentimientoDatosPersonales: boolean;
};

type PersonaJuridica = {
  tipoPersona: "JURIDICA";
  ruc: string;
  razonSocial: string;
  representanteLegal: {
    tipoDocumento: "DNI" | "CE";
    numeroDocumento: string;
    nombres: string;
    apellidos: string;
    cargo: string;
  };
  partidaSunarp: string;
  correoCorporativo: string;
  celularContacto: string;
  domicilio: Ubigeo;
  declaracionJuradaAceptada: boolean;
  consentimientoDatosPersonales: boolean;
};

const crearUbigeo = (): Ubigeo => ({
  departamentoCodigo: "1501",
  provinciaCodigo: "150101",
  distritoCodigo: "15010101",
  direccionExacta: "Av. Arequipa 123",
  referencia: "Cerca de la plaza de armas",
});

const crearFechaISO = (fecha: Date): string => {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
};

const fechaHaceAnos = (anios: number): string => {
  const fecha = new Date();
  fecha.setFullYear(fecha.getFullYear() - anios);
  return crearFechaISO(fecha);
};

const personaNaturalBase = {
  tipoPersona: "NATURAL" as const,
  nombres: "Juan",
  apellidos: "Pérez",
  fechaNacimiento: fechaHaceAnos(30),
  correo: "juan.perez@example.com",
  celular: "912345678",
  domicilio: crearUbigeo(),
  tipoDocumento: "DNI" as const,
  numeroDocumento: "12345678",
  declaracionJuradaAceptada: true,
  consentimientoDatosPersonales: true,
} satisfies PersonaNatural;

const crearPersonaNatural = (
  overrides: Partial<PersonaNatural>
): PersonaNatural => ({
  ...personaNaturalBase,
  ...overrides,
});

const personaJuridicaBase = {
  tipoPersona: "JURIDICA" as const,
  ruc: "20131312955",
  razonSocial: "Instituto Suiza S.A.C.",
  representanteLegal: {
    tipoDocumento: "DNI" as const,
    numeroDocumento: "12345678",
    nombres: "Carlos",
    apellidos: "Gómez",
    cargo: "Gerente General",
  },
  partidaSunarp: "20123456789",
  correoCorporativo: "contacto@institutosuiza.com",
  celularContacto: "987654321",
  domicilio: crearUbigeo(),
  declaracionJuradaAceptada: true,
  consentimientoDatosPersonales: true,
} satisfies PersonaJuridica;

const crearPersonaJuridica = (
  overrides: Partial<PersonaJuridica>
): PersonaJuridica => ({
  ...personaJuridicaBase,
  ...overrides,
});

describe("naturalSchema", () => {
  it("debe RECHAZAR un DNI con menos de 8 dígitos", () => {
    const resultado = naturalSchema.safeParse(
      crearPersonaNatural({ numeroDocumento: "1234567" })
    );
    expect(resultado.success).toBe(false);
  });

  it("debe RECHAZAR un DNI con letras", () => {
    const resultado = naturalSchema.safeParse(
      crearPersonaNatural({ numeroDocumento: "1234567A" })
    );
    expect(resultado.success).toBe(false);
  });

  it("debe ACEPTAR un DNI válido de 8 dígitos numéricos", () => {
    const resultado = naturalSchema.safeParse(
      crearPersonaNatural({ numeroDocumento: "12345678" })
    );
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.numeroDocumento).toBe("12345678");
    }
  });

  it("debe RECHAZAR una persona menor de 16 años", () => {
    const resultado = naturalSchema.safeParse(
      crearPersonaNatural({ fechaNacimiento: fechaHaceAnos(10) })
    );
    expect(resultado.success).toBe(false);
  });

  it("debe ACEPTAR una persona de exactamente 16 años o más", () => {
    const resultado = naturalSchema.safeParse(
      crearPersonaNatural({ fechaNacimiento: fechaHaceAnos(16) })
    );
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.fechaNacimiento).toBe(fechaHaceAnos(16));
    }
  });

  it("debe RECHAZAR un correo con formato inválido", () => {
    const resultado = naturalSchema.safeParse(
      crearPersonaNatural({ correo: "correo-sin-arroba" })
    );
    expect(resultado.success).toBe(false);
  });

  it("debe RECHAZAR un celular que no tenga 9 dígitos o no empiece en 9", () => {
    const resultado = naturalSchema.safeParse(
      crearPersonaNatural({ celular: "812345678" })
    );
    expect(resultado.success).toBe(false);
  });

  it("debe RECHAZAR si declaracionJuradaAceptada es false", () => {
    const resultado = naturalSchema.safeParse(
      crearPersonaNatural({ declaracionJuradaAceptada: false })
    );
    expect(resultado.success).toBe(false);
  });

  it("debe RECHAZAR si consentimientoDatosPersonales es false", () => {
    const resultado = naturalSchema.safeParse(
      crearPersonaNatural({ consentimientoDatosPersonales: false })
    );
    expect(resultado.success).toBe(false);
  });

  it("debe ACEPTAR un objeto completo y válido de Persona Natural", () => {
    const resultado = naturalSchema.safeParse(
      crearPersonaNatural({
        fechaNacimiento: fechaHaceAnos(25),
        numeroDocumento: "12345678",
      })
    );
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data).toMatchObject({
        tipoPersona: "NATURAL",
        nombres: "Juan",
        apellidos: "Pérez",
      });
    }
  });
});

describe("juridicalSchema", () => {
  it("debe RECHAZAR un RUC que no inicie en 10 o 20", () => {
    const resultado = juridicalSchema.safeParse(
      crearPersonaJuridica({ ruc: "30601234567" })
    );
    expect(resultado.success).toBe(false);
  });

  it("debe RECHAZAR un RUC con dígito verificador incorrecto", () => {
    const resultado = juridicalSchema.safeParse(
      crearPersonaJuridica({ ruc: "20131312956" })
    );
    expect(resultado.success).toBe(false);
  });

  it("debe ACEPTAR un RUC válido con dígito verificador correcto", () => {
    const ruc = "20131312955";
    const resultado = juridicalSchema.safeParse(crearPersonaJuridica({ ruc }));
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.ruc).toBe(ruc);
    }
  });

  it("debe ACEPTAR el RUC real de la SUNAT (20131312955)", () => {
    const ruc = "20131312955";
    const resultado = juridicalSchema.safeParse(crearPersonaJuridica({ ruc }));
    expect(resultado.success).toBe(true);
  });

  it("debe RECHAZAR si falta cualquier campo de representanteLegal", () => {
    const personaSinNombres = {
      ...personaJuridicaBase,
      representanteLegal: {
        ...personaJuridicaBase.representanteLegal,
        nombres: undefined,
      },
    };

    const resultado = juridicalSchema.safeParse(personaSinNombres);
    expect(resultado.success).toBe(false);
  });

  it("debe ACEPTAR un objeto completo y válido de Persona Jurídica", () => {
    const resultado = juridicalSchema.safeParse(personaJuridicaBase);
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.tipoPersona).toBe("JURIDICA");
    }
  });
});

describe("registroCiudadanoSchema", () => {
  it("debe diferenciar correctamente entre tipoPersona NATURAL y JURIDICA", () => {
    const natural = registroCiudadanoSchema.safeParse(crearPersonaNatural({}));
    const juridica = registroCiudadanoSchema.safeParse(personaJuridicaBase);

    expect(natural.success).toBe(true);
    if (natural.success) {
      expect(natural.data.tipoPersona).toBe("NATURAL");
    }

    expect(juridica.success).toBe(true);
    if (juridica.success) {
      expect(juridica.data.tipoPersona).toBe("JURIDICA");
    }
  });
});