import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';

const manifeste = JSON.parse(readFileSync('package.json', 'utf8'));
const exiger = createRequire(import.meta.url);
const ATTENDUS = {
  contrats: {
    listes: [
      'TYPES_QUESTION',
      'DIFFUSIONS',
      'ETATS_PULSE',
      'PHASES_DE_VOTE',
      'PACING_MODES',
      'MODALITES',
      'REGIMES_DE_VERROU',
    ],
    types: [
      'TypeQuestion',
      'Diffusion',
      'EtatPulse',
      'VotePhase',
      'PacingMode',
      'FreeRange',
      'Modalite',
      'RegimeVerrou',
      'MetadonneesBrique',
      'Tolerance',
      'FormeFormule',
      'ValeurProduction',
      'ConfusionComptee',
      'Decompte',
      'DecomptesParCle',
      'ResultatQuestion',
      'ResultatsSeance',
      'StatistiquesSeance',
      'ComptesJalon',
      'ProgressionEnigme',
      'ResumeBareme',
      'ResultatsEnDirect',
      'RegleDeNotation',
    ],
  },
  formule: {
    fonctions: [
      'evaluerFeuille',
      'evaluerExpression',
      'estUneFormule',
      'surfaceDeFormule',
      'lireNombreSaisi',
      'lireNombreSaisiAvecUnite',
    ],
  },
  html: {
    fonctions: ['escapeHtml', 'escapeUrl', 'safeCss', 'safeHtml', 'safeHtmlInteractif'],
  },
  score: { fonctions: ['statutDuScore'] },
};

const RESOLUTIONS = {
  node10: { module: ts.ModuleKind.CommonJS, moduleResolution: ts.ModuleResolutionKind.Node10 },
  nodenext: { module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext },
  bundler: { module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler },
};

assert.deepEqual(
  Object.keys(manifeste.exports).sort(),
  Object.keys(ATTENDUS)
    .map((entree) => `./${entree}`)
    .sort(),
  'chaque entrée du paquet doit être vérifiée ici',
);

for (const [entree, { fonctions = [], listes = [] }] of Object.entries(ATTENDUS)) {
  const specificateur = `${manifeste.name}/${entree}`;
  const chargements = { import: await import(specificateur), require: exiger(specificateur) };
  for (const [condition, module] of Object.entries(chargements)) {
    for (const fonction of fonctions) {
      assert.equal(
        typeof module[fonction],
        'function',
        `${specificateur} (${condition}) : ${fonction}`,
      );
    }
    for (const liste of listes) {
      assert.ok(
        Array.isArray(module[liste]) && Object.isFrozen(module[liste]),
        `${specificateur} (${condition}) : ${liste} doit être une liste gelée`,
      );
    }
  }
}

function sonder(dossier) {
  const sonde = join(dossier, 'sonde.ts');
  const reexportations = Object.entries(ATTENDUS).map(
    ([entree, { fonctions = [], listes = [], types = [] }]) =>
      `export type { ${[...fonctions, ...listes, ...types].join(', ')} } from '${manifeste.name}/${entree}';`,
  );
  writeFileSync(sonde, `${reexportations.join('\n')}\n`);
  const hote = {
    getCanonicalFileName: (fichier) => fichier,
    getCurrentDirectory: () => dossier,
    getNewLine: () => '\n',
  };
  for (const [resolution, options] of Object.entries(RESOLUTIONS)) {
    const programme = ts.createProgram([sonde], {
      ...options,
      strict: true,
      noEmit: true,
      target: ts.ScriptTarget.ES2022,
      lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
      types: [],
    });
    const diagnostics = ts.getPreEmitDiagnostics(programme);
    assert.equal(
      diagnostics.length,
      0,
      `déclarations lues en ${resolution} :\n${ts.formatDiagnostics(diagnostics, hote)}`,
    );
  }
}

const dossier = mkdtempSync(join(tmpdir(), 'sonde-partage-'));
try {
  mkdirSync(join(dossier, 'node_modules'));
  symlinkSync(process.cwd(), join(dossier, 'node_modules', manifeste.name), 'dir');
  sonder(dossier);
} finally {
  rmSync(dossier, { recursive: true, force: true });
}

console.log(
  `${manifeste.name} : entrées ESM et CJS résolues par leur nom de paquet, déclarations lues en ${Object.keys(RESOLUTIONS).join(', ')}`,
);
