import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/**
 * @param {string} racine
 * @returns {void}
 */
export const supprimerDossier = (racine) => rmSync(racine, { recursive: true, force: true });

/**
 * @param {string} racine
 * @param {Record<string, string>} fichiers
 * @returns {void}
 */
export function ecrireFichiers(racine, fichiers) {
  for (const [relatif, contenu] of Object.entries(fichiers)) {
    const chemin = join(racine, relatif);
    mkdirSync(dirname(chemin), { recursive: true });
    writeFileSync(chemin, contenu);
  }
}

/**
 * @param {string} prefixe
 * @param {Record<string, string>} [fichiers]
 * @returns {string}
 */
export function planterDossier(prefixe, fichiers = {}) {
  const racine = mkdtempSync(join(tmpdir(), prefixe));
  ecrireFichiers(racine, fichiers);
  return racine;
}

/**
 * @template T
 * @param {string} prefixe
 * @param {Record<string, string>} fichiers
 * @param {(racine: string) => T} executer
 * @returns {T}
 */
export function avecDossierPlante(prefixe, fichiers, executer) {
  const racine = planterDossier(prefixe, fichiers);
  const nettoyer = () => supprimerDossier(racine);
  let resultat;
  try {
    resultat = executer(racine);
  } catch (erreur) {
    nettoyer();
    throw erreur;
  }
  if (resultat instanceof Promise) return /** @type {T} */ (resultat.finally(nettoyer));
  nettoyer();
  return resultat;
}
