import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { avecDossierPlante } from '../outils/dossier-temporaire.mjs';
import {
  analyzeFile,
  collectFiles,
  declaredScope,
  formatGate,
  GATE,
  githubAnnotation,
  isolatedGitEnv,
  parseArgs,
  ratchetCeiling,
  runGate,
  tightenCeiling,
} from '../outils/garde-commentaires/garde.mjs';
import { isInScope, PERIMETRE_PAR_DEFAUT } from '../outils/garde-commentaires/perimetre.mjs';

const manifesteDuPaquet = JSON.parse(readFileSync('package.json', 'utf8')) as {
  bin: Record<string, string>;
  files: string[];
};

const L = (...parts: string[]): string => parts.join('\n');

interface Depot {
  files?: Record<string, string>;
  config?: Record<string, unknown>;
}

const withRepo = ({ files = {}, config }: Depot, run: (root: string) => void): void => {
  const manifest = { name: 'guard-fixture', ...(config && { [GATE]: config }) };
  const plantes = { 'package.json': `${JSON.stringify(manifest, null, 2)}\n`, ...files };
  avecDossierPlante('guard-no-comments-', plantes, (root) => {
    execFileSync('git', ['-C', root, 'init', '-q'], { env: isolatedGitEnv() });
    execFileSync('git', ['-C', root, 'add', '-A'], { env: isolatedGitEnv() });
    run(root);
  });
};

const underInheritedGitDir = (gitDir: string, run: () => void): void => {
  const inherited = process.env.GIT_DIR;
  process.env.GIT_DIR = gitDir;
  try {
    run();
  } finally {
    if (inherited === undefined) delete process.env.GIT_DIR;
    else process.env.GIT_DIR = inherited;
  }
};

const gitIn = (repo: string, args: string[]): string =>
  execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', env: isolatedGitEnv() });

const declaredConfig = (root: string): unknown =>
  JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))[GATE];

const narrative = (n: number): string =>
  L(...Array.from({ length: n }, (_, i) => `// prose numero ${i}`), 'const a = 1;');

const ts = (text: string, file = 'src/a.service.ts') => analyzeFile({ text, file });

const linesOf = (offenders: ReturnType<typeof analyzeFile>): number[] =>
  offenders.map((o) => o.line);

const mesurerLaCroissance = (cas: string, taille: number) =>
  JSON.parse(
    execFileSync(process.execPath, ['test/mesure-de-croissance.mjs', cas, String(taille)], {
      encoding: 'utf8',
    }),
  ) as { croissance: number; derniereLigne: number };

const lancerLeBin = (args: string[]) =>
  spawnSync(process.execPath, [manifesteDuPaquet.bin['garde-commentaires'], ...args], {
    encoding: 'utf8',
    env: { ...isolatedGitEnv(), GITHUB_ACTIONS: 'false' },
  });

