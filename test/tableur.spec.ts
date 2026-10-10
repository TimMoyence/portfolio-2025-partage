import { describe, expect, it } from 'vitest';
import {
  type Feuille,
  type ValeurFormule,
  LONGUEUR_MAX_FORMULE,
  PROFONDEUR_MAX,
  decalerFormule,
  estUneFormule,
  evaluerCellule,
  evaluerExpression,
  evaluerFeuille,
  formaterResultat,
  formeR1C1,
  lettreColonne,
  nomCellule,
  remplirGabarit,
} from '../src/formule';

const GRILLE = { lignes: 12, colonnes: 6 };
const DELAI_MAX_MS = 200;
const IMBRICATIONS = 200;

function feuille(cellules: Readonly<Record<string, string>>): Feuille {
  return { ...GRILLE, cellules };
}

function resultatDe(cellules: Readonly<Record<string, string>>, nom = 'A1'): ValeurFormule | null {
  return evaluerCellule(feuille(cellules), nom).valeur;
}

function valeurDe(cellules: Readonly<Record<string, string>>, nom = 'A1'): number | null {
  const valeur = resultatDe(cellules, nom);
  return typeof valeur === 'number' ? valeur : null;
}

function erreurDe(cellules: Readonly<Record<string, string>>, nom = 'A1'): string | null {
  return evaluerCellule(feuille(cellules), nom).erreur;
}

function calcul(formule: string): number | null {
  return valeurDe({ A1: formule });
}

function refus(formule: string): string | null {
  return erreurDe({ A1: formule });
}

function approche(formule: string): number {
  return calcul(formule) ?? Number.NaN;
}

describe('priorite des operateurs et parentheses', () => {
  it('applique la priorite multiplicative avant l addition', () => {
    expect(calcul('=2+3*4')).toBe(14);
    expect(calcul('=2*3+4')).toBe(10);
    expect(calcul('=20-6/3')).toBe(18);
  });

  it('laisse les parentheses renverser la priorite', () => {
    expect(calcul('=(2+3)*4')).toBe(20);
    expect(calcul('=2*(3+4)')).toBe(14);
    expect(calcul('=((2+3)*(4-1))/5')).toBe(3);
  });

  it('eleve a la puissance avant de multiplier et associe a gauche comme un tableur', () => {
    expect(calcul('=2*3^2')).toBe(18);
    expect(calcul('=2^3^2')).toBe(64);
    expect(
      calcul('=-2^2'),
      'le signe unaire lie plus fort que l exposant, comme dans un tableur',
    ).toBe(4);
  });

  it('accepte le nombre decimal a la francaise et le point-virgule des arguments', () => {
    expect(calcul('=1,5+2,25')).toBe(3.75);
    expect(calcul('=SOMME(1,5;2,5)')).toBe(4);
    expect(calcul('=1.5*2')).toBe(3);
  });
});

describe('references', () => {
  it('lit une reference relative, absolue et mixte de la meme facon', () => {
    const cellules = { A1: '=B2+$C$1+B$2+$B2', B2: '10', C1: '5' };
    expect(valeurDe(cellules)).toBe(35);
  });

  it('compte une cellule vide pour zero sans rendre d erreur', () => {
    expect(valeurDe({ A1: '=B2+1' })).toBe(1);
    expect(erreurDe({ A1: '=B2+1' })).toBeNull();
    expect(valeurDe({ A1: '=SOMME(B1:B5)' })).toBe(0);
  });

  it('rend #REF! pour une cellule hors de la grille', () => {
    expect(refus('=Z1')).toBe('#REF!');
    expect(refus('=A99')).toBe('#REF!');
    expect(refus('=SOMME(A1:Z1)')).toBe('#REF!');
  });

  it('rend #VALEUR! quand la cellule visee porte du texte', () => {
    expect(erreurDe({ A1: '=B1+1', B1: 'trois' })).toBe('#VALEUR!');
  });

  it('propage l erreur de la cellule visee au lieu de la masquer', () => {
    expect(erreurDe({ A1: '=B1+1', B1: '=1/0' })).toBe('#DIV/0!');
  });

  it('decale les references relatives a la recopie et fige celles ancrees', () => {
    expect(decalerFormule('=B2*$C$1', 1, 0)).toBe('=B3*$C$1');
    expect(decalerFormule('=B$2+$B2', 2, 1)).toBe('=C$2+$B4');
    expect(decalerFormule('=SOMME(B2:B4)', 1, 0)).toBe('=SOMME(B3:B5)');
    expect(decalerFormule('=A1', -1, 0)).toBe('=#REF!');
    expect(decalerFormule('12', 1, 0)).toBe('12');
  });
});

