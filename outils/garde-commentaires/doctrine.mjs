const DIRECTIVE_RES = [
  /^(?:eslint-disable(?:-next-line|-line)?|eslint-enable|eslint-env)\b/,
  /^@(?:ts-(?:ignore|expect-error|nocheck|check))\b/,
  /^(?:prettier-ignore|istanbul ignore|c8 ignore|v8 ignore|Stryker (?:disable|restore))\b/,
  /^gitleaks:allow\b/,
  /^@(?:jest|vitest)-environment(?:-options)?\b/,
  /^@deprecated\b/,
  /^<reference\b/,
];

const GENERATED_RE = /GENERATED/;
const DO_NOT_EDIT_RE = /do not edit/i;

const TYPING_TAG_RE =
  /^@(?:param|returns?|type|typedef|template|satisfies|property|callback|enum|implements|extends|augments)\b/;

const TAG_RE = /^@/;

const UNFINISHED_RES = [/\bTODO\b/, /\bFIXME\b/, /\bXXX\b/, /\bHACK\b/, /\bWIP\b/];

const COMMENTED_CODE_RES = [
  /^(?:const|let|var|function|class|import|export|return|await|if|for|while|switch|try|throw|new)\b.*[;{(]/,
  /^[\w.$[\]'"]+\s*\([^)]*\)\s*[;,]?$/,
];

const ASSIGNMENT_HEAD_RE = /^[\w.$]+\s*[:=].{2,}$/;
const STATEMENT_TERMINATOR_RE = /[;,]$/;

/**
 * @param {string} content
 * @returns {boolean}
 */
function isAssignmentStatement(content) {
  return ASSIGNMENT_HEAD_RE.test(content) && STATEMENT_TERMINATOR_RE.test(content);
}

const ANCHOR_RES = [
  /https?:\/\/\S+/,
  /\bRFC\s?\d{3,5}\b/i,
  /\bCVE-\d{4}-\d{4,}\b/,
  /\bWCAG\s?\d(?:\.\d+)*\b/i,
  /\bISO[\s-]?\d{4,5}\b/,
  /\bECMA-\d+\b/,
  /\b[A-Za-z][\w@/.+-]*\s+v?\d+\.\d+(?:\.\d+)?\b/,
  /\b[A-Z][A-Z0-9]{1,7}(?:-[A-Z0-9]{1,7})*-\d+\b/,
  /\b\d{4}-\d{2}-\d{2}\b/,
  /\b[\w.-]+\.(?:ts|tsx|mts|cts|js|mjs|cjs|scss|css|html|json|jsonc|ya?ml|md|sql|env)\b/,
  /\(\d+\s*,\s*\d+\s*,\s*\d+\)/,
];

/** @typedef {{ raw: string, startLine: number }} CommentBlock */

/**
 * @param {string} content
 * @returns {boolean}
 */
function isExempt(content) {
  if (DIRECTIVE_RES.some((re) => re.test(content))) return true;
  return GENERATED_RE.test(content) && DO_NOT_EDIT_RE.test(content);
}

/**
 * @param {string} content
 * @returns {boolean}
 */
function isUnfinished(content) {
  return UNFINISHED_RES.some((re) => re.test(content));
}

/**
 * @param {string} content
 * @returns {boolean}
 */
function isCommentedCode(content) {
  return COMMENTED_CODE_RES.some((re) => re.test(content)) || isAssignmentStatement(content);
}

const DEPENDENCY_MIN_LENGTH = 3;

const GENERIC_PACKAGE_NAMES = new Set([
  'cli',
  'common',
  'config',
  'core',
  'sdk',
  'types',
  'util',
  'utils',
]);

/**
 * @param {string} name
 * @returns {string[]}
 */
function anchorNamesOf(name) {
  if (!name.startsWith('@')) return [name];
  const [scope, rest] = name.slice(1).split('/');
  if (scope === 'types') return rest ? [rest] : [];
  return rest ? [scope, `${scope}/${rest}`] : [scope];
}

/**
 * @param {Record<string, unknown>} manifest
 * @returns {string[]}
 */
export function declaredDependencies(manifest) {
  const fields = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
  const names = fields.flatMap((field) => Object.keys(manifest[field] ?? {}));
  return [...new Set(names.flatMap(anchorNamesOf))]
    .filter((name) => name.length >= DEPENDENCY_MIN_LENGTH && !GENERIC_PACKAGE_NAMES.has(name))
    .sort();
}

/**
 * @param {string} text
 * @param {string[]} dependencies
 * @returns {boolean}
 */
function namesDependency(text, dependencies) {
  const words = new Set(text.toLowerCase().match(/[a-z0-9][a-z0-9.-]*/g) ?? []);
  return dependencies.some((name) => words.has(name.toLowerCase()));
}

/**
 * @param {string} text
 * @param {{ dependencies?: string[] }} [options]
 * @returns {boolean}
 */
function hasExternalAnchor(text, { dependencies = [] } = {}) {
  if (ANCHOR_RES.some((re) => re.test(text))) return true;
  return namesDependency(text, dependencies);
}

/**
 * @param {string} line
 * @returns {string}
 */
function stripMarkers(line) {
  let s = line.trim();
  if (s.startsWith('/**')) s = s.slice(3);
  else if (s.startsWith('/*')) s = s.slice(2);
  else if (s.startsWith('///')) s = s.slice(3);
  else if (s.startsWith('//')) s = s.slice(2);
  else if (s.startsWith('<!--')) s = s.slice(4);
  if (s.endsWith('*/')) s = s.slice(0, -2);
  else if (s.endsWith('-->')) s = s.slice(0, -3);
  return s.replace(/^\*+/, '').trim();
}

/**
 * @param {string[]} contents
 * @returns {number[]}
 */
function proseIndexes(contents) {
  return contents.flatMap((content, i) => (content === '' ? [] : [i]));
}

/**
 * @param {string} content
 * @returns {boolean}
 */
function isForeignTag(content) {
  return TAG_RE.test(content) && !TYPING_TAG_RE.test(content);
}

/**
 * @param {string[]} contents
 * @returns {number[]}
 */
function typedJsdocIndexes(contents) {
  const tagAt = contents.findIndex((c) => TYPING_TAG_RE.test(c));
  if (tagAt < 0) return proseIndexes(contents);
  return proseIndexes(contents).filter((i) => i < tagAt || isForeignTag(contents[i]));
}

/**
 * @param {CommentBlock} block
 * @param {{ jsdocTypes?: boolean }} [options]
 * @returns {number[]}
 */
function proseLines({ raw, startLine }, { jsdocTypes = false } = {}) {
  const contents = raw.split('\n').map(stripMarkers);
  const typed = jsdocTypes && raw.startsWith('/**');
  const indexes = typed ? typedJsdocIndexes(contents) : proseIndexes(contents);
  return indexes.filter((i) => !isExempt(contents[i])).map((i) => startLine + i);
}

/**
 * @param {CommentBlock} block
 * @param {{ jsdocTypes?: boolean }} [options]
 * @returns {{ line: number, reason: string }[]}
 */
function alwaysOffending({ raw, startLine }, { jsdocTypes = false } = {}) {
  const kept = new Set(proseLines({ raw, startLine }, { jsdocTypes }));
  return raw
    .split('\n')
    .map((line, i) => ({ content: stripMarkers(line), line: startLine + i }))
    .filter(({ line }) => kept.has(line))
    .flatMap(({ content, line }) => {
      if (isUnfinished(content)) return [{ line, reason: 'travail non fait' }];
      if (isCommentedCode(content)) return [{ line, reason: 'code commente' }];
      return [];
    });
}

/**
 * @param {CommentBlock} block
 * @param {{ jsdocTypes?: boolean, emptyBlock?: boolean, dependencies?: string[] }} [options]
 * @returns {{ line: number, reason: string }[]}
 */
export function blockOffenses(
  block,
  { jsdocTypes = false, emptyBlock = false, dependencies = [] } = {},
) {
  const forced = alwaysOffending(block, { jsdocTypes });
  if (emptyBlock) return forced;
  const forcedLines = new Set(forced.map((o) => o.line));
  if (hasExternalAnchor(block.raw, { dependencies })) return forced;
  const narrative = proseLines(block, { jsdocTypes })
    .filter((line) => !forcedLines.has(line))
    .map((line) => ({ line, reason: 'commentaire narratif sans fait verifiable' }));
  return [...forced, ...narrative].sort((a, b) => a.line - b.line);
}
