import { describe, expect, it } from 'vitest';
import type { Feuille, ResultatFormule } from '../src/formule';
import {
  evaluerCellule,
  evaluerExpression,
  evaluerFeuille,
  formeR1C1,
  FeuilleHorsLimitesError,
  LONGUEUR_MAX_FORMULE,
  NOMBRE_MAX_CELLULES,
  PROFONDEUR_MAX,
  surfaceDeFormule,
} from '../src/formule';
import { chaineDeDoublements, colonneDeSommesCirculaires } from './feuilles';

const REF = '#REF!';
const DIV = '#DIV/0!';
const NOM = '#NOM?';
const VALEUR = '#VALEUR!';

function feuille(cellules: Readonly<Record<string, string>>, lignes = 12, colonnes = 8): Feuille {
  return { lignes, colonnes, cellules };
}

function valeurs(
  resultats: ReadonlyMap<string, ResultatFormule>,
): Record<string, number | string | boolean> {
  return Object.fromEntries(
    [...resultats].map(([nom, resultat]) => [
      nom,
      resultat.erreur ?? resultat.valeur ?? Number.NaN,
    ]),
  );
}

describe('evaluerFeuille', () => {
  it('évalue les formules d’une feuille et ignore les cellules vides', () => {
    const resultats = evaluerFeuille(
      feuille({ A1: '2', A2: '3', A3: '=A1+A2', A4: '   ', A5: '' }),
    );

    expect(valeurs(resultats)).toEqual({ A1: 2, A2: 3, A3: 5 });
  });

  it('lit la virgule décimale française, dans une saisie comme dans une formule', () => {
    const resultats = evaluerFeuille(feuille({ A1: '2,5', A2: '=A1*0,4' }));

    expect(valeurs(resultats)).toEqual({ A1: 2.5, A2: 1 });
  });

  it('signale un cycle par #REF! sur chacun de ses maillons', () => {
    const resultats = evaluerFeuille(feuille({ A1: '=A2', A2: '=A3', A3: '=A1' }));

    expect(valeurs(resultats)).toEqual({ A1: REF, A2: REF, A3: REF });
  });

  it('arrête une plage à sa première cellule circulaire, sans épuiser le budget sur la grille la plus large', () => {
    const large = colonneDeSommesCirculaires();
    const derniere = `A${NOMBRE_MAX_CELLULES}`;

    expect(evaluerFeuille(large).get(derniere)).toEqual({ valeur: null, erreur: REF });
    expect(evaluerCellule(large, derniere)).toEqual({ valeur: null, erreur: REF });
  });

  it('signale une division par une cellule vide par #DIV/0!', () => {
    expect(valeurs(evaluerFeuille(feuille({ A1: '=1/B1' })))).toEqual({ A1: DIV });
  });

  it('signale une référence hors grille par #REF!', () => {
    expect(valeurs(evaluerFeuille(feuille({ A1: '=B1' }, 1, 1)))).toEqual({ A1: REF });
  });

  it('propage l’erreur d’une cellule à celles qui la citent', () => {
    const resultats = evaluerFeuille(feuille({ A1: '=1/0', A2: '=A1+1' }, 2, 1));

    expect(valeurs(resultats)).toEqual({ A1: DIV, A2: DIV });
  });

  it('signale une fonction inconnue par #NOM? et du texte calculé par #VALEUR!', () => {
    const resultats = evaluerFeuille(feuille({ A1: 'Canal', A2: '=RACINE(4)', A3: '=A1+1' }));

    expect(valeurs(resultats)).toEqual({ A1: 'Canal', A2: NOM, A3: VALEUR });
  });

  it('additionne une plage en ignorant ses cellules de texte', () => {
    const resultats = evaluerFeuille(
      feuille({ A1: 'Total', A2: '10', A3: '5', A4: '=SOMME(A1:A3)' }),
    );

    expect(valeurs(resultats).A4).toBe(15);
  });

  it('refuse du texte passé en argument direct à SOMME', () => {
    const resultats = evaluerFeuille(feuille({ A1: 'Total', A2: '=SOMME(A1)' }));

    expect(valeurs(resultats).A2).toBe(VALEUR);
  });

  it('moyenne une plage vide de nombres par #DIV/0!', () => {
    const resultats = evaluerFeuille(feuille({ A1: 'Canal', A2: '=MOYENNE(A1:A1)' }));

    expect(valeurs(resultats).A2).toBe(DIV);
  });

  it('accepte une plage écrite à l’envers et une plage figée', () => {
    const resultats = evaluerFeuille(
      feuille({ A1: '1', A2: '2', B1: '=SOMME(A2:A1)', B2: '=SOMME($A$1:$A$2)' }),
    );

    expect(valeurs(resultats).B1).toBe(3);
    expect(valeurs(resultats).B2).toBe(3);
  });

  it('refuse une plage hors grille par #REF!', () => {
    const resultats = evaluerFeuille(feuille({ A1: '=SOMME(A1:A9)' }, 2, 1));

    expect(valeurs(resultats).A1).toBe(REF);
  });

  it('refuse une plage employée comme un nombre', () => {
    const resultats = evaluerFeuille(feuille({ A1: '1', B1: '=A1:A1+1' }));

    expect(valeurs(resultats).B1).toBe(VALEUR);
  });

  it.each([
    ['une formule plus longue que la borne', `=${'1+'.repeat(LONGUEUR_MAX_FORMULE)}1`],
    [
      'une imbrication plus profonde que la borne',
      `=${'('.repeat(PROFONDEUR_MAX + 1)}1${')'.repeat(PROFONDEUR_MAX + 1)}`,
    ],
  ])('refuse %s', (_cas, trop) => {
    expect(valeurs(evaluerFeuille(feuille({ A1: trop }))).A1).toBe(VALEUR);
  });

  it('arrête le calcul au budget de nœuds et renvoie #VALEUR!', () => {
    const resultats = evaluerFeuille(feuille({ A1: '=SOMME(A2:A12)' }), { budgetNoeuds: 3 });

    expect(valeurs(resultats).A1).toBe(VALEUR);
  });

  it('mémoïse chaque cellule : une chaîne de doublements tient dans un budget linéaire', () => {
    const longueur = 40;

    const resultats = evaluerFeuille(chaineDeDoublements(longueur), {
      budgetNoeuds: 6 * longueur,
    });

    expect(valeurs(resultats)[`A${longueur}`]).toBe(2 ** (longueur - 1));
  });

  it('refuse une feuille dont le nombre de cellules dépasse la borne', () => {
    const cellules: Record<string, string> = {};
    for (let rang = 1; rang <= NOMBRE_MAX_CELLULES + 1; rang += 1) {
      cellules[`A${rang}`] = '1';
    }

    expect(() => evaluerFeuille(feuille(cellules))).toThrow(FeuilleHorsLimitesError);
  });

  it.each([
    ['un exposant qui déborde les flottants', '=10^400'],
    ['une tour de puissances', '=9^9^9^9'],
    ['un nom de cellule hérité de l’objet', '=__proto__+constructor'],
    ['une fonction de l’hôte', '=eval(1)'],
    ['une plage géante', '=SOMME(A1:ZZZZ99999999)'],
    ['un nombre illisible', '=1e999999'],
    ['des opérateurs en rafale', `=1${'+-'.repeat(60)}1`],
    ['un appel sans fermeture', `=SOMME(${'SOMME('.repeat(30)}1`],
  ])('T10 · rend une erreur de tableur, sans lever, pour %s', (_cas, formule) => {
    const b1 = evaluerFeuille(feuille({ A1: '1', B1: formule, ['__proto__']: '=A1' })).get('B1');

    expect(typeof b1?.erreur === 'string' || Number.isFinite(b1?.valeur)).toBe(true);
  });

  it('refuse une feuille dont la grille n’est pas un couple d’entiers positifs', () => {
    expect(() => evaluerFeuille(feuille({ A1: '1' }, 1.5, 1))).toThrow(FeuilleHorsLimitesError);
    expect(() => evaluerFeuille(feuille({ A1: '1' }, 1, -1))).toThrow(FeuilleHorsLimitesError);
  });
});

