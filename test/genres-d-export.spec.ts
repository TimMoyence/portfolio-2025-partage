import { describe, expect, it } from 'vitest';

import { nomsAttendus, verifierLesValeurs } from '../scripts/genres-d-export.mjs';

class ErreurDeTest extends Error {}

const MODULE = {
  lire: () => 1,
  LISTE: Object.freeze(['a']),
  TABLE: Object.freeze({ a: 1 }),
  PLAFOND: 3,
  CANARI: 'canari',
  ErreurDeTest,
  VIDE: null,
};

describe('genres d export du verificateur', () => {
  it('aplatit les noms attendus de tous les genres, types compris', () => {
    expect(nomsAttendus({ fonctions: ['lire'], chaines: ['CANARI'], types: ['Forme'] })).toEqual([
      'lire',
      'CANARI',
      'Forme',
    ]);
  });

  it('accepte un module conforme a chaque genre', () => {
    const { VIDE: _horsDesAttendus, ...conforme } = MODULE;
    expect(() =>
      verifierLesValeurs('sonde', conforme, {
        fonctions: ['lire'],
        listes: ['LISTE'],
        objets: ['TABLE'],
        constantes: ['PLAFOND'],
        chaines: ['CANARI'],
        erreurs: ['ErreurDeTest'],
        types: ['SansValeur'],
      }),
    ).not.toThrow();
  });

  it.each([
    ['fonctions', 'CANARI'],
    ['listes', 'TABLE'],
    ['objets', 'VIDE'],
    ['objets', 'LISTE'],
    ['constantes', 'CANARI'],
    ['chaines', 'PLAFOND'],
    ['erreurs', 'lire'],
  ])('refuse un export %s qui n en est pas un (%s)', (genre, nom) => {
    expect(() => verifierLesValeurs('sonde', MODULE, { [genre]: [nom] })).toThrow(`sonde : ${nom}`);
  });

  it.each([
    ['une valeur listee en types', { lire: MODULE.lire }, { types: ['lire'] }],
    [
      'une valeur absente des attendus',
      { lire: MODULE.lire, PLAFOND: MODULE.PLAFOND },
      { fonctions: ['lire'] },
    ],
  ])('refuse un module qui exporte %s', (_cas, module, attendus) => {
    expect(() => verifierLesValeurs('sonde', module, attendus)).toThrow(
      'sonde : chaque valeur exportée doit figurer dans ses attendus, et elle seule',
    );
  });

  it('refuse un module qui perd une valeur attendue', () => {
    expect(() =>
      verifierLesValeurs('sonde', { lire: () => 1 }, { fonctions: ['lire'], listes: ['LISTE'] }),
    ).toThrow('sonde : LISTE');
  });

  it('refuse un genre inconnu au lieu de sauter ses controles', () => {
    expect(() => nomsAttendus({ fonctionz: ['lire'] })).toThrow(
      'genre d export inconnu : fonctionz',
    );
    expect(() => verifierLesValeurs('sonde', MODULE, { fonctionz: ['CANARI'] })).toThrow(
      'genre d export inconnu : fonctionz',
    );
  });
});
