import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

import { racineDuDepot } from '../outils/depot.mjs';
import {
  avecDossierPlante,
  planterDossier,
  supprimerDossier,
} from '../outils/dossier-temporaire.mjs';
import {
  CANARI_TS,
  ecartsDesConfigurations,
  ecartsDuBranchement,
  scenariosDeLaPorte,
  verdictSurDepotPlante,
} from '../outils/porte-de-duplication.mjs';
import { blocsDesJobs, etapesDuJob } from '../outils/workflow-github.mjs';

describe('outils — dossier temporaire', () => {
  it('plante les fichiers imbriqués, rend la valeur de l exécutant puis supprime le dossier', () => {
    let planté = '';
    const lu = avecDossierPlante('outils-', { 'a/b/c.txt': 'contenu' }, (racine) => {
      planté = racine;
      return readFileSync(join(racine, 'a/b/c.txt'), 'utf8');
    });
    expect(lu).toBe('contenu');
    expect(existsSync(planté)).toBe(false);
  });

  it('supprime le dossier même quand l exécutant lève', () => {
    let planté = '';
    expect(() =>
      avecDossierPlante('outils-', {}, (racine) => {
        planté = racine;
        throw new Error('échec voulu');
      }),
    ).toThrow('échec voulu');
    expect(existsSync(planté)).toBe(false);
  });

  it('attend la fin d un exécutant asynchrone avant de supprimer le dossier', async () => {
    let planté = '';
    const vuAprèsAttente = await avecDossierPlante('outils-', { 'a.txt': 'x' }, async (racine) => {
      planté = racine;
      await new Promise((suite) => setTimeout(suite, 0));
      return existsSync(join(racine, 'a.txt'));
    });
    expect(vuAprèsAttente).toBe(true);
    expect(existsSync(planté)).toBe(false);
  });

  it.each([
    [
      'un thenable',
      (travail: () => boolean): PromiseLike<boolean> => ({
        then: (resoudre, rejeter) =>
          new Promise<boolean>((suite) => setTimeout(() => suite(travail()), 0)).then(
            resoudre,
            rejeter,
          ),
      }),
    ],
    [
      'une promesse d un autre royaume',
      (travail: () => boolean): PromiseLike<boolean> =>
        runInNewContext('new Promise((suite) => setTimeout(() => suite(travail()), 0))', {
          setTimeout,
          travail,
        }) as PromiseLike<boolean>,
    ],
  ])('attend %s avant de supprimer le dossier', async (_cas, differer) => {
    let planté = '';
    const vuAprèsAttente = await avecDossierPlante('outils-', { 'a.txt': 'x' }, (racine) => {
      planté = racine;
      return differer(() => existsSync(join(racine, 'a.txt')));
    });
    expect(vuAprèsAttente).toBe(true);
    expect(existsSync(planté)).toBe(false);
  });

  it('supprime le dossier quand l exécutant asynchrone rejette', async () => {
    let planté = '';
    await expect(
      avecDossierPlante('outils-', {}, async (racine) => {
        planté = racine;
        await new Promise((suite) => setTimeout(suite, 0));
        throw new Error('échec voulu');
      }),
    ).rejects.toThrow('échec voulu');
    expect(existsSync(planté)).toBe(false);
  });

  it.each([
    [
      'un getter then qui lève',
      () => ({
        get then(): unknown {
          throw new Error('then illisible');
        },
      }),
    ],
    [
      'un Proxy dont chaque lecture lève',
      () =>
        new Proxy(
          {},
          {
            get() {
              throw new Error('then illisible');
            },
          },
        ),
    ],
    [
      'un Proxy révoqué',
      () => {
        const { proxy, revoke } = Proxy.revocable({}, {});
        revoke();
        return proxy;
      },
    ],
  ])('supprime le dossier quand lire le then de %s lève', (_cas, resultat) => {
    let planté = '';
    expect(() =>
      avecDossierPlante('outils-', { 'a.txt': 'x' }, (racine) => {
        planté = racine;
        return resultat();
      }),
    ).toThrow();
    expect(existsSync(planté)).toBe(false);
  });

  it('ne laisse aucun dossier quand un fichier à planter ne peut pas s écrire', () => {
    const prefixe = `outils-fuite-${process.pid}-${Date.now()}-`;
    const plantes = () => readdirSync(tmpdir()).filter((nom) => nom.startsWith(prefixe));
    expect(() => planterDossier(prefixe, { a: 'fichier', 'a/b.txt': 'sous un fichier' })).toThrow();
    expect(plantes()).toEqual([]);
  });

  it('planterDossier laisse le dossier à son appelant, supprimerDossier le retire', () => {
    const racine = planterDossier('outils-', { 'x.json': '{}' });
    expect(readFileSync(join(racine, 'x.json'), 'utf8')).toBe('{}');
    supprimerDossier(racine);
    expect(existsSync(racine)).toBe(false);
  });
});