describe('fonctions à deux séries', () => {
  const donneesMobiles = {
    A1: '0',
    A2: '1',
    A3: '2',
    A4: '3',
    A5: '4',
    B1: '2,20',
    B2: '3,64',
    B3: '5,24',
    B4: '7,13',
    B5: '8,66',
  };

  it('ajuste y en x par les moindres carrés et mesure la corrélation linéaire', () => {
    const resultats = evaluerFeuille(
      feuille({
        ...donneesMobiles,
        D1: '=PENTE(B1:B5;A1:A5)',
        D2: '=ORDONNEE.ORIGINE(B1:B5;A1:A5)',
        D3: '=COEFFICIENT.CORRELATION(A1:A5;B1:B5)',
        D4: '=ARRONDI(coefficient.correlation(A1:A5;B1:B5);6)',
      }),
    );
    const lus = valeurs(resultats);

    expect(lus.D1).toBeCloseTo(1.641, 12);
    expect(lus.D2).toBeCloseTo(2.092, 12);
    expect(lus.D3).toBeCloseTo(0.999045, 6);
    expect(lus.D4).toBeCloseTo(0.999045, 12);
  });

  it('écarte une paire dès qu’un de ses membres est du texte ou vide', () => {
    const resultats = evaluerFeuille(
      feuille({
        A1: 'Rang',
        A2: '0',
        A3: '1',
        A4: '2',
        A5: '3',
        B1: '12',
        B2: '1',
        B3: '3',
        B4: 'absent',
        B5: '7',
        C1: '=PENTE(B1:B5;A1:A5)',
        C2: '=ORDONNEE.ORIGINE(B1:B5;A1:A5)',
      }),
    );

    expect(valeurs(resultats).C1).toBe(2);
    expect(valeurs(resultats).C2).toBe(1);
  });

  it('refuse des séries de tailles différentes ou passées hors plage par #VALEUR!', () => {
    const resultats = evaluerFeuille(
      feuille({
        ...donneesMobiles,
        D1: '=PENTE(B1:B5;A1:A4)',
        D2: '=PENTE(B1:B5)',
        D3: '=PENTE(3;4)',
      }),
    );

    expect(valeurs(resultats)).toMatchObject({ D1: VALEUR, D2: VALEUR, D3: VALEUR });
  });

  it('signale une série constante ou trop courte par #DIV/0!', () => {
    const resultats = evaluerFeuille(
      feuille({
        A1: '5',
        A2: '5',
        B1: '1',
        B2: '4',
        C1: '=PENTE(B1:B2;A1:A2)',
        C2: '=COEFFICIENT.CORRELATION(B1:B2;A1:A2)',
        C3: '=PENTE(B1:B1;A1:A1)',
      }),
    );

    expect(valeurs(resultats)).toMatchObject({ C1: DIV, C2: DIV, C3: DIV });
  });

  it('propage l’erreur d’une cellule appariée', () => {
    const resultats = evaluerFeuille(
      feuille({
        A1: '1',
        A2: '2',
        B1: '=1/0',
        B2: '3',
        C1: '=COEFFICIENT.CORRELATION(A1:A2;B1:B2)',
      }),
    );

    expect(valeurs(resultats).C1).toBe(DIV);
  });

  it('garde #NOM? pour un nom pointé inconnu', () => {
    expect(evaluerExpression('LOI.INCONNUE(1)', {})).toEqual({ valeur: null, erreur: NOM });
  });
});

