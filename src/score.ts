export type StatutScore = 'critical' | 'warning' | 'ok';

const SEUIL_OK = 80;
const SEUIL_DE_VIGILANCE = 55;

export function statutDuScore(score: number): StatutScore {
  if (score >= SEUIL_OK) {
    return 'ok';
  }
  return score >= SEUIL_DE_VIGILANCE ? 'warning' : 'critical';
}

export const LIBELLES_DU_STATUT: Readonly<Record<StatutScore, string>> = Object.freeze({
  critical: 'Critique',
  warning: 'À améliorer',
  ok: 'Objectif atteint',
});
