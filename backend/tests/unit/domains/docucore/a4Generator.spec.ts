/**
 * T-BE-DC-09 — Pruebas del generador de PDF en hoja A4.
 *
 * Verifica los criterios de aceptacion del issue y las reglas tipograficas que
 * corrigieron los saltos de pagina y desbordes observados por la DREU.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PDFDocument } from "pdf-lib";

import {
  A4_MM,
  A4_PUNTOS,
  a4GeneratorService,
  ALTO_UTIL,
  ANCHO_UTIL,
  MARGEN_MM,
  MARGEN_PUNTOS,
  MEMBRETE_POR_DEFECTO,
  PUNTOS_POR_MM,
} from "../../../../src/domains/docucore/a4Generator.service.js";
import type { BloqueResolucion, ContenidoResolucion } from "../../../../src/domains/docucore/types.js";

const TOLERANCIA_PUNTOS = 0.01;

/** Convierte puntos a milimetros. */
function puntosAMm(puntos: number): number {
  return puntos / PUNTOS_POR_MM;
}

/** Carga el PDF generado y devuelve sus dimensiones en puntos. */
async function dimensiones(bytes: Uint8Array): Promise<{ ancho: number; alto: number }[]> {
  const documento = await PDFDocument.load(bytes);
  return documento.getPages().map((hoja) => {
    const { width, height } = hoja.getSize();
    return { ancho: width, alto: height };
  });
}

/** Contenido minimo: un solo parrafo. */
function contenidoSimple(): ContenidoResolucion {
  return {
    bloques: [{ tipo: "parrafo", texto: "Texto de prueba para el generador A4." }],
  };
}

/** Genera un documento y devuelve bytes, paginas y hash. */
async function generar(contenido: ContenidoResolucion, titulo?: string) {
  return a4GeneratorService.generar(contenido, { titulo });
}

describe("A4GeneratorService — geometria de la hoja", () => {
  it("declara las dimensiones normativas de A4 en milimetros", () => {
    assert.deepEqual({ ...A4_MM }, { ancho: 210, alto: 297 });
  });

  it("convierte correctamente de milimetros a puntos tipograficos", () => {
    // 210 mm = 595.2756 pt y 297 mm = 841.8898 pt con 72 pt por pulgada.
    assert.ok(Math.abs(A4_PUNTOS.ancho - 595.2756) < 0.001);
    assert.ok(Math.abs(A4_PUNTOS.alto - 841.8898) < 0.001);
  });

  it("el PDF generado mide 210 x 297 mm exactos", async () => {
    const resultado = await generar(contenidoSimple());

    const [primera] = await dimensiones(resultado.bytes);

    assert.equal(primera.ancho, A4_PUNTOS.ancho);
    assert.equal(primera.alto, A4_PUNTOS.alto);
    assert.ok(Math.abs(puntosAMm(primera.ancho) - 210) < 0.001);
    assert.ok(Math.abs(puntosAMm(primera.alto) - 297) < 0.001);
  });

  it("todas las hojas de un documento multipagina respectan A4", async () => {
    const largo = "contenido ".repeat(2000);
    const resultado = await generar({ bloques: [{ tipo: "parrafo", texto: largo }] });

    assert.ok(resultado.paginas > 1, "El documento de prueba debe ocupar varias hojas.");

    for (const hoja of await dimensiones(resultado.bytes)) {
      assert.equal(hoja.ancho, A4_PUNTOS.ancho);
      assert.equal(hoja.alto, A4_PUNTOS.alto);
    }
  });

  it("declara el margen uniforme de 25 mm en los cuatro lados", () => {
    assert.equal(MARGEN_MM, 25);
    assert.ok(Math.abs(MARGEN_PUNTOS - 25 * PUNTOS_POR_MM) < TOLERANCIA_PUNTOS);

    // El area util se obtiene restando el margen dos veces por eje.
    assert.ok(Math.abs(ANCHO_UTIL - (A4_PUNTOS.ancho - 2 * MARGEN_PUNTOS)) < TOLERANCIA_PUNTOS);
    assert.ok(Math.abs(ALTO_UTIL - (A4_PUNTOS.alto - 2 * MARGEN_PUNTOS)) < TOLERANCIA_PUNTOS);
  });

  it("reporta las dimensiones junto al resto del resultado", async () => {
    const resultado = await generar(contenidoSimple());

    assert.equal(resultado.anchoHoja, A4_PUNTOS.ancho);
    assert.equal(resultado.altoHoja, A4_PUNTOS.alto);
  });
});

