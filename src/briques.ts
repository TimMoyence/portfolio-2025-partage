import type { MetadonneesBrique, RegimeVerrou } from './contrats.js';
import type { Feuille } from './formule.js';

export interface ContenuDeBrique {
  readonly id: string;
  readonly metadonnees: MetadonneesBrique;
}

export type ContenuPublie<P> = P & ContenuDeBrique;

export interface OptionPublique {
  readonly id: string;
  readonly libelle: string;
}

export interface VotePublic {
  readonly id: string;
  readonly enonce: string;
  readonly options: readonly OptionPublique[];
}

export type RecallQuestionPublique = VotePublic & ContenuDeBrique;

export interface NumeriquePublic extends ContenuDeBrique {
  readonly enonce: string;
  readonly unite: string | null;
}

export interface ExitBilletPublic extends ContenuDeBrique {
  readonly question: string;
  readonly invite: string;
  readonly options: readonly OptionPublique[];
}

export interface QuoteCitation extends ContenuDeBrique {
  readonly texte: string;
  readonly auteur: string | null;
  readonly source: string | null;
}

export interface QuestionLibre {
  readonly id: string;
  readonly question: string;
  readonly placeholder?: string;
}

export interface CasProfessionnel {
  readonly metier: string;
  readonly situation: string;
  readonly geste: string;
  readonly consequence: string | null;
  readonly questionsLibres?: readonly QuestionLibre[];
}

export type ProCas = ContenuPublie<CasProfessionnel>;

export interface LigneDuDossier {
  readonly libelle: string;
  readonly valeur: string;
}

export interface WorkedEtape {
  readonly id: string;
  readonly intitule: string;
  readonly raisonnement: string;
  readonly invite: string;
}

export interface WorkedExemple extends ContenuDeBrique {
  readonly enonce: string;
  readonly rappel?: readonly LigneDuDossier[];
  readonly etapes: readonly WorkedEtape[];
}

export interface ParametreCurseur {
  readonly cle: string;
  readonly libelle: string;
  readonly min: number;
  readonly max: number;
  readonly pas: number;
  readonly defaut: number;
}

export type Reglages = Readonly<Record<string, number>>;

export interface Prereglage {
  readonly libelle: string;
  readonly valeurs: Reglages;
}

export interface DefinitionReglable extends ContenuDeBrique {
  readonly parametres: readonly ParametreCurseur[];
  readonly prereglages?: readonly Prereglage[];
  readonly animation?: readonly Reglages[];
}

export interface EtapeDeMachine {
  readonly libelle: string;
  readonly calcul: string;
}

export interface Concept4Definition extends DefinitionReglable {
  readonly formuleLatexSimplifie: string;
  readonly calcul: string;
  readonly phrase: string;
  readonly etapes?: readonly EtapeDeMachine[];
}

export type TraitSerie = 'plein' | 'tirets';

export interface PlotAxe {
  readonly libelle: string;
  readonly min: number;
  readonly max: number;
}

export interface PlotBornesOrdonnee {
  readonly min?: number;
  readonly max?: number;
  readonly minParametre?: string;
  readonly maxParametre?: string;
}

export interface PlotSerie {
  readonly id: string;
  readonly libelle: string;
  readonly trait: TraitSerie;
  readonly calcul: string;
}

export interface PlotDefinition extends DefinitionReglable {
  readonly titre?: string;
  readonly description?: string;
  readonly descriptionPapier?: string;
  readonly source?: string;
  readonly sourceUrl?: string;
  readonly abscisse: PlotAxe;
  readonly ordonnee: string;
  readonly bornesOrdonnee?: PlotBornesOrdonnee;
  readonly series: readonly PlotSerie[];
  readonly forme?: 'courbes' | 'barres';
  readonly unite?: 'euros';
  readonly etiquettes?: readonly string[];
  readonly reference?: string;
}

export interface StoryVisuel {
  readonly src: string;
  readonly alt: string;
  readonly legende?: string;
  readonly source?: string;
}

export interface StoryVideo {
  readonly src: string;
  readonly srcPoste?: string;
  readonly type: 'video/webm' | 'video/mp4';
  readonly titre: string;
  readonly poster?: string;
  readonly transcript: string;
  readonly source: string;
  readonly licence: string;
  readonly sousTitres?: {
    readonly src: string;
    readonly srclang: string;
    readonly libelle: string;
  };
  readonly preload?: 'none' | 'metadata';
}

export type PresentationDuRecit =
  | {
      readonly version: 1;
      readonly screenId: string;
      readonly renderer: string;
      readonly title?: string;
      readonly subtitle?: string;
    }
  | {
      readonly version: 2;
      readonly screenId: string;
      readonly renderer: string;
      readonly props: unknown;
    };

export interface StoryRecit extends ContenuDeBrique {
  readonly titre?: string;
  readonly paragraphes?: readonly string[];
  readonly presentation?: PresentationDuRecit;
  readonly visuel?: StoryVisuel;
  readonly video?: StoryVideo;
}

