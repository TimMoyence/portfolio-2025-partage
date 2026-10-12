import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  BOITES_DE_REVISION,
  CHAMPS_EXTRAITS_DU_CAS,
  DIFFUSIONS,
  ETATS_PULSE,
  MODALITES,
  PACING_MODES,
  PHASES_DE_VOTE,
  RAISONS_DE_FIN,
  REGIMES_DE_VERROU,
  STATUTS_DE_REPONSE_LIBRE,
  STATUTS_DE_SEANCE,
  TYPES_QUESTION,
  surLaJumelle,
  type BoiteDeRevision,
  type CadrageDuRenvoi,
  type ChampExtraitDuCas,
  type ContenuDeBrique,
  type CoursPublic,
  type CoursPublicCatalogue,
  type CorrectionServie,
  type DecomptesParCle,
  type DerouleCours,
  type DetailDeVerdict,
  type Diffusion,
  type DonneesParBrique,
  type EcranDeroule,
  type EcranPublic,
  type EtatParticipant,
  type EtatPulse,
  type EtatSession,
  type LigneDuDossier,
  type LivretPublie,
  type MetadonneesBrique,
  type Modalite,
  type PacingMode,
  type ProgressionDesEnigmes,
  type RaisonDeFin,
  type RapportSeance,
  type RegimeVerrou,
  type RegleDeNotation,
  type ReponseLibreFormateur,
  type ResultatQuestion,
  type ResultatsEnDirect,
  type ResultatsSeance,
  type ResumeBareme,
  type SheetPlanPublic,
  type StatutDeSeance,
  type TypeQuestion,
  type ValeurProduction,
  type VerdictDeProductionServi,
  type VotePhase,
} from '../src/contrats';
import type { Feuille } from '../src/formule';

type ListeFermee = readonly (string | number)[];

const LISTES_FERMEES: readonly (readonly [string, ListeFermee, ListeFermee])[] = [
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
  [
    'CHAMPS_EXTRAITS_DU_CAS',
    CHAMPS_EXTRAITS_DU_CAS,
    ['metier', 'situation', 'geste', 'consequence'],
  ],
  ['STATUTS_DE_SEANCE', STATUTS_DE_SEANCE, ['attente', 'en_cours', 'terminee']],
  ['STATUTS_DE_REPONSE_LIBRE', STATUTS_DE_REPONSE_LIBRE, ['enregistre', 'en_attente', 'echec']],
  ['RAISONS_DE_FIN', RAISONS_DE_FIN, ['cloturee', 'introuvable', 'expiree', 'evince', 'revoque']],
  ['BOITES_DE_REVISION', BOITES_DE_REVISION, [1, 2, 3]],
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
    expectTypeOf<RaisonDeFin>().toEqualTypeOf<
      'cloturee' | 'introuvable' | 'expiree' | 'evince' | 'revoque'
    >();
    expectTypeOf<BoiteDeRevision>().toEqualTypeOf<1 | 2 | 3>();
  });
});

describe('surLaJumelle', () => {
  it.each([
    ['vote', false],
    ['discussion', false],
    ['revote', true],
    ['revele', true],
    [undefined, false],
  ] as const)('en phase %s, la question jumelle est affichée : %s', (phase, attendu) => {
    expect(surLaJumelle(phase)).toBe(attendu);
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

describe('contrats — données publiques des briques, telles que l API les sérialise', () => {
  it('chaque brique servie porte son contenu sous une seule clé', () => {
    expectTypeOf<keyof DonneesParBrique>().toEqualTypeOf<
      | 'fp-quote'
      | 'fp-story'
      | 'fp-pro'
      | 'fp-worked'
      | 'fp-concept4'
      | 'fp-plot'
      | 'fp-challenge'
      | 'fp-cardsort'
      | 'fp-sheet'
      | 'fp-table-build'
      | 'fp-escape'
      | 'fp-pulse'
      | 'fp-spaced'
      | 'fp-numeric'
      | 'fp-vote'
      | 'fp-recall'
      | 'fp-exit'
      | 'questionnaire'
      | 'ecran-verrouille'
    >();
    expectTypeOf<DonneesParBrique['fp-quote']['citation']>().toExtend<ContenuDeBrique>();
    expectTypeOf<DonneesParBrique['fp-story']['recit']>().toExtend<ContenuDeBrique>();
    expectTypeOf<DonneesParBrique['fp-pro']['cas']>().toExtend<ContenuDeBrique>();
  });

  it('un exemple travaillé peut désigner l écran qu il corrige, un rappel porter sa consigne', () => {
    expectTypeOf<DonneesParBrique['fp-worked']>().toHaveProperty('corrigeDe');
    expectTypeOf<DonneesParBrique['fp-worked']['corrigeDe']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<DonneesParBrique['fp-recall']['consigne']>().toEqualTypeOf<string | undefined>();
  });

  it('un défi sert le rappel du dossier sans aucune stratégie', () => {
    type Probleme = DonneesParBrique['fp-challenge']['probleme'];
    expectTypeOf<Probleme['rappel']>().toEqualTypeOf<readonly LigneDuDossier[] | undefined>();
    expectTypeOf<Probleme['strategies']>().toEqualTypeOf<readonly []>();
  });

  it('une feuille d atelier est une feuille du moteur de formules', () => {
    expectTypeOf<SheetPlanPublic>().toExtend<Feuille>();
  });
});

describe('contrats — cours servis', () => {
  it('le renvoi ne cadre que des champs du cas professionnel', () => {
    type Champs = NonNullable<NonNullable<CadrageDuRenvoi['extrait']>['champs']>;
    expectTypeOf<Champs>().toEqualTypeOf<readonly ChampExtraitDuCas[]>();
  });

  it('le déroulé prolonge le sujet, écran par écran', () => {
    expectTypeOf<EcranDeroule>().toExtend<EcranPublic>();
    expectTypeOf<DerouleCours['ecrans']>().toEqualTypeOf<readonly EcranDeroule[]>();
    expectTypeOf<CoursPublicCatalogue>().toExtend<CoursPublic>();
    expectTypeOf<LivretPublie['corrige']>().toEqualTypeOf<DerouleCours>();
  });

  it('un écran de correction porte la correction de sa source sous la forme du fil', () => {
    expectTypeOf<EcranPublic['correction']>().toEqualTypeOf<CorrectionServie | undefined>();
    expectTypeOf<CorrectionServie['questions'][number]>().toHaveProperty('bonneReponse');
  });
});

describe('contrats — séance', () => {
  it('l état d une séance a un statut fermé', () => {
    expectTypeOf<EtatSession['etat']>().toEqualTypeOf<StatutDeSeance>();
  });

  it('l état d un participant reprend la progression des énigmes', () => {
    expectTypeOf<EtatParticipant['enigmes']>().toEqualTypeOf<readonly ProgressionDesEnigmes[]>();
    expectTypeOf<VerdictDeProductionServi['details']>().toEqualTypeOf<readonly DetailDeVerdict[]>();
  });

  it('le fil sérialise les dates en chaînes', () => {
    expectTypeOf<RapportSeance['ouverteLe']>().toEqualTypeOf<string>();
    expectTypeOf<EtatSession['majLe']>().toEqualTypeOf<string>();
    expectTypeOf<ReponseLibreFormateur['submittedAt']>().toEqualTypeOf<string>();
    expectTypeOf<ReponseLibreFormateur['strategiesServiesLe']>().toEqualTypeOf<string | null>();
  });
});