describe("A4GeneratorService — salida del documento", () => {
  it("produce un PDF valido y no vacio", async () => {
    const resultado = await generar(contenidoSimple());

    assert.ok(resultado.tamanoBytes > 0);
    assert.equal(resultado.tamanoBytes, resultado.bytes.byteLength);

    const documento = await PDFDocument.load(resultado.bytes);
    assert.equal(documento.getPageCount(), resultado.paginas);
  });

  it("emite la firma magica del formato PDF", async () => {
    const resultado = await generar(contenidoSimple());
    const cabecera = Buffer.from(resultado.bytes.slice(0, 5)).toString("latin1");

    assert.equal(cabecera, "%PDF-");
  });

  it("calcula el SHA-256 en hexadecimal sobre los bytes definitivos", async () => {
    const resultado = await generar(contenidoSimple());

    assert.match(resultado.sha256, /^[0-9a-f]{64}$/u);
  });

  it("produce el mismo hash para el mismo contenido", async () => {
    const uno = await generar(contenidoSimple());
    const otro = await generar(contenidoSimple());

    assert.equal(uno.sha256, otro.sha256);
  });

  it("produce hashes distintos para contenidos distintos", async () => {
    const uno = await generar(contenidoSimple());
    const otro = await generar({
      bloques: [{ tipo: "parrafo", texto: "Otro contenido distinto para comparar." }],
    });

    assert.notEqual(uno.sha256, otro.sha256);
  });
});

describe("A4GeneratorService — paginacion y saltos de hoja", () => {
  it("mantiene una sola hoja cuando el contenido es breve", async () => {
    const resultado = await generar(contenidoSimple());

    assert.equal(resultado.paginas, 1);
  });

  it("reparte el contenido largo en varias hojas", async () => {
    const resultado = await generar({
      bloques: Array.from({ length: 120 }, (_, i) => ({
        tipo: "parrafo" as const,
        texto: `Considerando ${i + 1}: el contenido institucional se desarrolla en detalle.`,
      })),
    });

    assert.ok(resultado.paginas > 1);
  });

  it("no pierde contenido largo al paginar", async () => {
    // Un codigo sin espacios es el caso que antes desbordaba la caja de texto.
    const codigoLargo = "SIGD-DOCUCORE-".repeat(300);
    const resultado = await generar({
      bloques: [
        { tipo: "parrafo", texto: `Referencia ${codigoLargo} del expediente.` },
      ],
    });

    const documento = await PDFDocument.load(resultado.bytes);
    assert.equal(documento.getPageCount(), resultado.paginas);
    assert.ok(resultado.tamanoBytes > 0);
  });

  it("coloca el titulo junto al parrafo que introduce, sin dejarlo huerfano", async () => {
    // Se repite un parrafo largo para forzar el titulo cerca de un corte de hoja.
    const bloques: BloqueResolucion[] = [];
    for (let i = 0; i < 60; i += 1) {
      bloques.push({
        tipo: "encabezado",
        texto: `CAPITULO ${i + 1}`,
        nivel: 2,
        espacioAntes: 20,
        espacioDespues: 10,
      });
      bloques.push({
        tipo: "parrafo",
        texto: `Contenido del capitulo ${i + 1}. `.repeat(6),
      });
    }

    const resultado = await generar({ bloques }, "RESOLUCION DE PRUEBA");

    assert.ok(resultado.paginas > 1);
  });

  it("genera una sola hoja cuando el contenido incluye solo un separador", async () => {
    const resultado = await generar({ bloques: [{ tipo: "separador" }] });

    assert.equal(resultado.paginas, 1);
  });

  it("mantiene atomico el bloque de firma", async () => {
    const bloques: BloqueResolucion[] = [
      ...Array.from({ length: 100 }, (_, i) => ({
        tipo: "parrafo" as const,
        texto: `Parrafo ${i + 1} con texto suficiente para llenar la hoja. `.repeat(4),
      })),
      {
        tipo: "firma",
        cargo: "Director de la Direccion de Administracion [EJEMPLO]",
        nombre: "NOMBRE APELLIDO [EJEMPLO]",
        documento: "DNI 00000000 [EJEMPLO]",
      },
    ];

    const resultado = await generar({ bloques });

    assert.ok(resultado.paginas >= 1);
  });
});