describe('references circulaires', () => {
  it('rend #REF! et non une boucle quand une cellule se cite elle-meme', () => {
    const debut = Date.now();
    expect(erreurDe({ A1: '=A1' })).toBe('#REF!');
    expect(erreurDe({ A1: '=A1+1' })).toBe('#REF!');
    expect(Date.now() - debut, 'un cycle direct doit etre coupe, pas parcouru').toBeLessThan(
      DELAI_MAX_MS,
    );
  });

  it('rend #REF! et non une boucle pour un cycle indirect de deux cellules', () => {
    const debut = Date.now();
    expect(erreurDe({ A1: '=B1', B1: '=A1' })).toBe('#REF!');
    expect(Date.now() - debut).toBeLessThan(DELAI_MAX_MS);
  });

  it('rend #REF! et non une boucle pour un cycle indirect de trois cellules', () => {
    const debut = Date.now();
    const cellules = { A1: '=B1+1', B1: '=C1*2', C1: '=A1-3' };
    expect(erreurDe(cellules)).toBe('#REF!');
    expect(erreurDe(cellules, 'B1')).toBe('#REF!');
    expect(
      Date.now() - debut,
      'trois cellules qui se citent en rond doivent etre coupees, pas parcourues',
    ).toBeLessThan(DELAI_MAX_MS);
  });

  it('ne prend pas un losange sans cycle pour une reference circulaire', () => {
    const cellules = { A1: '=B1+C1', B1: '=D1*2', C1: '=D1*3', D1: '4' };
    expect(valeurDe(cellules)).toBe(20);
    expect(erreurDe(cellules)).toBeNull();
  });
});

describe('erreurs nommees', () => {
  it('rend #DIV/0! pour une division par zero, directe ou indirecte', () => {
    expect(refus('=1/0')).toBe('#DIV/0!');
    expect(refus('=0/0')).toBe('#DIV/0!');
    expect(erreurDe({ A1: '=10/B1', B1: '' })).toBe('#DIV/0!');
    expect(refus('=MOYENNE(B1:B2)')).toBeNull();
  });

  it('rend #NOM? pour une fonction inconnue et pour un mot isole', () => {
    expect(refus('=TOTAL(1;2)')).toBe('#NOM?');
    expect(refus('=SUM(1;2)')).toBe('#NOM?');
    expect(refus('=bonjour')).toBe('#NOM?');
  });

  it('rend #VALEUR! pour une expression malformee sans jamais lever', () => {
    expect(refus('=(1+2')).toBe('#VALEUR!');
    expect(refus('=1+2)')).toBe('#VALEUR!');
    expect(refus('=1+')).toBe('#VALEUR!');
    expect(refus('=*3')).toBe('#VALEUR!');
    expect(refus('=1 2')).toBe('#VALEUR!');
    expect(refus('=SOMME(1;)')).toBe('#VALEUR!');
    expect(refus('=B1:B3')).toBe('#VALEUR!');
    expect(refus('=')).toBe('#VALEUR!');
  });

  it('rend #VALEUR! plutot qu un infini quand le calcul deborde', () => {
    expect(refus('=PUISSANCE(10;400)')).toBe('#VALEUR!');
  });
});

