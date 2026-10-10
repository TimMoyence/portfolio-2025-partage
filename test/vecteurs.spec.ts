import { describe, expect, it } from 'vitest';
import type { Feuille, ResultatFormule } from '../src/formule';
import { evaluerExpression, evaluerFeuille, formeR1C1 } from '../src/formule';
import fichier from './vecteurs.json';

type VecteurFormule =
  | {
      readonly id: string;
      readonly type: 'feuille';
      readonly entree: Feuille;
      readonly attendu: Readonly<Record<string, ResultatFormule>>;
    }
  | {
      readonly id: string;
      readonly type: 'expression';
      readonly entree: {
        readonly expression: string;
        readonly variables: Readonly<Record<string, number>>;
      };
      readonly attendu: ResultatFormule;
    }
  | {
      readonly id: string;
      readonly type: 'r1c1';
      readonly entree: { readonly formule: string; readonly cellule: string };
      readonly attendu: string | null;
    };

const VECTEURS = fichier.vecteurs as readonly VecteurFormule[];

function executer(vecteur: VecteurFormule): unknown {
  switch (vecteur.type) {
    case 'feuille':
      return Object.fromEntries(evaluerFeuille(vecteur.entree));
    case 'expression':
      return evaluerExpression(vecteur.entree.expression, vecteur.entree.variables);
    case 'r1c1':
      return formeR1C1(vecteur.entree.formule, vecteur.entree.cellule);
  }
}

describe('vecteurs du moteur de formules', () => {
  it('a trente-six vecteurs d identifiants uniques', () => {
    expect(new Set(VECTEURS.map((vecteur) => vecteur.id)).size).toBe(36);
  });

  for (const vecteur of VECTEURS) {
    it(`${vecteur.type} « ${vecteur.id} » rend l attendu`, () => {
      expect(executer(vecteur)).toEqual(vecteur.attendu);
    });
  }
});