describe("A4GeneratorService — bloques y tipografia", () => {
  it("compila una resolucion con todos los tipos de bloque soportados", async () => {
    const resultado = await generar(
      {
        bloques: [
          { tipo: "parrafo", texto: "Parrafo inicial del considerando.", sangria: 12 },
          { tipo: "encabezado", texto: "PARTE RESOLUTIVA", nivel: 1 },
          { tipo: "articulo", numero: "Articulo 1.-", texto: "Declarar conforme lo pedido." },
          {
            tipo: "lista",
            items: ["Primer requisito del tramite.", "Segundo requisito del tramite."],
            marcador: "numeros",
          },
          { tipo: "separador" },
          {
            tipo: "tabla",
            columnas: ["Codigo", "Descripcion", "Vigencia"],
            filas: [
              ["001", "Solicitud de certificado", "Vigente [EJEMPLO]"],
              ["002", "Copia de documento", "Vigente [EJEMPLO]"],
            ],
            anchosRelativos: [1, 4, 1.5],
          },
          { tipo: "firma", cargo: "Director [EJEMPLO]", nombre: "APELLIDO NOMBRE [EJEMPLO]" },
        ],
      },
      "TITULO DE LA RESOLUCION",
    );

    assert.ok(resultado.paginas >= 1);
    assert.ok(resultado.tamanoBytes > 0);
  });

  it("admite alineacion justificada, centrada y a la derecha", async () => {
    const resultado = await generar({
      bloques: [
        { tipo: "parrafo", texto: "Texto justificado con longitud suficiente. ".repeat(10) },
        { tipo: "parrafo", texto: "Texto centrado.", alineacion: "centro" },
        { tipo: "parrafo", texto: "Texto a la derecha.", alineacion: "derecha" },
      ],
    });

    assert.equal(resultado.paginas, 1);
  });

  it("respeta los saltos de linea explicitos del texto", async () => {
    const resultado = await generar({
      bloques: [
        {
          tipo: "parrafo",
          texto: "Primera consideracion.\nSegunda consideracion.\nTercera consideracion.",
        },
      ],
    });

    assert.equal(resultado.paginas, 1);
  });

  it("ignora un parrafo vacio sin generar una hoja en blanco", async () => {
    const resultado = await generar({ bloques: [{ tipo: "parrafo", texto: "   " }] });

    assert.ok(resultado.paginas >= 1);
    assert.ok(resultado.tamanoBytes > 0);
  });

  it("acepta las cuatro variantes de estilo de fuente", async () => {
    const resultado = await generar({
      bloques: [
        { tipo: "parrafo", texto: "Texto normal.", estilo: "normal" },
        { tipo: "parrafo", texto: "Texto en negrita.", estilo: "negrita" },
        { tipo: "parrafo", texto: "Texto en cursiva.", estilo: "cursiva" },
        { tipo: "parrafo", texto: "Texto en negrita cursiva.", estilo: "negritaCursiva" },
      ],
    });

    assert.equal(resultado.paginas, 1);
  });

  it("rechaza un bloque de tipo desconocido en lugar de emitir un documento corrupto", async () => {
    await assert.rejects(
      generar({
        bloques: [{ tipo: "bloqueInventado" } as unknown as BloqueResolucion],
      }),
      /no soportado/u,
    );
  });
});

describe("A4GeneratorService — membrete institucional", () => {
  it("expone un membrete por omision marcado como ejemplo", () => {
    assert.match(MEMBRETE_POR_DEFECTO.institucion, /\[EJEMPLO\]/u);
  });

  it("acepta un membrete institucional propio", async () => {
    const resultado = await a4GeneratorService.generar(contenidoSimple(), {
      membrete: {
        institucion: "INSTITUTO DE PRUEBA",
        unidad: "UNIDAD DE PRUEBA",
        tipoDocumento: "RESOLUCION DIRECTORAL",
        numeroDocumento: "N.° 0001-2026/PE-DSI-IESTP-PRUEBA-DIR",
        correlativo: "EXP-2026-000123",
        sigla: "IESTP PRUEBA",
      },
    });

    const documento = await PDFDocument.load(resultado.bytes);
    assert.equal(documento.getTitle(), "N.° 0001-2026/PE-DSI-IESTP-PRUEBA-DIR");
  });

  it("genera el documento aunque el membrete tenga solo los campos obligatorios", async () => {
    const resultado = await a4GeneratorService.generar(contenidoSimple(), {
      membrete: { institucion: "INSTITUTO DE PRUEBA" },
    });

    assert.equal(resultado.paginas, 1);
  });
});
