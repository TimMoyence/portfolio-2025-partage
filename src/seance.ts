import type { BoiteDeRevision, SpacedQuestionPublique } from './briques.js';
import type {
  ComptesJalon,
  EtatPulse,
  FreeRange,
  PacingMode,
  ProgressionEnigme,
  RegleDeNotation,
  ResultatsSeance,
  ResumeBareme,
  StatistiquesSeance,
  TypeQuestion,
  ValeurProduction,
  VotePhase,
} from './contrats.js';

export const STATUTS_DE_SEANCE = Object.freeze(['attente', 'en_cours', 'terminee'] as const);
export type StatutDeSeance = (typeof STATUTS_DE_SEANCE)[number];

export interface PilotageEcran {
  readonly phase?: VotePhase;
  readonly revele?: boolean;
  readonly etayage?: number;
  readonly etayageAtteint?: number;
  readonly explicationsDevoilees?: number;
  readonly reglages?: Readonly<Record<string, number>>;
  readonly resultatsProjetes?: boolean;
  readonly optionsAffichees?: boolean;
}

export type PilotageDemande = { readonly screenId: string } & Omit<PilotageEcran, 'etayageAtteint'>;

export interface CommandePilotage {
  readonly ecran?: number;
  readonly mode?: PacingMode;
  readonly intervalle?: FreeRange | null;
  readonly pilotage?: PilotageDemande;
}

export interface EtatSession {
  readonly etat: StatutDeSeance;
  readonly modeRythme: PacingMode;
  readonly ecranCourant: number;
  readonly intervalleLibre: FreeRange | null;
  readonly participants: number;
  readonly revision: number;
  readonly pilotage: Readonly<Record<string, PilotageEcran>>;
}

export interface SeanceOuverte {
  readonly sessionId: string;
  readonly code: string;
}

export interface InscriptionParticipant {
  readonly prenom: string;
  readonly nom: string;
  readonly email: string;
  readonly website?: string;
  readonly formStartedAt?: number;
  readonly secretDeReprise?: string;
}

export interface Rattachement {
  readonly participantId: string;
  readonly sessionId: string;
  readonly ecranCourant: number;
  readonly modeRythme: PacingMode;
  readonly jeton: string;
  readonly secretDeReprise: string;
}

export interface ParticipantDeSeance {
  readonly id: string;
  readonly prenom: string;
  readonly nom: string;
  readonly evince: boolean;
}

export type ValeurSaisie = number | string;
export type ValeurReponse = ValeurSaisie | ValeurProduction;

export interface ReponseEtudiant {
  readonly questionId: string;
  readonly valeur: ValeurSaisie;
  readonly dureeMs: number;
}

export interface ProductionEtudiante {
  readonly questionId: string;
  readonly valeur: ValeurProduction;
  readonly dureeMs: number;
}

export interface TentativeEnigme {
  readonly enigmeId: string;
  readonly reponse: string;
  readonly dureeMs: number;
}

export interface TentativeDefi {
  readonly texte: string;
  readonly dureeMs: number;
}

export interface ReponseLibreEtudiant {
  readonly screenId: string;
  readonly activityId: string;
  readonly response: string;
  readonly dureeMs: number;
}

export interface ReponseLibreEnregistree {
  readonly status: 'enregistre';
}

export interface IncidentEtudiant {
  readonly type: string;
  readonly contexte?: Readonly<Record<string, unknown>>;
  readonly horodatage: string;
}

export interface DetailDeVerdict {
  readonly cle: string;
  readonly juste: boolean;
  readonly libelleConfusion: string | null;
}

export interface VerdictDeReponseServi {
  readonly correcte: boolean;
  readonly misconception: string | null;
  readonly libelleConfusion: string | null;
}

export interface VerdictDeProductionServi {
  readonly correcte: boolean;
  readonly score: number;
  readonly details: readonly DetailDeVerdict[];
  readonly libelleConfusion: string | null;
}

export interface VerdictDeTentativeServi {
  readonly correcte: boolean;
  readonly fragment: string | null;
  readonly tentativesRestantes: number;
}

export interface StrategieServie {
  readonly id: string;
  readonly libelle: string;
  readonly fausse?: boolean;
}

