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
 * @param {import('typescript').SourceFile} sf
 * @returns {CommentSpan | undefined}
 */
function emptyBracesOf(node, sf) {
  if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
    return node.members.length === 0
      ? { pos: node.members.pos - 1, end: node.getEnd() }
      : undefined;
  }
  const empty = ts.isObjectLiteralExpression(node)
    ? node.properties.length === 0
    : (ts.isBlock(node) || ts.isModuleBlock(node)) && node.statements.length === 0;
  return empty ? { pos: node.getStart(sf), end: node.getEnd() } : undefined;
}

/**
 * @param {CommentSpan[]} spans
 * @returns {CommentSpan[]}
 */
function outermost(spans) {
  /** @type {CommentSpan[]} */
  const kept = [];
  for (const span of [...spans].sort((a, b) => a.pos - b.pos)) {
    if (span.pos >= (kept.at(-1)?.end ?? 0)) kept.push(span);
  }
  return kept;
}

/**
 * @param {CommentSpan[]} spans
 * @param {CommentSpan} range
 * @returns {boolean}
 */
function isInside(spans, range) {
  let low = 0;
  let high = spans.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (spans[middle].pos < range.pos) low = middle + 1;
    else high = middle;
  }
  const span = spans[low - 1];
  return span !== undefined && range.end < span.end;
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
  /** @type {CommentSpan[]} */
  const spans = [];
  /** @type {Map<number, CommentSpan>} */
  const comments = new Map();
  const leading = new Set();
  const trailing = new Set();

  /**
   * @param {Set<number>} scanned
   * @param {number} pos
   * @param {(text: string, pos: number) => import('typescript').CommentRange[] | undefined} read
   * @returns {void}
   */
  const scan = (scanned, pos, read) => {
    if (scanned.has(pos)) return;
    scanned.add(pos);
    for (const range of read(text, pos) ?? []) {
      if (!comments.has(range.pos)) comments.set(range.pos, range);
    }
  };

  for (const node of nodesOf(sf)) {
    const span = emptyBracesOf(node, sf);
    if (span) spans.push(span);
    scan(leading, node.getFullStart(), ts.getLeadingCommentRanges);
    scan(trailing, node.getEnd(), ts.getTrailingCommentRanges);
  }
  const empty = outermost(spans);
  return mergeContiguous(
    [...comments.values()].map((range) => blockAt(sf, range, isInside(empty, range))),
  );
}

const QUOTES = new Set(['"', "'"]);
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
 * @param {number} at
 * @returns {number}
 */
function afterChar(text, at) {
  return text[at] === '\\' ? at + 2 : at + 1;
}

/**
 * @param {string} text
 * @param {number} from
 * @param {ReadonlySet<string>} closing
 * @returns {number}
 */
function afterUnescaped(text, from, closing) {
  for (let i = from; i < text.length; i = afterChar(text, i)) {
    if (closing.has(text[i])) return i + 1;
  }
  return text.length;
}

/**
 * @param {string} text
 * @param {number} from
 * @param {string} quote
 * @param {boolean} interpolates
 * @returns {number}
 */
function afterString(text, from, quote, interpolates) {
  const closers = [quote];
  let i = from;
  while (i < text.length && closers.length > 0) {
    const closer = closers[closers.length - 1];
    const char = text[i];
    if (closer === '}') {
      if (QUOTES.has(char)) closers.push(char);
      else if (char === '{') closers.push('}');
      else if (char === '}') closers.pop();
      i += 1;
    } else if (char === closer || char === '\n') {
      closers.pop();
      i += 1;
    } else if (interpolates && text.startsWith('#{', i)) {
      closers.push('}');
      i += 2;
    } else {
      i = afterChar(text, i);
    }
  }
  return Math.min(i, text.length);
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
 * @param {boolean} interpolates
 * @returns {number}
 */
function afterNonComment(text, at, interpolates) {
  if (QUOTES.has(text[at])) return afterString(text, at + 1, text[at], interpolates);
  UNQUOTED_URL.lastIndex = at;
  if (UNQUOTED_URL.test(text)) return afterUnescaped(text, UNQUOTED_URL.lastIndex, CLOSING_OF_URL);
  return afterChar(text, at);
}

/**
 * @param {string} text
 * @param {boolean} interpolates
 * @returns {CommentSpan[]}
 */
function styleCommentSpans(text, interpolates) {
  /** @type {CommentSpan[]} */
  const spans = [];
  let at = 0;
  while (at < text.length) {
    const end = styleCommentEnd(text, at);
    if (end < 0) {
      at = afterNonComment(text, at, interpolates);
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
 * @param {{ text: string, file: string }} input
 * @returns {ExtractedBlock[]}
 */
export function styleBlocks({ text, file }) {
  return mergeContiguous(blocksAt(text, styleCommentSpans(text, file.endsWith('.scss'))));
}

/**
 * @param {{ text: string }} input
 * @returns {ExtractedBlock[]}
 */
export function markupBlocks({ text }) {
  return blocksAt(text, markupCommentSpans(text));
}
