import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { lireNombreSaisi, lireNombreSaisiAvecUnite } from '../src/formule';

const ESPACES_SAISIS = [' ', ' ', ' ', ' '] as const;
const UNITES_SAISIES = [
  '',
  '%',
  '€',
  'pt',
  'pts',
  'point',
  'points',
  'euro',
  'Euros',
  'facture',
  'factures',
  'ligne',
  'lignes',
  'k€',
  'K€',
  'passage',
  'passages',
  'kit',
  'kits',
] as const;
const DECIMALES_MAX = 4;
const BORNE = 1_000_000;

const LUS_PAR_LES_DEUX: readonly (readonly [string, number])[] = [
  ['12', 12],
  ['12,5', 12.5],
  ['12.5', 12.5],
  ['1 234', 1234],
  ['1 234,75', 1234.75],
  ['  42  ', 42],
  ['-3,5', -3.5],
  ['−3,5', -3.5],
  ['+.5', 0.5],
  ['.5', 0.5],
  ['142 920', 142920],
  ['142 920,5', 142920.5],
];

const REFUSES_PAR_LES_DEUX: readonly string[] = [
  '',
  '   ',
  '1.2.3',
  '1,2,3',
  '1e3',
  '1E3',
  'douze',
  '--3',
  '1/2',
  '0x10',
  'Infinity',
  'NaN',
  '1,',
  ',',
  '12x',
  '%',
  '12 € 3',
  '€12',
];

const AVEC_UNITE: readonly (readonly [string, number])[] = [
  ['12 %', 12],
  ['12 €', 12],
  ['12 k€', 12],
  ['3 pts', 3],
  ['3 points', 3],
  ['−2,5 €', -2.5],
];

function decimal(): fc.Arbitrary<number> {
  return fc
    .tuple(
      fc.integer({ min: -BORNE, max: BORNE }),
      fc.integer({ min: 0, max: 10 ** DECIMALES_MAX - 1 }),
    )
    .map(([entier, fraction]) =>
      Number(`${entier}.${String(fraction).padStart(DECIMALES_MAX, '0')}`),
    );
}

const ecrire = (valeur: number, separateur: string): string =>
  String(valeur).replace('.', separateur);

describe('lireNombreSaisi', () => {
  it.each(LUS_PAR_LES_DEUX)('lit « %s » comme %p', (saisie, attendu) => {
    expect(lireNombreSaisi(saisie)).toBe(attendu);
  });

  it.each([...REFUSES_PAR_LES_DEUX, ...AVEC_UNITE.map(([saisie]) => saisie)])(
    'refuse « %s » au lieu de rendre un nombre approximatif',
    (saisie) => {
      expect(lireNombreSaisi(saisie)).toBeNull();
    },
  );
});

describe('lireNombreSaisiAvecUnite', () => {
  it.each([...LUS_PAR_LES_DEUX, ...AVEC_UNITE])('lit « %s » comme %p', (saisie, attendu) => {
    expect(lireNombreSaisiAvecUnite(saisie)).toBe(attendu);
  });

  it.each(REFUSES_PAR_LES_DEUX)('refuse la saisie « %s »', (saisie) => {
    expect(lireNombreSaisiAvecUnite(saisie)).toBeNull();
  });

  it('rend le même nombre quels que soient les espaces, la virgule et l unité', () => {
    fc.assert(
      fc.property(
        decimal(),
        fc.constantFrom(...ESPACES_SAISIS),
        fc.constantFrom(',', '.'),
        fc.constantFrom(...UNITES_SAISIES),
        (valeur, espace, separateur, unite) => {
          const saisie = `${espace}${ecrire(valeur, separateur)}${espace}${unite}`;
          expect(lireNombreSaisiAvecUnite(saisie)).toBeCloseTo(valeur, DECIMALES_MAX);
        },
      ),
    );
  });

  it('lit le moins typographique comme un moins', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: BORNE }), (valeur) => {
        expect(lireNombreSaisiAvecUnite(`−${String(valeur)}`)).toBe(-valeur);
      }),
    );
  });

  it('refuse toute saisie qui n est pas un nombre isolé', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((texte) => /[a-z=+*/]/i.test(texte)),
        decimal(),
        (texte, valeur) => {
          expect(lireNombreSaisiAvecUnite(`${String(valeur)}${texte}x`)).toBeNull();
        },
      ),
    );
  });
});
