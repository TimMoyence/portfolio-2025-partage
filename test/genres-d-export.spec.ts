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
    expect(() =>
      verifierLesValeurs('sonde', MODULE, {
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

  it('refuse un genre inconnu au lieu de sauter ses controles', () => {
    expect(() => nomsAttendus({ fonctionz: ['lire'] })).toThrow(
      'genre d export inconnu : fonctionz',
    );
    expect(() => verifierLesValeurs('sonde', MODULE, { fonctionz: ['CANARI'] })).toThrow(
      'genre d export inconnu : fonctionz',
    );
  });
});
