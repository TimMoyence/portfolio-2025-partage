import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { blockOffenses, declaredDependencies } from './doctrine.mjs';
import { markupBlocks, sourceBlocks, styleBlocks } from './extraction.mjs';
import {
  dansLEntree,
  hasJsdocTypes,
  isInScope,
  languageOf,
  PERIMETRE_PAR_DEFAUT,
} from './perimetre.mjs';

export const GATE = 'guard-no-comments';

/** @typedef {{ file: string, line: number, reason: string, snippet: string }} Offender */

/**
 * @param {{ text: string, file: string }} input
 * @returns {import('./extraction.mjs').ExtractedBlock[]}
 */
function blocksOf({ text, file }) {
  const lang = languageOf(file);
  if (lang === 'style') return styleBlocks({ text, file });
  if (lang === 'markup') return markupBlocks({ text });
  return sourceBlocks({ text, file });
}

/**
 * @param {{ text: string, file: string, dependencies?: string[], perimetre?: readonly string[] }} input
 * @returns {Offender[]}
 */
export function analyzeFile({ text, file, dependencies = [], perimetre }) {
  if (!isInScope({ file, perimetre })) return [];
  const lines = text.split('\n');
  const jsdocTypes = hasJsdocTypes(file);
  return blocksOf({ text, file })
    .flatMap((block) =>
      blockOffenses(block, {
        jsdocTypes,
        emptyBlock: block.emptyBlock,
        dependencies,
      }),
    )
    .sort((a, b) => a.line - b.line)
    .map(({ line, reason }) => ({
      file,
      line,
      reason,
      snippet: (lines[line - 1] ?? '').trim(),
    }));
}

/**
 * @param {string} root
 * @returns {{ manifest: string, parsed: Record<string, any> }}
 */
function readManifest(root) {
  const manifest = join(root, 'package.json');
  return {
    manifest,
    parsed: existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')) : {},
  };
}

/**
 * @param {string} root
 * @returns {string[]}
 */
export function rootDependencies(root) {
  return declaredDependencies(readManifest(root).parsed);
}

/**
 * @param {string} root
 * @returns {number}
 */
export function ratchetCeiling(root) {
  const { manifest, parsed } = readManifest(root);
  const declared = parsed[GATE]?.maxOffenses;
  if (declared === undefined) return 0;
  if (!Number.isInteger(declared) || declared < 0) {
    throw new Error(
      `${GATE}: "${GATE}".maxOffenses vaut ${JSON.stringify(declared)} dans ${manifest} — attendu un entier positif ou nul.`,
    );
  }
  return declared;
}

/**
 * @param {unknown} dir
 * @returns {dir is string}
 */
