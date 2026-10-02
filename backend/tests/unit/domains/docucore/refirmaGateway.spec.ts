/**
 * Comprobacion de compatibilidad del agente de escritorio Refirma de RENIEC.
 *
 * Problema que resuelve (T-BE-DC-12): faltaba verificacion de la codificacion
 * Base64URL y de los caracteres especiales en los parametros de la invocacion,
 * por lo que un fallo de codificacion solo se manifestaba como un error en la
 * computadora del director, sin posibilidad de diagnostico desde el backend.
 *
 * Reglas que se comprueban:
 *   1. La URI respeta la forma `refirma://sign?arguments=[<Base64URL>]`.
 *   2. El payload decodificado contiene exactamente los cuatro parametros
 *      exigidos por la pasarela, ni mas ni menos.
 *   3. El contenido transportado sobrevive al viaje intacto: acentos, signos,
 *      ampersands, signos igual y saltos de linea de las URL sobreviven al
 *      Base64URL sin percent-encoding adicional.
 *   4. El Base64URL usa el alfabeto URL-safe sin relleno `=`.
 *   5. El hash es SHA-256 de 64 hexadecimales y el identificador de sesion
 *      cumple el alfabeto exigido.
 *   6. Las URLs exigidas son HTTPS y pertenecen a la lista blanca de hosts.
 */

import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  CLAVES_PAYLOAD,
  esHashSha256,
  esIdSesionValido,
  RefirmaGatewayService,
  type PayloadRefirma,
} from "../../../../src/domains/docucore/refirmaGateway.service.js";

const HOST_PERMITIDO = "sigd.iestp-suiza.edu.pe";
const HOST_PERMITIDO_ALT = "docs.iestp-suiza.edu.pe";

const pasarela = new RefirmaGatewayService({
  hostsPermitidos: [HOST_PERMITIDO, HOST_PERMITIDO_ALT],
  exigirHttps: true,
});

/** Hash SHA-256 valido, calculado sobre un contenido ficticio. */
const HASH_VALIDO = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

function payloadValido(overrides: Partial<PayloadRefirma> = {}): PayloadRefirma {
  return {
    urlDocumento: `https://${HOST_PERMITIDO}/api/v1/firma/documento/doc_001?token=abc123`,
    hashDocumento: HASH_VALIDO,
    idSesion: "ses_0123456789abcdef0123456789abcdef",
    urlCallback: `https://${HOST_PERMITIDO}/api/v1/firma/callback-refirma/ses_0123456789abcdef0123456789abcdef`,
    ...overrides,
  };
}

/** Decodifica el payload sin validarlo, para inspeccionar los bytes crudos. */
function decodificarCrudo(codificado: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(codificado, "base64url").toString("utf8")) as Record<
    string,
    unknown
  >;
}

describe("RefirmaGatewayService — forma de la URI protocolar", () => {
  it("arma refirma://sign?arguments=[...] con el payload en Base64URL", () => {
    const invocacion = pasarela.generarInvocacion(payloadValido());

    assert.match(invocacion.uriProtocolar, /^refirma:\/\/sign\?arguments=\[[A-Za-z0-9_-]+\]$/u);
  });

  it("el payload no requiere percent-encoding dentro de la query", () => {
    const invocacion = pasarela.generarInvocacion(payloadValido());

    // El resto de la URI (esquema, separadores y corchetes) si lleva caracteres
    // reservados, pero el payload es lo unico que viaja como dato y debe quedar
    // intacto sin escapes: de ahi que se use Base64URL.
    assert.equal(
      encodeURIComponent(invocacion.parametrosCodificados),
      invocacion.parametrosCodificados,
    );
  });

  it("usa el alfabeto Base64URL y omite el relleno", () => {
    const invocacion = pasarela.generarInvocacion(payloadValido());

    assert.match(invocacion.parametrosCodificados, /^[A-Za-z0-9_-]+$/u);
    assert.ok(!invocacion.parametrosCodificados.includes("="));
    assert.ok(!invocacion.parametrosCodificados.includes("+"));
    assert.ok(!invocacion.parametrosCodificados.includes("/"));
  });

  it("conserva el envoltorio en corchetes especificado en la URI", () => {
    const invocacion = pasarela.generarInvocacion(payloadValido());

    const prefijo = "refirma://sign?arguments=[";
    assert.ok(invocacion.uriProtocolar.startsWith(prefijo));
    assert.ok(invocacion.uriProtocolar.endsWith("]"));
  });

  it("extrae de la URI el mismo payload que se inyecto", () => {
    const entrada = payloadValido();
    const invocacion = pasarela.generarInvocacion(entrada);

    assert.deepEqual(pasarela.extraerDeUri(invocacion.uriProtocolar), entrada);
  });
});