describe('VPM', () => {
  it('rend l’annuité constante d’un emprunt, négative pour un capital reçu', () => {
    const resultats = evaluerFeuille(
      feuille({
        A1: '0,035',
        A2: '4',
        A3: '32000',
        B1: '=VPM(A1;A2;-A3)',
        B2: '=VPM(A1;A2;A3)',
        B3: '=ARRONDI(VPM(0,04;5;-60000);2)',
      }),
    );
    const lus = valeurs(resultats);

    expect(lus.B1).toBeCloseTo(8712.036464, 6);
    expect(lus.B2).toBeCloseTo(-8712.036464, 6);
    expect(lus.B3).toBeCloseTo(13477.63, 6);
  });

  it('tient compte d’une valeur future et d’un versement en début de période', () => {
    expect(evaluerExpression('VPM(0,03;5;0;-31854,81486)', {})).toEqual({
      valeur: 6000,
      erreur: null,
    });
    expect(evaluerExpression('VPM(0,04;5;-60000;0;1)', {})).toEqual({
      valeur: 12959.256548,
      erreur: null,
    });
  });

  it('partage le capital en parts égales quand le taux est nul', () => {
    expect(evaluerExpression('VPM(0;4;-1000;-200)', {})).toEqual({ valeur: 300, erreur: null });
  });

  it('refuse un nombre de périodes nul par #DIV/0! et un mauvais nombre d’arguments par #VALEUR!', () => {
    const resultats = evaluerFeuille(
      feuille({
        A1: '=VPM(0,04;0;-1000)',
        A2: '=VPM(0;0;-1000)',
        A3: '=VPM(0,04;5)',
        A4: '=VPM(0,04;5;-1000;0;0;1)',
      }),
    );

    expect(valeurs(resultats)).toEqual({ A1: DIV, A2: DIV, A3: VALEUR, A4: VALEUR });
  });
});

