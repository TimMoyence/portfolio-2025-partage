declare const escapedHtmlBrand: unique symbol;

export type EscapedHtml = string & {
  readonly [escapedHtmlBrand]: 'EscapedHtml';
};

type Genre = 'url' | 'style';

class FragmentEmis<G extends Genre> {
  readonly #texte: string;

  constructor(
    readonly genre: G,
    texte: string,
  ) {
    this.#texte = texte;
  }

  toString(): string {
    return this.#texte;
  }
}

export type UrlEchappee = FragmentEmis<'url'>;

export type FeuilleDeStyle = FragmentEmis<'style'>;

const genresEmis = new WeakMap<object, Genre>();

function emettre<G extends Genre>(genre: G, texte: string): FragmentEmis<G> {
  const fragment = new FragmentEmis(genre, texte);
  Object.freeze(fragment);
  genresEmis.set(fragment, genre);
  return fragment;
}

function verifierGabarit(strings: TemplateStringsArray): void {
  if (!Object.isFrozen(strings) || !Object.isFrozen(strings.raw)) {
    throw new Error(
      'Gabarit refusé : seul un gabarit littéral, dont le tableau est gelé par le moteur, peut transporter du balisage brut.',
    );
  }
}

function estEmis<G extends Genre>(valeur: unknown, genre: G): valeur is FragmentEmis<G> {
  return typeof valeur === 'object' && valeur !== null && genresEmis.get(valeur) === genre;
}

type HtmlFragment = EscapedHtml | number | readonly EscapedHtml[] | UrlEchappee | FeuilleDeStyle;

export function escapeHtml(value: unknown): EscapedHtml {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;') as EscapedHtml;
}

const ALLOWED_URL_SCHEMES: ReadonlySet<string> = new Set(['http:', 'https:', 'mailto:']);

const INERT_URL = '#';

function absoluteScheme(raw: string): string | null {
  try {
    return new URL(raw).protocol;
  } catch {
    return null;
  }
}

/**
 * Le parseur de https://url.spec.whatwg.org/#concept-basic-url-parser retire
 * les tabulations et sauts de ligne de l'entree et met le schema en
 * minuscules : `new URL` ramene `JaVaScRiPt:`, `java<TAB>script:` et
 * ` javascript:` au meme `protocol`, sans normalisation maison. Une entree
 * sans schema valide fait lever le parseur : c'est une reference relative,
 * qui heritera du schema du document.
 *
 * Le refus rend `#` et non la chaine vide : par RFC 3986 section 4.2, une
 * reference vide designe le document courant, donc `href=""` reste un lien
 * actif.
 */
export function escapeUrl(value: unknown): UrlEchappee {
  const raw = String(value);
  if (!raw.trim()) return emettre('url', INERT_URL);
  const scheme = absoluteScheme(raw);
  if (scheme === null) return emettre('url', escapeHtml(raw));
  return emettre('url', ALLOWED_URL_SCHEMES.has(scheme) ? escapeHtml(raw) : INERT_URL);
}