describe('garde-commentaires — doctrine', () => {
  it('prose narrative sans fait verifiable -> offense sur chaque ligne porteuse', () => {
    const off = ts(L('// on recupere le user', 'const user = load();'));
    expect(linesOf(off)).toEqual([1]);
    expect(off[0]?.reason).toBe('commentaire narratif sans fait verifiable');
  });

  it('JSDoc qui paraphrase la signature -> offense sur les lignes de prose', () => {
    const off = ts(L('/**', ' * Cree un utilisateur.', ' */', 'export function createUser() {}'));
    expect(linesOf(off)).toEqual([2]);
  });

  it('en `.ts` un @param est du bruit typant -> offense (les types portent deja l information)', () => {
    const off = ts(
      L('/**', ' * @param id identifiant', ' */', 'export function get(id: string) {}'),
    );
    expect(linesOf(off)).toEqual([2]);
  });

  it('en `.mjs` le JSDoc typant est le seul typage disponible -> 0 offense', () => {
    const text = L(
      '/**',
      ' * @param {string} id',
      ' * @returns {number}',
      ' */',
      'export function get(id) {}',
    );
    expect(analyzeFile({ text, file: 'scripts/x.mjs' })).toEqual([]);
  });

  it('en `.mjs` la prose d entete d un JSDoc typant reste une offense', () => {
    const text = L(
      '/**',
      ' * Recupere la valeur.',
      ' * @param {string} id',
      ' */',
      'export function get(id) {}',
    );
    expect(linesOf(analyzeFile({ text, file: 'scripts/x.mjs' }))).toEqual([2]);
  });

  it.each([
    '// eslint-disable-next-line no-console',
    '/* eslint-disable @typescript-eslint/no-explicit-any */',
    '// @ts-ignore',
    '// @ts-expect-error message',
    '// @ts-nocheck',
    '// prettier-ignore',
    '/// <reference types="node" />',
    '/** @deprecated utiliser `next()` a la place */',
    '// istanbul ignore next',
    '// gitleaks:allow',
  ])('EXCEPTION 1 : la directive fonctionnelle %s -> 0 offense', (directive) => {
    expect(ts(L(directive, 'const a = 1;'))).toEqual([]);
  });

  it('EXCEPTION 1 : shebang d un script executable -> 0 offense', () => {
    expect(
      analyzeFile({ text: L('#!/usr/bin/env node', 'run();'), file: 'scripts/x.mjs' }),
    ).toEqual([]);
  });

  it('ANTI-TROU : une directive CITEE en milieu de phrase reste de la prose', () => {
    expect(linesOf(ts('// on ajoutera un eslint-disable ici plus tard'))).toEqual([1]);
    expect(linesOf(ts('// voir @ts-expect-error dans le fichier voisin'))).toEqual([1]);
  });

  it('ANTI-TROU : une directive n acquitte jamais sa ligne voisine', () => {
    const off = ts(
      L('/* eslint-disable no-console', ' * et voici pourquoi on a fait ce choix', ' */'),
    );
    expect(linesOf(off)).toEqual([2]);
  });

  it('EXCEPTION 2 : commentaire seul contenu d un `catch {}` -> 0 offense', () => {
    const text = L('try {', '  risky();', '} catch {', '  // erreur ignoree volontairement', '}');
    expect(ts(text)).toEqual([]);
  });

  it('EXCEPTION 2 : meme acquittement pour `catch (e) {}` et pour un `{}` de callback', () => {
    const withParam = L('try {', '  risky();', '} catch (e) {', '  /* rien a faire */', '}');
    expect(ts(withParam)).toEqual([]);
    const callback = L('p.catch(() => {', '  /* ignore si pas admin */', '});');
    expect(ts(callback)).toEqual([]);
  });

  it('EXCEPTION 2 : le bloc doit etre VIDE — un bloc qui porte du code ne couvre pas son commentaire', () => {
    const text = L(
      'try {',
      '  risky();',
      '} catch {',
      '  // on avale et on trace',
      '  log();',
      '}',
    );
    expect(linesOf(ts(text))).toEqual([4]);
  });

  it('EXCEPTION 2 : un bloc vide ne blanchit pas du code commente ni un TODO', () => {
    const dead = L('try {', '  risky();', '} catch {', '  // log(err);', '}');
    expect(ts(dead).map((o) => o.reason)).toEqual(['code commente']);
    const todo = L('try {', '  risky();', '} catch {', '  // TODO traiter cette erreur', '}');
    expect(ts(todo).map((o) => o.reason)).toEqual(['travail non fait']);
  });

  it('EXCEPTION 3 : les attributs i18n d un template Angular ne sont pas des commentaires', () => {
    const html = L('<h1 i18n="@@home.title">Bonjour</h1>', '<p i18n-title title="Info">Texte</p>');
    expect(analyzeFile({ text: html, file: 'src/app/home.component.html' })).toEqual([]);
  });

  it('EXCEPTION 3 : un vrai commentaire HTML narratif reste une offense', () => {
    const html = L('<!-- on affiche le titre ici -->', '<h1>Bonjour</h1>');
    expect(linesOf(analyzeFile({ text: html, file: 'src/app/home.component.html' }))).toEqual([1]);
  });

  it('EXCEPTION 4 : `@ApiProperty({ description })` est du code, jamais un commentaire', () => {
    const text = L(
      'export class Dto {',
      "  @ApiProperty({ description: 'Identifiant public de la ressource' })",
      '  id!: string;',
      '}',
    );
    expect(ts(text)).toEqual([]);
  });

  it('EXCEPTION 5 : un commentaire dans une template literal appartient a la sortie du programme', () => {
    const css = L(
      'export const style = `',
      '  /* reset applique au shadow DOM */',
      '  :host { display: block; }',
      '`;',
    );
    expect(ts(css)).toEqual([]);
    const html = L('export const tpl = `', '  <!-- entete du mail -->', '  <h1>Bonjour</h1>', '`;');
    expect(ts(html)).toEqual([]);
  });

  it('CONTROLE NEGATIF : `//` dans une chaine ou une regex n est pas un commentaire', () => {
    expect(ts("const u = 'https://exemple.fr/a';")).toEqual([]);
    expect(ts('const re = /a\\/\\/b/;')).toEqual([]);
  });

  it('CONTROLE NEGATIF : en SCSS, un `//` d URL n ouvre pas un commentaire', () => {
    const scss = L('.a {', '  background: url(https://exemple.fr/img.png);', '}');
    expect(analyzeFile({ text: scss, file: 'src/styles/_a.scss' })).toEqual([]);
  });

  it('SCSS : un commentaire place apres une URL sur la meme ligne est lu', () => {
    const scss = 'a { background: url(http://exemple.fr/a.png); } // on recupere le fond';
    expect(linesOf(analyzeFile({ text: scss, file: 'src/styles/_a.scss' }))).toEqual([1]);
  });

  it('CONTROLE NEGATIF : en SCSS, un `//` de chaine ou d url() non citee n ouvre pas un commentaire', () => {
    const scss = L(
      '.a {',
      '  background: url(//cdn.exemple.fr/a.png);',
      "  content: 'l\\'a // b';",
      '  font-family: "x//y";',
      '  quotes: "/* cite */";',
      '}',
    );
    expect(analyzeFile({ text: scss, file: 'src/styles/_a.scss' })).toEqual([]);
  });

  it.each([
    ['blocs-vides', 10_000, 20_000],
    ['scss', 10_000, 20_000],
    ['html', 10_000, 20_000],
    ['non-fermes', 40_000, 1],
  ])(
    'ANTI-QUADRATIQUE : doubler les commentaires (%s) ne quadruple pas le temps, et la derniere ligne est jugee',
    (cas, taille, derniereLigne) => {
      const mesure = mesurerLaCroissance(cas, taille);
      expect(mesure.croissance).toBeLessThan(3);
      expect(mesure.derniereLigne).toBe(derniereLigne);
    },
    30_000,
  );

  it('SCSS : les deux syntaxes de commentaire sont lues, et une banniere de section est une offense', () => {
    const scss = L(
      '/* --- Section titres --- */',
      '.a {',
      '  // couleur du survol',
      '  color: red;',
      '}',
    );
    expect(linesOf(analyzeFile({ text: scss, file: 'src/styles/_a.scss' }))).toEqual([1, 3]);
  });

  it('EXCEPTION 6 : une contrainte externe citant une RFC est conservee', () => {
    const text = L(
      '/**',
      ' * RFC 8058 §4 : sans ces en-tetes dans le tag `h=`, Gmail ignore',
      ' * le desabonnement en un clic.',
      ' */',
      'const headers = build();',
    );
    expect(ts(text)).toEqual([]);
  });

  it.each([
    '// le piege `use: { reducedMotion }` est sans effet en Playwright 1.59.1',
    '// specificite (0,1,1) : le selecteur parent ne peut pas etre surcharge',
    '// comportement documente sur https://open-meteo.com/en/docs',
    '// CVE-2024-21538 : version minimale imposee par le correctif',
    '// contrainte relevee dans l audit HIGH-2 du 2026-05-09',
    '// la resolution suit celle de `src/main.ts`, jamais celle du proxy',
  ])('EXCEPTION 6 : l ancre externe %s est conservee', (line) => {
    expect(ts(L(line, 'const a = 1;'))).toEqual([]);
  });

  it('EXCEPTION 6 : nommer une dependance declaree ancre le commentaire', () => {
    const text = L('// nodemailer recoit `from: undefined` et echoue a l envoi', 'send();');
    expect(analyzeFile({ text, file: 'src/a.service.ts', dependencies: ['nodemailer'] })).toEqual(
      [],
    );
    expect(linesOf(analyzeFile({ text, file: 'src/a.service.ts', dependencies: [] }))).toEqual([1]);
  });

  it('EXCEPTION 6 : l ancre couvre le bloc contigu, pas la seule ligne qui la porte', () => {
    const text = L(
      '// Le pool est dimensionne pour l usage concurrent API + workers.',
      '// La valeur par defaut saturait sous charge, cf. https://node-postgres.com/apis/pool',
      'const pool = build();',
    );
    expect(ts(text)).toEqual([]);
  });

  it('ANTI-TROU : l ancre ne franchit pas la frontiere entre deux blocs separes', () => {
    const text = L(
      '// prose sans aucun fait verifiable',
      '',
      '// voir https://exemple.fr/doc',
      'const a = 1;',
    );
    expect(linesOf(ts(text))).toEqual([1]);
  });

  it.each(['a/', 'a.', 'AB-'])(
    'ANTI-REDOS : une ligne de 80 ko faite de %s se juge en temps lineaire',
    (motif) => {
      const ligne = motif.repeat(Math.ceil(80_000 / motif.length));
      const debut = performance.now();
      const offenses = ts(L(`// ${ligne}`, 'const a = 1;'));
      expect(performance.now() - debut).toBeLessThan(500);
      expect(linesOf(offenses)).toEqual([1]);
    },
  );

  it('parcourt sans debordement de pile une somme de 20 000 termes que tsc accepte', () => {
    const somme = `export const total = ${Array.from({ length: 20_000 }, () => '1').join(' + ')};`;
    expect(linesOf(ts(L(somme, '// prose', 'const a = 1;')))).toEqual([2]);
  });

  it('ANTI-TROU : une ancre ne blanchit ni un TODO ni du code commente', () => {
    const todo = L('// TODO revoir, cf. https://exemple.fr/ticket', 'const a = 1;');
    expect(ts(todo).map((o) => o.reason)).toEqual(['travail non fait']);
    const dead = L('// await queryRunner.query(`DROP TABLE audit_requests`);', 'const a = 1;');
    expect(ts(dead).map((o) => o.reason)).toEqual(['code commente']);
  });

  it('offense : file, line et snippet designent la ligne reelle', () => {
    const off = ts(L('const a = 1;', 'const b = 2;', '// prose en ligne trois', 'const c = 3;'));
    expect(off).toEqual([
      {
        file: 'src/a.service.ts',
        line: 3,
        reason: 'commentaire narratif sans fait verifiable',
        snippet: '// prose en ligne trois',
      },
    ]);
  });
});