describe('EXP et LN', () => {
  it('calcule l’exponentielle et le logarithme népérien d’une cellule', () => {
    const resultats = evaluerFeuille(
      feuille({
        A1: '5',
        B1: '=400*EXP(0,06*A1)',
        C1: '=LN(B1/400)/0,06',
        D1: '=EXP(1)',
        E1: '=LN(2)',
      }),
    );
    const lus = valeurs(resultats);

    expect(lus.B1).toBeCloseTo(539.943523, 6);
    expect(lus.C1).toBeCloseTo(5, 9);
    expect(lus.D1).toBeCloseTo(Math.E, 12);
    expect(lus.E1).toBeCloseTo(Math.LN2, 12);
  });

  it('rend e⁰ = 1, ln 1 = 0 et ramène ln(eˣ) à x', () => {
    expect(evaluerExpression('EXP(0)', {})).toEqual({ valeur: 1, erreur: null });
    expect(evaluerExpression('LN(1)', {})).toEqual({ valeur: 0, erreur: null });
    expect(evaluerExpression('LN(EXP(2,5))', {})).toEqual({ valeur: 2.5, erreur: null });
    expect(evaluerExpression('LN(2,5)/0,06', {})).toEqual({ valeur: 15.271512, erreur: null });
  });

  it('refuse par #VALEUR! le logarithme d’un nombre négatif ou nul, une exponentielle infinie et un mauvais nombre d’arguments', () => {
    const resultats = evaluerFeuille(
      feuille({
        A1: '=LN(0)',
        A2: '=LN(-1)',
        A3: '=EXP(LN(0))',
        A4: '=EXP(1000)',
        A5: '=EXP()',
        A6: '=LN(2;3)',
      }),
    );

    expect(valeurs(resultats)).toEqual({
      A1: VALEUR,
      A2: VALEUR,
      A3: VALEUR,
      A4: VALEUR,
      A5: VALEUR,
      A6: VALEUR,
    });
  });
});

