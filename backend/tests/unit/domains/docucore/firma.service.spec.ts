/**
 * Pruebas de integracion del endpoint #35.
 *
 * Comprueba el recorrido completo: generacion del PDF A4, emision del token de
 * sesion, construccion de la URI `refirma://`, consumo atomico en el callback y
 * vigencia de la URL temporal de descarga.
 */

import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { InMemoryAlmacenDocumentosFirmables } from "../../../../src/domains/docucore/documentoFirmable.store.js";
import { ErrorFirma } from "../../../../src/domains/docucore/firma.errors.js";
import { ServicioFirmaService } from "../../../../src/domains/docucore/firma.service.js";
import { InMemoryFirmaSessionStore } from "../../../../src/domains/docucore/firmaSession.store.js";
import { RefirmaGatewayService } from "../../../../src/domains/docucore/refirmaGateway.service.js";
import type { ContenidoResolucion } from "../../../../src/domains/docucore/types.js";

const HOST = "https://sigd.iestp-suiza.edu.pe";

const CONTENIDO: ContenidoResolucion = {
  bloques: [
    { tipo: "parrafo", texto: "Considerando que el presente expediente cumple los requisitos." },
    { tipo: "articulo", numero: "Articulo 1.-", texto: "Declarar conforme lo solicitado." },
    { tipo: "firma", cargo: "Director [EJEMPLO]", nombre: "APELLIDO NOMBRE [EJEMPLO]" },
  ],
};

/** Arma el servicio con almacen y sesiones en memoria. */
function crearServicio(reloj: () => number = Date.now) {
  const sesiones = new InMemoryFirmaSessionStore(reloj);
  const almacen = new InMemoryAlmacenDocumentosFirmables(sesiones);
  const pasarela = new RefirmaGatewayService({
    hostsPermitidos: ["sigd.iestp-suiza.edu.pe"],
    exigirHttps: true,
  });
  const servicio = new ServicioFirmaService({ sesiones, almacen, pasarela });

  return { servicio, sesiones, almacen, pasarela };
}

/** Solicitud valida con datos ficticios. */
function solicitud(extra: Record<string, unknown> = {}) {
  return {
    contenido: CONTENIDO,
    firmante: { id: "usr_001", nombre: "NOMBRE [EJEMPLO]", documento: "00000000" },
    hostPublico: HOST,
    ...extra,
  };
}

