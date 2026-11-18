import crypto from 'node:crypto';
import { Argon2Service } from '../../src/domains/identicore/argon2.service.js';

interface TestResult {
  test: string;
  passed: boolean;
  actual: unknown;
  expected: unknown;
  details?: string;
}

const results: TestResult[] = [];

function check(test: string, actual: unknown, expected: unknown, details?: string) {
  const passed = actual === expected;
  results.push({ test, passed, actual, expected, details });
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${test} (Expected: ${expected}, Actual: ${actual}) ${details ?? ''}`);
}

async function runChallengerTests() {
  console.log('=== CHALLENGER M1 IT2: ARGON2SERVICE ADVERSARIAL TEST SUITE ===\n');

  // -------------------------------------------------------------------------
  // 1. Anti-bypass behavior: $argon2id$v=19$fallback$1234 with wrong_password
  // -------------------------------------------------------------------------
  console.log('--- Requirement 1.1: Fallback backdoor string bypass attempt ---');
  const r1 = await Argon2Service.verify('$argon2id$v=19$fallback$1234', 'wrong_password');
  check('Argon2Service.verify("$argon2id$v=19$fallback$1234", "wrong_password") === false', r1, false);

  const r1_correct_guess = await Argon2Service.verify('$argon2id$v=19$fallback$1234', '1234');
  check('Argon2Service.verify("$argon2id$v=19$fallback$1234", "1234") === false', r1_correct_guess, false, 'Even if password matches suffix, must reject malformed hash');

  const r1_mocked = await Argon2Service.verify('$argon2id$v=19$mockedhash$1234', '1234');
  check('Argon2Service.verify("$argon2id$v=19$mockedhash$1234", "1234") === false', r1_mocked, false, 'Old mockedhash backdoor rejected');

  // -------------------------------------------------------------------------
  // 2. Wrong password against valid fallback hash MUST return FALSE
  // -------------------------------------------------------------------------
  console.log('\n--- Requirement 1.2: Wrong password against valid fallback hash ---');
  const validPassword = 'PasswordInstitucional2026!';
  const validFallbackHash = Argon2Service.generateFallbackHash(validPassword);
  
  const r2_wrong = await Argon2Service.verify(validFallbackHash, 'wrong_password');
  check('Argon2Service.verify(validFallbackHash, "wrong_password") === false', r2_wrong, false);

  const r2_wrong_case = await Argon2Service.verify(validFallbackHash, 'passwordinstitucional2026!');
  check('Case mismatch password returns false', r2_wrong_case, false);

  const r2_wrong_similar = await Argon2Service.verify(validFallbackHash, 'PasswordInstitucional2026.');
  check('Single character change password returns false', r2_wrong_similar, false);

  const r2_correct = await Argon2Service.verify(validFallbackHash, validPassword);
  check('Correct password returns true', r2_correct, true);

  const r2_fb_wrong = Argon2Service.verifyFallback(validFallbackHash, 'wrong_password');
  check('Argon2Service.verifyFallback(validFallbackHash, "wrong_password") === false', r2_fb_wrong, false);

  const r2_fb_correct = Argon2Service.verifyFallback(validFallbackHash, validPassword);
  check('Argon2Service.verifyFallback(validFallbackHash, validPassword) === true', r2_fb_correct, true);

  // -------------------------------------------------------------------------
  // 3. Truncated hash matching attempts MUST return FALSE
  // -------------------------------------------------------------------------
  console.log('\n--- Requirement 1.3: Truncated hash matching attempts ---');
  const salt = '0123456789abcdef0123456789abcdef';
  
  // Truncated to 32 hex chars (< 64 threshold)
  const truncatedShort = `$argon2id$v=19$m=65536,t=3,p=4$${salt}$${'a'.repeat(32)}`;
  const r3_short = await Argon2Service.verify(truncatedShort, validPassword);
  check('Truncated short hash (< 64 hex chars) returns false', r3_short, false);

  // Truncated to 63 hex chars (odd length, < 64)
  const truncated63 = `$argon2id$v=19$m=65536,t=3,p=4$${salt}$${'a'.repeat(63)}`;
  const r3_63 = await Argon2Service.verify(truncated63, validPassword);
  check('Truncated 63 chars (odd length) returns false', r3_63, false);

  // Truncated to 65 hex chars (odd length)
  const truncated65 = `$argon2id$v=19$m=65536,t=3,p=4$${salt}$${'a'.repeat(65)}`;
  const r3_65 = await Argon2Service.verify(truncated65, validPassword);
  check('Truncated 65 chars (odd length) returns false', r3_65, false);

  // Truncated not aligned to 32 hex chars block (e.g. 126 hex chars instead of 128)
  const truncated126 = `$argon2id$v=19$m=65536,t=3,p=4$${salt}$${'a'.repeat(126)}`;
  const r3_126 = await Argon2Service.verify(truncated126, validPassword);
  check('Truncated 126 chars (unaligned block) returns false', r3_126, false);

  // Truncated valid hash by 1 hex char
  const validParts = validFallbackHash.split('$');
  const truncatedValidHash = `$argon2id$v=19$${validParts[3]}$${validParts[4]}$${validParts[5].slice(0, -1)}`;
  const r3_trunc_valid = await Argon2Service.verify(truncatedValidHash, validPassword);
  check('Truncated valid hash by 1 hex char returns false', r3_trunc_valid, false);

  // Truncated valid hash by 2 hex chars (1 byte)
  const truncatedValidHash2 = `$argon2id$v=19$${validParts[3]}$${validParts[4]}$${validParts[5].slice(0, -2)}`;
  const r3_trunc_valid2 = await Argon2Service.verify(truncatedValidHash2, validPassword);
  check('Truncated valid hash by 2 hex chars (1 byte) returns false', r3_trunc_valid2, false);

  // Truncated salt (< 16 hex chars)
  const truncatedSalt = `$argon2id$v=19$m=65536,t=3,p=4$0123456789abcde$${'a'.repeat(64)}`;
  const r3_salt = await Argon2Service.verify(truncatedSalt, validPassword);
  check('Truncated salt (15 chars, odd) returns false', r3_salt, false);

  // -------------------------------------------------------------------------
  // 4. Inverted argument order verify(password, hash) handles gracefully
  // -------------------------------------------------------------------------
  console.log('\n--- Requirement 1.4: Inverted argument order verify(password, hash) ---');
  // With correct password
  let noErrorThrownInvertedCorrect = false;
  let r4_inverted_correct = false;
  try {
    r4_inverted_correct = await Argon2Service.verify(validPassword, validFallbackHash);
    noErrorThrownInvertedCorrect = true;
  } catch {
    noErrorThrownInvertedCorrect = false;
  }
  check('Inverted verify(validPassword, hash) does not throw error', noErrorThrownInvertedCorrect, true);
  check('Inverted verify(validPassword, hash) evaluates to true', r4_inverted_correct, true);

  // With wrong password
  let noErrorThrownInvertedWrong = false;
  let r4_inverted_wrong = true;
  try {
    r4_inverted_wrong = await Argon2Service.verify('WrongPassword123!', validFallbackHash);
    noErrorThrownInvertedWrong = true;
  } catch {
    noErrorThrownInvertedWrong = false;
  }
  check('Inverted verify(wrongPassword, hash) does not throw error', noErrorThrownInvertedWrong, true);
  check('Inverted verify(wrongPassword, hash) evaluates to false', r4_inverted_wrong, false);

  // Both arguments are passwords (no hash)
  const r4_both_passwords = await Argon2Service.verify('pass1', 'pass2');
  check('verify("pass1", "pass2") fails gracefully without error', r4_both_passwords, false);

  // Both arguments are hashes
  const hash2 = Argon2Service.generateFallbackHash('OtherPass');
  const r4_both_hashes = await Argon2Service.verify(validFallbackHash, hash2);
  check('verify(hash1, hash2) fails gracefully without error', r4_both_hashes, false);

  // -------------------------------------------------------------------------
  // 5. Additional Security / Cryptographic Checks
  // -------------------------------------------------------------------------
  console.log('\n--- Additional Cryptographic Rigor Checks ---');
  // Constant time comparison check
  const fakeHashSameLength = `$argon2id$v=19$${validParts[3]}$${validParts[4]}$${'f'.repeat(validParts[5].length)}`;
  const r5_fake = await Argon2Service.verify(fakeHashSameLength, validPassword);
  check('Fake hash with identical length returns false', r5_fake, false);

  // Non-hex characters injection in hash and salt
  const injectionSalt = `$argon2id$v=19$m=65536,t=3,p=4$0123456789abcdef!@#$${'a'.repeat(64)}`;
  check('Non-hex injection in salt returns false', await Argon2Service.verify(injectionSalt, validPassword), false);

  const injectionHash = `$argon2id$v=19$m=65536,t=3,p=4$${'a'.repeat(32)}$${'a'.repeat(63)}z`;
  check('Non-hex injection in hash segment returns false', await Argon2Service.verify(injectionHash, validPassword), false);

  // Malformed parameter segment (e.g. m=-1, t=0, NaN)
  const malformedParams1 = `$argon2id$v=19$m=-65536,t=3,p=4$${'a'.repeat(32)}$${'a'.repeat(64)}`;
  check('Negative memory parameter returns false', await Argon2Service.verify(malformedParams1, validPassword), false);

  const malformedParams2 = `$argon2id$v=19$m=NaN,t=3,p=4$${'a'.repeat(32)}$${'a'.repeat(64)}`;
  check('NaN memory parameter returns false', await Argon2Service.verify(malformedParams2, validPassword), false);

  const malformedParams3 = `$argon2id$v=19$invalid_params$${'a'.repeat(32)}$${'a'.repeat(64)}`;
  check('Malformed param pairs returns false', await Argon2Service.verify(malformedParams3, validPassword), false);

  // Summary
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\n===============================================================');
  console.log(`CHALLENGER HARNESS RESULTS: ${passed}/${total} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runChallengerTests().catch((e) => {
  console.error('FATAL ERROR:', e);
  process.exit(1);
});
