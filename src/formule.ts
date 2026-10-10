export type CodeErreur = '#REF!' | '#DIV/0!' | '#NOM?' | '#VALEUR!';

export type ValeurFormule = number | string | boolean;

export interface ResultatFormule {
  readonly valeur: ValeurFormule | null;
  readonly erreur: CodeErreur | null;
}

export interface ResultatNumerique extends ResultatFormule {
  readonly valeur: number | null;
}

interface Echec extends ResultatNumerique {
  readonly valeur: null;
  readonly erreur: CodeErreur;
}

export interface Feuille {
  readonly lignes: number;
  readonly colonnes: number;
  readonly cellules: Readonly<Record<string, string>>;
}

export interface OptionsEvaluation {
  readonly budgetNoeuds: number;
}

export const LONGUEUR_MAX_FORMULE = 200;
export const PROFONDEUR_MAX = 64;
export const NOMBRE_MAX_CELLULES = 2000;

export class FeuilleHorsLimitesError extends Error {
  constructor(raison: string) {
    super(`Feuille hors des limites du moteur de formules : ${raison}`);
    this.name = 'FeuilleHorsLimitesError';
  }
}

interface Reference {
  readonly ligne: number;
  readonly colonne: number;
  readonly ligneFixe: boolean;
  readonly colonneFixe: boolean;
}

type GenreJeton =
  | 'nombre'
  | 'chaine'
  | 'reference'
  | 'nom'
  | 'operateur'
  | 'comparaison'
  | 'ouvrante'
  | 'fermante'
  | 'separateur'
  | 'deuxpoints';

interface Jeton {
  readonly genre: GenreJeton;
  readonly texte: string;
}

type Noeud =
  | { readonly genre: 'litteral'; readonly valeur: ValeurFormule }
  | { readonly genre: 'cellule'; readonly reference: Reference }
  | {
      readonly genre: 'plage';
      readonly debut: Reference;
      readonly fin: Reference;
    }
  | { readonly genre: 'variable'; readonly nom: string }
  | {
      readonly genre: 'unaire';
      readonly signe: number;
      readonly operande: Noeud;
    }
  | {
      readonly genre: 'binaire';
      readonly operateur: string;
      readonly gauche: Noeud;
      readonly droite: Noeud;
    }
  | {
      readonly genre: 'appel';
      readonly nom: string;
      readonly arguments: readonly Noeud[];
    };

type Contenu =
  | { readonly genre: 'vide' }
  | { readonly genre: 'nombre'; readonly valeur: number }
  | { readonly genre: 'texte'; readonly valeur: string }
  | { readonly genre: 'logique'; readonly valeur: boolean }
  | { readonly genre: 'formule'; readonly source: string };

const TEXTE_IGNORE: ReadonlySet<Contenu['genre']> = new Set(['texte', 'logique']);
const TEXTE_ET_VIDES_IGNORES: ReadonlySet<Contenu['genre']> = new Set(['texte', 'logique', 'vide']);

class ErreurFormule extends Error {
  constructor(readonly code: CodeErreur) {
    super(code);
  }
}

