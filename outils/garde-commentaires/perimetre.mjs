export const PERIMETRE_PAR_DEFAUT = Object.freeze(['src/', 'test/', 'e2e/', 'scripts/']);

const SOURCE_EXTS = new Set(['ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs']);
const JSDOC_TYPED_EXTS = new Set(['js', 'jsx', 'mjs', 'cjs', 'mts']);
const STYLE_EXTS = new Set(['css', 'scss']);
const MARKUP_EXTS = new Set(['html']);

const ARTEFACT_SEGMENTS = new Set([
  'node_modules',
  'dist',
  'coverage',
  '.angular',
  '.gitnexus',
  'playwright-report',
  'test-results',
]);

/** @typedef {'source' | 'style' | 'markup'} Language */

/**
 * @param {string} file
 * @returns {string}
 */
export function extensionOf(file) {
  const name = file.slice(file.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

/**
 * @param {string} file
 * @returns {Language | undefined}
 */
export function languageOf(file) {
  const ext = extensionOf(file);
  if (SOURCE_EXTS.has(ext)) return 'source';
  if (STYLE_EXTS.has(ext)) return 'style';
  if (MARKUP_EXTS.has(ext)) return 'markup';
  return undefined;
}

/**
 * @param {string} file
 * @returns {boolean}
 */
export function hasJsdocTypes(file) {
  return JSDOC_TYPED_EXTS.has(extensionOf(file));
}

/**
 * @param {string} file
 * @param {string} entree
 * @returns {boolean}
 */
export const dansLEntree = (file, entree) => file.startsWith(entree);

/**
 * @param {{ file: string, perimetre?: readonly string[] }} input
 * @returns {boolean}
 */
export function isInScope({ file, perimetre = PERIMETRE_PAR_DEFAUT }) {
  const segments = file.split('/');
  if (segments.some((s) => ARTEFACT_SEGMENTS.has(s))) return false;
  if (languageOf(file) === undefined) return false;
  if (segments.length === 1) return true;
  return perimetre.some((entree) => dansLEntree(file, entree));
}