function isRelativeDirectory(dir) {
  if (typeof dir !== 'string' || !dir.endsWith('/') || dir.includes('\\')) return false;
  const segments = dir.slice(0, -1).split('/');
  return segments.every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

/**
 * @param {unknown} declared
 * @returns {declared is string[]}
 */
function isScope(declared) {
  return Array.isArray(declared) && declared.length > 0 && declared.every(isRelativeDirectory);
}

/**
 * @param {string} root
 * @returns {readonly string[]}
 */
export function declaredScope(root) {
  const { manifest, parsed } = readManifest(root);
  const declared = parsed[GATE]?.perimetre;
  if (declared === undefined) return PERIMETRE_PAR_DEFAUT;
  if (!isScope(declared)) {
    throw new Error(
      `${GATE}: "${GATE}".perimetre vaut ${JSON.stringify(declared)} dans ${manifest} — attendu une liste non vide de dossiers relatifs normalises terminant par / (ni ./, ni ../, ni //, ni / en tete).`,
    );
  }
  return declared;
}

/**
 * @param {{ root: string, ceiling: number }} input
 * @returns {void}
 */
function writeCeiling({ root, ceiling }) {
  const { manifest, parsed } = readManifest(root);
  parsed[GATE] = { ...parsed[GATE], maxOffenses: ceiling };
  writeFileSync(manifest, `${JSON.stringify(parsed, null, 2)}\n`);
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {NodeJS.ProcessEnv}
 */
export function isolatedGitEnv(env = process.env) {
  return Object.fromEntries(Object.entries(env).filter(([name]) => !name.startsWith('GIT_')));
}

/**
 * @param {string} root
 * @returns {string[]}
 */
function trackedFiles(root) {
  const out = execFileSync('git', ['-C', root, 'ls-files', '-z'], {
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    env: isolatedGitEnv(),
  });
  return out.split('\0').filter(Boolean);
}

/**
 * @param {{ root: string, perimetre?: readonly string[] }} input
 * @returns {string[]}
 */
export function collectFiles({ root, perimetre = declaredScope(root) }) {
  return trackedFiles(root).filter((file) => isInScope({ file, perimetre }));
}

/**
 * @param {{ root?: string }} [input]
 * @returns {{ code: number, offenders: Offender[], inspected: number, ceiling: number }}
 */
export function runGate({ root = '.' } = {}) {
  const perimetre = declaredScope(root);
  const files = collectFiles({ root, perimetre });
  if (files.length === 0) {
    throw new Error(
      `${GATE}: aucun fichier du perimetre sous ${root} — un gate qui n'inspecte rien n'atteste rien.`,
    );
  }
  const vides =
    perimetre === PERIMETRE_PAR_DEFAUT
      ? []
      : perimetre.filter((entree) => !files.some((file) => dansLEntree(file, entree)));
  if (vides.length > 0) {
    throw new Error(
      `${GATE}: ${vides.join(', ')} du perimetre declare ne designe aucun fichier suivi inspectable sous ${root} — une entree qui n'inspecte rien n'atteste rien.`,
    );
  }
  const readable = files.filter((rel) => existsSync(join(root, rel)));
  if (readable.length === 0) {
    throw new Error(`${GATE}: 0 fichier reellement lu sous ${root} — verdict non falsifiable.`);
  }
  const dependencies = rootDependencies(root);
  const offenders = readable.flatMap((rel) =>
    analyzeFile({
      text: readFileSync(join(root, rel), 'utf8'),
      file: rel,
      dependencies,
      perimetre,
    }),
  );
  const ceiling = ratchetCeiling(root);
  return {
    code: offenders.length > ceiling ? 1 : 0,
    offenders,
    inspected: readable.length,
    ceiling,
  };
}

const TIGHTEN_COMMAND = 'npx garde-commentaires --root . --tighten';

/**
 * @param {{ offenders: Offender[], inspected: number, ceiling?: number }} result
 * @returns {string}
 */
export function formatGate({ offenders, inspected, ceiling = 0 }) {
  const count = offenders.length;
  const attestation = `${GATE}: ${inspected} fichier(s) inspecte(s), ${count} violation(s), plafond ${ceiling}.`;
  if (count > ceiling) {
    const lines = offenders.map((o) => `${o.file}:${o.line} — [${o.reason}] ${o.snippet}`);
    return [
      ...lines,
      attestation,
      `${GATE}: REGRESSION — ${count} violation(s) pour un plafond de ${ceiling}. Le cliquet ne remonte jamais : retirez ${count - ceiling} commentaire(s) parmi ceux listes ci-dessus.`,
    ].join('\n');
  }
  if (count < ceiling) {
    return [
      attestation,
      `${GATE}: PLAFOND ABAISSABLE — ${count} violation(s) sous un plafond de ${ceiling} : abaissez-le a ${count}.`,
      `${GATE}: posez ${count} dans "${GATE}".maxOffenses (package.json), ou lancez \`${TIGHTEN_COMMAND}\`.`,
    ].join('\n');
  }
  return count === 0
    ? `${GATE}: OK — zero commentaire narratif sans fait verifiable.\n${attestation}`
    : `${GATE}: OK — plafond tenu, aucune regression.\n${attestation}`;
}

/**
 * @param {{ root: string, offenders: Offender[], inspected: number, ceiling: number }} result
 * @returns {string}
 */
export function tightenCeiling({ root, offenders, inspected, ceiling }) {
  const count = offenders.length;
  if (count > ceiling) return formatGate({ offenders, inspected, ceiling });
  if (count === ceiling)
    return `${GATE}: plafond deja au plus juste (${ceiling}) — rien a abaisser.`;
  writeCeiling({ root, ceiling: count });
  return `${GATE}: plafond abaisse de ${ceiling} a ${count} dans ${join(root, 'package.json')}.`;
}

/**
 * @param {{ offenders: Offender[], ceiling: number }} result
 * @returns {string | undefined}
 */
export function githubAnnotation({ offenders, ceiling }) {
  const count = offenders.length;
  if (count >= ceiling) return undefined;
  return `::warning title=${GATE}::${count} violation(s) sous un plafond de ${ceiling} — abaissez "${GATE}".maxOffenses a ${count} dans package.json, ou lancez \`${TIGHTEN_COMMAND}\`.`;
}

/**
 * @param {string[]} argv
 * @returns {{ root: string, count: boolean, tighten: boolean }}
 */
export function parseArgs(argv) {
  const at = argv.indexOf('--root');
  return {
    root: at >= 0 ? argv[at + 1] : '.',
    count: argv.includes('--count'),
    tighten: argv.includes('--tighten'),
  };
}

/**
 * @param {string[]} argv
 * @returns {number}
 */
export function main(argv) {
  const { root, count, tighten } = parseArgs(argv);
  const result = runGate({ root });
  if (count) {
    console.log(`${GATE}: ${result.offenders.length}`);
    return result.code;
  }
  if (tighten) {
    console.log(tightenCeiling({ root, ...result }));
    return result.code;
  }
  console.log(formatGate(result));
  const annotation = githubAnnotation(result);
  if (annotation && process.env.GITHUB_ACTIONS === 'true') console.log(annotation);
  return result.code;
}