const OPTIONS_PAR_DEFAUT: OptionsEvaluation = { budgetNoeuds: 20_000 };
const MARQUE = '=';
const MOTIF_NOMBRE = /^(?:\d+(?:[.,]\d*)?|[.,]\d+)/;
const MOTIF_REFERENCE = /^(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})(?![A-Za-z\d])/;
const MOTIF_NOM = /^\p{L}+(?:(?:\.\p{L}+)+(?=\())?/u;
const MOTIF_ESPACE = /^\s+/;
const MOTIF_NOMBRE_SAISI = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;
const COMPARAISONS = ['<=', '>=', '<>', '<', '>', '='] as const;
const EGALITES: ReadonlySet<string> = new Set(['=', '<>']);
const GUILLEMET = '"';
const GUILLEMET_DOUBLE = '""';
const CONSTANTES_LOGIQUES: ReadonlyMap<string, boolean> = new Map([
  ['VRAI', true],
  ['FAUX', false],
]);
const OPERATEURS: ReadonlySet<string> = new Set(['+', '-', '*', '/', '^']);
const ADDITIFS: ReadonlySet<string> = new Set(['+', '-']);
const MULTIPLICATIFS: ReadonlySet<string> = new Set(['*', '/']);
const PUISSANCES: ReadonlySet<string> = new Set(['^']);
const PONCTUATION: Readonly<Record<string, GenreJeton | undefined>> = {
  '(': 'ouvrante',
  ')': 'fermante',
  ';': 'separateur',
  ':': 'deuxpoints',
};
const FONCTIONS_MULTIPLES: ReadonlySet<string> = new Set(['SOMME', 'MOYENNE']);
const NOM_EXPONENTIELLE = 'EXP';
const FONCTIONS_UNAIRES: ReadonlySet<string> = new Set([NOM_EXPONENTIELLE, 'LN']);
const FONCTIONS_BINAIRES: ReadonlySet<string> = new Set(['ARRONDI', 'PUISSANCE']);
const FONCTIONS_STATISTIQUES: ReadonlySet<string> = new Set([
  'MIN',
  'MAX',
  'NB',
  'MEDIANE',
  'ECARTYPEP',
  'ECARTYPE',
]);
const NOM_CONDITION = 'SI';
const NOM_NEGATION = 'NON';
const NOM_COMPTE_SI = 'NB.SI';
const FONCTIONS_LOGIQUES: ReadonlySet<string> = new Set([NOM_CONDITION, NOM_NEGATION, 'ET', 'OU']);
const NOM_QUARTILE = 'QUARTILE';
const NOM_PENTE = 'PENTE';
const NOM_CORRELATION = 'COEFFICIENT.CORRELATION';
const FONCTIONS_BIVARIEES: ReadonlySet<string> = new Set([
  NOM_PENTE,
  'ORDONNEE.ORIGINE',
  NOM_CORRELATION,
]);
const NOM_VERSEMENT = 'VPM';
const ARGUMENTS_MIN_VERSEMENT = 3;
const ARGUMENTS_MAX_VERSEMENT = 5;
const RANG_MAX_QUARTILE = 4;
const ALPHABET = 26;
const CODE_A = 'A'.charCodeAt(0);
const PRECISION_DECIMALE = 15;
const DECIMALES_EXPRESSION = 6;
const ERREUR_VALEUR: CodeErreur = '#VALEUR!';
const ERREUR_REFERENCE: CodeErreur = '#REF!';
const ERREUR_DIVISION: CodeErreur = '#DIV/0!';
const ERREUR_NOM: CodeErreur = '#NOM?';

const REFUS: Readonly<Record<CodeErreur, ErreurFormule>> = {
  '#REF!': new ErreurFormule(ERREUR_REFERENCE),
  '#DIV/0!': new ErreurFormule(ERREUR_DIVISION),
  '#NOM?': new ErreurFormule(ERREUR_NOM),
  '#VALEUR!': new ErreurFormule(ERREUR_VALEUR),
};

function refuser(code: CodeErreur): never {
  throw REFUS[code];
}

const REFUS_CIRCULAIRE = new ErreurFormule(ERREUR_REFERENCE);

export function lettreColonne(colonne: number): string {
  let reste = colonne;
  let lettres = '';
  do {
    lettres = String.fromCharCode(CODE_A + (reste % ALPHABET)) + lettres;
    reste = Math.floor(reste / ALPHABET) - 1;
  } while (reste >= 0);
  return lettres;
}

export function nomCellule(ligne: number, colonne: number): string {
  return `${lettreColonne(colonne)}${ligne + 1}`;
}

function indexColonne(lettres: string): number {
  return [...lettres.toUpperCase()].reduce(
    (cumul, lettre) => cumul * ALPHABET + (lettre.charCodeAt(0) - CODE_A + 1),
    0,
  );
}

function lireReference(texte: string): Reference {
  const trouve = MOTIF_REFERENCE.exec(texte);
  if (trouve === null || trouve[0] !== texte) {
    refuser(ERREUR_VALEUR);
  }
  return {
    ligne: Number(trouve[4]) - 1,
    colonne: indexColonne(trouve[2]) - 1,
    ligneFixe: trouve[3] === '$',
    colonneFixe: trouve[1] === '$',
  };
}

function ecrireReference(reference: Reference): string {
  if (reference.ligne < 0 || reference.colonne < 0) {
    return '#REF!';
  }
  const colonne = `${reference.colonneFixe ? '$' : ''}${lettreColonne(reference.colonne)}`;
  return `${colonne}${reference.ligneFixe ? '$' : ''}${reference.ligne + 1}`;
}

function lireNombre(brut: string): number {
  const compact = brut.trim().replace(',', '.');
  return MOTIF_NOMBRE_SAISI.test(compact) ? Number(compact) : Number.NaN;
}

function texteDuJetonChaine(reste: string): string {
  let rang = GUILLEMET.length;
  while (rang < reste.length) {
    if (reste.startsWith(GUILLEMET_DOUBLE, rang)) {
      rang += GUILLEMET_DOUBLE.length;
    } else if (reste.startsWith(GUILLEMET, rang)) {
      return reste.slice(0, rang + GUILLEMET.length);
    } else {
      rang += 1;
    }
  }
  return refuser(ERREUR_VALEUR);
}

function contenuDeChaine(texte: string): string {
  return texte.slice(GUILLEMET.length, -GUILLEMET.length).replaceAll(GUILLEMET_DOUBLE, GUILLEMET);
}

function jetonSuivant(reste: string): Jeton {
  if (reste.startsWith(GUILLEMET)) {
    return { genre: 'chaine', texte: texteDuJetonChaine(reste) };
  }
  const nombre = MOTIF_NOMBRE.exec(reste);
  if (nombre !== null) {
    return { genre: 'nombre', texte: nombre[0] };
  }
  const reference = MOTIF_REFERENCE.exec(reste);
  if (reference !== null) {
    return { genre: 'reference', texte: reference[0] };
  }
  const nom = MOTIF_NOM.exec(reste);
  if (nom !== null) {
    return { genre: 'nom', texte: nom[0] };
  }
  const comparaison = COMPARAISONS.find((signe) => reste.startsWith(signe));
  if (comparaison !== undefined) {
    return { genre: 'comparaison', texte: comparaison };
  }
  const premier = reste.charAt(0);
  if (OPERATEURS.has(premier)) {
    return { genre: 'operateur', texte: premier };
  }
  const ponctuation = PONCTUATION[premier];
  if (ponctuation === undefined) {
    refuser(ERREUR_VALEUR);
  }
  return { genre: ponctuation, texte: premier };
}

function decouper(source: string): Jeton[] {
  if (source.length > LONGUEUR_MAX_FORMULE) {
    refuser(ERREUR_VALEUR);
  }
  const jetons: Jeton[] = [];
  let reste = source;
  while (reste.length > 0) {
    const espace = MOTIF_ESPACE.exec(reste);
    if (espace !== null) {
      reste = reste.slice(espace[0].length);
      continue;
    }
    const jeton = jetonSuivant(reste);
    jetons.push(jeton);
    reste = reste.slice(jeton.texte.length);
  }
  return jetons;
}

class Analyseur {
  private position = 0;
  private profondeur = 0;

  constructor(private readonly jetons: readonly Jeton[]) {}

  analyser(): Noeud {
    const racine = this.comparaison();
    if (this.position !== this.jetons.length) {
      refuser(ERREUR_VALEUR);
    }
    return racine;
  }

  private courant(): Jeton | null {
    return this.jetons[this.position] ?? null;
  }

  private avancer(): Jeton {
    const jeton = this.courant();
    if (jeton === null) {
      refuser(ERREUR_VALEUR);
    }
    this.position += 1;
    return jeton;
  }

  private consommer(genre: GenreJeton): void {
    if (this.avancer().genre !== genre) {
      refuser(ERREUR_VALEUR);
    }
  }

  private descendre<T>(niveau: () => T): T {
    this.profondeur += 1;
    if (this.profondeur > PROFONDEUR_MAX) {
      refuser(ERREUR_VALEUR);
    }
    const resultat = niveau();
    this.profondeur -= 1;
    return resultat;
  }

  private comparaison(): Noeud {
    const gauche = this.somme();
    const jeton = this.courant();
    if (jeton === null || jeton.genre !== 'comparaison') {
      return gauche;
    }
    this.position += 1;
    return {
      genre: 'binaire',
      operateur: jeton.texte,
      gauche,
      droite: this.somme(),
    };
  }

  private somme(): Noeud {
    return this.suite(ADDITIFS, () => this.produit());
  }

  private produit(): Noeud {
    return this.suite(MULTIPLICATIFS, () => this.puissance());
  }

  private puissance(): Noeud {
    return this.suite(PUISSANCES, () => this.unaire());
  }

  private suite(signes: ReadonlySet<string>, niveau: () => Noeud): Noeud {
    let gauche = niveau();
    let jeton = this.courant();
    while (jeton !== null && jeton.genre === 'operateur' && signes.has(jeton.texte)) {
      this.position += 1;
      gauche = {
        genre: 'binaire',
        operateur: jeton.texte,
        gauche,
        droite: niveau(),
      };
      jeton = this.courant();
    }
    return gauche;
  }

  private unaire(): Noeud {
    const jeton = this.courant();
    if (jeton !== null && jeton.genre === 'operateur' && ADDITIFS.has(jeton.texte)) {
      this.position += 1;
      return this.descendre<Noeud>(() => ({
        genre: 'unaire',
        signe: jeton.texte === '-' ? -1 : 1,
        operande: this.unaire(),
      }));
    }
    return this.primaire();
  }

  private primaire(): Noeud {
    const jeton = this.avancer();
    if (jeton.genre === 'nombre') {
      return {
        genre: 'litteral',
        valeur: Number(jeton.texte.replace(',', '.')),
      };
    }
    if (jeton.genre === 'chaine') {
      return { genre: 'litteral', valeur: contenuDeChaine(jeton.texte) };
    }
    if (jeton.genre === 'ouvrante') {
      return this.descendre<Noeud>(() => {
        const interne = this.comparaison();
        this.consommer('fermante');
        return interne;
      });
    }
    if (jeton.genre === 'reference') {
      return this.celluleOuPlage(jeton);
    }
    if (jeton.genre === 'nom') {
      return this.nomme(jeton.texte);
    }
    return refuser(ERREUR_VALEUR);
  }

  private nomme(nom: string): Noeud {
    if (this.courant()?.genre === 'ouvrante') {
      return this.descendre<Noeud>(() => this.appel(nom));
    }
    const constante = CONSTANTES_LOGIQUES.get(nom.toUpperCase());
    return constante === undefined
      ? { genre: 'variable', nom }
      : { genre: 'litteral', valeur: constante };
  }

  private celluleOuPlage(jeton: Jeton): Noeud {
    const debut = lireReference(jeton.texte);
    if (this.courant()?.genre !== 'deuxpoints') {
      return { genre: 'cellule', reference: debut };
    }
    this.position += 1;
    const fin = this.avancer();
    if (fin.genre !== 'reference') {
      refuser(ERREUR_VALEUR);
    }
    return { genre: 'plage', debut, fin: lireReference(fin.texte) };
  }

  private appel(nom: string): Noeud {
    this.position += 1;
    const parametres: Noeud[] = [];
    if (this.courant()?.genre === 'fermante') {
      this.position += 1;
      return { genre: 'appel', nom: nom.toUpperCase(), arguments: parametres };
    }
    parametres.push(this.comparaison());
    while (this.courant()?.genre === 'separateur') {
      this.position += 1;
      parametres.push(this.comparaison());
    }
    this.consommer('fermante');
    return { genre: 'appel', nom: nom.toUpperCase(), arguments: parametres };
  }
}

function analyser(source: string): Noeud {
  return new Analyseur(decouper(source)).analyser();
}

function sourceDeFormule(brut: string): string | null {
  const debut = brut.trimStart();
  return debut.startsWith(MARQUE) ? debut.slice(MARQUE.length) : null;
}

export function estUneFormule(brut: string): boolean {
  return sourceDeFormule(brut) !== null;
}

function lireContenu(brut: string): Contenu {
  if (brut.trim().length === 0) {
    return { genre: 'vide' };
  }
  const source = sourceDeFormule(brut);
  if (source !== null) {
    return { genre: 'formule', source };
  }
  const saisie = lireSaisie(brut);
  if (typeof saisie === 'number') {
    return { genre: 'nombre', valeur: saisie };
  }
  return typeof saisie === 'boolean'
    ? { genre: 'logique', valeur: saisie }
    : { genre: 'texte', valeur: saisie };
}

function lireSaisie(brut: string): ValeurFormule {
  const nombre = lireNombre(brut);
  return Number.isNaN(nombre)
    ? (CONSTANTES_LOGIQUES.get(brut.trim().toUpperCase()) ?? brut)
    : nombre;
}

function versNombre(valeur: ValeurFormule): number {
  if (typeof valeur === 'number') {
    return valeur;
  }
  if (typeof valeur === 'boolean') {
    return Number(valeur);
  }
  const nombre = lireNombre(valeur);
  return Number.isNaN(nombre) ? refuser(ERREUR_VALEUR) : nombre;
}

function versLogique(valeur: ValeurFormule): boolean {
  if (typeof valeur === 'string') {
    return refuser(ERREUR_VALEUR);
  }
  return typeof valeur === 'boolean' ? valeur : valeur !== 0;
}

const RANG_DU_TYPE: Readonly<Record<string, number>> = {
  number: 0,
  string: 1,
  boolean: 2,
};

function ordreDeMemeType(gauche: ValeurFormule, droite: ValeurFormule): number {
  const [premier, second] =
    typeof gauche === 'string' && typeof droite === 'string'
      ? [gauche.toUpperCase(), droite.toUpperCase()]
      : [Number(gauche), Number(droite)];
  if (premier === second) {
    return 0;
  }
  return premier < second ? -1 : 1;
}

function ordre(gauche: ValeurFormule, droite: ValeurFormule): number {
  const ecart = RANG_DU_TYPE[typeof gauche] - RANG_DU_TYPE[typeof droite];
  return ecart === 0 ? ordreDeMemeType(gauche, droite) : Math.sign(ecart);
}

function selonOrdre(operateur: string, rang: number): boolean {
  switch (operateur) {
    case '=':
      return rang === 0;
    case '<>':
      return rang !== 0;
    case '<':
      return rang < 0;
    case '<=':
      return rang <= 0;
    case '>':
      return rang > 0;
    default:
      return rang >= 0;
  }
}

interface Critere {
  readonly operateur: string;
  readonly valeur: ValeurFormule;
}

function lireCritere(valeur: ValeurFormule): Critere {
  if (typeof valeur !== 'string') {
    return { operateur: '=', valeur };
  }
  const signe = COMPARAISONS.find((candidat) => valeur.startsWith(candidat));
  const reste = signe === undefined ? valeur : valeur.slice(signe.length);
  return {
    operateur: signe ?? '=',
    valeur: reste.length === 0 ? reste : lireSaisie(reste),
  };
}

function satisfait(critere: Critere, valeur: ValeurFormule): boolean {
  if (typeof valeur !== typeof critere.valeur && !EGALITES.has(critere.operateur)) {
    return false;
  }
  return selonOrdre(critere.operateur, ordre(valeur, critere.valeur));
}

function sansZeroNegatif(valeur: number): number {
  return valeur === 0 ? 0 : valeur;
}

export function arrondirMoitieLoinDeZero(valeur: number, decimales: number): number {
  const facteur = 10 ** Math.trunc(decimales);
  const decale = Number((Math.abs(valeur) * facteur).toPrecision(PRECISION_DECIMALE));
  const arrondi = (Math.sign(valeur) * Math.round(decale)) / facteur;
  return sansZeroNegatif(Number(arrondi.toPrecision(PRECISION_DECIMALE)));
}

function appliquer(operateur: string, gauche: number, droite: number): number {
  if (operateur === '+') {
    return gauche + droite;
  }
  if (operateur === '-') {
    return gauche - droite;
  }
  if (operateur === '*') {
    return gauche * droite;
  }
  if (operateur === '/') {
    return droite === 0 ? refuser(ERREUR_DIVISION) : gauche / droite;
  }
  return gauche ** droite;
}

function quantile(valeurs: readonly number[], part: number): number {
  if (valeurs.length === 0) {
    refuser(ERREUR_VALEUR);
  }
  const triees = [...valeurs].sort((gauche, droite) => gauche - droite);
  const position = (triees.length - 1) * part;
  const bas = Math.floor(position);
  const haut = Math.min(bas + 1, triees.length - 1);
  return triees[bas] + (position - bas) * (triees[haut] - triees[bas]);
}

function ecartType(valeurs: readonly number[], degresPerdus: number): number {
  const diviseur = valeurs.length - degresPerdus;
  if (diviseur <= 0) {
    refuser(ERREUR_DIVISION);
  }
  const moyenne = valeurs.reduce((cumul, valeur) => cumul + valeur, 0) / valeurs.length;
  const carres = valeurs.reduce((cumul, valeur) => cumul + (valeur - moyenne) ** 2, 0);
  return Math.sqrt(carres / diviseur);
}

function statistique(nom: string, valeurs: readonly number[]): number {
  switch (nom) {
    case 'MIN':
      return valeurs.length === 0 ? 0 : Math.min(...valeurs);
    case 'MAX':
      return valeurs.length === 0 ? 0 : Math.max(...valeurs);
    case 'NB':
      return valeurs.length;
    case 'MEDIANE':
      return quantile(valeurs, 1 / 2);
    case 'ECARTYPEP':
      return ecartType(valeurs, 0);
    default:
      return ecartType(valeurs, 1);
  }
}

function deuxSeries(nom: string, paires: readonly (readonly [number, number])[]): number {
  if (paires.length < 2) {
    return refuser(ERREUR_DIVISION);
  }
  const moyenne = (rang: 0 | 1): number =>
    paires.reduce((cumul, paire) => cumul + paire[rang], 0) / paires.length;
  const [moyenneGauche, moyenneDroite] = [moyenne(0), moyenne(1)];
  let carresGauche = 0;
  let carresDroite = 0;
  let produits = 0;
  for (const [gauche, droite] of paires) {
    carresGauche += (gauche - moyenneGauche) ** 2;
    carresDroite += (droite - moyenneDroite) ** 2;
    produits += (gauche - moyenneGauche) * (droite - moyenneDroite);
  }
  if (nom === NOM_CORRELATION) {
    const denominateur = Math.sqrt(carresGauche * carresDroite);
    return denominateur === 0 ? refuser(ERREUR_DIVISION) : produits / denominateur;
  }
  if (carresDroite === 0) {
    return refuser(ERREUR_DIVISION);
  }
  const pente = produits / carresDroite;
  return nom === NOM_PENTE ? pente : moyenneGauche - pente * moyenneDroite;
}

function versementConstant([
  taux,
  periodes,
  valeurActuelle,
  valeurFuture = 0,
  enDebutDePeriode = 0,
]: readonly number[]): number {
  if (periodes === 0) {
    return refuser(ERREUR_DIVISION);
  }
  if (taux === 0) {
    return -(valeurActuelle + valeurFuture) / periodes;
  }
  const facteur = (1 + taux) ** periodes;
  if (facteur === 1) {
    return refuser(ERREUR_DIVISION);
  }
  const versement = (-(valeurActuelle * facteur + valeurFuture) * taux) / (facteur - 1);
  return enDebutDePeriode === 0 ? versement : versement / (1 + taux);
}

function exponentielleOuLogarithme(nom: string, valeur: number): number {
  if (nom === NOM_EXPONENTIELLE) {
    return fini(Math.exp(valeur));
  }
  return valeur > 0 ? Math.log(valeur) : refuser(ERREUR_VALEUR);
}

function fini(valeur: number): number {
  return Number.isFinite(valeur) ? sansZeroNegatif(valeur) : refuser(ERREUR_VALEUR);
}

function stabiliser(valeur: ValeurFormule): ValeurFormule {
  return typeof valeur === 'number' ? fini(valeur) : valeur;
}

function valeurSaisie(contenu: Exclude<Contenu, { readonly genre: 'formule' }>): ValeurFormule {
  return contenu.genre === 'vide' ? 0 : contenu.valeur;
}

const CELLULE_VIDE_COMPTEE: ResultatFormule = { valeur: '', erreur: null };

function plageHorsFonction(): ValeurFormule {
  return refuser(ERREUR_VALEUR);
}

function echec(cause: unknown): Echec {
  return {
    valeur: null,
    erreur: cause instanceof ErreurFormule ? cause.code : ERREUR_VALEUR,
  };
}

function estEntierPositif(valeur: number): boolean {
  return Number.isSafeInteger(valeur) && valeur >= 0;
}

function exigerFeuilleRecevable(feuille: Feuille): void {
  if (!estEntierPositif(feuille.lignes) || !estEntierPositif(feuille.colonnes)) {
    throw new FeuilleHorsLimitesError('la grille doit être un couple d’entiers positifs');
  }
  const nombre = Object.keys(feuille.cellules).length;
  if (nombre > NOMBRE_MAX_CELLULES) {
    throw new FeuilleHorsLimitesError(`${nombre} cellules pour ${NOMBRE_MAX_CELLULES} au plus`);
  }
}

class Evaluation {
  private restant: number;
  private readonly contenus: ReadonlyMap<string, string>;
  private readonly memoire = new Map<string, ResultatFormule>();
  private readonly arbres = new Map<string, Noeud>();
  private readonly enCours = new Set<string>();
  private readonly circulaires = new Set<string>();

  constructor(
    private readonly feuille: Feuille | null,
    private readonly variables: Readonly<Record<string, number>>,
    options: OptionsEvaluation,
  ) {
    this.restant = options.budgetNoeuds;
    this.contenus = new Map(
      Object.entries(feuille?.cellules ?? {}).map(([nom, contenu]) => [
        nom.toUpperCase(),
        String(contenu),
      ]),
    );
  }

  nomsRemplis(): string[] {
    return [...this.contenus.entries()]
      .filter(([, contenu]) => contenu.trim().length > 0)
      .map(([nom]) => nom);
  }

  resultatDe(nom: string): ResultatFormule {
    const connu = this.memoire.get(nom);
    if (connu !== undefined) {
      return connu;
    }
    if (this.enCours.has(nom)) {
      return { valeur: null, erreur: ERREUR_REFERENCE };
    }
    this.enCours.add(nom);
    let resultat: ResultatFormule;
    try {
      this.depenser();
      resultat = { valeur: this.valeurDuContenu(nom), erreur: null };
    } catch (cause) {
      resultat = echec(cause);
      if (cause === REFUS_CIRCULAIRE) {
        this.circulaires.add(nom);
      }
    }
    this.enCours.delete(nom);
    this.memoire.set(nom, resultat);
    return resultat;
  }

  expression(noeud: Noeud): number {
    return fini(this.nombre(noeud));
  }

  private depenser(): void {
    this.restant -= 1;
    if (this.restant < 0) {
      refuser(ERREUR_VALEUR);
    }
  }

  private valeurDuContenu(nom: string): ValeurFormule {
    const contenu = lireContenu(this.contenus.get(nom) ?? '');
    return contenu.genre === 'formule'
      ? stabiliser(this.calculer(this.arbreDe(contenu.source)))
      : valeurSaisie(contenu);
  }

  private arbreDe(source: string): Noeud {
    const connu = this.arbres.get(source);
    if (connu !== undefined) {
      return connu;
    }
    const arbre = analyser(source);
    this.arbres.set(source, arbre);
    return arbre;
  }

  private exigerDansLaGrille(reference: Reference): string {
    const feuille = this.feuille;
    if (
      feuille === null ||
      reference.ligne < 0 ||
      reference.colonne < 0 ||
      reference.ligne >= feuille.lignes ||
      reference.colonne >= feuille.colonnes
    ) {
      return refuser(ERREUR_REFERENCE);
    }
    return nomCellule(reference.ligne, reference.colonne);
  }

  private valeurCellule(reference: Reference): ValeurFormule {
    return this.valeurNommee(this.exigerDansLaGrille(reference));
  }

  private valeurNommee(nom: string): ValeurFormule {
    const resultat = this.resultatDe(nom);
    this.exigerHorsCycle(nom);
    return resultat.erreur === null && resultat.valeur !== null
      ? resultat.valeur
      : refuser(resultat.erreur ?? ERREUR_VALEUR);
  }

  private exigerHorsCycle(nom: string): void {
    if (this.enCours.has(nom) || this.circulaires.has(nom)) {
      throw REFUS_CIRCULAIRE;
    }
  }

  private genreDe(nom: string): Contenu['genre'] {
    return lireContenu(this.contenus.get(nom) ?? '').genre;
  }

  private *nomsDeLaPlage(noeud: Extract<Noeud, { genre: 'plage' }>): Generator<string> {
    const { debut, fin } = noeud;
    this.exigerDansLaGrille(debut);
    this.exigerDansLaGrille(fin);
    for (
      let ligne = Math.min(debut.ligne, fin.ligne);
      ligne <= Math.max(debut.ligne, fin.ligne);
      ligne += 1
    ) {
      for (
        let colonne = Math.min(debut.colonne, fin.colonne);
        colonne <= Math.max(debut.colonne, fin.colonne);
        colonne += 1
      ) {
        this.depenser();
        yield nomCellule(ligne, colonne);
      }
    }
  }

  private cellulesDeLaPlage(
    noeud: Extract<Noeud, { genre: 'plage' }>,
    ignorees: ReadonlySet<Contenu['genre']>,
  ): (ValeurFormule | null)[] {
    return Array.from(this.nomsDeLaPlage(noeud), (nom) =>
      ignorees.has(this.genreDe(nom)) ? null : this.valeurNommee(nom),
    );
  }

  private nombresDeLaPlage(
    noeud: Extract<Noeud, { genre: 'plage' }>,
    ignorees: ReadonlySet<Contenu['genre']>,
  ): (number | null)[] {
    return this.cellulesDeLaPlage(noeud, ignorees).map((valeur) =>
      typeof valeur === 'number' ? valeur : null,
    );
  }

  private valeursDeLaPlage(
    noeud: Extract<Noeud, { genre: 'plage' }>,
    ignorees: ReadonlySet<Contenu['genre']> = TEXTE_IGNORE,
  ): number[] {
    return this.nombresDeLaPlage(noeud, ignorees).filter(
      (valeur): valeur is number => valeur !== null,
    );
  }

  private nombre(noeud: Noeud): number {
    return versNombre(this.calculer(noeud));
  }

  private logique(noeud: Noeud): boolean {
    return versLogique(this.calculer(noeud));
  }

  private logiquesDe(argument: Noeud): boolean[] {
    if (argument.genre !== 'plage') {
      return [this.logique(argument)];
    }
    return this.cellulesDeLaPlage(argument, TEXTE_ET_VIDES_IGNORES)
      .filter((valeur): valeur is number | boolean => valeur !== null && typeof valeur !== 'string')
      .map(versLogique);
  }

  private connecter(nom: string, parametres: readonly Noeud[]): boolean {
    const valeurs = parametres.flatMap((argument) => this.logiquesDe(argument));
    if (valeurs.length === 0) {
      return refuser(ERREUR_VALEUR);
    }
    return nom === 'ET' ? valeurs.every(Boolean) : valeurs.some(Boolean);
  }

  private nier(parametres: readonly Noeud[]): boolean {
    return parametres.length === 1 ? !this.logique(parametres[0]) : refuser(ERREUR_VALEUR);
  }

  private resultatCompte(nom: string): ResultatFormule {
    if (this.genreDe(nom) === 'vide') {
      return CELLULE_VIDE_COMPTEE;
    }
    const resultat = this.resultatDe(nom);
    this.exigerHorsCycle(nom);
    return resultat;
  }

  private compterSi(parametres: readonly Noeud[]): number {
    const [plage, argument] = parametres;
    if (parametres.length !== 2 || plage.genre !== 'plage') {
      return refuser(ERREUR_VALEUR);
    }
    const critere = lireCritere(this.calculer(argument));
    let compte = 0;
    for (const nom of this.nomsDeLaPlage(plage)) {
      const { valeur, erreur } = this.resultatCompte(nom);
      if (erreur === null && valeur !== null && satisfait(critere, valeur)) {
        compte += 1;
      }
    }
    return compte;
  }

  private bivariee(nom: string, parametres: readonly Noeud[]): number {
    const [premiere, seconde] = parametres;
    if (parametres.length !== 2 || premiere.genre !== 'plage' || seconde.genre !== 'plage') {
      return refuser(ERREUR_VALEUR);
    }
    const gauche = this.nombresDeLaPlage(premiere, TEXTE_ET_VIDES_IGNORES);
    const droite = this.nombresDeLaPlage(seconde, TEXTE_ET_VIDES_IGNORES);
    if (gauche.length !== droite.length) {
      return refuser(ERREUR_VALEUR);
    }
    const paires: [number, number][] = [];
    gauche.forEach((valeur, rang) => {
      const associee = droite[rang];
      if (valeur !== null && associee !== null) {
        paires.push([valeur, associee]);
      }
    });
    return deuxSeries(nom, paires);
  }

  private etendre(noeud: Noeud): number[] {
    return noeud.genre === 'plage' ? this.valeursDeLaPlage(noeud) : [this.nombre(noeud)];
  }

  private serie(parametres: readonly Noeud[]): number[] {
    return parametres.flatMap((argument) =>
      argument.genre === 'plage'
        ? this.valeursDeLaPlage(argument, TEXTE_ET_VIDES_IGNORES)
        : [this.nombre(argument)],
    );
  }

  private quartile(parametres: readonly Noeud[]): number {
    if (parametres.length !== 2) {
      refuser(ERREUR_VALEUR);
    }
    const rang = Math.trunc(this.nombre(parametres[1]));
    if (rang < 0 || rang > RANG_MAX_QUARTILE) {
      refuser(ERREUR_VALEUR);
    }
    return quantile(this.serie([parametres[0]]), rang / RANG_MAX_QUARTILE);
  }

  private condition(parametres: readonly Noeud[]): ValeurFormule {
    if (parametres.length !== 2 && parametres.length !== 3) {
      refuser(ERREUR_VALEUR);
    }
    if (this.logique(parametres[0])) {
      return this.calculer(parametres[1]);
    }
    return parametres.length === 3 ? this.calculer(parametres[2]) : false;
  }

  private agreger(nom: string, parametres: readonly Noeud[]): number {
    const valeurs = parametres.flatMap((argument) => this.etendre(argument));
    const somme = valeurs.reduce((cumul, valeur) => cumul + valeur, 0);
    if (nom === 'SOMME') {
      return somme;
    }
    return valeurs.length === 0 ? refuser(ERREUR_DIVISION) : somme / valeurs.length;
  }

  private unaireNommee(nom: string, parametres: readonly Noeud[]): number {
    if (parametres.length !== 1) {
      refuser(ERREUR_VALEUR);
    }
    return exponentielleOuLogarithme(nom, this.nombre(parametres[0]));
  }

  private binaireNommee(nom: string, parametres: readonly Noeud[]): number {
    if (parametres.length !== 2) {
      refuser(ERREUR_VALEUR);
    }
    const [premier, second] = parametres.map((argument) => this.nombre(argument));
    return nom === 'ARRONDI' ? arrondirMoitieLoinDeZero(premier, second) : premier ** second;
  }

  private appeler(noeud: Extract<Noeud, { genre: 'appel' }>): ValeurFormule {
    return FONCTIONS_LOGIQUES.has(noeud.nom)
      ? this.appelerLogique(noeud)
      : this.appelerNumerique(noeud);
  }

  private appelerLogique(noeud: Extract<Noeud, { genre: 'appel' }>): ValeurFormule {
    return noeud.nom === NOM_CONDITION
      ? this.condition(noeud.arguments)
      : this.logiqueNommee(noeud.nom, noeud.arguments);
  }

  private logiqueNommee(nom: string, parametres: readonly Noeud[]): boolean {
    return nom === NOM_NEGATION ? this.nier(parametres) : this.connecter(nom, parametres);
  }

  private appelerNumerique(noeud: Extract<Noeud, { genre: 'appel' }>): number {
    if (noeud.nom === NOM_COMPTE_SI) {
      return this.compterSi(noeud.arguments);
    }
    if (FONCTIONS_MULTIPLES.has(noeud.nom)) {
      return this.agreger(noeud.nom, noeud.arguments);
    }
    if (FONCTIONS_UNAIRES.has(noeud.nom)) {
      return this.unaireNommee(noeud.nom, noeud.arguments);
    }
    if (FONCTIONS_BINAIRES.has(noeud.nom)) {
      return this.binaireNommee(noeud.nom, noeud.arguments);
    }
    if (FONCTIONS_STATISTIQUES.has(noeud.nom)) {
      return statistique(noeud.nom, this.serie(noeud.arguments));
    }
    if (noeud.nom === NOM_QUARTILE) {
      return this.quartile(noeud.arguments);
    }
    if (FONCTIONS_BIVARIEES.has(noeud.nom)) {
      return this.bivariee(noeud.nom, noeud.arguments);
    }
    if (noeud.nom === NOM_VERSEMENT) {
      return this.versement(noeud.arguments);
    }
    return refuser(ERREUR_NOM);
  }

  private versement(parametres: readonly Noeud[]): number {
    if (
      parametres.length < ARGUMENTS_MIN_VERSEMENT ||
      parametres.length > ARGUMENTS_MAX_VERSEMENT
    ) {
      return refuser(ERREUR_VALEUR);
    }
    return versementConstant(parametres.map((argument) => this.nombre(argument)));
  }

  private variable(nom: string): ValeurFormule {
    return Object.hasOwn(this.variables, nom) ? this.variables[nom] : refuser(ERREUR_NOM);
  }

  private signer(noeud: Extract<Noeud, { genre: 'unaire' }>): ValeurFormule {
    return noeud.signe * this.nombre(noeud.operande);
  }

  private binaire(noeud: Extract<Noeud, { genre: 'binaire' }>): ValeurFormule {
    const gauche = this.calculer(noeud.gauche);
    const droite = this.calculer(noeud.droite);
    return OPERATEURS.has(noeud.operateur)
      ? appliquer(noeud.operateur, versNombre(gauche), versNombre(droite))
      : selonOrdre(noeud.operateur, ordre(gauche, droite));
  }

  private calculer(noeud: Noeud): ValeurFormule {
    this.depenser();
    switch (noeud.genre) {
      case 'litteral':
        return noeud.valeur;
      case 'variable':
        return this.variable(noeud.nom);
      case 'cellule':
        return this.valeurCellule(noeud.reference);
      case 'plage':
        return plageHorsFonction();
      case 'unaire':
        return this.signer(noeud);
      case 'binaire':
        return this.binaire(noeud);
      case 'appel':
        return this.appeler(noeud);
    }
  }
}

function referenceDeCellule(nom: string): Reference | null {
  try {
    return lireReference(nom.trim());
  } catch {
    return null;
  }
}

export function evaluerFeuille(
  feuille: Feuille,
  options: OptionsEvaluation = OPTIONS_PAR_DEFAUT,
): ReadonlyMap<string, ResultatFormule> {
  exigerFeuilleRecevable(feuille);
  const evaluation = new Evaluation(feuille, {}, options);
  return new Map(evaluation.nomsRemplis().map((nom) => [nom, evaluation.resultatDe(nom)]));
}

export function evaluerCellule(
  feuille: Feuille,
  nom: string,
  options: OptionsEvaluation = OPTIONS_PAR_DEFAUT,
): ResultatFormule {
  exigerFeuilleRecevable(feuille);
  const reference = referenceDeCellule(nom);
  if (
    reference === null ||
    reference.ligne >= feuille.lignes ||
    reference.colonne >= feuille.colonnes
  ) {
    return { valeur: null, erreur: ERREUR_REFERENCE };
  }
  return new Evaluation(feuille, {}, options).resultatDe(
    nomCellule(reference.ligne, reference.colonne),
  );
}

export function evaluerExpression(
  expression: string,
  variables: Readonly<Record<string, number>>,
  options: OptionsEvaluation = OPTIONS_PAR_DEFAUT,
): ResultatNumerique {
  try {
    const source = sourceDeFormule(expression) ?? expression;
    const valeur = new Evaluation(null, variables, options).expression(analyser(source));
    return {
      valeur: sansZeroNegatif(Number(valeur.toFixed(DECIMALES_EXPRESSION))),
      erreur: null,
    };
  } catch (cause) {
    return echec(cause);
  }
}

function formeRelative(reference: Reference, origine: Reference): string {
  const ecart = (axe: 'R' | 'C', fixe: boolean, cible: number, depart: number): string => {
    if (fixe) {
      return `${axe}${cible + 1}`;
    }
    const delta = cible - depart;
    return delta === 0 ? axe : `${axe}[${delta}]`;
  };
  return (
    ecart('R', reference.ligneFixe, reference.ligne, origine.ligne) +
    ecart('C', reference.colonneFixe, reference.colonne, origine.colonne)
  );
}

export interface SurfaceFormule {
  readonly references: readonly string[];
  readonly litteraux: readonly number[];
}

export function surfaceDeFormule(formule: string): SurfaceFormule | null {
  const source = sourceDeFormule(formule);
  if (source === null) {
    return null;
  }
  try {
    const jetons = decouper(source);
    new Analyseur(jetons).analyser();
    return {
      references: jetons
        .filter((jeton) => jeton.genre === 'reference')
        .map((jeton) => jeton.texte.replaceAll('$', '').toUpperCase()),
      litteraux: jetons
        .filter((jeton) => jeton.genre === 'nombre')
        .map((jeton) => Number(jeton.texte.replace(',', '.'))),
    };
  } catch {
    return null;
  }
}

export function formeR1C1(formule: string, cellule: string): string | null {
  const source = sourceDeFormule(formule);
  const origine = referenceDeCellule(cellule);
  if (source === null || origine === null) {
    return null;
  }
  try {
    const jetons = decouper(source);
    new Analyseur(jetons).analyser();
    const corps = jetons
      .map((jeton) =>
        jeton.genre === 'reference'
          ? formeRelative(lireReference(jeton.texte), origine)
          : jeton.texte,
      )
      .join('');
    return `${MARQUE}${corps}`;
  } catch {
    return null;
  }
}

export function decalerFormule(
  formule: string,
  decalageLigne: number,
  decalageColonne: number,
): string {
  const source = sourceDeFormule(formule);
  if (source === null) {
    return formule;
  }
  try {
    const jetons = decouper(source);
    return (
      MARQUE + jetons.map((jeton) => decalerJeton(jeton, decalageLigne, decalageColonne)).join('')
    );
  } catch {
    return formule;
  }
}

function decalerJeton(jeton: Jeton, decalageLigne: number, decalageColonne: number): string {
  if (jeton.genre !== 'reference') {
    return jeton.texte;
  }
  const reference = lireReference(jeton.texte);
  return ecrireReference({
    ligne: reference.ligneFixe ? reference.ligne : reference.ligne + decalageLigne,
    colonne: reference.colonneFixe ? reference.colonne : reference.colonne + decalageColonne,
    ligneFixe: reference.ligneFixe,
    colonneFixe: reference.colonneFixe,
  });
}

const AFFICHAGE_LOGIQUE = { true: 'VRAI', false: 'FAUX' } as const;

function formaterValeur(valeur: ValeurFormule): string {
  switch (typeof valeur) {
    case 'number':
      return String(Number(valeur.toFixed(DECIMALES_EXPRESSION))).replace('.', ',');
    case 'boolean':
      return AFFICHAGE_LOGIQUE[`${valeur}`];
    default:
      return valeur;
  }
}

export function formaterResultat(resultat: ResultatFormule): string {
  if (resultat.erreur !== null || resultat.valeur === null) {
    return resultat.erreur ?? '#VALEUR!';
  }
  return formaterValeur(resultat.valeur);
}

const MOTIF_CLE_GABARIT = /\{([^{}]+)\}/g;

export function remplirGabarit(
  gabarit: string,
  valeurs: Readonly<Record<string, number>>,
  formater: (valeur: number) => string,
): string {
  return gabarit.replace(MOTIF_CLE_GABARIT, (correspondance, cle: string) =>
    Object.hasOwn(valeurs, cle) ? formater(valeurs[cle]) : correspondance,
  );
}