describe('fonctions francaises', () => {
  const cellules = { B1: '10', B2: '20', B3: '30', C1: '0' };

  it('somme une plage, des arguments et un melange des deux', () => {
    expect(valeurDe({ ...cellules, A1: '=SOMME(B1:B3)' })).toBe(60);
    expect(valeurDe({ ...cellules, A1: '=SOMME(B1;B3;5)' })).toBe(45);
    expect(valeurDe({ ...cellules, A1: '=SOMME(B1:B2;100)' })).toBe(130);
  });

  it('moyenne une plage et rend #DIV/0! sans aucune valeur', () => {
    expect(valeurDe({ ...cellules, A1: '=MOYENNE(B1:B3)' })).toBe(20);
    expect(erreurDe({ ...cellules, A1: '=MOYENNE()' })).toBe('#DIV/0!');
  });

  it('choisit la branche de SI sans evaluer celle qui est ecartee', () => {
    expect(valeurDe({ ...cellules, A1: '=SI(B1>5;1;0)' })).toBe(1);
    expect(valeurDe({ ...cellules, A1: '=SI(B1<5;1;0)' })).toBe(0);
    expect(
      valeurDe({ ...cellules, A1: '=SI(C1=0;0;B1/C1)' }),
      'la branche ecartee divise par zero : elle ne doit pas etre calculee',
    ).toBe(0);
  });

  it('arrondit au nombre de decimales demande et eleve a la puissance', () => {
    expect(approche('=ARRONDI(3,14159;2)')).toBeCloseTo(3.14, 6);
    expect(calcul('=ARRONDI(1234,5;-2)')).toBe(1200);
    expect(approche('=PUISSANCE(1,05;2)')).toBeCloseTo(1.1025, 6);
    expect(approche('=ARRONDI(PUISSANCE(1,05;10)*1000;2)')).toBeCloseTo(1628.89, 6);
  });

  it('accepte le nom de fonction en minuscules comme un tableur', () => {
    expect(valeurDe({ ...cellules, A1: '=somme(B1:B3)' })).toBe(60);
  });
});

describe('fonctions statistiques', () => {
  const serie = { B1: '4', B2: '2', B3: '9', B4: '4', B5: '5', B6: '4', B7: '7', B8: '5' };
  const troue = { B1: '1', B2: '', B3: 'absent', B4: '3' };

  it('rend le minimum, le maximum et l effectif d une plage', () => {
    expect(valeurDe({ ...serie, A1: '=MIN(B1:B8)' })).toBe(2);
    expect(valeurDe({ ...serie, A1: '=MAX(B1:B8)' })).toBe(9);
    expect(valeurDe({ ...serie, A1: '=NB(B1:B8)' })).toBe(8);
    expect(valeurDe({ ...serie, A1: '=MAX(B1:B3;12)' })).toBe(12);
  });

  it('rend la mediane d un effectif pair comme d un effectif impair', () => {
    expect(valeurDe({ ...serie, A1: '=MEDIANE(B1:B8)' })).toBe(4.5);
    expect(valeurDe({ ...serie, A1: '=MEDIANE(B1:B7)' })).toBe(4);
    expect(calcul('=MEDIANE(3;1;2)')).toBe(2);
  });

  it('interpole les quartiles comme QUARTILE.INCLURE et tronque le rang demande', () => {
    expect(
      calcul('=QUARTILE(1;2;3;4;1)'),
      'le dernier argument est le rang du quartile, pas une valeur de la serie',
    ).toBeNull();
    const quatre = { B1: '1', B2: '2', B3: '3', B4: '4' };
    expect(valeurDe({ ...quatre, A1: '=QUARTILE(B1:B4;1)' })).toBe(1.75);
    expect(valeurDe({ ...quatre, A1: '=QUARTILE(B1:B4;3)' })).toBe(3.25);
    expect(valeurDe({ ...quatre, A1: '=QUARTILE(B1:B4;0)' })).toBe(1);
    expect(valeurDe({ ...quatre, A1: '=QUARTILE(B1:B4;2)' })).toBe(2.5);
    expect(valeurDe({ ...quatre, A1: '=QUARTILE(B1:B4;4)' })).toBe(4);
    expect(valeurDe({ ...quatre, A1: '=QUARTILE(B1:B4;1,9)' })).toBe(1.75);
    expect(erreurDe({ ...quatre, A1: '=QUARTILE(B1:B4;5)' })).toBe('#VALEUR!');
    expect(erreurDe({ ...quatre, A1: '=QUARTILE(B1:B4;-1)' })).toBe('#VALEUR!');
    expect(erreurDe({ ...quatre, A1: '=QUARTILE(B1:B4)' })).toBe('#VALEUR!');
  });

  it('distingue l ecart type de la population de celui de l echantillon', () => {
    expect(valeurDe({ ...serie, A1: '=ECARTYPEP(B1:B8)' })).toBe(2);
    expect(approche('=ECARTYPE(2;4;4;4;5;5;7;9)')).toBeCloseTo(Math.sqrt(32 / 7), 12);
    expect(refus('=ECARTYPE(5)')).toBe('#DIV/0!');
    expect(calcul('=ECARTYPEP(5)')).toBe(0);
  });

  it('ignore les cellules vides et le texte d une plage, comme un tableur', () => {
    expect(valeurDe({ ...troue, A1: '=NB(B1:B4)' })).toBe(2);
    expect(valeurDe({ ...troue, A1: '=MEDIANE(B1:B4)' })).toBe(2);
    expect(valeurDe({ ...troue, A1: '=MIN(B1:B4)' })).toBe(1);
    expect(valeurDe({ ...troue, A1: '=ECARTYPEP(B1:B4)' })).toBe(1);
  });

  it('rend une erreur nommee quand la serie est vide, sauf pour MIN, MAX et NB', () => {
    expect(refus('=MEDIANE(B1:B3)')).toBe('#VALEUR!');
    expect(refus('=QUARTILE(B1:B3;1)')).toBe('#VALEUR!');
    expect(refus('=ECARTYPEP(B1:B3)')).toBe('#DIV/0!');
    expect(calcul('=MIN(B1:B3)')).toBe(0);
    expect(calcul('=MAX(B1:B3)')).toBe(0);
    expect(calcul('=NB(B1:B3)')).toBe(0);
  });

  it('propage l erreur d une cellule de la plage au lieu de l ignorer', () => {
    expect(erreurDe({ B1: '=1/0', B2: '3', A1: '=MEDIANE(B1:B2)' })).toBe('#DIV/0!');
  });
});

