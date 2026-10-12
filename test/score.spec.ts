import { describe, expect, it } from 'vitest';
import { LIBELLES_DU_STATUT, statutDuScore } from '../src/score';

describe('statutDuScore', () => {
  it.each([
    [100, 'ok'],
    [80, 'ok'],
    [79.9, 'warning'],
    [55, 'warning'],
    [54.9, 'critical'],
    [0, 'critical'],
  ])('classe %d en %s', (score, statut) => {
    expect(statutDuScore(score)).toBe(statut);
  });
});

describe('LIBELLES_DU_STATUT', () => {
  it('nomme chaque statut avec le vocabulaire de l écran du growth audit', () => {
    expect(LIBELLES_DU_STATUT).toEqual({
      critical: 'Critique',
      warning: 'À améliorer',
      ok: 'Objectif atteint',
    });
  });

  it('est gelé', () => {
    expect(Object.isFrozen(LIBELLES_DU_STATUT)).toBe(true);
  });
});
