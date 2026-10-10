import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const manifeste = JSON.parse(readFileSync('package.json', 'utf8'));
const exiger = createRequire(import.meta.url);
const ATTENDUS = {
  formule: ['evaluerFeuille', 'evaluerExpression', 'estUneFormule', 'surfaceDeFormule'],
  score: ['statutDuScore'],
};

assert.deepEqual(
  Object.keys(manifeste.exports).sort(),
  Object.keys(ATTENDUS)
    .map((entree) => `./${entree}`)
    .sort(),
  'chaque entrée du paquet doit être vérifiée ici',
);

for (const [entree, symboles] of Object.entries(ATTENDUS)) {
  const specificateur = `${manifeste.name}/${entree}`;
  const enModule = await import(specificateur);
  const enCommonJs = exiger(specificateur);
  for (const symbole of symboles) {
    assert.equal(typeof enModule[symbole], 'function', `${specificateur} (import) : ${symbole}`);
    assert.equal(typeof enCommonJs[symbole], 'function', `${specificateur} (require) : ${symbole}`);
  }
}

console.log(`${manifeste.name} : entrées ESM et CJS résolues par leur nom de paquet`);