describe('outils — racine du dépôt', () => {
  const urlDe = (racine: string, relatif: string): string =>
    pathToFileURL(join(racine, relatif)).href;

  it('rend le dossier du package.json le plus proche au-dessus du module appelant', () => {
    const plantes = { 'package.json': '{}', 'scripts/lib/a.mjs': '' };
    avecDossierPlante('outils-depot-', plantes, (racine) => {
      expect(racineDuDepot(urlDe(racine, 'scripts/lib/a.mjs'))).toBe(racine);
    });
  });

  it('s arrête au package.json le plus proche, pas à celui du dépôt englobant', () => {
    const plantes = { 'package.json': '{}', 'sous/package.json': '{}', 'sous/a.mjs': '' };
    avecDossierPlante('outils-depot-', plantes, (racine) => {
      expect(racineDuDepot(urlDe(racine, 'sous/a.mjs'))).toBe(join(racine, 'sous'));
    });
  });

  it('décode le chemin de l URL : espaces, accents et %20 littéral', () => {
    const plantes = { 'dépôt à %20 près/package.json': '{}', 'dépôt à %20 près/a.mjs': '' };
    avecDossierPlante('outils-depot-', plantes, (racine) => {
      const attendu = join(racine, 'dépôt à %20 près');
      expect(racineDuDepot(urlDe(racine, 'dépôt à %20 près/a.mjs'))).toBe(attendu);
    });
  });

  it('ne prend pas pour manifeste un dossier nommé package.json', () => {
    const plantes = {
      'package.json': '{}',
      'scripts/package.json/garde.txt': '',
      'scripts/a.mjs': '',
    };
    avecDossierPlante('outils-depot-', plantes, (racine) => {
      expect(racineDuDepot(urlDe(racine, 'scripts/a.mjs'))).toBe(racine);
    });
  });

  it('part du dossier lui-même quand l URL désigne un dossier', () => {
    const plantes = { 'package.json': '{}', 'sous/package.json': '{}', 'sous/a.mjs': '' };
    avecDossierPlante('outils-depot-', plantes, (racine) => {
      expect(racineDuDepot(new URL('.', urlDe(racine, 'sous/a.mjs')))).toBe(join(racine, 'sous'));
    });
  });

  it('refuse un module qu aucun package.json ne surplombe, en nommant son dossier', () => {
    avecDossierPlante('outils-depot-', { 'a.mjs': '' }, (racine) => {
      expect(() => racineDuDepot(urlDe(racine, 'a.mjs'))).toThrow(
        `racineDuDepot : aucun package.json dans ${racine} ni au-dessus`,
      );
    });
  });
});

const WORKFLOW = [
  'name: CI',
  'on:',
  '  push:',
  'jobs:',
  '  quality-gate:',
  '    runs-on: ubuntu-latest',
  '    steps:',
  '      - uses: actions/checkout@v4',
  '      - name: Lint',
  '        run: npm run lint',
  '      - name: Tests',
  '        run: npm run test:ci',
  '  docker:',
  '    needs:',
  '      - quality-gate',
  '    continue-on-error: true',
  '    steps:',
  '      - name: Image',
  '        run: docker build .',
  '',
].join('\n');