export interface StrategiesDuDefi {
  readonly strategies: readonly StrategieServie[];
}

export interface RappelsDus {
  readonly questions: readonly SpacedQuestionPublique[];
}

export interface QuestionDue {
  readonly questionId: string;
  readonly concept: string;
  readonly boite: BoiteDeRevision;
}

export interface QuestionsDues {
  readonly questions: readonly QuestionDue[];
}

export interface SyntheseConcept {
  readonly concept: string;
  readonly libelle: string;
  readonly boite1: number;
  readonly boite2: number;
  readonly boite3: number;
  readonly nonVus: number;
}

export interface EnigmeResolue {
  readonly enigmeId: string;
  readonly fragment: string;
}

export interface ProgressionDesEnigmes {
  readonly parcoursId: string;
  readonly resolues: readonly EnigmeResolue[];
  readonly tentativesRestantes: Readonly<Record<string, number>>;
}

export interface ReponseDuParticipant {
  readonly questionId: string;
  readonly valeur: ValeurReponse;
  readonly correcte: boolean;
  readonly score: number | null;
  readonly details: readonly DetailDeVerdict[] | null;
  readonly libelleConfusion: string | null;
}

export interface EtatParticipant {
  readonly sessionId: string;
  readonly participantId: string;
  readonly revision: number;
  readonly reponses: readonly ReponseDuParticipant[];
  readonly reponsesLibres: readonly {
    readonly activityId: string;
    readonly response: string;
  }[];
  readonly jalons: readonly {
    readonly sondageId: string;
    readonly etat: EtatPulse;
  }[];
  readonly enigmes: readonly ProgressionDesEnigmes[];
  readonly defis: readonly {
    readonly defiId: string;
    readonly premiereTentative: string;
  }[];
  readonly rappels: { readonly questionIds: readonly string[] };
}

export const STATUTS_DE_REPONSE_LIBRE = Object.freeze([
  'enregistre',
  'en_attente',
  'echec',
] as const);
export type StatutDeReponseLibre = (typeof STATUTS_DE_REPONSE_LIBRE)[number];

export interface ReponseLibreFormateur {
  readonly id: string;
  readonly sessionId: string;
  readonly participantId: string;
  readonly screenId: string;
  readonly activityId: string;
  readonly response: string;
  readonly premiereReponse: string | null;
  readonly strategiesServiesLe: string | null;
  readonly dureeMs: number;
  readonly status: StatutDeReponseLibre;
  readonly submittedAt: string;
}

export interface AnnotationFormateur {
  readonly id: string;
  readonly sessionId: string;
  readonly teacherId: string;
  readonly screenId: string;
  readonly note: string;
  readonly updatedAt: string;
}

export interface ReponseRapportee {
  readonly questionId: string;
  readonly concept: string;
  readonly type: TypeQuestion;
  readonly score: number | null;
  readonly valeur: string;
  readonly reponse: string;
  readonly correcte: boolean;
  readonly misconception: string | null;
  readonly libelleConfusion: string | null;
  readonly dureeMs: number;
}

export interface ReponseLibreRapportee {
  readonly screenId: string;
  readonly activityId: string;
  readonly reponse: string;
}

export interface ParticipantRapporte {
  readonly prenom: string;
  readonly nom: string;
  readonly email: string;
  readonly completion: number;
  readonly note: number;
  readonly sousSeuil: boolean;
  readonly reponses: readonly ReponseRapportee[];
  readonly reponsesLibres: readonly ReponseLibreRapportee[];
  readonly incidents: number;
}

export interface RapportSeance {
  readonly courseSlug: string;
  readonly code: string;
  readonly ouverteLe: string;
  readonly fermeeLe: string;
  readonly participants: readonly ParticipantRapporte[];
  readonly conceptsFragiles: readonly string[];
  readonly libellesDesConcepts: Readonly<Record<string, string>>;
  readonly resultats: ResultatsSeance;
  readonly statistiques: StatistiquesSeance;
  readonly notation: RegleDeNotation;
  readonly bareme: ResumeBareme;
  readonly jalons: Readonly<Record<string, ComptesJalon>>;
  readonly enigmes: readonly ProgressionEnigme[];
}