describe('garde-commentaires — périmètre', () => {
  it.each([
    'src/main.ts',
    'src/app/home/home.component.html',
    'src/styles/_primitives.scss',
    'e2e/cours-session.spec.ts',
    'test/app.e2e.spec.ts',
    'scripts/x.mjs',
    'eslint.config.js',
  ])('le périmètre par défaut inspecte %s', (file) => {
    expect(isInScope({ file })).toBe(true);
  });

  it.each([
    'README.md',
    'docs/guide.md',
    'node_modules/x/index.js',
    '.angular/cache/x.js',
    'coverage/report.js',
    'package.json',
    'src/locale/messages.fr.xlf',
  ])('le périmètre par défaut laisse %s', (file) => {
    expect(isInScope({ file })).toBe(false);
  });

  it('le périmètre par défaut réunit le code applicatif, les tests et l outillage', () => {
    expect(PERIMETRE_PAR_DEFAUT).toEqual(['src/', 'test/', 'e2e/', 'scripts/']);
    expect(Object.isFrozen(PERIMETRE_PAR_DEFAUT)).toBe(true);
  });

  it('un périmètre déclaré remplace celui par défaut', () => {
    const perimetre = ['src/', 'outils/'];
    expect(isInScope({ file: 'outils/garde.mjs', perimetre })).toBe(true);
    expect(isInScope({ file: 'e2e/cours.spec.ts', perimetre })).toBe(false);
    expect(isInScope({ file: 'eslint.config.js', perimetre })).toBe(true);
  });

  it('analyzeFile : un fichier hors perimetre n est jamais analyse', () => {
    expect(analyzeFile({ text: '// prose libre', file: 'docs/notes.md' })).toEqual([]);
    expect(
      analyzeFile({ text: '// prose libre', file: 'e2e/a.spec.ts', perimetre: ['src/'] }),
    ).toEqual([]);
  });

  it('le périmètre se lit dans le package.json du dépôt inspecté', () => {
    const files = { 'e2e/a.spec.ts': narrative(1), 'src/a.ts': 'export const a = 1;\n' };
    withRepo({ files, config: { perimetre: ['src/'] } }, (root) => {
      expect(declaredScope(root)).toEqual(['src/']);
      expect(collectFiles({ root })).toEqual(['src/a.ts']);
      expect(runGate({ root })).toMatchObject({ code: 0, inspected: 1 });
    });
  });

  it('sans périmètre déclaré, le dépôt est inspecté sous le périmètre par défaut', () => {
    withRepo({ files: { 'e2e/a.spec.ts': narrative(1) } }, (root) => {
      expect(declaredScope(root)).toEqual(PERIMETRE_PAR_DEFAUT);
      expect(runGate({ root }).code).toBe(1);
    });
  });

  it.each([
    [[]],
    [['src']],
    [[1]],
    ['src/'],
    [null],
    [['']],
    [['./src/']],
    [['//']],
    [['../']],
    [['src//']],
    [['/src/']],
    [['src/../']],
    [['src\\a/']],
    [['src/', './test/']],
  ])('un périmètre %j est refusé plutôt que subi', (perimetre) => {
    withRepo({ config: { perimetre } }, (root) => {
      expect(() => declaredScope(root)).toThrow(/guard-no-comments.*perimetre/);
    });
  });

  it.each([[['src/', 'srcs/']], [['src/', 'dist/']], [['src/', 'docs/']]])(
    'une entrée déclarée %j qui ne désigne aucun fichier inspectable fait refuser le gate',
    (perimetre) => {
      const files = {
        'src/a.service.ts': narrative(1),
        'dist/a.js': 'export const a = 1;\n',
        'docs/notes.md': '# notes\n',
        'eslint.config.js': 'export default [];\n',
      };
      withRepo({ files, config: { perimetre } }, (root) => {
        expect(() => runGate({ root })).toThrow(
          new RegExp(`guard-no-comments.*${perimetre[1]}.*aucun fichier`),
        );
      });
    },
  );
});