describe('outils — workflow GitHub Actions', () => {
  it('découpe chaque job déclaré sous jobs:, en-tête compris', () => {
    const blocs = blocsDesJobs(WORKFLOW);
    expect(Object.keys(blocs)).toEqual(['quality-gate', 'docker']);
    expect(blocs['quality-gate']).toMatch(/^ {2}quality-gate:\n/);
    expect(blocs['quality-gate']).not.toMatch(/docker build/);
    expect(blocs['docker']).toMatch(/continue-on-error: true/);
    expect(blocs['docker']).toMatch(/- quality-gate/);
  });

  it('refuse un workflow sans section jobs:', () => {
    expect(() => blocsDesJobs('name: CI\non:\n  push:\n')).toThrow(/jobs:/);
  });

  it('liste les étapes nommées d un job avec leur commande', () => {
    expect(etapesDuJob(WORKFLOW, 'quality-gate')).toEqual([
      { nom: 'Lint', commande: 'npm run lint' },
      { nom: 'Tests', commande: 'npm run test:ci' },
    ]);
  });

  it.each(['', '   \n'])('refuse un workflow vide %j', (texte) => {
    expect(() => etapesDuJob(texte, 'quality-gate')).toThrow(/vide/);
  });

  it('refuse un job introuvable', () => {
    expect(() => etapesDuJob(WORKFLOW, 'e2e')).toThrow(/introuvable/);
  });

  it('refuse un job sans étape run', () => {
    const texte = [
      'jobs:',
      '  quality-gate:',
      '    steps:',
      '      - name: Checkout',
      '        uses: actions/checkout@v4',
      '  autre-job:',
      '    steps:',
      '      - name: X',
      '        run: echo x',
      '',
    ].join('\n');
    expect(() => etapesDuJob(texte, 'quality-gate')).toThrow(/aucune etape/);
  });
});

const MOTEUR_FACTICE = `
const { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const config = JSON.parse(readFileSync(process.argv[process.argv.indexOf('--config') + 1], 'utf8'));
if (JSON.stringify(config.reporters) !== '["json"]') process.exit(3);
if (!existsSync('src/temoin.ts') || !existsSync('src/temoin.spec.ts')) process.exit(4);
const lister = (dossier) => readdirSync(dossier).flatMap((nom) => {
  const chemin = join(dossier, nom);
  return statSync(chemin).isDirectory() ? lister(chemin) : [chemin];
});
const canaris = config.path.flatMap(lister).filter((f) => readFileSync(f, 'utf8').includes('canari'));
const duplicates = canaris.length > 1 ? [{ fichiers: canaris }] : [];
mkdirSync(config.output, { recursive: true });
writeFileSync(join(config.output, 'jscpd-report.json'), JSON.stringify({ duplicates }));
process.exit(duplicates.length > 0 ? 1 : 0);
`;

const CONFIG_CONFORME = { minTokens: 30, minLines: 5, threshold: 0, maxLines: 100_000 };

const CONSOMMATEUR = {
  'node_modules/jscpd/run-jscpd.js': MOTEUR_FACTICE,
  'node_modules/jscpd4/bin/jscpd': MOTEUR_FACTICE,
  '.jscpd.json': JSON.stringify({ ...CONFIG_CONFORME, path: ['src'] }),
  '.jscpd.tests.json': JSON.stringify({ ...CONFIG_CONFORME, path: ['src', 'test'] }),
  '.jscpd4.tests.json': JSON.stringify({ ...CONFIG_CONFORME, path: ['src', 'test'] }),
  'package.json': JSON.stringify({
    scripts: {
      'quality:dup':
        'jscpd --config .jscpd.json && node node_modules/jscpd4/bin/jscpd --config .jscpd.json',
      'quality:dup:tests':
        'jscpd --config .jscpd.tests.json && node node_modules/jscpd4/bin/jscpd --config .jscpd4.tests.json',
      'ci:check': 'npm run lint && npm run quality:dup && npm run quality:dup:tests && npm test',
      'pre-push:check': 'npm run quality:dup && npm run quality:dup:tests && npm test',
    },
  }),
  '.github/workflows/ci.yml':
    'jobs:\n  q:\n    steps:\n      - run: npm run quality:dup\n      - run: npm run quality:dup:tests\n',
};

const SCRIPTS_DES_PORTES = { app: 'quality:dup', tests: 'quality:dup:tests' } as const;

