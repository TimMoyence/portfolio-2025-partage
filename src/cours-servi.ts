import type { OptionPublique } from './briques.js';
import type { Diffusion, FormeFormule, Tolerance } from './contrats.js';
import type { ValeurFormule } from './formule.js';

export const CHAMPS_EXTRAITS_DU_CAS = Object.freeze([
  'metier',
  'situation',
  'geste',
  'consequence',
] as const);
export type ChampExtraitDuCas = (typeof CHAMPS_EXTRAITS_DU_CAS)[number];

export interface CadrageDuRenvoi {
  readonly extrait?: {
    readonly lignes?: readonly number[];
    readonly champs?: readonly ChampExtraitDuCas[];
  };
}

export interface ExplicationDeCorrection {
  readonly reference: string;
  readonly texte: string;
}

export interface PieceJointePublique {
  readonly libelle: string;
  readonly fichier: string;
}

export interface PieceJointeServieEnSeance {
  readonly libelle: string;
  readonly reservee: true;
}

export type PieceJointeServie = PieceJointePublique | PieceJointeServieEnSeance;

export interface GuideFormateur {
  readonly aDire?: string;
  readonly question?: string;
  readonly reponse?: string;
  readonly calcul?: string;
  readonly relance?: string;
  readonly transition?: string;
}

export interface CorrigePresentateur {
  readonly questionId: string;
  readonly bonneReponse: string;
  readonly confusions: readonly OptionPublique[];
}

export type CorrigeEcranPresentateur =
  | {
      readonly type: 'feuille';
      readonly attendus: readonly {
        readonly reference: string;
        readonly formuleReference: string;
        readonly valeur: ValeurFormule;
        readonly tolerance: Tolerance;
        readonly forme: FormeFormule;
      }[];
      readonly seuilReussite: number;
    }
  | {
      readonly type: 'tableau';
      readonly attendus: readonly {
        readonly rang: number;
        readonly cle: string;
        readonly valeur: number;
      }[];
      readonly tolerance: Tolerance;
      readonly seuilReussite: number;
    }
  | {
      readonly type: 'classement';
      readonly attendus: readonly {
        readonly carteId: string;
        readonly categorieId: string;
        readonly justification: string;
      }[];
      readonly seuilReussite: number;
    }
  | {
      readonly type: 'enigmes';
      readonly enigmes: readonly {
        readonly enigmeId: string;
        readonly solution: string;
        readonly fragment: string;
      }[];
      readonly codeFinal: string;
    }
  | {
      readonly type: 'defi';
      readonly strategies: readonly {
        readonly id: string;
        readonly libelle: string;
        readonly fausse: boolean;
      }[];
    }
  | {
      readonly type: 'revelation';
      readonly titre: string;
      readonly lignes: readonly string[];
    }
  | {
      readonly type: 'reflexion';
      readonly attendu: string;
      readonly suite: string;
    };

export interface QuestionCorrigee {
  readonly questionId: string;
  readonly bonneReponse: string;
  readonly optionId: string | null;
}

export interface ReflexionServie {
  readonly attendu: string;
  readonly suite: string | null;
}

export interface CorrectionServie {
  readonly ecranId: string;
  readonly questions: readonly QuestionCorrigee[];
  readonly corrige: CorrigeEcranPresentateur | null;
  readonly reflexion: ReflexionServie | null;
  readonly explications?: readonly ExplicationDeCorrection[];
}

export interface EcranPublic {
  readonly id: string;
  readonly type: string;
  readonly titre: string | null;
  readonly duree: number;
  readonly interactif: boolean;
  readonly donnees: Readonly<Record<string, unknown>>;
  readonly renvoi?: string;
  readonly cadrageDuRenvoi?: CadrageDuRenvoi;
  readonly pieceJointe?: PieceJointeServie;
  readonly ecranCorrige?: string;
  readonly resoluPar?: readonly string[];
  readonly correction?: CorrectionServie;
}

export interface CoursPublic {
  readonly id: string;
  readonly titre: string;
  readonly niveau: string;
  readonly duree: number;
  readonly concepts: readonly string[];
  readonly ecrans: readonly EcranPublic[];
}

export interface CoursPublicCatalogue extends CoursPublic {
  readonly version: number;
  readonly publieLe: string;
}

export interface QuestionDuDeroule {
  readonly id: string;
  readonly enonce: string;
  readonly options: readonly OptionPublique[] | null;
}

export interface EcranDeroule extends EcranPublic {
  readonly notes: string;
  readonly diffusion: Diffusion;
  readonly seuil: number | null;
  readonly corriges: readonly CorrigePresentateur[];
  readonly questions: readonly QuestionDuDeroule[];
  readonly corrigeEcran: CorrigeEcranPresentateur | null;
  readonly guide?: GuideFormateur;
  readonly explications?: readonly ExplicationDeCorrection[];
}

export interface DerouleCours extends Omit<CoursPublic, 'ecrans'> {
  readonly ecrans: readonly EcranDeroule[];
  readonly remediations: Readonly<Record<string, string>>;
}

export interface LivretPublie {
  readonly version: number;
  readonly sujet: CoursPublic;
  readonly corrige: DerouleCours;
}