describe('garde-commentaires — dépôt inspecté', () => {
  it('HOOK-WT-1 · collectFiles lit le depot de root sous le GIT_DIR exporte par un pre-push de worktree', () => {
    withRepo({ files: { 'src/a.service.ts': 'export const a = 1;\n' } }, (root) => {
      withRepo({ files: { 'src/b.service.ts': 'export const b = 1;\n' } }, (hookRepo) => {
        underInheritedGitDir(join(hookRepo, '.git'), () => {
          expect(collectFiles({ root })).toEqual(['src/a.service.ts']);
        });
      });
    });
  });

  it('HOOK-WT-2 · le depot de fixture laisse intact le depot designe par un GIT_DIR herite', () => {
    withRepo({ files: { 'src/b.service.ts': 'export const b = 1;\n' } }, (hookRepo) => {
      underInheritedGitDir(join(hookRepo, '.git'), () => {
        withRepo({ files: { 'src/a.service.ts': 'export const a = 1;\n' } }, () => {});
      });
      expect({
        tracked: gitIn(hookRepo, ['ls-files']),
        bare: gitIn(hookRepo, ['config', 'core.bare']),
      }).toEqual({ tracked: 'package.json\nsrc/b.service.ts\n', bare: 'false\n' });
    });
  });

  it('PLANCHER ANTI-VACUITE : un perimetre vide leve une erreur citant le gate', () => {
    withRepo({}, (root) => {
      expect(() => runGate({ root })).toThrow(/guard-no-comments/);
    });
  });

  it('runGate : un arbre conforme atteste un nombre de fichiers non nul', () => {
    withRepo({ files: { 'src/a.service.ts': 'export const a = 1;\n' } }, (root) => {
      expect(runGate({ root })).toEqual({ code: 0, offenders: [], inspected: 1, ceiling: 0 });
    });
  });

  it('runGate : un fichier fautif sort en code 1 avec un chemin relatif a la racine', () => {
    const files = { 'src/a.service.ts': '// on recupere le user\nexport const a = 1;\n' };
    withRepo({ files }, (root) => {
      const result = runGate({ root });
      expect(result.code).toBe(1);
      expect(result.offenders.map((o) => [o.file, o.line])).toEqual([['src/a.service.ts', 1]]);
    });
  });
});

