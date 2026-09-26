import { normaliserNumero, normalizePhone } from './phone.js';

const cases = [
  { input: '781311371', pays: '221', expected: '+221781311371' },
  { input: '77 123 45 67', pays: '221', expected: '+221771234567' },
  { input: '00221781311371', pays: '221', expected: '+221781311371' },
  { input: '221221781311371', pays: '221', expected: '+221781311371' },
  { input: '+22364608757', pays: '221', expected: '+22364608757' },
  { input: '64608757', pays: '223', expected: '+22364608757' },
  { input: '64608757', pays: '221', expected: null },
  { input: '0612345678', pays: '33', expected: '+33612345678' },
  { input: '+2250712345678', pays: '221', expected: '+2250712345678' },
  { input: '12345', pays: '221', expected: null },
];

let passed = 0;
let failed = 0;

for (const { input, pays, expected } of cases) {
  const result = normalizePhone(input, pays);
  const ok = result === expected;
  if (ok) {
    passed++;
    console.log(`  PASS  ${input} (${pays}) => ${result}`);
  } else {
    failed++;
    console.error(`  FAIL  ${input} (${pays}) => ${result} (attendu: ${expected})`);
    const full = normaliserNumero(input, pays);
    if (!full.ok) console.error(`        Erreur: ${full.erreur}`);
  }
}

console.log(`\n${passed}/${passed + failed} tests OK${failed ? ` — ${failed} ECHEC` : ''}`);
process.exit(failed > 0 ? 1 : 0);