const JETON_CSS = /^[#\w.%-]+$/;

type FragmentCss = number | string | FeuilleDeStyle | readonly FeuilleDeStyle[];

function texteCss(valeur: FragmentCss): string {
  if (typeof valeur === 'number') return String(valeur);
  if (typeof valeur === 'string') {
    if (!JETON_CSS.test(valeur)) {
      throw new Error(
        `Jeton CSS refusé : « ${valeur} ». Seuls les identifiants, couleurs hexadécimales et dimensions sont interpolables dans une feuille de style.`,
      );
    }
    return valeur;
  }
  if (Array.isArray(valeur)) return valeur.map(texteCss).join('');
  if (estEmis(valeur, 'style')) return valeur.toString();
  throw new Error('Jeton CSS refusé : fragment de style contrefait.');
}

export function safeCss(
  strings: TemplateStringsArray,
  ...values: readonly FragmentCss[]
): FeuilleDeStyle {
  verifierGabarit(strings);
  let out = strings[0];
  for (const [index, value] of values.entries()) {
    out += texteCss(value);
    out += strings[index + 1];
  }
  return emettre('style', out);
}

/**
 * Etats du tokenizer de https://html.spec.whatwg.org/multipage/parsing.html#tokenization,
 * reduits a ce qui decide du sens d'une interpolation : texte, balise, nom ou
 * valeur d'attribut, contenu brut de `<script>` et `<style>`.
 */
type Etat =
  | 'texte'
  | 'chevron'
  | 'nom-de-balise'
  | 'fermante'
  | 'declaration'
  | 'balise'
  | 'nom-attribut'
  | 'apres-nom'
  | 'avant-valeur'
  | 'valeur'
  | 'valeur-nue'
  | 'brut';

const ELEMENTS_BRUTS: ReadonlySet<string> = new Set([
  'script',
  'style',
  'xmp',
  'iframe',
  'noembed',
  'noframes',
  'noscript',
  'plaintext',
]);

const ATTRIBUTS_URL: ReadonlySet<string> = new Set(['href', 'src']);

const ELEMENTS_A_RESSOURCE_ACTIVE: ReadonlySet<string> = new Set([
  'script',
  'base',
  'iframe',
  'frame',
  'embed',
  'object',
  'link',
  'portal',
  'applet',
]);

const ATTRIBUTS_TEXTE: ReadonlySet<string> = new Set([
  'alt',
  'title',
  'class',
  'id',
  'lang',
  'dir',
  'role',
  'aria-label',
  'target',
  'rel',
  'name',
  'align',
  'valign',
  'colspan',
  'rowspan',
]);

const ATTRIBUTS_COULEUR: ReadonlySet<string> = new Set(['fill', 'stroke', 'color', 'bgcolor']);

const ATTRIBUTS_DES_BRIQUES: ReadonlySet<string> = new Set([
  'value',
  'for',
  'step',
  'placeholder',
  'headers',
  'points',
  'srclang',
  'label',
  'preload',
  'type',
]);

const ATTRIBUTS_URL_DES_BRIQUES: ReadonlySet<string> = new Set(['poster']);

const ATTRIBUTS_BOOLEENS: ReadonlySet<string> = new Set([
  'disabled',
  'open',
  'checked',
  'selected',
  'hidden',
  'readonly',
]);

interface Politique {
  readonly attributUrl: (attribut: string) => boolean;
  readonly attributTexte: (attribut: string) => boolean;
  readonly fragmentsDansLaBalise: boolean;
}

const STRICTE: Politique = {
  attributUrl: (attribut) => ATTRIBUTS_URL.has(attribut),
  attributTexte: (attribut) => ATTRIBUTS_TEXTE.has(attribut),
  fragmentsDansLaBalise: false,
};

const INTERACTIVE: Politique = {
  attributUrl: (attribut) => ATTRIBUTS_URL.has(attribut) || ATTRIBUTS_URL_DES_BRIQUES.has(attribut),
  attributTexte: (attribut) =>
    ATTRIBUTS_TEXTE.has(attribut) ||
    ATTRIBUTS_DES_BRIQUES.has(attribut) ||
    attribut.startsWith('data-') ||
    attribut.startsWith('aria-'),
  fragmentsDansLaBalise: true,
};

const MORCEAU_DE_BALISE = /[\t\n\f\r ]+|([a-z][a-z0-9-]*)(?:="[^"]*")?|./gs;

const BLANC = /[\t\n\f\r ]/;

const ETATS_SCELLES: ReadonlySet<Etat> = new Set(['valeur', 'declaration', 'brut']);

const LETTRE = /[a-zA-Z]/;

class LecteurDeGabarit {
  etat: Etat = 'texte';
  balise = '';
  attribut = '';
  guillemet = '';
  valeurVide = true;
  #finDuBrut = '';
  #fermetureDuBrutLue = false;

  readonly #transitions: Readonly<Record<Etat, (c: string) => void>> = {
    texte: (c) => this.dansTexte(c),
    chevron: (c) => this.apresChevron(c),
    'nom-de-balise': (c) => this.dansNomDeBalise(c),
    fermante: (c) => this.jusquAuChevronFermant(c),
    declaration: (c) => this.jusquAuChevronFermant(c),
    balise: (c) => this.dansBalise(c),
    'nom-attribut': (c) => this.dansNomAttribut(c),
    'apres-nom': (c) => this.apresNom(c),
    'avant-valeur': (c) => this.avantValeur(c),
    valeur: (c) => this.dansValeur(c),
    'valeur-nue': (c) => this.dansValeurNue(c),
    brut: (c) => this.dansBrut(c),
  };

  lire(texte: string): void {
    for (const caractere of texte) this.#transitions[this.etat](caractere);
  }

  lireInterpolation(texte: string): void {
    if (!ETATS_SCELLES.has(this.etat)) {
      this.lire(texte);
      return;
    }
    const scelle = this.etat;
    for (const caractere of texte) {
      this.#transitions[this.etat](caractere);
      if (this.etat !== scelle) refuser(`qui referme son contexte « ${scelle} »`);
    }
  }

  private dansTexte(c: string): void {
    if (c === '<') this.etat = 'chevron';
  }

  private dansNomDeBalise(c: string): void {
    if (BLANC.test(c) || c === '/') this.etat = 'balise';
    else if (c === '>') this.fermerBalise();
    else this.balise += c.toLowerCase();
  }

  private jusquAuChevronFermant(c: string): void {
    if (c === '>') this.etat = 'texte';
  }

  private dansBalise(c: string): void {
    if (c === '>') this.fermerBalise();
    else if (!BLANC.test(c) && c !== '/') this.ouvrirAttribut(c);
  }

  private apresNom(c: string): void {
    if (c === '=') this.etat = 'avant-valeur';
    else if (c === '>') this.fermerBalise();
    else if (c === '/') this.etat = 'balise';
    else if (!BLANC.test(c)) this.ouvrirAttribut(c);
  }

  private dansValeur(c: string): void {
    if (c === this.guillemet) this.etat = 'balise';
    else this.valeurVide = false;
  }

  private dansValeurNue(c: string): void {
    if (BLANC.test(c)) this.etat = 'balise';
    else if (c === '>') this.fermerBalise();
  }

  private apresChevron(c: string): void {
    if (LETTRE.test(c)) {
      this.etat = 'nom-de-balise';
      this.balise = c.toLowerCase();
    } else if (c === '/') {
      this.etat = 'fermante';
    } else if (c === '!' || c === '?') {
      this.etat = 'declaration';
    } else if (c !== '<') {
      this.etat = 'texte';
    }
  }

  private ouvrirAttribut(c: string): void {
    this.etat = 'nom-attribut';
    this.attribut = c.toLowerCase();
  }

  private dansNomAttribut(c: string): void {
    if (BLANC.test(c)) this.etat = 'apres-nom';
    else if (c === '=') this.etat = 'avant-valeur';
    else if (c === '>') this.fermerBalise();
    else if (c === '/') this.etat = 'balise';
    else this.attribut += c.toLowerCase();
  }

  private avantValeur(c: string): void {
    if (BLANC.test(c)) return;
    if (c === '"' || c === "'") {
      this.etat = 'valeur';
      this.guillemet = c;
      this.valeurVide = true;
    } else if (c === '>') {
      this.fermerBalise();
    } else {
      this.etat = 'valeur-nue';
    }
  }

  private fermerBalise(): void {
    this.etat = ELEMENTS_BRUTS.has(this.balise) ? 'brut' : 'texte';
    this.#finDuBrut = '';
    this.#fermetureDuBrutLue = false;
  }

  private dansBrut(c: string): void {
    if (this.#fermetureDuBrutLue && (BLANC.test(c) || c === '/' || c === '>')) {
      this.etat = c === '>' ? 'texte' : 'fermante';
      return;
    }
    const fermeture = `</${this.balise}`;
    this.#finDuBrut = (this.#finDuBrut + c.toLowerCase()).slice(-fermeture.length);
    this.#fermetureDuBrutLue = this.#finDuBrut === fermeture;
  }
}