describe('garde-commentaires — cliquet', () => {
  it('sans plafond declare, la garde exige toujours zero', () => {
    withRepo({ files: { 'src/a.service.ts': narrative(1) } }, (root) => {
      expect(ratchetCeiling(root)).toBe(0);
      expect(runGate({ root }).code).toBe(1);
    });
  });

  it('un compte egal au plafond declare passe en code 0', () => {
    const files = { 'src/a.service.ts': narrative(3) };
    withRepo({ files, config: { maxOffenses: 3 } }, (root) => {
      const result = runGate({ root });
      expect(result.ceiling).toBe(3);
      expect(result.offenders).toHaveLength(3);
      expect(result.code).toBe(0);
    });
  });

  it('une violation de plus que le plafond sort en code 1', () => {
    const files = { 'src/a.service.ts': narrative(4) };
    withRepo({ files, config: { maxOffenses: 3 } }, (root) => {
      const result = runGate({ root });
      expect(result.code).toBe(1);
      expect(formatGate(result)).toMatch(/REGRESSION — 4 violation\(s\) pour un plafond de 3/);
      expect(formatGate(result)).toMatch(/retirez 1 commentaire\(s\)/);
    });
  });

  it.each([[-1], [1.5], ['3'], [null]])(
    'un plafond %j est refuse plutot que subi',
    (maxOffenses) => {
      withRepo({ config: { maxOffenses } }, (root) => {
        expect(() => ratchetCeiling(root)).toThrow(/maxOffenses/);
      });
    },
  );

  it('sous le plafond, le verdict nomme la valeur exacte a poser et la commande du bin', () => {
    const files = { 'src/a.service.ts': narrative(2) };
    withRepo({ files, config: { maxOffenses: 5 } }, (root) => {
      const result = runGate({ root });
      expect(result.code).toBe(0);
      const verdict = formatGate(result);
      expect(verdict).toMatch(
        /PLAFOND ABAISSABLE — 2 violation\(s\) sous un plafond de 5 : abaissez-le a 2/,
      );
      expect(verdict).toMatch(/`npx garde-commentaires --root \. --tighten`/);
    });
  });

  it('--tighten abaisse le plafond declare et garde le périmètre', () => {
    const files = { 'src/a.service.ts': narrative(2) };
    withRepo({ files, config: { maxOffenses: 5, perimetre: ['src/'] } }, (root) => {
      const verdict = tightenCeiling({ root, ...runGate({ root }) });
      expect(verdict).toMatch(/plafond abaisse de 5 a 2/);
      expect(declaredConfig(root)).toEqual({ maxOffenses: 2, perimetre: ['src/'] });
      expect(runGate({ root }).ceiling).toBe(2);
    });
  });

  it('ANTI-TROU : --tighten ne remonte jamais un plafond depasse', () => {
    const files = { 'src/a.service.ts': narrative(4) };
    withRepo({ files, config: { maxOffenses: 3 } }, (root) => {
      expect(tightenCeiling({ root, ...runGate({ root }) })).toMatch(/REGRESSION/);
      expect(declaredConfig(root)).toEqual({ maxOffenses: 3 });
    });
  });

  it('--tighten sur un plafond deja au plus juste n ecrit rien', () => {
    const files = { 'src/a.service.ts': narrative(3) };
    withRepo({ files, config: { maxOffenses: 3 } }, (root) => {
      expect(tightenCeiling({ root, ...runGate({ root }) })).toMatch(/deja au plus juste \(3\)/);
      expect(declaredConfig(root)).toEqual({ maxOffenses: 3 });
    });
  });

  it('sous le plafond, une annotation GitHub porte la valeur a poser', () => {
    const offenders = Array.from({ length: 2 }, () => ({
      file: 'src/a.ts',
      line: 1,
      reason: 'r',
      snippet: 's',
    }));
    const annotation = githubAnnotation({ offenders, ceiling: 5 });
    expect(annotation).toMatch(/^::warning title=guard-no-comments::/);
    expect(annotation).toMatch(/abaissez "guard-no-comments"\.maxOffenses a 2/);
  });

  it('au plafond ou au-dessus, aucune annotation n est emise', () => {
    const one = [{ file: 'src/a.ts', line: 1, reason: 'r', snippet: 's' }];
    expect(githubAnnotation({ offenders: one, ceiling: 1 })).toBeUndefined();
    expect(githubAnnotation({ offenders: one, ceiling: 0 })).toBeUndefined();
    expect(githubAnnotation({ offenders: [], ceiling: 0 })).toBeUndefined();
  });
});

