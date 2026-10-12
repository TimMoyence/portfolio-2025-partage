export * from './briques.js';
export * from './cours-servi.js';
export * from './seance.js';

export const TYPES_QUESTION = Object.freeze([
  'numeric',
  'vote',
  'feuille',
  'tableau',
  'classement',
  'enigme',
] as const);
export type TypeQuestion = (typeof TYPES_QUESTION)[number];

export const DIFFUSIONS = Object.freeze(['catalogue', 'seance'] as const);
export type Diffusion = (typeof DIFFUSIONS)[number];

export const ETATS_PULSE = Object.freeze(['perdu', 'ca-va', 'clair'] as const);
export type EtatPulse = (typeof ETATS_PULSE)[number];

export const PHASES_DE_VOTE = Object.freeze(['vote', 'discussion', 'revote', 'revele'] as const);
export type VotePhase = (typeof PHASES_DE_VOTE)[number];

export function surLaJumelle(phase: VotePhase | undefined): boolean {
  return phase === 'revote' || phase === 'revele';
}

export const PACING_MODES = Object.freeze(['pilote', 'libre'] as const);
export type PacingMode = (typeof PACING_MODES)[number];

export interface FreeRange {
  premier: number;
  dernier: number;
}

export const MODALITES = Object.freeze(['solo', 'binome', 'groupe', 'classe'] as const);
export type Modalite = (typeof MODALITES)[number];

export const REGIMES_DE_VERROU = Object.freeze(['ouvert', 'focus', 'examen'] as const);
export type RegimeVerrou = (typeof REGIMES_DE_VERROU)[number];

export interface MetadonneesBrique {
  readonly concepts: readonly string[];
  readonly misconceptionsCiblees: readonly string[];
  readonly dureeMinutes: number;
  readonly modalite: Modalite;
  readonly regime: RegimeVerrou;
}

export interface Tolerance {
  readonly type: 'relative' | 'absolue' | 'decimales';
  readonly valeur: number;
}

export type FormeFormule = 'references' | { readonly memeQue: string };

export type ValeurProduction =
  | {
      readonly type: 'feuille';
      readonly cellules: Readonly<Record<string, string>>;
    }
  | {
      readonly type: 'tableau';
      readonly saisies: readonly {
        readonly rang: number;
        readonly cle: string;
        readonly valeur: number;
      }[];
    }
  | {
      readonly type: 'classement';
      readonly classement: Readonly<Record<string, string>>;
    }
  | {
      readonly type: 'feuille' | 'tableau' | 'classement';
      readonly neSaitPas: true;
    };

export interface ConfusionComptee {
  readonly id: string;
  readonly libelle: string;
  readonly nombre: number;
}

export interface Decompte {
  readonly total: number;
  readonly justes: number;
}

export type DecomptesParCle = Readonly<Record<string, Decompte>>;

export interface ResultatQuestion {
  readonly questionId: string;
  readonly ecranId: string;
  readonly type: TypeQuestion;
  readonly noteCompte: boolean;
  readonly total: number;
  readonly correctes: number;
  readonly neSaitPas: number;
  readonly confusions: readonly ConfusionComptee[];
  readonly parOption: Readonly<Record<string, number>> | null;
  readonly scoreMoyen: number | null;
  readonly parCle: DecomptesParCle | null;
}

export interface ResultatsSeance {
  readonly participants: number;
  readonly questions: readonly ResultatQuestion[];
}

export interface StatistiquesSeance {
  readonly moyenne: number;
  readonly mediane: number;
  readonly dispersion: number;
  readonly tauxParticipation: number;
  readonly tauxReussite: number;
  readonly questionsProblemes: readonly string[];
}

export interface ComptesJalon {
  readonly perdu: number;
  readonly 'ca-va': number;
  readonly clair: number;
  readonly total: number;
}

export interface ProgressionEnigme {
  readonly parcoursId: string;
  readonly enigmeId: string;
  readonly ouvertes: number;
  readonly resolues: number;
  readonly tentativesMoyennes: number;
  readonly epuisees: number;
}

export interface ResumeBareme {
  readonly questionsNotees: number;
  readonly parType: Readonly<
    Record<TypeQuestion, { readonly notees: number; readonly nonNotees: number }>
  >;
}

export interface ResultatsEnDirect extends ResultatsSeance {
  readonly statistiques: StatistiquesSeance;
  readonly jalons: Readonly<Record<string, ComptesJalon>>;
  readonly enigmes: readonly ProgressionEnigme[];
  readonly bareme: ResumeBareme;
}

export interface RegleDeNotation {
  readonly noteMax: number;
  readonly base: 'participation-relative-cohorte';
  readonly partCohorteReference: number;
  readonly ratioSeuilValidation: number;
  readonly neSaitPasCompteCommeReponse: boolean;
  readonly pointsNonReponse: number;
  readonly reponsesLibresNotees: boolean;
  readonly seuilQuestionProbleme: number;
  readonly decimalesStatistiques: number;
  readonly typesNotables: readonly TypeQuestion[];
  readonly productionCompteSi: 'au-moins-une-saisie';
  readonly statistiquesSurQuestionsNotees: boolean;
}
