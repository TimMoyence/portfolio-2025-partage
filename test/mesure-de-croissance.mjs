import { analyzeFile } from '../outils/garde-commentaires/garde.mjs';
import { DRAPEAUX_DE_MESURE } from './drapeaux-de-mesure.mjs';

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
  'lignes-contigues': {
    file: 'src/a.service.ts',
    fabriquer: (n) => `${lignes(n, (i) => `// c${i}`)}\nexport const a = 1;`,
  },
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

/** @returns {() => void} */
function ramasseMiettes() {
  const { gc } = globalThis;
  const manquants = DRAPEAUX_DE_MESURE.filter((drapeau) => !process.execArgv.includes(drapeau));
  if (typeof gc !== 'function' || manquants.length > 0) {
    throw new Error(`mesure-de-croissance : lancer node avec ${DRAPEAUX_DE_MESURE.join(' ')}`);
  }
  return gc;
}

const PASSES = 7;
const DOUBLEMENTS = 2;
const [nom = '', taille = '0'] = process.argv.slice(2);
const { file, fabriquer } = casDemande(nom);
const ramasser = ramasseMiettes();

/**
 * @param {string} text
 * @returns {{ duree: number, derniereLigne: number | undefined }}
 */
function analyser(text) {
  ramasser();
  const avant = process.cpuUsage();
  const derniereLigne = analyzeFile({ text, file }).at(-1)?.line;
  const { user, system } = process.cpuUsage(avant);
  return { duree: user + system, derniereLigne };
}

/**
 * @param {number[]} valeurs
 * @returns {number}
 */
const mediane = (valeurs) => [...valeurs].sort((a, b) => a - b)[valeurs.length >> 1];

const grand = fabriquer(2 * Number(taille));
const petit = fabriquer(Math.ceil((2 * Number(taille)) / 2 ** DOUBLEMENTS));
analyser(petit);
/** @type {number[]} */
const rapports = [];
/** @type {number | undefined} */
let derniereLigne;
for (let passe = 0; passe < PASSES; passe += 1) {
  const avant = analyser(petit).duree;
  const mesure = analyser(grand);
  rapports.push(mesure.duree / avant);
  derniereLigne = mesure.derniereLigne;
}
process.stdout.write(
  JSON.stringify({ croissance: mediane(rapports) ** (1 / DOUBLEMENTS), derniereLigne }),
);