function refuser(contexte: string): never {
  throw new Error(
    `Interpolation refusée ${contexte} : l'échappement HTML n'y protège de rien, « javascript:alert(1) » ne contient aucun caractère échappé. Passez une URL entière par escapeUrl() dans href ou src, une feuille de style par safeCss dans <style> ; ailleurs, seuls le texte, les attributs descriptifs et les nombres sont admis.`,
  );
}

function verifierValeurDAttribut(
  politique: Politique,
  lecteur: LecteurDeGabarit,
  valeur: HtmlFragment,
  suite: () => string,
): void {
  const { attribut, balise } = lecteur;
  const dans = `dans l'attribut « ${attribut} »`;
  if (politique.attributUrl(attribut)) {
    if (ELEMENTS_A_RESSOURCE_ACTIVE.has(balise)) refuser(`${dans} de <${balise}>`);
    const entiere = () => lecteur.valeurVide && suite().startsWith(lecteur.guillemet);
    if (!estEmis(valeur, 'url') || !entiere()) refuser(dans);
    return;
  }
  if (estEmis(valeur, 'url') || estEmis(valeur, 'style')) refuser(dans);
  if (politique.attributTexte(attribut)) return;
  if (ATTRIBUTS_COULEUR.has(attribut) && JETON_CSS.test(String(valeur))) {
    return;
  }
  refuser(dans);
}

