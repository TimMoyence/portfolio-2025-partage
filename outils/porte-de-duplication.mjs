import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

import { avecDossierPlante, ecrireFichiers } from './dossier-temporaire.mjs';

const JETONS_MINIMAUX = 30;
const LIGNES_MINIMALES = 5;
const PLAFOND_DE_TAILLE_MINIMAL = 100_000;
const WORKFLOW = '.github/workflows/ci.yml';

const PORTES = {
  app: { v5: '.jscpd.json', v4: '.jscpd.json' },
  tests: { v5: '.jscpd.tests.json', v4: '.jscpd4.tests.json' },
};

const MOTEURS = {
  v5: 'node_modules/jscpd/run-jscpd.js',
  v4: 'node_modules/jscpd4/bin/jscpd',
};

/** @type {readonly Moteur[]} */
const ORDRE_DES_MOTEURS = ['v5', 'v4'];

export const CANARI_TS = `export function canari(entree: number[]): number {
  let total = 0;
  for (const valeur of entree) {
    total += valeur * 2;
  }
  return total;
}
`;

const TEMOIN = `export const temoin = [
  'un',
  'deux',
  'trois',
  'quatre',
];
`;
const TEMOINS = ['src/temoin.ts', 'src/temoin.spec.ts'];

/** @typedef {keyof typeof MOTEURS} Moteur */
/** @typedef {keyof typeof PORTES} Porte */
/** @typedef {{ statut: number | null, clones: number }} Verdict */
/** @typedef {{ racine: string, moteur: Moteur, porte: Porte, fichiers: Record<string, string> }} DemandeDeVerdict */
/** @typedef {{ porte: Porte, detecte: readonly (readonly string[])[], ignore: readonly (readonly string[])[] }} CasDePorte */
/** @typedef {{ intitule: string, demande: DemandeDeVerdict, attendu: Verdict }} Scenario */

/**
 * @param {string} chemin
 * @returns {Record<string, any>}
 */
const lireJson = (chemin) => JSON.parse(readFileSync(chemin, 'utf8'));

/**
 * @param {DemandeDeVerdict} demande
 * @returns {Verdict}
 */
export function verdictSurDepotPlante({ racine, moteur, porte, fichiers }) {
  return avecDossierPlante('porte-cpd-', {}, (depot) => {
    const nomConfig = PORTES[porte][moteur];
    const rapport = join(depot, 'rapport');
    const lue = lireJson(join(racine, nomConfig));
    const config = { ...lue, reporters: ['json'], output: rapport };
    for (const dossier of /** @type {string[]} */ (lue.path)) {
      mkdirSync(join(depot, dossier), { recursive: true });
    }
    ecrireFichiers(depot, {
      [nomConfig]: JSON.stringify(config),
      ...fichiers,
      ...Object.fromEntries(TEMOINS.map((temoin) => [temoin, TEMOIN])),
    });
    const resultat = spawnSync(
      process.execPath,
      [join(racine, MOTEURS[moteur]), '--config', nomConfig],
      {
        cwd: depot,
        encoding: 'utf8',
      },
    );
    const { duplicates } = lireJson(join(rapport, 'jscpd-report.json'));
    return { statut: resultat.status, clones: duplicates.length };
  });
}

/**
 * @param {readonly string[]} paire
 * @param {Readonly<Record<string, string>>} canaris
 * @returns {Record<string, string>}
 */
function plantes(paire, canaris) {
  return Object.fromEntries(
    paire.map((fichier) => {
      const canari = canaris[extname(fichier)];
      if (canari === undefined) {
        throw new Error(`porte de duplication : aucun canari pour l extension de ${fichier}.`);
      }
      return [fichier, canari];
    }),
  );
}

/**
 * @param {{ racine: string, cas: readonly CasDePorte[], canaris: Readonly<Record<string, string>> }} entree
 * @returns {Scenario[]}
 */