describe('entrees hostiles', () => {
  const HOSTILES: readonly [string, string][] = [
    ['=constructor', '#NOM?'],
    ['=process', '#NOM?'],
    ['=alert(1)', '#NOM?'],
    ['=fetch(1)', '#NOM?'],
    ['=require(1)', '#NOM?'],
    ['=__proto__', '#VALEUR!'],
    ['=eval("2+2")', '#NOM?'],
    ['=this.constructor', '#VALEUR!'],
    ['=window[0]', '#VALEUR!'],
    ['=1;globalThis', '#VALEUR!'],
    ['=`2+2`', '#VALEUR!'],
    ['=A1.toString()', '#VALEUR!'],
    ['=(function(){})()', '#VALEUR!'],
    ['=1||1', '#VALEUR!'],
    ['=document&&1', '#VALEUR!'],
  ];

  for (const [formule, attendu] of HOSTILES) {
    it(`refuse « ${formule} » et rend ${attendu}`, () => {
      expect(refus(formule)).toBe(attendu);
      expect(valeurDe({ A1: formule })).toBeNull();
    });
  }

  it('n execute pas une formule qui ecrirait un temoin global', () => {
    const portee = globalThis as unknown as Record<string, unknown>;
    delete portee['fpTemoinFormule'];
    expect(refus('=(globalThis.fpTemoinFormule=1)')).toBe('#VALEUR!');
    expect(refus('=fpTemoinFormule')).toBe('#NOM?');
    expect(
      portee['fpTemoinFormule'],
      'la formule aurait pose ce temoin si elle avait ete executee comme du code',
    ).toBeUndefined();
  });
});

