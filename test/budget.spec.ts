import { describe, expect, it } from 'vitest';
import {
  type Feuille,
  FeuilleHorsLimitesError,
  NOMBRE_MAX_CELLULES,
  evaluerCellule,
  evaluerFeuille,
} from '../src/formule';
import {
  chaineDeDoublements,
  colonneDeSommesCirculaires,
  cycleDeMaillons,
  formuleRecopiee,
  sommesCroisees,
} from './feuilles';

const BUDGET_MS = 50;
const BUDGET_REFUS_MASSIF_MS = 500;
const MAILLONS = 26;
const CELLULES_HORS_LIMITES = 200_000;
const CELLULES_MASSIVES = 1_000_000;
const CHAUFFES = 5;
const MESURES = 9;

function millisecondesProcesseur(executer: () => void): number {
  const depart = process.cpuUsage();
  executer();
  const consomme = process.cpuUsage(depart);
  return (consomme.user + consomme.system) / 1000;
}

function meilleureMesure(executer: () => void): number {
  for (let chauffe = 0; chauffe < CHAUFFES; chauffe += 1) {
    executer();
  }
  return Math.min(...Array.from({ length: MESURES }, () => millisecondesProcesseur(executer)));
}

const ADVERSES: readonly (readonly [string, Feuille])[] = [
  [`chaine de ${MAILLONS} doublements`, chaineDeDoublements(MAILLONS)],
  [`${MAILLONS} SOMME croisees`, sommesCroisees(MAILLONS)],
  [`cycle de ${MAILLONS} maillons`, cycleDeMaillons(MAILLONS)],
  ['chaine de 1500 doublements', chaineDeDoublements(1500)],
  [`formule recopiee sur ${NOMBRE_MAX_CELLULES} cellules`, formuleRecopiee(NOMBRE_MAX_CELLULES)],
  [`largeur ${NOMBRE_MAX_CELLULES}`, colonneDeSommesCirculaires()],
];

describe(`AC-35 : une feuille adverse tient sous ${BUDGET_MS} ms de processeur`, () => {
  for (const [intitule, feuille] of ADVERSES) {
    it(`evalue « ${intitule} » et rend un resultat par cellule remplie`, () => {
      expect(meilleureMesure(() => evaluerFeuille(feuille))).toBeLessThan(BUDGET_MS);
      expect(evaluerFeuille(feuille).size).toBe(Object.keys(feuille.cellules).length);
    });

    it(`corrige la derniere cellule de « ${intitule} » comme la passe complete`, () => {
      const derniere = Object.keys(feuille.cellules).at(-1) ?? 'A1';

      expect(meilleureMesure(() => evaluerCellule(feuille, derniere))).toBeLessThan(BUDGET_MS);
      expect(evaluerCellule(feuille, derniere)).toEqual(evaluerFeuille(feuille).get(derniere));
    });
  }
});

describe('borne du nombre de cellules', () => {
  it('refuse une feuille au dela de la borne sans la parcourir, et accepte la borne exacte', () => {
    const horsLimites = formuleRecopiee(CELLULES_HORS_LIMITES);

    expect(
      meilleureMesure(() =>
        expect(() => evaluerFeuille(horsLimites)).toThrow(FeuilleHorsLimitesError),
      ),
    ).toBeLessThan(BUDGET_MS);
    expect(() => evaluerCellule(horsLimites, 'A1')).toThrow(FeuilleHorsLimitesError);
    expect(evaluerFeuille(colonneDeSommesCirculaires()).size).toBe(NOMBRE_MAX_CELLULES);
  });

  it('refuse un million de cellules sans jamais les evaluer', () => {
    const million = formuleRecopiee(CELLULES_MASSIVES);

    expect(
      millisecondesProcesseur(() =>
        expect(() => evaluerFeuille(million)).toThrow(FeuilleHorsLimitesError),
      ),
      'compter les cles reste proportionnel a la charge recue ; les evaluer ne doit plus l etre',
    ).toBeLessThan(BUDGET_REFUS_MASSIF_MS);
  });
});