describe('texte et logique', () => {
  const FACTURES = {
    A1: '72',
    B1: 'Impayée',
    A2: '60',
    B2: 'impayée',
    A3: '90',
    B3: 'Payée',
    C1: '=SI(ET(B1="Impayée";A1>60);"Relancer";"")',
    C2: '=SI(ET(B2="Impayée";A2>60);"Relancer";"")',
    C3: '=SI(ET(B3="Impayée";A3>60);"Relancer";"")',
    D1: '=NB.SI(C1:C3;"Relancer")',
  };

  it('rend le texte d’une cellule saisie et celui d’une formule', () => {
    const resultats = valeurs(evaluerFeuille(feuille(FACTURES)));

    expect(resultats).toMatchObject({ B1: 'Impayée', C1: 'Relancer', C2: '', C3: '', D1: 1 });
  });

  it('lit une chaîne entre guillemets, guillemet doublé compris, et refuse une chaîne ouverte', () => {
    expect(valeurs(evaluerFeuille(feuille({ A1: '="a""b"', A2: '="abc' })))).toEqual({
      A1: 'a"b',
      A2: VALEUR,
    });
  });

  it('rend VRAI ou FAUX pour une comparaison, une constante ou une saisie', () => {
    const resultats = evaluerFeuille(
      feuille({ A1: '72', B1: '=A1>60', B2: '=A1<=60', B3: '=VRAI', B4: '=faux', B5: 'Vrai' }),
    );

    expect(valeurs(resultats)).toMatchObject({
      B1: true,
      B2: false,
      B3: true,
      B4: false,
      B5: true,
    });
  });

  it('compare deux textes sans tenir compte de la casse, et range nombre < texte < booléen', () => {
    const resultats = evaluerFeuille(
      feuille({
        A1: '="impayée"="Impayée"',
        A2: '="a"<"B"',
        A3: '=1="1"',
        A4: '="a">5',
        A5: '=VRAI>"z"',
        A6: '="France"<>"france"',
      }),
    );

    expect(valeurs(resultats)).toEqual({
      A1: true,
      A2: true,
      A3: false,
      A4: true,
      A5: true,
      A6: false,
    });
  });

  it('convertit VRAI et un texte numérique en calcul, et refuse un autre texte', () => {
    const resultats = evaluerFeuille(
      feuille({ A1: '=VRAI+1', A2: '="3"+1', A3: '="a"+1', A4: '=-FAUX' }),
    );

    expect(valeurs(resultats)).toEqual({ A1: 2, A2: 4, A3: VALEUR, A4: 0 });
  });

  it('combine des conditions par ET, OU et NON', () => {
    const resultats = evaluerFeuille(
      feuille({
        A1: '=ET(VRAI;1>0)',
        A2: '=ET(VRAI;0)',
        A3: '=OU(FAUX;0)',
        A4: '=OU(FAUX;2)',
        A5: '=NON(3>2)',
        A6: '=NON(0)',
      }),
    );

    expect(valeurs(resultats)).toEqual({
      A1: true,
      A2: false,
      A3: false,
      A4: true,
      A5: false,
      A6: true,
    });
  });

  it('lit dans une plage les seules valeurs logiques ou numériques de ET et OU', () => {
    const resultats = evaluerFeuille(
      feuille({ A1: '=1>0', A2: 'texte', B1: '=ET(A1:A3)', B2: '=OU(A2:A3)' }),
    );

    expect(valeurs(resultats)).toMatchObject({ B1: true, B2: VALEUR });
  });

  it('refuse du texte en condition, un NON à deux arguments et propage une erreur', () => {
    const resultats = evaluerFeuille(
      feuille({
        A1: '=ET("a")',
        A2: '=NON(1;2)',
        A3: '=OU(1/0;VRAI)',
        A4: '=SI("a";1;0)',
        A5: '=ET()',
      }),
    );

    expect(valeurs(resultats)).toEqual({
      A1: VALEUR,
      A2: VALEUR,
      A3: DIV,
      A4: VALEUR,
      A5: VALEUR,
    });
  });

  it('rend FAUX pour un SI à deux arguments dont la condition est fausse', () => {
    expect(valeurs(evaluerFeuille(feuille({ A1: '=SI(1>2;10)' })))).toEqual({ A1: false });
  });

  it('ignore les textes et les booléens calculés dans une plage numérique', () => {
    const resultats = evaluerFeuille(
      feuille({ A1: '=SI(1>0;"x";"")', A2: '4', A3: '=2>1', A4: '=SOMME(A1:A3)' }),
    );

    expect(valeurs(resultats).A4).toBe(4);
  });

  describe('NB.SI', () => {
    const DONNEES = {
      A1: 'France',
      A2: 'Allemagne',
      A3: 'france',
      A5: 'Espagne',
      B1: '6400',
      B2: '890',
      B3: '5000',
      B4: 'n/a',
      B5: '=4999+1',
    };

    function compter(critere: string): number | string | boolean {
      const resultats = evaluerFeuille(feuille({ ...DONNEES, D1: `=NB.SI(${critere})` }));
      return valeurs(resultats).D1;
    }

    it('compte un texte égal sans tenir compte de la casse', () => {
      expect(compter('A1:A5;"France"')).toBe(2);
    });

    it('compte les cellules différentes d’un texte, vides comprises', () => {
      expect(compter('A1:A5;"<>France"')).toBe(3);
    });

    it('compte les cellules vides avec un critère vide', () => {
      expect(compter('A1:A5;""')).toBe(1);
    });

    it('compare les seuls nombres à un critère numérique, virgule comprise', () => {
      expect(compter('B1:B5;">=5000"')).toBe(3);
      expect(compter('B1:B5;">1000,5"')).toBe(3);
      expect(compter('B1:B5;"<1000"')).toBe(1);
    });

    it('compte les égalités à un nombre ou à une cellule', () => {
      expect(compter('B1:B5;5000')).toBe(2);
      expect(compter('B1:B5;B2')).toBe(1);
    });

    it('refuse un critère sans guillemets, une plage absente ou un argument manquant', () => {
      expect(compter('B1:B5;>=5000')).toBe(VALEUR);
      expect(compter('5;">1"')).toBe(VALEUR);
      expect(compter('B1:B5')).toBe(VALEUR);
    });

    it('ignore une cellule en erreur de la plage sans échouer', () => {
      expect(
        valeurs(evaluerFeuille(feuille({ A1: '=1/0', A2: '7', B1: '=NB.SI(A1:A2;">0")' }))).B1,
      ).toBe(1);
    });

    it('propage une référence circulaire à toutes ses cellules, quelle que soit la cellule d’entrée', () => {
      const circulaire = feuille({ A1: '5', A2: '=OU(B1>0;FAUX)', B1: '=NB.SI(A1:A2;">0")' });
      const passe = evaluerFeuille(circulaire);

      expect(valeurs(passe)).toEqual({ A1: 5, A2: REF, B1: REF });
      for (const [nom, attendu] of passe) {
        expect(evaluerCellule(circulaire, nom)).toEqual(attendu);
      }
    });
  });
});

