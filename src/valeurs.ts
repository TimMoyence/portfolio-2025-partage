export function estObjet(valeur: unknown): valeur is Readonly<Record<string, unknown>> {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur);
}

export function objetOuNull(valeur: unknown): Readonly<Record<string, unknown>> | null {
  return estObjet(valeur) ? valeur : null;
}

export function estMembre<T extends string>(valeurs: readonly T[], valeur: unknown): valeur is T {
  return typeof valeur === 'string' && (valeurs as readonly string[]).includes(valeur);
}

declare const ENTIER_POSITIF: unique symbol;
declare const ENTIER_STRICTEMENT_POSITIF: unique symbol;

export type EntierPositif = number & { readonly [ENTIER_POSITIF]: true };
export type EntierStrictementPositif = EntierPositif & {
  readonly [ENTIER_STRICTEMENT_POSITIF]: true;
};

export function estEntierPositif(valeur: unknown): valeur is EntierPositif {
  return typeof valeur === 'number' && Number.isSafeInteger(valeur) && valeur >= 0;
}

export function estEntierStrictementPositif(valeur: unknown): valeur is EntierStrictementPositif {
  return estEntierPositif(valeur) && valeur > 0;
}

export function borner(valeur: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, valeur));
}

export function messageDErreur(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : String(erreur);
}

const SPECIAUX_DES_REGEX = /[.*+?^${}()|[\]\\]/g;

export function echapperPourRegex(texte: string): string {
  return texte.replace(SPECIAUX_DES_REGEX, '\\$&');
}

function debutSans(texte: string, caractere: string): number {
  let debut = 0;
  while (debut < texte.length && texte[debut] === caractere) debut += 1;
  return debut;
}

function finSans(texte: string, caractere: string, debut: number): number {
  let fin = texte.length;
  while (fin > debut && texte[fin - 1] === caractere) fin -= 1;
  return fin;
}

export function sansFin(texte: string, caractere: string): string {
  return texte.slice(0, finSans(texte, caractere, 0));
}

export function sansDebut(texte: string, caractere: string): string {
  return texte.slice(debutSans(texte, caractere));
}

export function sansBords(texte: string, caractere: string): string {
  const debut = debutSans(texte, caractere);
  return texte.slice(debut, finSans(texte, caractere, debut));
}

export type Retenir<T> = (cle: string, element: unknown) => readonly T[] | null;

export function cueillirDansArbre<T>(valeur: unknown, retenir: Retenir<T>): T[] {
  if (Array.isArray(valeur)) {
    return valeur.flatMap((element: unknown) => cueillirDansArbre(element, retenir));
  }
  if (!estObjet(valeur)) {
    return [];
  }
  return Object.entries(valeur).flatMap(([cle, element]) => cueillirSous(cle, element, retenir));
}

export function cueillirSous<T>(cle: string, valeur: unknown, retenir: Retenir<T>): T[] {
  const retenus = retenir(cle, valeur);
  if (retenus !== null) {
    return [...retenus];
  }
  if (Array.isArray(valeur)) {
    return valeur.flatMap((element: unknown) => cueillirSous(cle, element, retenir));
  }
  return cueillirDansArbre(valeur, retenir);
}