describe('robustesse', () => {
  it('evalue une imbrication jusqu a la profondeur maximale', () => {
    const formule = `=${'('.repeat(PROFONDEUR_MAX)}7${')'.repeat(PROFONDEUR_MAX)}`;
    expect(calcul(formule)).toBe(7);
  });

  it('refuse une imbrication au-dela de la profondeur maximale par une erreur nommee', () => {
    const profonde = `=${'('.repeat(PROFONDEUR_MAX + 1)}7${')'.repeat(PROFONDEUR_MAX + 1)}`;
    expect(refus(profonde)).toBe('#VALEUR!');
    expect(refus(`=${'-'.repeat(PROFONDEUR_MAX + 1)}7`)).toBe('#VALEUR!');
  });

  it('refuse une formule plus longue que la longueur maximale', () => {
    const longue = `=${'1+'.repeat(LONGUEUR_MAX_FORMULE / 2)}1`;
    expect(refus(longue)).toBe('#VALEUR!');
    expect(evaluerExpression(longue, {}).erreur).toBe('#VALEUR!');
    expect(calcul(`=${'1+'.repeat(40)}1`)).toBe(41);
  });

  it('evalue une chaine de 200 cellules qui se citent en cascade', () => {
    const chaine: Record<string, string> = { A1: '1' };
    for (let ligne = 1; ligne < IMBRICATIONS; ligne += 1) {
      chaine[`A${ligne + 1}`] = `=A${ligne}+1`;
    }
    const longue: Feuille = { lignes: IMBRICATIONS, colonnes: 1, cellules: chaine };
    expect(evaluerCellule(longue, `A${IMBRICATIONS}`).valeur).toBe(IMBRICATIONS);
  });
});

describe('compatibilite tableur', () => {
  it('accepte SI a deux arguments et rend FAUX quand la condition est fausse', () => {
    expect(calcul('=SI(1>0;7)')).toBe(7);
    expect(resultatDe({ A1: '=SI(1<0;7)' })).toBe(false);
    expect(refus('=SI(1)')).toBe('#VALEUR!');
    expect(refus('=SI(1;2;3;4)')).toBe('#VALEUR!');
  });

  it('arrondit la moitie en s eloignant de zero, dans les deux signes', () => {
    expect(calcul('=ARRONDI(-2,5;0)')).toBe(-3);
    expect(calcul('=ARRONDI(2,5;0)')).toBe(3);
    expect(approche('=ARRONDI(2,675;2)')).toBeCloseTo(2.68, 12);
    expect(calcul('=ARRONDI(-0,4;0)'), 'pas de zero negatif').toBe(0);
  });

  it('ignore le texte d une plage dans SOMME mais le refuse en argument direct', () => {
    const cellules = { B1: 'Canal', B2: '10', B3: '20' };
    expect(valeurDe({ ...cellules, A1: '=SOMME(B1:B3)' })).toBe(30);
    expect(erreurDe({ ...cellules, A1: '=SOMME(B1;B2)' })).toBe('#VALEUR!');
    expect(valeurDe({ ...cellules, A1: '=MOYENNE(B1:B3)' })).toBe(15);
  });

  it('lit une plage inversee comme la plage dans l ordre', () => {
    expect(valeurDe({ B1: '1', B2: '2', B3: '3', A1: '=SOMME(B3:B1)' })).toBe(6);
  });
});

describe('evaluerFeuille', () => {
  it('rend le resultat de chaque cellule remplie, erreurs comprises', () => {
    const resultats = evaluerFeuille({
      lignes: 2,
      colonnes: 2,
      cellules: { A1: '4', b1: '=A1*2', A2: '=1/B2', B2: '' },
    });
    expect([...resultats.keys()]).toEqual(['A1', 'B1', 'A2']);
    expect(resultats.get('B1')).toEqual({ valeur: 8, erreur: null });
    expect(resultats.get('A2')).toEqual({ valeur: null, erreur: '#DIV/0!' });
  });
});

describe('estUneFormule', () => {
  it('reconnait la marque apres des blancs de tete et rien d autre', () => {
    expect(['=A1', '  =A1*2', '\t=1'].map(estUneFormule)).toEqual([true, true, true]);
    expect(['', '12', 'A1=B1', ' 1 200'].map(estUneFormule)).toEqual([false, false, false, false]);
  });
});

describe('formeR1C1', () => {
  it('ecrit les references mixtes et les plages en decalage', () => {
    expect(formeR1C1('=$C3+C$5', 'E2')).toBe('=R[1]C3+R5C[-2]');
    expect(formeR1C1('=SOMME(B2:B4)', 'B5')).toBe('=SOMME(R[-3]C:R[-1]C)');
  });

  it('donne la meme forme a une formule recopiee et une forme differente a une formule reecrite', () => {
    expect(formeR1C1('=C2*F2', 'G2')).toBe(formeR1C1('=C4*F4', 'G4'));
    expect(formeR1C1('=C3/C5', 'E3')).not.toBe(formeR1C1('=C2/$C$5', 'E2'));
  });
});

