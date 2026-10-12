import ts from 'typescript';

/** @typedef {{ raw: string, startLine: number, endLine: number, column: number, emptyBlock: boolean }} ExtractedBlock */

/**
 * @param {string} file
 * @param {string} text
 * @returns {import('typescript').SourceFile}
 */
function createSf(file, text) {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
}

/**
 * @param {import('typescript').Node} node
 * @returns {boolean}
 */
function isEmptyBraces(node) {
  if (ts.isObjectLiteralExpression(node)) return node.properties.length === 0;
  if (ts.isBlock(node) || ts.isModuleBlock(node)) return node.statements.length === 0;
  if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) return node.members.length === 0;
  return false;
}

/**
 * @param {import('typescript').SourceFile} sf
 * @returns {{ from: number, to: number }[]}
 */
function emptyBraceRanges(sf) {
  /** @type {{ from: number, to: number }[]} */
  const ranges = [];
  /** @param {import('typescript').Node} node @returns {void} */
  const walk = (node) => {
    if (isEmptyBraces(node)) ranges.push({ from: node.getStart(sf), to: node.getEnd() });
    for (const child of node.getChildren(sf)) walk(child);
  };
  walk(sf);
  return ranges;
}

/**
 * @param {string} raw
 * @returns {boolean}
 */
function isLineComment(raw) {
  return raw.startsWith('//');
}

/**
 * @param {ExtractedBlock} previous
 * @param {ExtractedBlock} next
 * @returns {boolean}
 */
function isContiguous(previous, next) {
  if (!isLineComment(previous.raw) || !isLineComment(next.raw)) return false;
  if (previous.emptyBlock !== next.emptyBlock) return false;
  return next.startLine === previous.endLine + 1 && next.column === previous.column;
}

/**
 * @param {ExtractedBlock[]} blocks
 * @returns {ExtractedBlock[]}
 */
function mergeContiguous(blocks) {
  const ordered = [...blocks].sort((a, b) => a.startLine - b.startLine || a.column - b.column);
  /** @type {ExtractedBlock[]} */
  const merged = [];
  for (const block of ordered) {
    const previous = merged.at(-1);
    if (previous && isContiguous(previous, block)) {
      merged[merged.length - 1] = {
        ...previous,
        raw: `${previous.raw}\n${block.raw}`,
        endLine: block.endLine,
      };
      continue;
    }
    merged.push(block);
  }
  return merged;
}

/**
 * @param {{ text: string, file: string }} input
 * @returns {ExtractedBlock[]}
 */
export function sourceBlocks({ text, file }) {
  const sf = createSf(file, text);
  const empties = emptyBraceRanges(sf);
  /** @type {ExtractedBlock[]} */
  const blocks = [];
  /** @type {Set<number>} */
  const seen = new Set();

  /** @param {readonly import('typescript').CommentRange[] | undefined} ranges @returns {void} */
  const add = (ranges) => {
    if (!ranges) return;
    for (const range of ranges) {
      if (seen.has(range.pos)) continue;
      seen.add(range.pos);
      const raw = text.slice(range.pos, range.end);
      const start = sf.getLineAndCharacterOfPosition(range.pos);
      blocks.push({
        raw,
        startLine: start.line + 1,
        endLine: sf.getLineAndCharacterOfPosition(range.end).line + 1,
        column: start.character,
        emptyBlock: empties.some((r) => range.pos > r.from && range.end < r.to),
      });
    }
  };

  /** @param {import('typescript').Node} node @returns {void} */
  const walk = (node) => {
    add(ts.getLeadingCommentRanges(text, node.getFullStart()));
    add(ts.getTrailingCommentRanges(text, node.getEnd()));
    for (const child of node.getChildren(sf)) walk(child);
  };
  walk(sf);
  return mergeContiguous(blocks);
}

/** @typedef {{ open: string, close: string }} Delimiters */

/**
 * @param {string} text
 * @param {Delimiters} delimiters
 * @returns {ExtractedBlock[]}
 */
function delimitedBlocks(text, { open, close }) {
  /** @type {ExtractedBlock[]} */
  const blocks = [];
  let from = 0;
  for (;;) {
    const start = text.indexOf(open, from);
    if (start < 0) return blocks;
    const closeAt = text.indexOf(close, start + open.length);
    const end = closeAt < 0 ? text.length : closeAt + close.length;
    const startLine = text.slice(0, start).split('\n').length;
    const raw = text.slice(start, end);
    blocks.push({
      raw,
      startLine,
      endLine: startLine + raw.split('\n').length - 1,
      column: start - (text.lastIndexOf('\n', start - 1) + 1),
      emptyBlock: false,
    });
    from = end;
  }
}

/**
 * @param {string} text
 * @returns {ExtractedBlock[]}
 */
function slashSlashBlocks(text) {
  const masked = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const lines = text.split('\n');
  return masked.split('\n').flatMap((line, i) => {
    const at = line.indexOf('//');
    if (at < 0) return [];
    if (/https?:$/.test(line.slice(0, at))) return [];
    return [
      {
        raw: lines[i].slice(at),
        startLine: i + 1,
        endLine: i + 1,
        column: at,
        emptyBlock: false,
      },
    ];
  });
}

/**
 * @param {{ text: string }} input
 * @returns {ExtractedBlock[]}
 */
export function styleBlocks({ text }) {
  return mergeContiguous([
    ...delimitedBlocks(text, { open: '/*', close: '*/' }),
    ...slashSlashBlocks(text),
  ]);
}

/**
 * @param {{ text: string }} input
 * @returns {ExtractedBlock[]}
 */
export function markupBlocks({ text }) {
  return delimitedBlocks(text, { open: '<!--', close: '-->' });
}
