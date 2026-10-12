import { statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @param {string} chemin
 * @returns {boolean}
 */
const estUnFichier = (chemin) => statSync(chemin, { throwIfNoEntry: false })?.isFile() === true;

/**
 * @param {string | URL} url
 * @returns {string}
 */
export function racineDuDepot(url) {
  const depart = resolve(fileURLToPath(new URL('.', url)));
  let dossier = depart;
  while (!estUnFichier(join(dossier, 'package.json'))) {
    const parent = dirname(dossier);
    if (parent === dossier) {
      throw new Error(`racineDuDepot : aucun package.json dans ${depart} ni au-dessus`);
    }
    dossier = parent;
  }
  return dossier;
}
