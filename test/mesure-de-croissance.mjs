import { analyzeFile } from '../outils/garde-commentaires/garde.mjs';

/**
 * @param {number} nombre
 * @param {(i: number) => string} ligne
 * @returns {string}
 */
const lignes = (nombre, ligne) => Array.from({ length: nombre }, (_, i) => ligne(i)).join('\n');

/** @type {Record<string, { file: string, fabriquer: (taille: number) => string }>} */
const CAS = {
  'blocs-vides': { file: 'src/a.service.ts', fabriquer: (n) => lignes(n, (i) => `/* c${i} */ {}`) },
  scss: { file: 'src/styles/_a.scss', fabriquer: (n) => lignes(n, (i) => `/* c${i} */ a {}`) },
  html: { file: 'src/a.html', fabriquer: (n) => lignes(n, (i) => `<!-- c${i} --><p></p>`) },
  'non-fermes': { file: 'src/styles/_a.scss', fabriquer: (n) => 'a/*'.repeat(n) },
  'trivia-partagee': {
    file: 'src/a.service.ts',
    fabriquer: (n) =>
      `export const a = /* ${'x'.repeat(32 * n)} */ ${Array.from({ length: n }, () => '1').join(' + ')};`,
  },
  'trivia-de-queue': {
    file: 'src/a.service.ts',
    fabriquer: (n) => `${'a = '.repeat(n)}1 /* ${'x'.repeat(32 * n)} */;`,
  },
};

/**
 * @param {string} nom
 * @returns {{ file: string, fabriquer: (taille: number) => string }}
 */
function casDemande(nom) {
  const cas = CAS[nom];
  if (!cas) {
    throw new Error(
      `mesure-de-croissance : cas « ${nom} » inconnu, attendu ${Object.keys(CAS).join(', ')}`,
    );
  }
  return cas;
}

const [nom = '', taille = '0'] = process.argv.slice(2);
const { file, fabriquer } = casDemande(nom);

/**
 * @param {number} n
 * @returns {{ duree: number, derniereLigne: number | undefined }}
 */
function analyser(n) {
  const text = fabriquer(n);
  /** @type {number | undefined} */
  let derniereLigne;
  const durees = [0, 1, 2].map(() => {
    const debut = performance.now();
    derniereLigne = analyzeFile({ text, file }).at(-1)?.line;
    return performance.now() - debut;
  });
  return { duree: Math.min(...durees), derniereLigne };
}

analyser(Math.ceil(Number(taille) / 5));
const simple = analyser(Number(taille));
const double = analyser(2 * Number(taille));
process.stdout.write(
  JSON.stringify({ croissance: double.duree / simple.duree, derniereLigne: double.derniereLigne }),
);