describe("RefirmaGatewayService — conjunto exacto de parametros", () => {
  it("transporta exactamente los cuatro parametros exigidos", () => {
    const invocacion = pasarela.generarInvocacion(payloadValido());
    const decodificado = decodificarCrudo(invocacion.parametrosCodificados);

    assert.deepEqual(Object.keys(decodificado).sort(), [...CLAVES_PAYLOAD].sort());
    assert.equal(Object.keys(decodificado).length, 4);
  });

  it("los cuatro parametros son los requeridos por la pasarela", () => {
    assert.deepEqual(
      [...CLAVES_PAYLOAD],
      ["urlDocumento", "hashDocumento", "idSesion", "urlCallback"],
    );
  });

  it("rechaza un payload al que le falta un parametro obligatorio", () => {
    const entrada = payloadValido();
    const incompleto: Record<string, unknown> = { ...entrada };
    delete incompleto["urlCallback"];

    const codificado = Buffer.from(JSON.stringify(incompleto), "utf8").toString("base64url");

    assert.throws(
      () => pasarela.decodificar(codificado),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal((error as { codigo?: string }).codigo, "ERR-FIR-422");
        assert.match(error.message, /urlCallback/u);
        return true;
      },
    );
  });

  it("rechaza un payload con un parametro no contemplado en el protocolo", () => {
    const codificado = Buffer.from(
      JSON.stringify({ ...payloadValido(), campoInesperado: "x" }),
      "utf8",
    ).toString("base64url");

    try {
      pasarela.decodificar(codificado);
      assert.fail("Se esperaba un error por parametro no contemplado.");
    } catch (error) {
      assert.ok(error instanceof Error);
      const detalles = (error as { detalles?: { problema: string }[] }).detalles ?? [];
      assert.ok(
        detalles.some((detalle) => detalle.problema.includes("campoInesperado")),
        "El detalle debe nombrar el parametro sobrante.",
      );
    }
  });

  it("rechaza un payload que no es un objeto JSON", () => {
    const codificado = Buffer.from(JSON.stringify(["no", "es", "objeto"]), "utf8").toString(
      "base64url",
    );

    assert.throws(() => pasarela.decodificar(codificado), /arguments/u);
  });

  it("rechaza un valor que no es JSON valido", () => {
    const codificado = Buffer.from("{esto-no-es-json", "utf8").toString("base64url");

    assert.throws(() => pasarela.decodificar(codificado), /arguments/u);
  });
});

describe("RefirmaGatewayService — caracteres especiales y codificacion", () => {
  it("conserva acentos y enye en el documento a firmar", () => {
    const entrada = payloadValido({
      urlDocumento:
        "https://sigd.iestp-suiza.edu.pe/documentos/Resoluci%C3%B3n%20Directoral%20N%C2%BA%20001.pdf?token=abc",
    });

    const recuperado = pasarela.extraerDeUri(pasarela.generarInvocacion(entrada).uriProtocolar);

    assert.equal(recuperado.urlDocumento, entrada.urlDocumento);
  });

  it("sobrevive a una URL con ampersand, interrogacion y hash", () => {
    const entrada = payloadValido({
      urlDocumento:
        "https://sigd.iestp-suiza.edu.pe/descarga?token=a&firmante=1&modo=2#seccion",
    });

    const recuperado = pasarela.extraerDeUri(pasarela.generarInvocacion(entrada).uriProtocolar);

    assert.equal(recuperado.urlDocumento, entrada.urlDocumento);
  });

  it("usa el alfabeto URL-safe donde Base64 estandar produciria mas y barra", () => {
    // Bytes que en Base64 estandar generan `+` y `/`,符号 prohibidos en una query.
    const bytes = Buffer.from([0xfb, 0xff, 0xbe, 0xff, 0xfb, 0xff]);
    const codificadoEstandar = bytes.toString("base64");

    assert.ok(codificadoEstandar.includes("+"));
    assert.ok(codificadoEstandar.includes("/"));

    // Ambos alfabetos decodifican al mismo contenido.
    assert.deepEqual(Buffer.from(bytes.toString("base64url"), "base64url"), bytes);

    const codificado = pasarela.generarInvocacion(payloadValido()).parametrosCodificados;
    assert.match(codificado, /^[A-Za-z0-9_-]+$/u);
    assert.ok(!codificado.includes("+"));
    assert.ok(!codificado.includes("/"));
    assert.ok(!codificado.includes("="));
  });

  it("rechaza una URL relativa que el agente de escritorio no podria resolver", () => {
    assert.throws(
      () => pasarela.generarInvocacion(payloadValido({ urlDocumento: "/descargar/documento.pdf" })),
      /urlDocumento/u,
    );
  });

  it("rechaza un esquema distinto de http o https", () => {
    try {
      pasarela.generarInvocacion(
        payloadValido({ urlCallback: "ftp://sigd.iestp-suiza.edu.pe/callback" }),
      );
      assert.fail("Se esperaba un error por esquema no admitido.");
    } catch (error) {
      assert.ok(error instanceof Error);
      const detalles = (error as { detalles?: { campo: string; problema: string }[] }).detalles ?? [];
      const detalle = detalles.find((item) => item.campo === "urlCallback");
      assert.ok(detalle !== undefined);
      assert.match(detalle.problema, /Esquema no admitido/u);
    }
  });
});