export interface ChallengeProblemePublic extends ContenuDeBrique {
  readonly enonce: string;
  readonly invite: string;
  readonly rappel?: readonly LigneDuDossier[];
  readonly strategies: readonly [];
}

export interface PlanEtaye extends ContenuDeBrique {
  readonly intitule: string;
  readonly consignes: readonly string[];
}

export interface SheetPlanPublic extends PlanEtaye, Feuille {
  readonly verrouillees: readonly string[];
}

export interface CardsortPlanPublic extends ContenuDeBrique {
  readonly intitule: string;
  readonly cartes: readonly OptionPublique[];
  readonly categories: readonly OptionPublique[];
  readonly dureeJeuMs?: number;
}

export type RoleColonne = 'donnee' | 'saisie' | 'deduite';

export interface TableColonneServie {
  readonly cle: string;
  readonly intitule: string;
  readonly role: RoleColonne;
  readonly format?: 'nombre' | 'booleen';
  readonly decimales: number;
  readonly valeurs?: readonly number[];
  readonly formule?: string;
  readonly formuleInitiale?: string;
  readonly soldeDe?: string;
  readonly totalise: boolean;
}

export interface TableSynthese {
  readonly libelle: string;
  readonly formule: string;
  readonly unite: string | null;
  readonly decimales: number;
}

export interface TableBuildPlanPublic extends PlanEtaye {
  readonly echeances: number;
  readonly intituleDesLignes?: string;
  readonly libellesLignes: readonly string[];
  readonly parametres: Reglages;
  readonly colonnes: readonly TableColonneServie[];
  readonly synthese: readonly TableSynthese[];
}

export interface EscapeEnigmePublique {
  readonly id: string;
  readonly intitule: string;
  readonly enonce: string;
  readonly indice: string;
}

export interface EscapeParcoursPublic extends ContenuDeBrique {
  readonly intitule: string;
  readonly delaiIndiceMs: number;
  readonly budgetEnigmeMs: number;
  readonly tentativesMax: number;
  readonly enigmes: readonly EscapeEnigmePublique[];
}

export interface PulseSondage extends ContenuDeBrique {
  readonly invite: string;
}

export interface SpacedRappel extends ContenuDeBrique {
  readonly intitule: string;
}

export type BoiteDeRevision = 1 | 2 | 3;

export interface SpacedQuestionPublique {
  readonly questionId: string;
  readonly concept: string;
  readonly boite: BoiteDeRevision;
  readonly cours: string;
  readonly enonce: string;
  readonly options: readonly OptionPublique[];
}

export type OrdreQuestions = 'fixe' | 'melange';

export type QuestionDeQuestionnaire =
  | { readonly brique: 'fp-numeric'; readonly donnees: DonneesParBrique['fp-numeric'] }
  | { readonly brique: 'fp-vote'; readonly donnees: DonneesParBrique['fp-vote'] };

export interface DonneesParBrique {
  readonly 'fp-quote': { readonly citation: QuoteCitation };
  readonly 'fp-story': { readonly recit: StoryRecit };
  readonly 'fp-pro': { readonly cas: ProCas };
  readonly 'fp-worked': {
    readonly exemple: WorkedExemple;
    readonly etayage: number;
    readonly pilote?: boolean;
    readonly corrigeDe?: string;
  };
  readonly 'fp-concept4': { readonly definition: Concept4Definition };
  readonly 'fp-plot': { readonly definition: PlotDefinition };
  readonly 'fp-challenge': { readonly probleme: ChallengeProblemePublic };
  readonly 'fp-cardsort': { readonly plan: CardsortPlanPublic };
  readonly 'fp-sheet': { readonly plan: SheetPlanPublic };
  readonly 'fp-table-build': { readonly plan: TableBuildPlanPublic };
  readonly 'fp-escape': { readonly parcours: EscapeParcoursPublic };
  readonly 'fp-pulse': { readonly sondage: PulseSondage };
  readonly 'fp-spaced': { readonly rappel: SpacedRappel };
  readonly 'fp-numeric': { readonly question: NumeriquePublic };
  readonly 'fp-vote': {
    readonly question: VotePublic;
    readonly questionJumelle?: VotePublic;
  };
  readonly 'fp-recall': {
    readonly question: RecallQuestionPublique;
    readonly delaiMs: number;
    readonly consigne?: string;
  };
  readonly 'fp-exit': { readonly billet: ExitBilletPublic };
  readonly questionnaire: {
    readonly intitule: string;
    readonly consigne: string;
    readonly regime: RegimeVerrou;
    readonly ordre: OrdreQuestions;
    readonly questions: readonly QuestionDeQuestionnaire[];
  };
  readonly 'ecran-verrouille': Readonly<Record<string, never>>;
}
