import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  DIFFUSIONS,
  ETATS_PULSE,
  MODALITES,
  PACING_MODES,
  PHASES_DE_VOTE,
  REGIMES_DE_VERROU,
  TYPES_QUESTION,
  type DecomptesParCle,
  type Diffusion,
  type EtatPulse,
  type MetadonneesBrique,
  type Modalite,
  type PacingMode,
  type RegimeVerrou,
  type RegleDeNotation,
  type ResultatQuestion,
  type ResultatsEnDirect,
  type ResultatsSeance,
  type ResumeBareme,
  type TypeQuestion,
  type ValeurProduction,
  type VotePhase,
} from '../src/contrats';

const LISTES_FERMEES: readonly (readonly [string, readonly string[], readonly string[]])[] = [
  [
    'TYPES_QUESTION',
    TYPES_QUESTION,
    ['numeric', 'vote', 'feuille', 'tableau', 'classement', 'enigme'],
  ],
  ['DIFFUSIONS', DIFFUSIONS, ['catalogue', 'seance']],
  ['ETATS_PULSE', ETATS_PULSE, ['perdu', 'ca-va', 'clair']],
  ['PHASES_DE_VOTE', PHASES_DE_VOTE, ['vote', 'discussion', 'revote', 'revele']],
  ['PACING_MODES', PACING_MODES, ['pilote', 'libre']],
  ['MODALITES', MODALITES, ['solo', 'binome', 'groupe', 'classe']],
  ['REGIMES_DE_VERROU', REGIMES_DE_VERROU, ['ouvert', 'focus', 'examen']],
];

describe('contrats — listes fermées servies par l API', () => {
  it.each(LISTES_FERMEES)(
    '%s porte exactement ses valeurs, dans leur ordre',
    (_nom, liste, attendu) => {
      expect(liste).toEqual(attendu);
    },
  );

  it.each(LISTES_FERMEES)('%s est gelée : aucun dépôt ne l étend à l exécution', (_nom, liste) => {
    expect(Object.isFrozen(liste)).toBe(true);
  });

  it('chaque type fermé est l union exacte de sa liste', () => {
    expectTypeOf<TypeQuestion>().toEqualTypeOf<
      'numeric' | 'vote' | 'feuille' | 'tableau' | 'classement' | 'enigme'
    >();
    expectTypeOf<Diffusion>().toEqualTypeOf<'catalogue' | 'seance'>();
    expectTypeOf<EtatPulse>().toEqualTypeOf<'perdu' | 'ca-va' | 'clair'>();
    expectTypeOf<VotePhase>().toEqualTypeOf<'vote' | 'discussion' | 'revote' | 'revele'>();
    expectTypeOf<PacingMode>().toEqualTypeOf<'pilote' | 'libre'>();
    expectTypeOf<Modalite>().toEqualTypeOf<'solo' | 'binome' | 'groupe' | 'classe'>();
    expectTypeOf<RegimeVerrou>().toEqualTypeOf<'ouvert' | 'focus' | 'examen'>();
  });
});

describe('contrats — résultats d une séance', () => {
  it('les résultats en direct prolongent ceux d une séance', () => {
    expectTypeOf<ResultatsEnDirect>().toExtend<ResultatsSeance>();
    expectTypeOf<ResultatsSeance>().not.toHaveProperty('statistiques');
  });

  it('une question décompte ses clés justes, ou rien hors des productions', () => {
    expectTypeOf<ResultatQuestion['parCle']>().toEqualTypeOf<DecomptesParCle | null>();
    expectTypeOf<ResultatQuestion['type']>().toEqualTypeOf<TypeQuestion>();
  });

  it('le barème et la règle de notation se lisent par type de question', () => {
    expectTypeOf<keyof ResumeBareme['parType']>().toEqualTypeOf<TypeQuestion>();
    expectTypeOf<RegleDeNotation['typesNotables']>().toEqualTypeOf<readonly TypeQuestion[]>();
  });

  it('une production « je ne sais pas » ne porte aucune saisie', () => {
    type SansReponse = Extract<ValeurProduction, { readonly neSaitPas: true }>;
    expectTypeOf<SansReponse>().not.toHaveProperty('cellules');
    expectTypeOf<SansReponse['type']>().toEqualTypeOf<'feuille' | 'tableau' | 'classement'>();
  });

  it('les métadonnées d une brique reprennent les listes fermées', () => {
    expectTypeOf<MetadonneesBrique['modalite']>().toEqualTypeOf<Modalite>();
    expectTypeOf<MetadonneesBrique['regime']>().toEqualTypeOf<RegimeVerrou>();
  });
});
