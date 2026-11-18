/**
 * T-BE-DC-11 — Pruebas de los tokens de sesion con vigencia efimera.
 *
 * Verifica el TTL de 300 segundos y, sobre todo, que el consumo sea atomico: la
 * sesion se autodestruye en el momento en que Refirma entrega el callback, de
 * modo que un segundo intento con el mismo token falla aunque llegue dentro de
 * la ventana de vigencia.
 *
 * El almacen en memoria comparte contrato con `RedisFirmaSessionStore`; los
 * comandos que respaldan la garantia en Redis 7 son `SET ... EX ... NX` y
 * `GETDEL`, ambos atomicos en el servidor.
 */

import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  claveSesionFirma,
  generarTokenFirma,
  InMemoryFirmaSessionStore,
  PREFIJO_SESION_FIRMA,
  TTL_SESION_FIRMA_SEGUNDOS,
  type SesionFirma,
} from "../../../../src/domains/docucore/firmaSession.store.js";

const HASH = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

function sesionDePrueba(token: string, id = "ses_0123456789abcdef"): SesionFirma {
  return {
    id,
    token,
    hashDocumento: HASH,
    documentoId: "doc_001",
    firmante: { id: "usr_001", nombre: "NOMBRE [EJEMPLO]", documento: "00000000" },
    creadaEn: "2026-09-30T10:00:00.000Z",
    expiraEn: "2026-09-30T10:05:00.000Z",
  };
}

describe("firmas de sesion — generacion de tokens", () => {
  it("usa una vigencia estricta de 300 segundos (5 minutos)", () => {
    assert.equal(TTL_SESION_FIRMA_SEGUNDOS, 300);
  });

  it("genera tokens de 256 bits en hexadecimal", () => {
    const token = generarTokenFirma();

    assert.match(token, /^[0-9a-f]{64}$/u);
  });

  it("no repite tokens entre llamadas", () => {
    const tokens = new Set(Array.from({ length: 500 }, () => generarTokenFirma()));

    assert.equal(tokens.size, 500);
  });

  it("deriva la clave del hash del token, nunca del token en claro", () => {
    const token = generarTokenFirma();
    const clave = claveSesionFirma(token);

    assert.ok(!clave.includes(token));
    assert.ok(clave.startsWith(`${PREFIJO_SESION_FIRMA}:`));
  });

  it("produce una clave distinta para cada token", () => {
    assert.notEqual(claveSesionFirma(generarTokenFirma()), claveSesionFirma(generarTokenFirma()));
  });
});

describe("almacen de sesiones — publicacion con NX", () => {
  it("publica la sesion y la marca como vigente", async () => {
    const almacen = new InMemoryFirmaSessionStore();
    const token = generarTokenFirma();

    assert.equal(await almacen.crear(sesionDePrueba(token)), true);
    assert.equal(await almacen.existe(token), true);
  });

  it("no sobrescribe una sesion con el mismo token", async () => {
    const almacen = new InMemoryFirmaSessionStore();
    const token = generarTokenFirma();

    await almacen.crear(sesionDePrueba(token));
    const segundo = await almacen.crear(sesionDePrueba(token, "ses_9999999999abcdef"));

    // Un token repetido implicaria una colision criptografica: la sesion no
    // debe modificarse.
    assert.equal(segundo, false);
    const recuperada = await almacen.consumir(token);
    assert.equal(recuperada?.id, "ses_0123456789abcdef");
  });
});

