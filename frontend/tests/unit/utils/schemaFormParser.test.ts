/**
 * Suite de regresión — Parser de JSON Schema (Draft 2020-12).
 * Integrante: Carlos Alexis Perea Saldaña (F_PEREA).
 *
 * Cubre `src/utils/schemaFormParser.ts`:
 *   - isWeekend: bloqueo LPAG fin de semana (implementación defensiva)
 *   - inferencia de widgets: text/textarea/number/select/date/checkbox
 *   - buildOptions y reglas de validación (min/max/minLength/maxLength/pattern/noWeekends)
 *   - parseJsonSchema / parseSchemaToFields: normalización a ParsedFormField[]
 *   - extractDefaultValues: valores por defecto seguros
 *   - validateFieldValue: requerido, longitudes, patrón, rango numérico, LPAG
 *
 * Sin backend. Entregado creado; NO ejecutado (sin node_modules).
 */
import { describe, it, expect } from "vitest";

import type { JsonSchemaDraft2020_12, ParsedFormField } from "../../../src/types/jsonSchema";
import {
  isWeekend,
  parseJsonSchema,
  parseSchemaToFields,
  extractDefaultValues,
  validateFieldValue,
} from "../../../src/utils/schemaFormParser";

describe("schemaFormParser — regresión LPAG y parseo JSON Schema", () => {
  describe("isWeekend", () => {
    it("Sábado/Domingo son considerados fin de semana (regla LPAG)", () => {
      expect(isWeekend("2026-09-12")).toBe(true); // Sáb
      expect(isWeekend("2026-09-13")).toBe(true); // Dom
    });

    it("Lunes–Viernes no son fin de semana", () => {
      expect(isWeekend("2026-09-07")).toBe(false); // Lun
      expect(isWeekend("2026-09-11")).toBe(false); // Vie
    });

    it("parseo defensivo: maneja ISO con hora, formato YYYY-MM-DD y valores inválidos", () => {
      expect(isWeekend("2026-09-12T10:00:00-05:00")).toBe(true);
      expect(isWeekend(" 2026-09-13 ")).toBe(true);
      expect(isWeekend("")).toBe(false);
      expect(isWeekend("no-fecha")).toBe(false);
    });
  });

  describe("parseJsonSchema / parseSchemaToFields", () => {
    const schema: JsonSchemaDraft2020_12 = {
      title: "Formulario TUPA-04",
      type: "object",
      required: ["asunto", "cantidadFolios", "motivoSolicitud", "fechaDocumento", "programaEstudios"],
      properties: {
        asunto: {
          title: "Asunto de la Solicitud",
          description: "Resumen sucinto",
          type: "string",
          minLength: 10,
          maxLength: 100,
        },
        cantidadFolios: {
          title: "Número de Folios Acompañados",
          description: "Cantidad total",
          type: "integer",
          minimum: 1,
          maximum: 100,
          default: 1,
        },
        motivoSolicitud: {
          title: "Motivo y Finalidad del Petitorio",
          description: "Fundamente detalladamente",
          type: "string",
          minLength: 10,
          maxLength: 250,
          widget: "textarea",
        },
        fechaDocumento: {
          title: "Fecha de Emisión del Documento",
          description: "lunes a viernes según LPAG",
          type: "string",
          format: "date",
        },
        programaEstudios: {
          title: "Programa de Estudios",
          description: "Carrera técnica profesional",
          type: "string",
          enum: [
            "Administración de Empresas",
            "Desarrollo de Sistemas de Información",
          ],
        },
      },
    };

    it("transforma esquema a campos parseados con widget, required, placeholders y reglas", () => {
      const fields = parseJsonSchema(schema);
      expect(fields.length).toBe(5);

      const asunto = fields.find((f) => f.name === "asunto");
      expect(asunto).toBeDefined();
      expect(asunto?.required).toBe(true);
      expect(asunto?.widget).toBe("text");
      expect(asunto?.validationRules.minLength).toBe(10);
      expect(asunto?.validationRules.maxLength).toBe(100);
      expect(asunto?.placeholder).toContain("Asunto de la Solicitud");
    });

    it("infiere textarea por widget explícito", () => {
      const fields = parseJsonSchema(schema);
      const motivo = fields.find((f) => f.name === "motivoSolicitud");
      expect(motivo?.widget).toBe("textarea");
      expect(motivo?.validationRules.noWeekends).toBe(false); // widget no es date
    });

    it("infiere number/select/date según tipo, formato y enum", () => {
      const fields = parseJsonSchema(schema);
      const folios = fields.find((f) => f.name === "cantidadFolios");
      expect(folios?.widget).toBe("number");
      expect(folios?.validationRules.min).toBe(1);
      expect(folios?.validationRules.max).toBe(100);
      expect(folios?.defaultValue).toBe(1);

      const programa = fields.find((f) => f.name === "programaEstudios");
      expect(programa?.widget).toBe("select");
      expect(programa?.options?.length).toBe(2);
      expect(programa?.options?.[0].label).toBe("Administración de Empresas");
      expect(programa?.options?.[0].value).toBe("Administración de Empresas");

      const fecha = fields.find((f) => f.name === "fechaDocumento");
      expect(fecha?.widget).toBe("date");
      expect(fecha?.validationRules.noWeekends).toBe(true);
    });

    it("retorna array vacío ante esquema inválido", () => {
      // @ts-expect-error - forzamos estructura inválida intencionalmente
      expect(parseJsonSchema(null)).toEqual([]);
      // @ts-expect-error - sin properties
      expect(parseJsonSchema({ title: "X", type: "object" } as any)).toEqual([]);
    });

    it("parseSchemaToFields es alias de parseJsonSchema", () => {
      expect(parseSchemaToFields(schema)).toEqual(parseJsonSchema(schema));
    });
  });

  describe("extractDefaultValues", () => {
    const schema: JsonSchemaDraft2020_12 = {
      title: "S",
      type: "object",
      properties: {
        flag: { title: "Flag", type: "boolean" },
        entero: { title: "Ent", type: "integer", minimum: 2 },
        numero: { title: "Num", type: "number" },
        texto: { title: "Txt", type: "string" },
        conDefault: { title: "D", type: "string", default: "VAL" },
      },
    };

    it("extrae defaults explícitos y provee sane defaults por tipo", () => {
      const dv = extractDefaultValues(schema);
      expect(dv["conDefault"]).toBe("VAL");
      expect(dv["flag"]).toBe(false);
      expect(dv["entero"]).toBe(2);
      expect(dv["numero"]).toBe("");
      expect(dv["texto"]).toBe("");
    });

    it("retorna objeto vacío ante esquema inválido", () => {
      // @ts-expect-error
      expect(extractDefaultValues(null)).toEqual({});
    });
  });

  describe("validateFieldValue", () => {
    const baseField: ParsedFormField = {
      name: "campo",
      label: "Campo Prueba",
      widget: "text",
      required: true,
      validationRules: { required: true },
      placeholder: "ingrese",
    };

    it("valida obligatoriedad: vacío → mensaje de error", () => {
      const err = validateFieldValue({ ...baseField, required: true }, "");
      expect(err).toMatch(/obligatorio/);
    });

    it("si no requerido y vacío → válido (null)", () => {
      const err = validateFieldValue(
        { ...baseField, required: false, validationRules: { required: false } },
        "",
      );
      expect(err).toBeNull();
    });

    it("valida minLength y maxLength en cadenas", () => {
      const f = {
        ...baseField,
        required: true,
        validationRules: { required: true, minLength: 5, maxLength: 10 },
      };
      expect(validateFieldValue(f, "abc")).toMatch(/al menos 5 caracteres/);
      expect(validateFieldValue(f, "12345678901")).toMatch(/no puede superar los 10 caracteres/);
      expect(validateFieldValue(f, "12345")).toBeNull();
    });

    it("valida patrón (regex)", () => {
      const f = {
        ...baseField,
        validationRules: { required: true, pattern: "^[A-Z]{3}$" },
      };
      expect(validateFieldValue(f, "AB")).toMatch(/no cumple con el patrón/);
      expect(validateFieldValue(f, "ABC")).toBeNull();
    });

    it("valida número: NaN, min, max", () => {
      const f: ParsedFormField = {
        ...baseField,
        widget: "number",
        validationRules: { required: true, min: 1, max: 100 },
      };
      expect(validateFieldValue(f, "abc")).toMatch(/numérico válido/);
      expect(validateFieldValue(f, 0)).toMatch(/mayor o igual a 1/);
      expect(validateFieldValue(f, 101)).toMatch(/mayor a 100/);
      expect(validateFieldValue(f, 50)).toBeNull();
    });

    it("valida fecha con regla LPAG: sábado/domingo → error con referencia a Ley N° 27444", () => {
      const f: ParsedFormField = {
        ...baseField,
        widget: "date",
        validationRules: { required: true, noWeekends: true },
      };
      const errSab = validateFieldValue(f, "2026-09-12"); // Sáb
      expect(errSab).toMatch(/día inhábil|sábado|domingo|Ley N° 27444/);
      const errDom = validateFieldValue(f, "2026-09-13"); // Dom
      expect(errDom).toMatch(/Ley N° 27444/);
      expect(validateFieldValue(f, "2026-09-07")).toBeNull(); // Lun
    });
  });
});