function attributsDuFragmentAdmis(politique: Politique, valeur: HtmlFragment): boolean {
  if (estEmis(valeur, 'url') || estEmis(valeur, 'style')) return false;
  for (const [morceau, nom] of String(valeur).matchAll(MORCEAU_DE_BALISE)) {
    const admis =
      nom === undefined
        ? BLANC.test(morceau)
        : politique.attributTexte(nom) || ATTRIBUTS_BOOLEENS.has(nom);
    if (!admis) return false;
  }
  return true;
}

function verifierContexte(
  politique: Politique,
  lecteur: LecteurDeGabarit,
  valeur: HtmlFragment,
  suite: () => string,
): void {
  if (typeof valeur === 'number') return;
  switch (lecteur.etat) {
    case 'texte':
    case 'declaration':
      if (estEmis(valeur, 'style')) refuser('hors d’un élément <style>');
      return;
    case 'valeur':
      verifierValeurDAttribut(politique, lecteur, valeur, suite);
      return;
    case 'balise':
    case 'apres-nom':
      if (!politique.fragmentsDansLaBalise || !attributsDuFragmentAdmis(politique, valeur)) {
        refuser('dans une balise, hors d’une valeur entre guillemets');
      }
      return;
    case 'brut':
      if (lecteur.balise !== 'style' || !estEmis(valeur, 'style')) {
        refuser(`dans le contenu brut de <${lecteur.balise}>`);
      }
      return;
    default:
      refuser('dans une balise, hors d’une valeur entre guillemets');
  }
}

function estUnTableau(valeur: HtmlFragment): valeur is readonly EscapedHtml[] {
  return Array.isArray(valeur);
}

function interpolerUne(
  politique: Politique,
  lecteur: LecteurDeGabarit,
  valeur: HtmlFragment,
  suite: () => string,
): string {
  verifierContexte(politique, lecteur, valeur, suite);
  const texte = String(valeur);
  lecteur.lireInterpolation(texte);
  return texte;
}

function interpoler(
  politique: Politique,
  lecteur: LecteurDeGabarit,
  valeur: HtmlFragment,
  suite: string,
): string {
  if (!estUnTableau(valeur)) return interpolerUne(politique, lecteur, valeur, () => suite);
  return valeur
    .map((element, rang) =>
      interpolerUne(politique, lecteur, element, () => valeur.slice(rang + 1).join('') + suite),
    )
    .join('');
}

function assembler(
  politique: Politique,
  strings: TemplateStringsArray,
  values: readonly HtmlFragment[],
): EscapedHtml {
  verifierGabarit(strings);
  const lecteur = new LecteurDeGabarit();
  let out = strings[0];
  lecteur.lire(strings[0]);
  for (const [index, value] of values.entries()) {
    const suite = strings[index + 1];
    const texte = interpoler(politique, lecteur, value, suite);
    lecteur.lire(suite);
    out += texte + suite;
  }
  return out as EscapedHtml;
}

/**
 * Assemble un gabarit HTML dont chaque interpolation est deja sure : le
 * compilateur rejette toute `string` qui n'est pas passee par `escapeHtml`
 * ou par un autre `safeHtml`. Les nombres sont acceptes tels quels, les
 * tableaux de fragments sont concatenes.
 *
 * Sans interpolation, le gabarit est un litteral ecrit par nous : c'est la
 * seule facon de produire du HTML brut, et elle ne peut pas transporter de
 * donnee externe. Il n'existe donc aucune echappatoire a marquer.
 *
 * Le tag ne s'appelle pas `html` a dessein : Prettier reformaterait alors
 * le contenu du gabarit, ce qui modifierait le rendu des blocs ou les
 * blancs comptent (`<pre>`, `<style>`).
 */
export function safeHtml(
  strings: TemplateStringsArray,
  ...values: readonly HtmlFragment[]
): EscapedHtml {
  return assembler(STRICTE, strings, values);
}

export function safeHtmlInteractif(
  strings: TemplateStringsArray,
  ...values: readonly HtmlFragment[]
): EscapedHtml {
  return assembler(INTERACTIVE, strings, values);
}