describe("almacen de sesiones — consumo atomico y autodestruccion", () => {
  it("devuelve la sesion en el primer consumo", async () => {
    const almacen = new InMemoryFirmaSessionStore();
    const token = generarTokenFirma();
    await almacen.crear(sesionDePrueba(token));

    const sesion = await almacen.consumir(token);

    assert.equal(sesion?.token, token);
    assert.equal(sesion?.hashDocumento, HASH);
  });

  it("destruye la sesion tras el primer consumo", async () => {
    const almacen = new InMemoryFirmaSessionStore();
    const token = generarTokenFirma();
    await almacen.crear(sesionDePrueba(token));

    await almacen.consumir(token);

    assert.equal(await almacen.existe(token), false);
  });

  it("rechaza el segundo consumo del mismo token aunque siga dentro del TTL", async () => {
    const almacen = new InMemoryFirmaSessionStore();
    const token = generarTokenFirma();
    await almacen.crear(sesionDePrueba(token));

    const primero = await almacen.consumir(token);
    const segundo = await almacen.consumir(token);
    const tercero = await almacen.consumir(token);

    assert.notEqual(primero, null);
    assert.equal(segundo, null);
    assert.equal(tercero, null);
  });

  it("devuelve null para un token nunca emitido", async () => {
    const almacen = new InMemoryFirmaSessionStore();

    assert.equal(await almacen.consumir(generarTokenFirma()), null);
  });

  it("rechaza un token que no corresponde al almacen", async () => {
    const almacen = new InMemoryFirmaSessionStore();
    await almacen.crear(sesionDePrueba(generarTokenFirma()));

    assert.equal(await almacen.consumir(generarTokenFirma()), null);
  });

  it("consumir es seguro cuando dos llamadas llegan a la vez", async () => {
    const almacen = new InMemoryFirmaSessionStore();
    const token = generarTokenFirma();
    await almacen.crear(sesionDePrueba(token));

    const resultados = await Promise.all([
      almacen.consumir(token),
      almacen.consumir(token),
      almacen.consumir(token),
    ]);

    // Exactamente una llamada gana la carrera, como ocurre con GETDEL en Redis.
    assert.equal(resultados.filter((sesion) => sesion !== null).length, 1);
  });
});

describe("almacen de sesiones — expiracion por TTL", () => {
  it("la sesion sigue vigente justo antes de los 300 segundos", async () => {
    let ahora = 1_000_000;
    const almacen = new InMemoryFirmaSessionStore(() => ahora);
    const token = generarTokenFirma();
    await almacen.crear(sesionDePrueba(token));

    ahora += (TTL_SESION_FIRMA_SEGUNDOS - 1) * 1000;

    assert.equal(await almacen.existe(token), true);
    assert.notEqual(await almacen.consumir(token), null);
  });

  it("la sesion expira al cumplirse los 300 segundos", async () => {
    let ahora = 1_000_000;
    const almacen = new InMemoryFirmaSessionStore(() => ahora);
    const token = generarTokenFirma();
    await almacen.crear(sesionDePrueba(token));

    ahora += TTL_SESION_FIRMA_SEGUNDOS * 1000;

    assert.equal(await almacen.existe(token), false);
    assert.equal(await almacen.consumir(token), null);
  });

  it("el consumo posterior a la expiracion no devuelve la sesion", async () => {
    let ahora = 0;
    const almacen = new InMemoryFirmaSessionStore(() => ahora);
    const token = generarTokenFirma();
    await almacen.crear(sesionDePrueba(token));

    ahora += 10 * 60 * 1000;

    assert.equal(await almacen.consumir(token), null);
  });

  it("el TTL puede fijarse por debajo del valor por omision", async () => {
    let ahora = 0;
    const almacen = new InMemoryFirmaSessionStore(() => ahora);
    const token = generarTokenFirma();

    await almacen.crear(sesionDePrueba(token), 60);
    ahora += 59_000;
    assert.equal(await almacen.existe(token), true);

    ahora += 2_000;
    assert.equal(await almacen.existe(token), false);
  });

  it("cerrar el almacen descarta todas las sesiones", async () => {
    const almacen = new InMemoryFirmaSessionStore();
    const token = generarTokenFirma();
    await almacen.crear(sesionDePrueba(token));

    await almacen.cerrar();

    assert.equal(await almacen.existe(token), false);
  });
});