describe('outils — porte de duplication', () => {
  it('plante la configuration du consommateur, ses canaris et ses témoins, puis lit le rapport json', () => {
    avecDossierPlante('consommateur-', CONSOMMATEUR, (racine) => {
      const clone = { 'src/a/un.ts': CANARI_TS, 'src/b/deux.ts': CANARI_TS };
      expect(
        verdictSurDepotPlante({ racine, moteur: 'v5', porte: 'app', fichiers: clone }),
      ).toEqual({
        statut: 1,
        clones: 1,
      });
      const horsPerimetre = { 'test/a.ts': CANARI_TS, 'test/b.ts': CANARI_TS };
      expect(
        verdictSurDepotPlante({ racine, moteur: 'v4', porte: 'app', fichiers: horsPerimetre }),
      ).toEqual({ statut: 0, clones: 0 });
    });
  });

  it('dérive un scénario par moteur, par porte et par paire de fichiers', () => {
    const scenarios = scenariosDeLaPorte({
      racine: '/depot',
      canaris: { '.ts': CANARI_TS },
      cas: [
        { porte: 'app', detecte: [['src/a.ts', 'src/b.ts']], ignore: [['test/a.ts', 'test/b.ts']] },
      ],
    });
    expect(scenarios.map(({ intitule, attendu }) => [intitule, attendu])).toEqual([
      [
        'jscpd v5 : la porte app échoue sur un clone canari src/a.ts + src/b.ts',
        { statut: 1, clones: 1 },
      ],
      ['jscpd v5 : la porte app ne compte pas test/a.ts + test/b.ts', { statut: 0, clones: 0 }],
      [
        'jscpd v4 : la porte app échoue sur un clone canari src/a.ts + src/b.ts',
        { statut: 1, clones: 1 },
      ],
      ['jscpd v4 : la porte app ne compte pas test/a.ts + test/b.ts', { statut: 0, clones: 0 }],
    ]);
    expect(scenarios[0]?.demande).toEqual({
      racine: '/depot',
      moteur: 'v5',
      porte: 'app',
      fichiers: { 'src/a.ts': CANARI_TS, 'src/b.ts': CANARI_TS },
    });
  });

  it('refuse un fichier dont l extension n a pas de canari', () => {
    expect(() =>
      scenariosDeLaPorte({
        racine: '/depot',
        canaris: { '.ts': CANARI_TS },
        cas: [{ porte: 'app', detecte: [['src/a.html', 'src/b.html']], ignore: [] }],
      }),
    ).toThrow(/\.html/);
  });

  it('des configurations conformes et une porte branchée partout ne rendent aucun écart', () => {
    avecDossierPlante('consommateur-', CONSOMMATEUR, (racine) => {
      expect(ecartsDesConfigurations(racine)).toEqual([]);
      expect(
        ecartsDuBranchement({ racine, gestionnaire: 'npm', scripts: SCRIPTS_DES_PORTES }),
      ).toEqual([]);
    });
  });

  it('nomme chaque réglage de configuration qui s écarte du seuil commun', () => {
    const relache = {
      ...CONSOMMATEUR,
      '.jscpd4.tests.json': JSON.stringify({
        minTokens: 50,
        minLines: 5,
        threshold: 1,
        path: ['src'],
      }),
    };
    avecDossierPlante('consommateur-', relache, (racine) => {
      expect(ecartsDesConfigurations(racine)).toEqual([
        '.jscpd4.tests.json : minTokens vaut 50, attendu 30',
        '.jscpd4.tests.json : threshold vaut 1, attendu 0',
        '.jscpd4.tests.json : maxLines vaut undefined, attendu au moins 100000',
      ]);
    });
  });

  it('nomme chaque branchement manquant d une porte', () => {
    const debranche = {
      ...CONSOMMATEUR,
      'package.json': JSON.stringify({
        scripts: {
          'quality:dup': 'jscpd --config .jscpd.json',
          'quality:dup:tests':
            'jscpd --config .jscpd.tests.json && node node_modules/jscpd4/bin/jscpd --config .jscpd4.tests.json',
          'ci:check': 'npm run quality:dup && npm test',
          'pre-push:check': 'npm run quality:dup && npm run quality:dup:tests && npm test',
        },
      }),
      '.github/workflows/ci.yml': 'jobs:\n  q:\n    steps:\n      - run: npm run quality:dup\n',
    };
    avecDossierPlante('consommateur-', debranche, (racine) => {
      expect(
        ecartsDuBranchement({ racine, gestionnaire: 'npm', scripts: SCRIPTS_DES_PORTES }),
      ).toEqual([
        'quality:dup : ne lance pas jscpd4/bin/jscpd --config .jscpd.json',
        'quality:dup:tests : absent de ci:check',
        'quality:dup:tests : absent du workflow .github/workflows/ci.yml',
      ]);
    });
  });
});