describe("ServicioFirmaService — invocacion (#35)", () => {
  it("devuelve token, URI protocolar y URL temporal de descarga", async () => {
    const { servicio } = crearServicio();

    const resultado = await servicio.invocarRefirma(solicitud());

    assert.ok(resultado.token.length > 0);
    assert.match(
      resultado.uriProtocolar,
      /^refirma:\/\/sign\?arguments=\[[A-Za-z0-9_-]+\]$/u,
    );
    assert.match(resultado.urlDocumento, /^https:\/\/sigd\.iestp-suiza\.edu\.pe\/api\/v1\/firma\//u);
  });

  it("expone el hash SHA-256 del PDF generado", async () => {
    const { servicio } = crearServicio();

    const resultado = await servicio.invocarRefirma(solicitud());

    assert.match(resultado.hashDocumento, /^[0-9a-f]{64}$/u);
  });

  it("declara una vigencia de 300 segundos", async () => {
    const { servicio } = crearServicio();

    const resultado = await servicio.invocarRefirma(solicitud());

    assert.equal(resultado.ttlSegundos, 300);

    const diferencia = Date.parse(resultado.expiraEn) - Date.now();
    assert.ok(diferencia > 295_000 && diferencia <= 300_000, `Diferencia: ${diferencia} ms`);
  });

  it("el payload de la URI transporta los cuatro parametros exigidos", async () => {
    const { servicio, pasarela } = crearServicio();

    const resultado = await servicio.invocarRefirma(solicitud());
    const payload = pasarela.extraerDeUri(resultado.uriProtocolar);

    assert.deepEqual(Object.keys(payload).sort(), [
      "hashDocumento",
      "idSesion",
      "urlCallback",
      "urlDocumento",
    ]);
    assert.equal(payload.hashDocumento, resultado.hashDocumento);
    assert.equal(payload.idSesion, resultado.sesionId);
    assert.equal(payload.urlDocumento, resultado.urlDocumento);
  });

  it("el hash del payload coincide con el del PDF realmente generado", async () => {
    const { servicio, pasarela } = crearServicio();

    const resultado = await servicio.invocarRefirma(solicitud());
    const documento = await servicio.descargarDocumento(resultado.urlDocumento.split("/").pop()?.split("?")[0] ?? "", resultado.token);
    const payload = pasarela.extraerDeUri(resultado.uriProtocolar);

    assert.notEqual(documento, null);
    assert.equal(resultado.hashDocumento, payload.hashDocumento);
  });

  it("la URL de callback apunta a la ruta versionada de la API", async () => {
    const { servicio, pasarela } = crearServicio();

    const resultado = await servicio.invocarRefirma(solicitud());
    const payload = pasarela.extraerDeUri(resultado.uriProtocolar);

    assert.equal(
      payload.urlCallback,
      `${HOST}/api/v1/firma/callback-refirma/${resultado.sesionId}`,
    );
  });

  it("el identificador de sesion no es el token en claro", async () => {
    const { servicio } = crearServicio();

    const resultado = await servicio.invocarRefirma(solicitud());

    assert.notEqual(resultado.sesionId, resultado.token);
    assert.ok(!resultado.sesionId.includes(resultado.token));
    assert.match(resultado.sesionId, /^ses_[0-9a-f]{32}$/u);
  });

  it("genera tokens distintos en invocaciones sucesivas", async () => {
    const { servicio } = crearServicio();

    const uno = await servicio.invocarRefirma(solicitud());
    const otro = await servicio.invocarRefirma(solicitud());

    assert.notEqual(uno.token, otro.token);
    assert.notEqual(uno.sesionId, otro.sesionId);
  });
});

describe("ServicioFirmaService — validacion de la solicitud", () => {
  it("rechaza una peticion sin firmante", async () => {
    const { servicio } = crearServicio();
    const peticion = solicitud();
    delete (peticion as Record<string, unknown>)["firmante"];

    await assert.rejects(servicio.invocarRefirma(peticion as never), (error: unknown) => {
      assert.ok(error instanceof ErrorFirma);
      assert.ok(error.detalles.some((detalle) => detalle.campo === "firmante"));
      return true;
    });
  });

  it("rechaza una peticion sin documento ni contenido", async () => {
    const { servicio } = crearServicio();
    const peticion = solicitud();
    delete (peticion as Record<string, unknown>)["contenido"];

    await assert.rejects(servicio.invocarRefirma(peticion as never), (error: unknown) => {
      assert.ok(error instanceof ErrorFirma);
      const campos = error.detalles.map((detalle) => detalle.campo);
      assert.ok(campos.includes("documentoId"));
      return true;
    });
  });

  it("rechaza enviar contenido y documentoId a la vez", async () => {
    const { servicio } = crearServicio();

    await assert.rejects(
      servicio.invocarRefirma(solicitud({ documentoId: "doc_001" })),
      (error: unknown) => {
        assert.ok(error instanceof ErrorFirma);
        const problemas = error.detalles.map((detalle) => detalle.problema).join(" | ");
        assert.match(problemas, /No se puede enviar contenido y documentoId/u);
        return true;
      },
    );
  });

  it("rechaza un contenido sin bloques", async () => {
    const { servicio } = crearServicio();

    await assert.rejects(
      servicio.invocarRefirma(solicitud({ contenido: { bloques: [] } })),
      (error: unknown) => {
        assert.ok(error instanceof ErrorFirma);
        const campos = error.detalles.map((detalle) => detalle.campo);
        assert.ok(campos.includes("contenido.bloques"));
        return true;
      },
    );
  });

  it("rechaza un host publico ausente o invalido", async () => {
    const { servicio } = crearServicio();

    for (const hostPublico of ["", "no-es-una-url"]) {
      await assert.rejects(
        servicio.invocarRefirma(solicitud({ hostPublico })),
        (error: unknown) => {
          assert.ok(error instanceof ErrorFirma);
          assert.ok(
            error.detalles.some((detalle) => detalle.campo === "hostPublico"),
            `Debe reportar el campo hostPublico para "${hostPublico}".`,
          );
          return true;
        },
      );
    }
  });

  it("acumera todos los errores de validacion en una sola respuesta", async () => {
    const { servicio } = crearServicio();

    try {
      await servicio.invocarRefirma({ contenido: CONTENIDO, hostPublico: "" } as never);
      assert.fail("Se esperaba un error de validacion.");
    } catch (error) {
      assert.ok(error instanceof ErrorFirma);
      const campos = error.detalles.map((detalle) => detalle.campo);
      assert.ok(campos.includes("firmante"));
      assert.ok(campos.includes("hostPublico"));
    }
  });
});

describe("ServicioFirmaService — descarga temporal", () => {
  it("entrega el PDF a quien presenta el token vigente", async () => {
    const { servicio } = crearServicio();

    const resultado = await servicio.invocarRefirma(solicitud());
    const documentoId = resultado.urlDocumento.split("/").pop()?.split("?")[0] ?? "";

    const documento = await servicio.descargarDocumento(documentoId, resultado.token);

    assert.notEqual(documento, null);
    assert.equal(documento?.mimeType, "application/pdf");
    assert.ok((documento?.bytes.byteLength ?? 0) > 0);
    assert.ok((documento?.nombreArchivo ?? "").endsWith(".pdf"));
  });

  it("rechaza la descarga con un token ajeno", async () => {
    const { servicio } = crearServicio();

    const resultado = await servicio.invocarRefirma(solicitud());
    const documentoId = resultado.urlDocumento.split("/").pop()?.split("?")[0] ?? "";

    assert.equal(await servicio.descargarDocumento(documentoId, "token-falso"), null);
  });

  it("la URL expira con la sesion tras los 300 segundos", async () => {
    let ahora = 1_000_000;
    const { servicio } = crearServicio(() => ahora);

    const resultado = await servicio.invocarRefirma(solicitud());
    const documentoId = resultado.urlDocumento.split("/").pop()?.split("?")[0] ?? "";

    ahora += 301_000;

    assert.equal(await servicio.descargarDocumento(documentoId, resultado.token), null);
  });
});

describe("ServicioFirmaService — callback y consumo atomico", () => {
  it("acepta el callback y destruye la sesion", async () => {
    const { servicio, sesiones } = crearServicio();

    const resultado = await servicio.invocarRefirma(solicitud());

    const callback = await servicio.recibirCallback(
      resultado.token,
      resultado.sesionId,
      "a".repeat(64),
    );

    assert.equal(callback.sesionId, resultado.sesionId);
    assert.equal(callback.hashOrigen, resultado.hashDocumento);
    assert.equal(callback.documentoModificado, true);
    assert.equal(await sesiones.existe(resultado.token), false);
  });

  it("rechaza el segundo callback con el mismo token", async () => {
    const { servicio } = crearServicio();

    const resultado = await servicio.invocarRefirma(solicitud());
    await servicio.recibirCallback(resultado.token, resultado.sesionId, "a".repeat(64));

    await assert.rejects(
      servicio.recibirCallback(resultado.token, resultado.sesionId, "a".repeat(64)),
      /no es valida, ya fue consumida/u,
    );
  });

  it("rechaza un callback con hash mal formado", async () => {
    const { servicio } = crearServicio();

    const resultado = await servicio.invocarRefirma(solicitud());

    await assert.rejects(
      servicio.recibirCallback(resultado.token, resultado.sesionId, "hash-invalido"),
      (error: unknown) => {
        assert.ok(error instanceof ErrorFirma);
        assert.equal(error.codigo, "ERR-FIR-422");
        assert.deepEqual(
          error.detalles.map((detalle) => detalle.campo),
          ["hashDocumento"],
        );
        return true;
      },
    );
  });

  it("rechaza un callback cuyo token no corresponde a la sesion indicada", async () => {
    const { servicio } = crearServicio();

    const resultado = await servicio.invocarRefirma(solicitud());

    await assert.rejects(
      servicio.recibirCallback(resultado.token, "ses_9999999999999999", "a".repeat(64)),
      /no es valida/u,
    );
  });

  it("rechaza el callback una vez expirada la sesion", async () => {
    let ahora = 0;
    const { servicio } = crearServicio(() => ahora);

    const resultado = await servicio.invocarRefirma(solicitud());
    ahora += 301_000;

    await assert.rejects(
      servicio.recibirCallback(resultado.token, resultado.sesionId, "a".repeat(64)),
      /expiro/u,
    );
  });

  it("rechaza un token nunca emitido", async () => {
    const { servicio } = crearServicio();

    await assert.rejects(
      servicio.recibirCallback("token-inventado", "ses_0123456789abcdef", "a".repeat(64)),
      /no es valida/u,
    );
  });
});

describe("ServicioFirmaService — reutilizacion de documentos", () => {
  it("recupera un documento previamente generado", async () => {
    const { servicio, almacen } = crearServicio();

    await almacen.guardar({
      id: "doc_existente",
      nombreArchivo: "resolucion.pdf",
      mimeType: "application/pdf",
      bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      sha256: "b".repeat(64),
    });

    const resultado = await servicio.invocarRefirma({
      documentoId: "doc_existente",
      firmante: { id: "usr_002", nombre: "OTRO [EJEMPLO]", documento: "00000001" },
      hostPublico: HOST,
    });

    assert.equal(resultado.hashDocumento, "b".repeat(64));
    assert.match(resultado.urlDocumento, /doc_existente/u);
  });

  it("falla cuando el documento solicitado no existe", async () => {
    const { servicio } = crearServicio();

    await assert.rejects(
      servicio.invocarRefirma({
        documentoId: "doc_inexistente",
        firmante: { id: "usr_003", nombre: "TERCERO [EJEMPLO]", documento: "00000002" },
        hostPublico: HOST,
      }),
      (error: unknown) => {
        assert.ok(error instanceof ErrorFirma);
        const campos = error.detalles.map((detalle) => detalle.campo);
        assert.deepEqual(campos, ["documentoId"]);
        assert.match(error.detalles[0]?.problema ?? "", /almacen temporal/u);
        return true;
      },
    );
  });
});
