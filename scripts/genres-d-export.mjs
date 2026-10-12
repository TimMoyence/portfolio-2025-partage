import assert from 'node:assert/strict';

/** @typedef {Partial<Record<string, readonly string[]>>} Attendus */
/** @typedef {{ attendu: string, estConforme: (valeur: unknown) => boolean }} Controle */

/** @type {Readonly<Record<string, Controle | null>>} */
const CONTROLES_PAR_GENRE = Object.freeze({
  fonctions: { attendu: 'une fonction', estConforme: (valeur) => typeof valeur === 'function' },
  listes: {
    attendu: 'une liste gelée',
    estConforme: (valeur) => Array.isArray(valeur) && Object.isFrozen(valeur),
  },
  objets: {
    attendu: 'un objet gelé',
    estConforme: (valeur) =>
      typeof valeur === 'object' &&
      valeur !== null &&
      !Array.isArray(valeur) &&
      Object.isFrozen(valeur),
  },
  constantes: { attendu: 'un nombre', estConforme: (valeur) => typeof valeur === 'number' },
  chaines: { attendu: 'une chaîne', estConforme: (valeur) => typeof valeur === 'string' },
  erreurs: {
    attendu: 'une classe d erreur',
    estConforme: (valeur) => typeof valeur === 'function' && valeur.prototype instanceof Error,
  },
  types: null,
});

/**
 * @param {Attendus} attendus
 * @returns {[string, readonly string[]][]}
 */
function genresDe(attendus) {
  const genres = Object.entries(attendus).map(
    ([genre, noms]) => /** @type {[string, readonly string[]]} */ ([genre, noms ?? []]),
  );
  const inconnus = genres
    .map(([genre]) => genre)
    .filter((genre) => !Object.hasOwn(CONTROLES_PAR_GENRE, genre));
  if (inconnus.length > 0) throw new Error(`genre d export inconnu : ${inconnus.join(', ')}`);
  return genres;
}

/**
 * @param {Attendus} attendus
 * @returns {string[]}
 */
export const nomsAttendus = (attendus) => genresDe(attendus).flatMap(([, noms]) => noms);

/**
 * @param {string} ici
 * @param {Readonly<Record<string, unknown>>} module
 * @param {Attendus} attendus
 * @returns {void}
 */
export function verifierLesValeurs(ici, module, attendus) {
  const valeurs = genresDe(attendus).filter(([genre]) => CONTROLES_PAR_GENRE[genre] !== null);
  for (const [genre, noms] of valeurs) {
    const controle = /** @type {Controle} */ (CONTROLES_PAR_GENRE[genre]);
    for (const nom of noms) {
      assert.ok(controle.estConforme(module[nom]), `${ici} : ${nom} doit être ${controle.attendu}`);
    }
  }
  assert.deepEqual(
    Object.keys(module).sort(),
    valeurs.flatMap(([, noms]) => noms).sort(),
    `${ici} : chaque valeur exportée doit figurer dans ses attendus, et elle seule`,
  );
}