describe('evaluerCellule', () => {
  const grille = feuille({ A1: '4', A2: '=A1*2' });

  it('rend le résultat d’une cellule nommée, quelle que soit la casse', () => {
    expect(evaluerCellule(grille, 'a2')).toEqual({ valeur: 8, erreur: null });
  });

  it('rend zéro pour une cellule vide de la grille', () => {
    expect(evaluerCellule(grille, 'B3')).toEqual({ valeur: 0, erreur: null });
  });

  it('rend #REF! pour un nom illisible ou hors grille', () => {
    expect(evaluerCellule(grille, 'zzz')).toEqual({ valeur: null, erreur: REF });
    expect(evaluerCellule(grille, 'A99')).toEqual({ valeur: null, erreur: REF });
  });

  it('refuse une feuille hors limites comme evaluerFeuille', () => {
    expect(() => evaluerCellule(feuille({ A1: '1' }, -1, 1), 'A1')).toThrow(
      FeuilleHorsLimitesError,
    );
  });
});

describe('evaluerExpression', () => {
  it('résout les variables et arrondit le résultat au millionième', () => {
    expect(evaluerExpression('prix / avantPrix', { prix: 20.52, avantPrix: 21.6 })).toEqual({
      valeur: 0.95,
      erreur: null,
    });
    expect(evaluerExpression('1/3', {})).toEqual({ valeur: 0.333333, erreur: null });
  });

  it('accepte le signe égal de tête', () => {
    expect(evaluerExpression('=2+3', {})).toEqual({ valeur: 5, erreur: null });
  });

  it('élève à la puissance en associant à gauche', () => {
    expect(evaluerExpression('2^3^2', {})).toEqual({ valeur: 64, erreur: null });
    expect(evaluerExpression('PUISSANCE(2;10)', {})).toEqual({ valeur: 1024, erreur: null });
  });

  it('arrondit la moitié en s’éloignant de zéro', () => {
    const arrondis = ['ARRONDI(-2,5;0)', 'ARRONDI(2,5;0)', 'ARRONDI(1,005;2)'];

    expect(arrondis.map((expression) => evaluerExpression(expression, {}).valeur)).toEqual([
      -3, 3, 1.01,
    ]);
  });

  it('accepte SI à deux ou à trois arguments', () => {
    expect(evaluerExpression('SI(1>2;10)', {}).valeur).toBe(0);
    expect(evaluerExpression('SI(1<2;10;20)', {}).valeur).toBe(10);
  });

  it.each([
    'NON()',
    'NON(1;2)',
    'SI(1)',
    'SI(1;2;3;4)',
    'EXP()',
    'EXP(1;2)',
    'PUISSANCE(2)',
    'PUISSANCE(2;3;4)',
    'QUARTILE(1)',
    'VPM(0,1;2)',
    'VPM(0,1;2;3;4;5;6)',
    'NB.SI(1;">0")',
    'PENTE(1;2)',
  ])('refuse %s, dont le nombre ou le genre des arguments est faux', (expression) => {
    expect(evaluerExpression(expression, {})).toEqual({ valeur: null, erreur: VALEUR });
  });

  it('compare et rend 1 ou 0', () => {
    expect(evaluerExpression('SI(3<>4;1;0)', {}).valeur).toBe(1);
    expect(evaluerExpression('SI(4>=4;1;0)', {}).valeur).toBe(1);
    expect(evaluerExpression('2>1', {}).valeur).toBe(1);
    expect(evaluerExpression('ET(2>1;FAUX)', {}).valeur).toBe(0);
  });

  it('refuse un résultat texte, qu’aucune colonne déduite ne sait lire', () => {
    expect(evaluerExpression('"a"', {}).erreur).toBe(VALEUR);
  });

  it('refuse une variable inconnue par #NOM?', () => {
    expect(evaluerExpression('inconnue + 1', {})).toEqual({ valeur: null, erreur: NOM });
  });

  it('refuse une division par zéro et une référence de cellule sans feuille', () => {
    expect(evaluerExpression('1/0', {}).erreur).toBe(DIV);
    expect(evaluerExpression('A1+1', {}).erreur).toBe(REF);
  });

  it('refuse une expression illisible et un résultat non fini', () => {
    expect(evaluerExpression('2+', {}).erreur).toBe(VALEUR);
    expect(evaluerExpression('2^1024', {}).erreur).toBe(VALEUR);
  });

  it('s’arrête au budget de nœuds', () => {
    expect(evaluerExpression('1+1+1+1+1', {}, { budgetNoeuds: 2 }).erreur).toBe(VALEUR);
  });
});

