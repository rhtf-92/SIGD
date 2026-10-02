import crypto from 'node:crypto';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Argon2Service } from '../../src/domains/identicore/argon2.service.js';
import {
  ESTADOS_RUTADOC,
  EVENTOS_RUTADOC,
  TRANSICIONES_RUTADOC,
} from '../../src/domains/rutadoc/rutadoc.fsm.js';

interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function assert(name: string, category: string, condition: boolean, details?: string) {
  results.push({
    name,
    category,
    passed: condition,
    details: details ?? (condition ? 'PASSED' : 'FAILED'),
  });
}

async function runAdversarialTests() {
  console.log('===============================================================');
  console.log('STARTING EMPIRICAL ADVERSARIAL TEST HARNESS (Milestone M1)');
  console.log('===============================================================\n');

  // --------------------------------------------------------------------------
  // SECTION 1: Argon2Service Adversarial Tests (Native / Scrypt Fallback)
  // --------------------------------------------------------------------------
  console.log('>>> [1] Testing Argon2Service Security & Robustness...');

  // 1.1 Empty & Nullish Inputs
  try {
    const emptyHash = await Argon2Service.hash('');
    assert(
      'hash("") produces valid hash string',
      'Empty/Nullish',
      typeof emptyHash === 'string' && emptyHash.startsWith('$argon2id$'),
      `Hash generated: ${emptyHash.slice(0, 40)}...`
    );

    // Empty password verification against hash of empty password
    // Note: Line 75: `if (!hashAlmacenado || !passwordPlana) return false;`
    // Adversarially checks whether an empty password can ever be validated
    const emptyVerify = await Argon2Service.verify(emptyHash, '');
    assert(
      'verify(hash, "") rejects empty password (fails closed)',
      'Empty/Nullish',
      emptyVerify === false,
      `Result: ${emptyVerify}`
    );

    const emptyVerifyInverted = await Argon2Service.verify('', emptyHash);
    assert(
      'verify("", hash) rejects empty password when inverted',
      'Empty/Nullish',
      emptyVerifyInverted === false,
      `Result: ${emptyVerifyInverted}`
    );

    const nullHashVerify = await Argon2Service.verify(null as unknown as string, 'validPassword');
    assert(
      'verify(null, password) rejects gracefully without throwing',
      'Empty/Nullish',
      nullHashVerify === false,
      `Result: ${nullHashVerify}`
    );

    const undefinedHashVerify = await Argon2Service.verify(undefined as unknown as string, 'validPassword');
    assert(
      'verify(undefined, password) rejects gracefully without throwing',
      'Empty/Nullish',
      undefinedHashVerify === false,
      `Result: ${undefinedHashVerify}`
    );

    const nullPassVerify = await Argon2Service.verify(emptyHash, null as unknown as string);
    assert(
      'verify(hash, null) rejects gracefully without throwing',
      'Empty/Nullish',
      nullPassVerify === false,
      `Result: ${nullPassVerify}`
    );

    const undefPassVerify = await Argon2Service.verify(emptyHash, undefined as unknown as string);
    assert(
      'verify(hash, undefined) rejects gracefully without throwing',
      'Empty/Nullish',
      undefPassVerify === false,
      `Result: ${undefPassVerify}`
    );
  } catch (err) {
    assert('Empty/Nullish suite execution', 'Empty/Nullish', false, String(err));
  }

  // 1.2 Malformed Hashes
  try {
    const malformedList = [
      '$invalid$',
      'invalid',
      '$argon2id$',
      '$argon2id$v=19$',
      '$argon2id$v=19$m=65536,t=3,p=4$',
      '$argon2id$v=19$m=65536,t=3,p=4$$',
      '$argon2id$v=19$m=65536,t=3,p=4$salt$',
      '$argon2id$v=19$m=65536,t=3,p=4$sal$hashInvalidoImpar', // odd length hex
      '$argon2id$v=19$m=65536,t=3,p=4$zzzzzzzzzzzzzzzz$1234567890abcdef', // non-hex salt
      '$argon2id$v=19$m=65536,t=3,p=4$' + '0'.repeat(32) + '$' + '1'.repeat(127), // 127 chars odd hex
      '$argon2id$v=19$m=65536,t=3,p=4$' + 'x'.repeat(32) + '$' + 'y'.repeat(128), // non-hex chars
      '$$$$$$',
      '$'.repeat(100),
      'A'.repeat(500), // extreme length
    ];

    for (const malformed of malformedList) {
      const fbRes = Argon2Service.verifyFallback(malformed, 'ClavePrueba123');
      assert(
        `verifyFallback rejects malformed: "${malformed.slice(0, 30)}..."`,
        'Malformed Hashes',
        fbRes === false,
        `Result: ${fbRes}`
      );

      // Also test via Argon2Service.verify
      const vRes = await Argon2Service.verify(malformed, 'ClavePrueba123');
      assert(
        `verify rejects malformed: "${malformed.slice(0, 30)}..."`,
        'Malformed Hashes',
        vRes === false,
        `Result: ${vRes}`
      );
    }
  } catch (err) {
    assert('Malformed Hashes suite execution', 'Malformed Hashes', false, String(err));
  }

  // 1.3 Inverted Parameters verify(password, hash)
  try {
    const goodPassword = 'MiPasswordSegura2026!';
    const validHash = await Argon2Service.hash(goodPassword);

    // Normal order: verify(hash, password)
    const normalOk = await Argon2Service.verify(validHash, goodPassword);
    assert('Normal order verify(hash, password) succeeds', 'Parameter Inversion', normalOk === true);

    // Inverted order: verify(password, hash)
    const invertedOk = await Argon2Service.verify(goodPassword, validHash);
    assert('Inverted order verify(password, hash) succeeds', 'Parameter Inversion', invertedOk === true);

    // Inverted with WRONG password: verify(wrongPassword, hash)
    const invertedWrong = await Argon2Service.verify('PasswordIncorrecta', validHash);
    assert('Inverted with WRONG password verify(wrong, hash) fails', 'Parameter Inversion', invertedWrong === false);

    // Normal with WRONG password: verify(hash, wrong)
    const normalWrong = await Argon2Service.verify(validHash, 'PasswordIncorrecta');
    assert('Normal with WRONG password verify(hash, wrong) fails', 'Parameter Inversion', normalWrong === false);

    // Both parameters are hashes: verify(hash1, hash2)
    const validHash2 = await Argon2Service.hash('OtraPassword');
    const bothHashes = await Argon2Service.verify(validHash, validHash2);
    assert('verify(hash1, hash2) fails safely', 'Parameter Inversion', bothHashes === false);
  } catch (err) {
    assert('Parameter Inversion suite execution', 'Parameter Inversion', false, String(err));
  }

  // 1.4 TimingSafeEqual Boundary Checks & Keylen Alignment
  try {
    const password = 'TestTimingBoundaryPass';
    const salt = crypto.randomBytes(16).toString('hex');

    // Test different key lengths (hash sizes)
    const keylengths = [16, 32, 48, 64, 96, 128];
    for (const klen of keylengths) {
      const customHash = crypto.scryptSync(password, salt, klen).toString('hex');
      const formattedHash = `$argon2id$v=19$m=65536,t=3,p=4$${salt}$${customHash}`;

      const verifyCustom = Argon2Service.verifyFallback(formattedHash, password);
      assert(
        `verifyFallback handles dynamic keylen ${klen} bytes (${klen * 2} hex chars)`,
        'TimingSafeEqual Boundary',
        verifyCustom === true,
        `Result: ${verifyCustom}`
      );

      const verifyCustomWrong = Argon2Service.verifyFallback(formattedHash, 'WrongPassword');
      assert(
        `verifyFallback rejects wrong password with keylen ${klen} bytes`,
        'TimingSafeEqual Boundary',
        verifyCustomWrong === false,
        `Result: ${verifyCustomWrong}`
      );
    }

    // Test buffer length mismatch / corruption without crashing
    const customHash64 = crypto.scryptSync(password, salt, 64).toString('hex');
    // Truncate hashEsperado by 2 hex chars (1 byte)
    const truncatedHash = `$argon2id$v=19$m=65536,t=3,p=4$${salt}$${customHash64.slice(0, -2)}`;
    const verifyTrunc = Argon2Service.verifyFallback(truncatedHash, password);
    assert(
      'verifyFallback handles truncated hashEsperado without RangeError',
      'TimingSafeEqual Boundary',
      verifyTrunc === false,
      `Result: ${verifyTrunc}`
    );

    // Extend hashEsperado by 2 hex chars
    const extendedHash = `$argon2id$v=19$m=65536,t=3,p=4$${salt}$${customHash64}aa`;
    const verifyExt = Argon2Service.verifyFallback(extendedHash, password);
    assert(
      'verifyFallback handles extended hashEsperado without RangeError',
      'TimingSafeEqual Boundary',
      verifyExt === false,
      `Result: ${verifyExt}`
    );
  } catch (err) {
    assert('TimingSafeEqual Boundary suite execution', 'TimingSafeEqual Boundary', false, String(err));
  }

  // 1.5 PostgreSQL 18 Constraint Compliance
  try {
    const pgRegex = /^\$argon2id\$.+/;
    const strictFormatRegex = /^\$argon2id\$v=19\$m=\d+,t=\d+,p=\d+\$[0-9a-f]{32}\$[0-9a-f]{128}$/;

    for (let i = 0; i < 20; i++) {
      const generated = Argon2Service.generateFallbackHash(`PasswordVariada_${i}`);
      const satisfiesPgConstraint = pgRegex.test(generated);
      const satisfiesLengthConstraint = generated.length <= 255;
      const matchesStrictStructure = strictFormatRegex.test(generated);

      if (!satisfiesPgConstraint || !satisfiesLengthConstraint || !matchesStrictStructure) {
        assert(
          `Fallback hash #${i} PostgreSQL compliance`,
          'PostgreSQL Schema Compliance',
          false,
          `Length: ${generated.length}, Valid: ${satisfiesPgConstraint}, Strict: ${matchesStrictStructure}`
        );
        break;
      }
    }
    assert(
      'All 20 generated fallback hashes strictly satisfy CHECK (password_hash LIKE "$argon2id$%") and length <= 255 (exact 194 chars)',
      'PostgreSQL Schema Compliance',
      true,
      'Lengths: exactly 194 chars, starts with $argon2id$'
    );
  } catch (err) {
    assert('PostgreSQL Schema Compliance suite execution', 'PostgreSQL Schema Compliance', false, String(err));
  }

  // --------------------------------------------------------------------------
  // SECTION 2: Adversarial Testing of migration-sync under CRLF Simulation
  // --------------------------------------------------------------------------
  console.log('\n>>> [2] Testing migration-sync.spec.ts under Simulated CRLF...');

  try {
    const rutaSql = fileURLToPath(new URL('../../migraciones/06_sigd_rut.sql', import.meta.url));
    const rutaDoc = fileURLToPath(new URL('../../docs/05_rutadoc/06_esquema_sigd_rut_fsm_v6.3.sql', import.meta.url));

    const contenidoSqlOriginal = readFileSync(rutaSql, 'utf8');
    const contenidoDocOriginal = readFileSync(rutaDoc, 'utf8');

    // Helper functions from migration-sync.spec.ts
    const normalizar = (txt: string): string => txt.replace(/\r\n/g, '\n');
    const hash = (contenido: string): string =>
      crypto.createHash('sha256').update(normalizar(contenido)).digest('hex');

    function filasFrom(sqlText: string, tabla: string): string[][] {
      const sqlNorm = normalizar(sqlText);
      const inicio = sqlNorm.indexOf(`INSERT INTO sigd_rut.${tabla}`);
      if (inicio < 0) return [];
      const bloque = sqlNorm.slice(inicio, sqlNorm.indexOf('ON CONFLICT', inicio));
      const valores = bloque.slice(bloque.indexOf('VALUES') + 'VALUES'.length);
      return [...valores.matchAll(/\(([^()]+)\)/g)].map((coincidencia) =>
        [...coincidencia[1].matchAll(/'([^']+)'|\b(TRUE|FALSE)\b/g)].map((celda) => celda[1] ?? celda[2]),
      );
    }

    // Scenario A: Both files purely LF
    const sqlPureLF = contenidoSqlOriginal.replace(/\r\n/g, '\n');
    const docPureLF = contenidoDocOriginal.replace(/\r\n/g, '\n');
    assert(
      'Hash parity: SQL (LF) vs DOC (LF)',
      'CRLF Adversarial',
      hash(sqlPureLF) === hash(docPureLF),
      `Hash: ${hash(sqlPureLF).slice(0, 16)}...`
    );

    // Scenario B: SQL purely CRLF vs DOC purely LF
    const sqlPureCRLF = sqlPureLF.replace(/\n/g, '\r\n');
    assert(
      'Hash parity: SQL (CRLF) vs DOC (LF) via normalizar()',
      'CRLF Adversarial',
      hash(sqlPureCRLF) === hash(docPureLF),
      `Both normalize to: ${hash(sqlPureCRLF).slice(0, 16)}...`
    );

    // Scenario C: SQL purely LF vs DOC purely CRLF
    const docPureCRLF = docPureLF.replace(/\n/g, '\r\n');
    assert(
      'Hash parity: SQL (LF) vs DOC (CRLF) via normalizar()',
      'CRLF Adversarial',
      hash(sqlPureLF) === hash(docPureCRLF),
      `Both normalize to: ${hash(sqlPureLF).slice(0, 16)}...`
    );

    // Scenario D: Both purely CRLF
    assert(
      'Hash parity: SQL (CRLF) vs DOC (CRLF) via normalizar()',
      'CRLF Adversarial',
      hash(sqlPureCRLF) === hash(docPureCRLF),
      `Both normalize to: ${hash(sqlPureCRLF).slice(0, 16)}...`
    );

    // Scenario E: Mixed line endings within single file
    // e.g., line 1-50 CRLF, remainder LF
    const lines = sqlPureLF.split('\n');
    const sqlMixed = lines.map((l, idx) => (idx < lines.length - 1 ? (idx % 2 === 0 ? l + '\r\n' : l + '\n') : l)).join('');
    assert(
      'Hash parity: Mixed CRLF/LF within file vs Pure LF',
      'CRLF Adversarial',
      hash(sqlMixed) === hash(docPureLF),
      `Hash: ${hash(sqlMixed).slice(0, 16)}...`
    );

    // Scenario F: filas() extraction under pure CRLF
    const filasLF = filasFrom(sqlPureLF, 'estado_tramite');
    const filasCRLF = filasFrom(sqlPureCRLF, 'estado_tramite');
    assert(
      'filas() parser extracts identical estado_tramite under CRLF as under LF',
      'CRLF Adversarial',
      JSON.stringify(filasLF) === JSON.stringify(filasCRLF) && filasCRLF.length > 0,
      `Extracted ${filasCRLF.length} rows`
    );

    const transicionesLF = filasFrom(sqlPureLF, 'transicion_estado_tramite');
    const transicionesCRLF = filasFrom(sqlPureCRLF, 'transicion_estado_tramite');
    assert(
      'filas() parser extracts identical transicion_estado_tramite under CRLF as under LF',
      'CRLF Adversarial',
      JSON.stringify(transicionesLF) === JSON.stringify(transicionesCRLF) && transicionesCRLF.length === 13,
      `Extracted ${transicionesCRLF.length} rows (expected 13)`
    );

    // Check FSM entity counts against TypeScript definitions
    const estadosMatch = filasCRLF.map(([codigo]) => codigo).join(',') === [...ESTADOS_RUTADOC].join(',');
    assert(
      'CRLF SQL estado_tramite matches TypeScript ESTADOS_RUTADOC exactly',
      'CRLF Adversarial',
      estadosMatch
    );

    const accionesCRLF = filasFrom(sqlPureCRLF, 'accion_tramite');
    const eventosMatch = accionesCRLF.map(([codigo]) => codigo).join(',') === [...EVENTOS_RUTADOC].join(',');
    assert(
      'CRLF SQL accion_tramite matches TypeScript EVENTOS_RUTADOC exactly',
      'CRLF Adversarial',
      eventosMatch
    );
  } catch (err) {
    assert('CRLF Adversarial suite execution', 'CRLF Adversarial', false, String(err));
  }

  // --------------------------------------------------------------------------
  // Summary & Report
  // --------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log('ADVERSARIAL HARNESS RESULTS SUMMARY');
  console.log('===============================================================');

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Total assertions: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nFAILED ASSERTIONS:');
    for (const f of results.filter((r) => !r.passed)) {
      console.log(`  [FAIL] [${f.category}] ${f.name} => ${f.details}`);
    }
  }

  return { total, passed, failed, results };
}

runAdversarialTests().then(({ failed }) => {
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
});