describe('garde-commentaires — verdict et ligne de commande', () => {
  it('formatGate : le verdict est chiffre et porte le nom du gate', () => {
    const clean = formatGate({ offenders: [], inspected: 42 });
    expect(clean).toMatch(/guard-no-comments: OK/);
    expect(clean).toMatch(/42 fichier\(s\) inspecte\(s\), 0 violation\(s\)/);
    const dirty = formatGate({
      offenders: [
        {
          file: 'src/a.ts',
          line: 7,
          reason: 'commentaire narratif sans fait verifiable',
          snippet: '// x',
        },
      ],
      inspected: 42,
    });
    expect(dirty).toMatch(/src\/a\.ts:7 — \[commentaire narratif sans fait verifiable\] \/\/ x/);
    expect(dirty).toMatch(/42 fichier\(s\) inspecte\(s\), 1 violation\(s\)/);
  });

  it('parseArgs : --root, --count et --tighten sont lus depuis argv', () => {
    expect(parseArgs(['--root', '/depot/x'])).toEqual({
      root: '/depot/x',
      count: false,
      tighten: false,
    });
    expect(parseArgs(['--count'])).toEqual({ root: '.', count: true, tighten: false });
    expect(parseArgs(['--tighten'])).toEqual({ root: '.', count: false, tighten: true });
  });

  it('le paquet expose l exécutable garde-commentaires et le livre dans son archive', () => {
    const bin = manifesteDuPaquet.bin['garde-commentaires'];
    expect(bin).toBe('outils/garde-commentaires/cli.mjs');
    expect(readFileSync(bin, 'utf8').startsWith('#!/usr/bin/env node\n')).toBe(true);
    expect(manifesteDuPaquet.files).toContain('outils');
  });

  it('l exécutable sort en 1 sur une régression et liste les offenses', () => {
    withRepo({ files: { 'src/a.ts': narrative(1) } }, (root) => {
      const sortie = lancerLeBin(['--root', root]);
      expect(sortie.status).toBe(1);
      expect(sortie.stdout).toMatch(/src\/a\.ts:1 — \[commentaire narratif sans fait verifiable\]/);
    });
  });

  it('l exécutable compte les offenses avec --count', () => {
    withRepo({ files: { 'src/a.ts': narrative(2) }, config: { maxOffenses: 2 } }, (root) => {
      const sortie = lancerLeBin(['--root', root, '--count']);
      expect(sortie.status).toBe(0);
      expect(sortie.stdout).toBe('guard-no-comments: 2\n');
    });
  });
});
