import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @param {string | URL} url
 * @returns {string}
 */
export function racineDuDepot(url) {
  const depart = dirname(fileURLToPath(url));
  let dossier = depart;
  while (!existsSync(join(dossier, 'package.json'))) {
    const parent = dirname(dossier);
    if (parent === dossier) {
      throw new Error(`racineDuDepot : aucun package.json dans ${depart} ni au-dessus`);
    }
    dossier = parent;
  }
  return dossier;
}