export function scenariosDeLaPorte({ racine, cas, canaris }) {
  return ORDRE_DES_MOTEURS.flatMap((moteur) =>
    cas.flatMap(({ porte, detecte, ignore }) => {
      /**
       * @param {readonly string[]} paire
       * @param {string} verbe
       * @param {Verdict} attendu
       * @returns {Scenario}
       */
      const scenario = (paire, verbe, attendu) => ({
        intitule: `jscpd ${moteur} : la porte ${porte} ${verbe} ${paire.join(' + ')}`,
        demande: { racine, moteur, porte, fichiers: plantes(paire, canaris) },
        attendu,
      });
      return [
        ...detecte.map((paire) =>
          scenario(paire, 'échoue sur un clone canari', { statut: 1, clones: 1 }),
        ),
        ...ignore.map((paire) => scenario(paire, 'ne compte pas', { statut: 0, clones: 0 })),
      ];
    }),
  );
}

/**
 * @param {string} racine
 * @returns {string[]}
 */
export function ecartsDesConfigurations(racine) {
  const configurations = [
    ...new Set(Object.values(PORTES).flatMap((porte) => Object.values(porte))),
  ];
  return configurations.flatMap((nomConfig) => {
    const config = lireJson(join(racine, nomConfig));
    /** @type {string[]} */
    const ecarts = [];
    for (const [reglage, attendu] of /** @type {const} */ ([
      ['minTokens', JETONS_MINIMAUX],
      ['minLines', LIGNES_MINIMALES],
      ['threshold', 0],
    ])) {
      if (config[reglage] !== attendu) {
        ecarts.push(`${nomConfig} : ${reglage} vaut ${config[reglage]}, attendu ${attendu}`);
      }
    }
    if (!(Number(config.maxLines) >= PLAFOND_DE_TAILLE_MINIMAL)) {
      ecarts.push(
        `${nomConfig} : maxLines vaut ${config.maxLines}, attendu au moins ${PLAFOND_DE_TAILLE_MINIMAL}`,
      );
    }
    return ecarts;
  });
}

/**
 * @param {string | undefined} commande
 * @returns {string[]}
 */
const etapesDe = (commande) => (commande ?? '').split('&&').map((etape) => etape.trim());

/**
 * @param {{ racine: string, gestionnaire: 'npm' | 'pnpm', scripts: Readonly<Record<Porte, string>> }} entree
 * @returns {string[]}
 */
export function ecartsDuBranchement({ racine, gestionnaire, scripts }) {
  const declares = /** @type {Record<string, string>} */ (
    lireJson(join(racine, 'package.json')).scripts
  );
  const cheminWorkflow = join(racine, WORKFLOW);
  const workflow = existsSync(cheminWorkflow) ? readFileSync(cheminWorkflow, 'utf8') : '';
  return Object.entries(scripts).flatMap(([porte, script]) => {
    const { v5, v4 } = PORTES[/** @type {Porte} */ (porte)];
    const etapes = etapesDe(declares[script]);
    const appel = `${gestionnaire} run ${script}`;
    return [
      [
        etapes.some((etape) => etape.endsWith(`jscpd --config ${v5}`) && !etape.includes('jscpd4')),
        `ne lance pas jscpd --config ${v5}`,
      ],
      [
        etapes.some((etape) => etape.endsWith(`jscpd4/bin/jscpd --config ${v4}`)),
        `ne lance pas jscpd4/bin/jscpd --config ${v4}`,
      ],
      [etapesDe(declares['ci:check']).includes(appel), 'absent de ci:check'],
      [etapesDe(declares['pre-push:check']).includes(appel), 'absent de pre-push:check'],
      [
        workflow.split('\n').some((ligne) => ligne.trimEnd().endsWith(` ${appel}`)),
        `absent du workflow ${WORKFLOW}`,
      ],
    ].flatMap(([tenu, ecart]) => (tenu ? [] : [`${script} : ${ecart}`]));
  });
}
