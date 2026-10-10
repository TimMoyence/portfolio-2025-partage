import { type Feuille, NOMBRE_MAX_CELLULES } from '../src/formule';

export function colonneA(hauteur: number, contenuDe: (rang: number) => string): Feuille {
  const cellules: Record<string, string> = {};
  for (let rang = 1; rang <= hauteur; rang += 1) {
    cellules[`A${rang}`] = contenuDe(rang);
  }
  return { lignes: hauteur, colonnes: 1, cellules };
}

export function chaineDeDoublements(longueur: number): Feuille {
  return colonneA(longueur, (rang) => (rang === 1 ? '1' : `=A${rang - 1}+A${rang - 1}`));
}

export function cycleDeMaillons(longueur: number): Feuille {
  return colonneA(longueur, (rang) => `=A${(rang % longueur) + 1}+1`);
}

export function formuleRecopiee(nombre: number): Feuille {
  return colonneA(nombre, (rang) => (rang === 1 ? '3' : '=$A$1*2+1'));
}

export function colonneDeSommesCirculaires(): Feuille {
  return colonneA(NOMBRE_MAX_CELLULES, () => `=SOMME(A1:A${NOMBRE_MAX_CELLULES})`);
}

export function sommesCroisees(cote: number): Feuille {
  const cellules: Record<string, string> = {};
  for (let ligne = 1; ligne <= cote; ligne += 1) {
    cellules[`A${ligne}`] = String(ligne);
  }
  for (let colonne = 1; colonne < cote; colonne += 1) {
    const lettre = String.fromCharCode(65 + colonne);
    const precedente = String.fromCharCode(64 + colonne);
    for (let ligne = 1; ligne <= cote; ligne += 1) {
      cellules[`${lettre}${ligne}`] = `=SOMME(${precedente}1:${precedente}${cote})`;
    }
  }
  return { lignes: cote, colonnes: cote, cellules };
}