describe('precision numerique', () => {
  it('garde evaluerCellule en pleine precision flottante, sans arrondi a 6 decimales', () => {
    expect(valeurDe({ A1: '=1/3' })).toBeCloseTo(1 / 3, 15);
  });
});

describe('presentation', () => {
  it('nomme les colonnes au-dela de la vingt-sixieme', () => {
    expect(lettreColonne(0)).toBe('A');
    expect(lettreColonne(25)).toBe('Z');
    expect(lettreColonne(26)).toBe('AA');
    expect(nomCellule(1, 2)).toBe('C2');
  });

  it('affiche la virgule decimale francaise et le code d erreur en clair', () => {
    expect(formaterResultat({ valeur: 1234.5, erreur: null })).toBe('1234,5');
    expect(formaterResultat({ valeur: 12, erreur: null })).toBe('12');
    expect(formaterResultat({ valeur: null, erreur: '#DIV/0!' })).toBe('#DIV/0!');
  });

  it('affiche un texte tel quel et une valeur logique en VRAI ou FAUX', () => {
    expect(formaterResultat({ valeur: 'Relancer', erreur: null })).toBe('Relancer');
    expect(formaterResultat({ valeur: '', erreur: null })).toBe('');
    expect(formaterResultat({ valeur: true, erreur: null })).toBe('VRAI');
    expect(formaterResultat({ valeur: false, erreur: null })).toBe('FAUX');
  });
});

describe('texte et logique', () => {
  const FACTURES = {
    A1: '72',
    B1: 'Impayée',
    A2: '60',
    B2: 'Impayée',
    C1: '=SI(ET(B1="impayée";A1>60);"Relancer";"")',
    C2: '=SI(ET(B2="impayée";A2>60);"Relancer";"")',
    D1: '=NB.SI(C1:C2;"Relancer")',
    D2: '=SI(OU(A1>=5000;B1<>"Payée");"Visa";"")',
    D3: '=NON(A1>60)',
  };

  it('ecrit la regle de relance et compte les factures a relancer', () => {
    expect(resultatDe(FACTURES, 'B1')).toBe('Impayée');
    expect(resultatDe(FACTURES, 'C1')).toBe('Relancer');
    expect(resultatDe(FACTURES, 'C2')).toBe('');
    expect(resultatDe(FACTURES, 'D1')).toBe(1);
    expect(resultatDe(FACTURES, 'D2')).toBe('Visa');
    expect(resultatDe(FACTURES, 'D3')).toBe(false);
  });

  it('garde un resultat numerique pour une expression de colonne deduite', () => {
    expect(evaluerExpression('ET(2>1;VRAI)+(3<=2)', {})).toEqual({ valeur: 1, erreur: null });
  });
});

describe('evaluerExpression', () => {
  it('calcule avec des variables nommees', () => {
    expect(evaluerExpression('prix*(1+taux/100)', { prix: 200, taux: 15 })).toEqual({
      valeur: 230,
      erreur: null,
    });
  });

  it('accepte les fonctions du tableur', () => {
    expect(
      evaluerExpression('=ARRONDI(capital*PUISSANCE(1+taux/100;x);2)', {
        capital: 1000,
        taux: 4,
        x: 3,
      }),
    ).toEqual({ valeur: 1124.86, erreur: null });
  });

  it('rend #REF! pour une cellule meme quand une variable porte sa lettre', () => {
    expect(evaluerExpression('A1*2', { A: 1 }).erreur).toBe('#REF!');
  });

  it('ne resout pas une variable heritee du prototype', () => {
    expect(evaluerExpression('constructor+1', {}).erreur).toBe('#NOM?');
  });

  it('laisse le tableur refuser un nom nu', () => {
    expect(evaluerCellule({ lignes: 1, colonnes: 1, cellules: { A1: '=prix' } }, 'A1').erreur).toBe(
      '#NOM?',
    );
  });
});

describe('remplirGabarit', () => {
  it('remplace chaque cle connue et garde les autres', () => {
    expect(
      remplirGabarit(
        '{prix} € puis {resultat} € ({absent})',
        { prix: 200, resultat: 230 },
        (valeur) => String(valeur),
      ),
    ).toBe('200 € puis 230 € ({absent})');
  });
});
