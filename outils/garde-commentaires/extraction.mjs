import ts from 'typescript';

/** @typedef {{ raw: string, startLine: number, endLine: number, column: number, emptyBlock: boolean }} ExtractedBlock */
/** @typedef {{ pos: number, end: number }} CommentSpan */
/** @typedef {{ text: string, getLineAndCharacterOfPosition(pos: number): import('typescript').LineAndCharacter }} LocatedText */

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
 * @returns {Generator<import('typescript').Node>}
 */
function* nodesOf(sf) {
  /** @type {import('typescript').Node[]} */
  const pending = [sf];
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    yield node;
    const children = node.getChildren(sf);
    for (let i = children.length - 1; i >= 0; i -= 1) pending.push(children[i]);
  }
}

/**
 * @param {LocatedText} source
 * @param {CommentSpan} span
 * @param {boolean} [emptyBlock]
 * @returns {ExtractedBlock}
 */
function blockAt(source, { pos, end }, emptyBlock = false) {
  const start = source.getLineAndCharacterOfPosition(pos);
  return {
    raw: source.text.slice(pos, end),
    startLine: start.line + 1,
    endLine: source.getLineAndCharacterOfPosition(end).line + 1,
    column: start.character,
    emptyBlock,
  };
}

/**
 * @param {string} text
 * @param {CommentSpan[]} spans
 * @returns {ExtractedBlock[]}
 */
function blocksAt(text, spans) {
  const source = ts.createSourceMapSource('', text);
  return spans.map((span) => blockAt(source, span));
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
  /** @type {ExtractedBlock[]} */
  const blocks = [];
  /** @type {Set<number>} */
  const seen = new Set();
  let emptyBraces = { from: 0, to: 0 };

  /** @param {readonly import('typescript').CommentRange[] | undefined} ranges @returns {void} */
  const add = (ranges) => {
    if (!ranges) return;
    for (const range of ranges) {
      if (seen.has(range.pos)) continue;
      seen.add(range.pos);
      const inside = range.pos > emptyBraces.from && range.end < emptyBraces.to;
      blocks.push(blockAt(sf, range, inside));
    }
  };

  for (const node of nodesOf(sf)) {
    if (isEmptyBraces(node) && node.getStart(sf) >= emptyBraces.to) {
      emptyBraces = { from: node.getStart(sf), to: node.getEnd() };
    }
    add(ts.getLeadingCommentRanges(text, node.getFullStart()));
    add(ts.getTrailingCommentRanges(text, node.getEnd()));
  }
  return mergeContiguous(blocks);
}

const CLOSING_OF_STRING = new Map([
  ['"', new Set(['"', '\n'])],
  ["'", new Set(["'", '\n'])],
]);
const CLOSING_OF_URL = new Set([')']);
const UNQUOTED_URL = /(?<![\w-])url\(\s*(?!["'\s])/iy;

/**
 * @param {string} text
 * @param {number} from
 * @param {string} close
 * @returns {number}
 */
function afterClose(text, from, close) {
  const at = text.indexOf(close, from);
  return at < 0 ? text.length : at + close.length;
}

/**
 * @param {string} text
 * @param {number} from
 * @param {ReadonlySet<string>} closing
 * @returns {number}
 */
function afterUnescaped(text, from, closing) {
  for (let i = from; i < text.length; i += 1) {
    if (text[i] === '\\') i += 1;
    else if (closing.has(text[i])) return i + 1;
  }
  return text.length;
}

/**
 * @param {string} text
 * @param {number} at
 * @returns {number}
 */
function styleCommentEnd(text, at) {
  if (text.startsWith('/*', at)) return afterClose(text, at + 2, '*/');
  if (!text.startsWith('//', at)) return -1;
  const newline = text.indexOf('\n', at);
  return newline < 0 ? text.length : newline;
}

/**
 * @param {string} text
 * @param {number} at
 * @returns {number}
 */
function afterNonComment(text, at) {
  const closing = CLOSING_OF_STRING.get(text[at]);
  if (closing) return afterUnescaped(text, at + 1, closing);
  UNQUOTED_URL.lastIndex = at;
  if (UNQUOTED_URL.test(text)) return afterUnescaped(text, UNQUOTED_URL.lastIndex, CLOSING_OF_URL);
  return at + 1;
}

/**
 * @param {string} text
 * @returns {CommentSpan[]}
 */
function styleCommentSpans(text) {
  /** @type {CommentSpan[]} */
  const spans = [];
  let at = 0;
  while (at < text.length) {
    const end = styleCommentEnd(text, at);
    if (end < 0) {
      at = afterNonComment(text, at);
      continue;
    }
    spans.push({ pos: at, end });
    at = end;
  }
  return spans;
}

/**
 * @param {string} text
 * @returns {CommentSpan[]}
 */
function markupCommentSpans(text) {
  /** @type {CommentSpan[]} */
  const spans = [];
  for (let pos = text.indexOf('<!--'); pos >= 0; pos = text.indexOf('<!--', spans.at(-1)?.end)) {
    spans.push({ pos, end: afterClose(text, pos + 4, '-->') });
  }
  return spans;
}

/**
 * @param {{ text: string }} input
 * @returns {ExtractedBlock[]}
 */
export function styleBlocks({ text }) {
  return mergeContiguous(blocksAt(text, styleCommentSpans(text)));
}

/**
 * @param {{ text: string }} input
 * @returns {ExtractedBlock[]}
 */
export function markupBlocks({ text }) {
  return blocksAt(text, markupCommentSpans(text));
}