describe("RefirmaGatewayService — reglas de seguridad del payload", () => {
  it("exige HTTPS en la URL del documento y en la de callback", () => {
    try {
      pasarela.generarInvocacion(
        payloadValido({
          urlDocumento: `http://${HOST_PERMITIDO}/api/v1/firma/documento/doc_001`,
        }),
      );
      assert.fail("Se esperaba un error por esquema HTTP en claro.");
    } catch (error) {
      assert.ok(error instanceof Error);
      const detalles = (error as { detalles?: { campo: string; problema: string }[] }).detalles ?? [];
      const detalle = detalles.find((item) => item.campo === "urlDocumento");
      assert.ok(detalle !== undefined);
      assert.match(detalle.problema, /Se exige HTTPS/u);
    }
  });

  it("permite HTTP solo si se desactiva la exigencia, y aun asi exige lista blanca", () => {
    const laxo = new RefirmaGatewayService({
      hostsPermitidos: [HOST_PERMITIDO],
      exigirHttps: false,
    });

    const invocacion = laxo.generarInvocacion(
      payloadValido({
        urlDocumento: `http://${HOST_PERMITIDO}/api/v1/firma/documento/doc_001`,
      }),
    );

    assert.match(invocacion.uriProtocolar, /^refirma:\/\/sign\?arguments=\[/u);

    assert.throws(
      () =>
        laxo.generarInvocacion(
          payloadValido({ urlCallback: "http://atacante.example.com/callback" }),
        ),
      /urlCallback/u,
    );
  });

  it("rechaza un host fuera de la lista blanca", () => {
    try {
      pasarela.generarInvocacion(
        payloadValido({ urlCallback: "https://atacante.example.com/robo-de-sesion" }),
      );
      assert.fail("Se esperaba un error por host no permitido.");
    } catch (error) {
      assert.ok(error instanceof Error);
      const detalles = (error as { detalles?: { campo: string; problema: string }[] }).detalles ?? [];
      const detalle = detalles.find((item) => item.campo === "urlCallback");
      assert.ok(detalle !== undefined);
      assert.match(detalle.problema, /lista blanca/u);
      assert.match(detalle.problema, /atacante\.example\.com/u);
    }
  });

  it("rechaza un hash que no sea SHA-256 en hexadecimal", () => {
    assert.throws(
      () => pasarela.generarInvocacion(payloadValido({ hashDocumento: "no-es-un-hash" })),
      /hashDocumento/u,
    );
  });

  it("explica en el detalle que el hash canonico va en minusculas", () => {
    try {
      pasarela.generarInvocacion(payloadValido({ hashDocumento: HASH_VALIDO.toUpperCase() }));
      assert.fail("Se esperaba un error de validacion del hash.");
    } catch (error) {
      assert.ok(error instanceof Error);
      const detalles = (error as { detalles?: { campo: string; problema: string }[] }).detalles ?? [];
      const detalle = detalles.find((item) => item.campo === "hashDocumento");
      assert.ok(detalle !== undefined);
      assert.match(detalle.problema, /64 caracteres hexadecimales/u);
    }
  });

  it("rechaza un identificador de sesion con caracteres fuera del alfabeto", () => {
    try {
      pasarela.generarInvocacion(payloadValido({ idSesion: "sesion con espacios y acentos" }));
      assert.fail("Se esperaba un error de validacion del identificador de sesion.");
    } catch (error) {
      assert.ok(error instanceof Error);
      const detalles = (error as { detalles?: { campo: string; problema: string }[] }).detalles ?? [];
      const detalle = detalles.find((item) => item.campo === "idSesion");
      assert.ok(detalle !== undefined);
      assert.match(detalle.problema, /Base64URL/u);
    }
  });

  it("rechaza un identificador de sesion demasiado corto", () => {
    assert.throws(
      () => pasarela.generarInvocacion(payloadValido({ idSesion: "corto" })),
      /idSesion/u,
    );
  });

  it("acumula todos los incumplimientos en un solo error", () => {
    try {
      pasarela.generarInvocacion({
        urlDocumento: "http://atacante.example.com/x.pdf",
        hashDocumento: "corto",
        idSesion: "corto",
        urlCallback: "no-es-una-url",
      });
      assert.fail("Se esperaba un error de validacion del payload.");
    } catch (error) {
      assert.ok(error instanceof Error);
      const detalles = (error as { detalles?: { campo: string }[] }).detalles ?? [];
      const campos = detalles.map((detalle) => detalle.campo).sort();

      assert.deepEqual(campos, ["hashDocumento", "idSesion", "urlCallback", "urlDocumento"]);
    }
  });
});

describe("RefirmaGatewayService — validaciones auxiliares", () => {
  it("identifica hashes SHA-256 validos e invalidos", () => {
    assert.equal(esHashSha256(HASH_VALIDO), true);
    assert.equal(esHashSha256(HASH_VALIDO.toUpperCase()), false);
    assert.equal(esHashSha256(`${HASH_VALIDO}00`), false);
    assert.equal(esHashSha256(""), false);
  });

  it("identifica identificadores de sesion validos e invalidos", () => {
    assert.equal(esIdSesionValido("ses_0123456789abcdef0123456789abcdef"), true);
    assert.equal(esIdSesionValido("abcdefghijklmnop"), true);
    assert.equal(esIdSesionValido("corto"), false);
    assert.equal(esIdSesionValido("sesion/con/barras"), false);
  });

  it("rechaza una URI con otro esquema, accion o nombre de parametro", () => {
    const inicioEsperado = /debe comenzar con refirma:\/\/sign\?arguments=/u;

    assert.throws(
      () => pasarela.extraerDeUri("https://sigd.iestp-suiza.edu.pe/firmar"),
      inicioEsperado,
    );
    assert.throws(
      () => pasarela.extraerDeUri("refirma://verify?arguments=[abcd]"),
      inicioEsperado,
    );
    assert.throws(
      () => pasarela.extraerDeUri("refirma://sign?payload=[abcd]"),
      inicioEsperado,
    );
  });

  it("detalla el prefijo exigido cuando la URI no corresponde al protocolo", () => {
    try {
      pasarela.extraerDeUri("refirma://verify?arguments=[abcd]");
      assert.fail("Se esperaba un error de formato de URI.");
    } catch (error) {
      assert.ok(error instanceof Error);
      const detalles = (error as { detalles?: { problema: string }[] }).detalles ?? [];
      assert.ok(detalles.some((detalle) => detalle.problema.includes("refirma://sign?arguments=")));
    }
  });

  it("construye la URL de callback sobre la ruta de la API versionada", () => {
    const url = pasarela.construirUrlCallback("https://sigd.iestp-suiza.edu.pe/", "ses_abc");

    assert.equal(
      url,
      "https://sigd.iestp-suiza.edu.pe/api/v1/firma/callback-refirma/ses_abc",
    );
  });

  it("construye la URL temporal de descarga con el token en la query", () => {
    const url = pasarela.construirUrlDescarga(
      "https://sigd.iestp-suiza.edu.pe",
      "doc_001",
      "token_xyz",
    );

    assert.equal(
      url,
      "https://sigd.iestp-suiza.edu.pe/api/v1/firma/documento/doc_001?token=token_xyz",
    );
  });
});

describe("RefirmaGatewayService — determinismo e idempotencia", () => {
  it("produce la misma URI para el mismo payload", () => {
    const entrada = payloadValido();

    assert.equal(
      pasarela.generarInvocacion(entrada).uriProtocolar,
      pasarela.generarInvocacion(entrada).uriProtocolar,
    );
  });

  it("emite las claves del payload en el orden fijo del protocolo", () => {
    const invocacion = pasarela.generarInvocacion(payloadValido());

    assert.deepEqual(Object.keys(decodificarCrudo(invocacion.parametrosCodificados)), [
      ...CLAVES_PAYLOAD,
    ]);
  });

  it("no modifica el payload entregado por el frontend", () => {
    const entrada = payloadValido();
    const copia = { ...entrada };

    pasarela.generarInvocacion(entrada);

    assert.deepEqual(entrada, copia);
  });
});
