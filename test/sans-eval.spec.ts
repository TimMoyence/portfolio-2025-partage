import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SOURCE = 'src/formule.ts';
const INTERDITS = [
  /\beval\s*\(/,
  /\bnew\s+Function\b/,
  /\bFunction\s*\(/,
  /\bimport\s*\(/,
  /\brequire\s*\(/,
  /\bsetTimeout\s*\(\s*['"`]/,
  /\bglobalThis\b/,
  /\[\s*['"`][^'"`]*['"`]\s*\]\s*\(/,
];
const POURQUOI =
  'le moteur evalue une expression tapee par un etudiant : un tableur qui execute du JavaScript arbitraire est une faille. L analyseur et l evaluateur restent explicites.';

describe('le moteur de formules n execute jamais la saisie comme du code', () => {
  it('sa source ne contient aucune construction de code a l execution', () => {
    const contenu = readFileSync(SOURCE, 'utf8');

    expect(contenu.length, `${SOURCE} est vide : la garde ne garde rien`).toBeGreaterThan(0);
    for (const motif of INTERDITS) {
      expect(motif.test(contenu), `${SOURCE} : « ${motif.source} » trouve. ${POURQUOI}`).toBe(
        false,
      );
    }
  });

  it('chaque construction interdite serait reconnue', () => {
    const temoins = [
      'eval("1+1")',
      'new Function("a", "return a")',
      'Function("return 1")',
      'import("x")',
      'require("x")',
      'setTimeout("x()", 1)',
      'globalThis.x',
      'window["eval"]("1")',
    ];

    expect(temoins.map((temoin) => INTERDITS.some((motif) => motif.test(temoin)))).not.toContain(
      false,
    );
  });
});