describe('surfaceDeFormule', () => {
  it('relève les références sans le dollar et les littéraux décimaux', () => {
    expect(surfaceDeFormule('=SOMME($C$2:C4)/100+0,5')).toEqual({
      references: ['C2', 'C4'],
      litteraux: [100, 0.5],
    });
  });

  it('ne compte pas une chaîne parmi les littéraux', () => {
    expect(surfaceDeFormule('=NB.SI(H2:H17;"Relancer")')).toEqual({
      references: ['H2', 'H17'],
      litteraux: [],
    });
  });

  it('rend null pour une valeur tapée et pour une formule illisible', () => {
    expect(surfaceDeFormule('0,345217')).toBeNull();
    expect(surfaceDeFormule('=C2/')).toBeNull();
  });
});

describe('formeR1C1', () => {
  it('rend les décalages relatifs d’une formule recopiable', () => {
    expect(formeR1C1('=(C2-B2)/B2', 'D2')).toBe('=(RC[-1]-RC[-2])/RC[-2]');
    expect(formeR1C1('=C2*F2', 'G2')).toBe('=RC[-4]*RC[-1]');
  });

  it('rend la même forme pour une référence figée recopiée', () => {
    expect(formeR1C1('=C2/$C$5', 'E2')).toBe('=RC[-2]/R5C3');
    expect(formeR1C1('=C3/$C$5', 'E3')).toBe('=RC[-2]/R5C3');
  });

  it('omet le crochet quand le décalage est nul et garde les mixtes', () => {
    expect(formeR1C1('=A2', 'A3')).toBe('=R[-1]C');
    expect(formeR1C1('=$A2', 'B2')).toBe('=RC1');
    expect(formeR1C1('=A$2', 'B3')).toBe('=R2C[-1]');
  });

  it('conserve les noms de fonctions et les séparateurs', () => {
    expect(formeR1C1('=SI(ARRONDI(SOMME(E2:E4);6)=1;1;0)', 'B7')).toBe(
      '=SI(ARRONDI(SOMME(R[-5]C[3]:R[-3]C[3]);6)=1;1;0)',
    );
  });

  it('garde les chaînes telles quelles dans la forme recopiable', () => {
    expect(formeR1C1('=SI(F2="Impayée";"Relancer";"")', 'H2')).toBe(
      '=SI(RC[-2]="Impayée";"Relancer";"")',
    );
  });

  it('rend null hors formule, hors cellule et hors syntaxe', () => {
    expect(formeR1C1('0,35', 'E2')).toBeNull();
    expect(formeR1C1('=C2', 'plop')).toBeNull();
    expect(formeR1C1('=C2/', 'E2')).toBeNull();
  });
});
