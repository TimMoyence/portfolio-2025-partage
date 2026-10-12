import ts from 'typescript';

import { extensionOf } from './perimetre.mjs';

/** @typedef {{ raw: string, startLine: number, endLine: number, column: number, emptyBlock: boolean }} ExtractedBlock */
/** @typedef {{ pos: number, end: number }} CommentSpan */
/** @typedef {{ text: string, getLineAndCharacterOfPosition(pos: number): import('typescript').LineAndCharacter }} LocatedText */
/** @typedef {{ interpolates: boolean, spans: CommentSpan[] }} StyleScan */

/** @type {Readonly<Record<string, import('typescript').ScriptKind>>} */
const SCRIPT_KIND_OF = { tsx: ts.ScriptKind.TSX, jsx: ts.ScriptKind.JSX };

/**
 * @param {string} file
 * @param {string} text
 * @returns {import('typescript').SourceFile}
 */
function createSf(file, text) {
  const kind = SCRIPT_KIND_OF[extensionOf(file)] ?? ts.ScriptKind.TS;
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
    const children = node.getChildren(sf).filter((child) => !ts.isJSDoc(child));
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
  /** @type {{ head: ExtractedBlock, raws: string[] }[]} */
  const runs = [];
  for (const block of ordered) {
    const run = runs.at(-1);
    if (run && isContiguous(run.head, block)) {
      run.raws.push(block.raw);
      run.head.endLine = block.endLine;
      continue;
    }
    runs.push({ head: { ...block }, raws: [block.raw] });
  }
  return runs.map(({ head, raws }) => ({ ...head, raw: raws.join('\n') }));
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
const UNQUOTED_URL = /(?<![\w-])url\(\s*(?!["'\s])/iy;
const CLOSER_OF_INTERPOLATION = '}';
const CLOSER_OF_URL = ')';

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
 * @param {CommentSpan[]} spans
 * @returns {number}
 */
function afterComment(text, at, spans) {
  const end = styleCommentEnd(text, at);
  if (end >= 0) spans.push({ pos: at, end });
  return end;
}

/**
 * @param {string} text
 * @param {number} at
 * @returns {number}
 */
function afterUnquotedUrlOpening(text, at) {
  UNQUOTED_URL.lastIndex = at;
  return UNQUOTED_URL.test(text) ? UNQUOTED_URL.lastIndex : -1;
}

/**
 * @param {string} text
 * @param {number} at
 * @param {string[]} closers
 * @param {StyleScan} scan
 * @returns {number}
 */
function stepInInterpolation(text, at, closers, scan) {
  const commentEnd = afterComment(text, at, scan.spans);
  if (commentEnd >= 0) return commentEnd;
  const urlStart = afterUnquotedUrlOpening(text, at);
  if (urlStart >= 0) {
    closers.push(CLOSER_OF_URL);
    return urlStart;
  }
  const char = text[at];
  if (char === CLOSER_OF_INTERPOLATION) closers.pop();
  else if (char === '{') closers.push(CLOSER_OF_INTERPOLATION);
  else if (QUOTES.has(char)) closers.push(char);
  return afterChar(text, at);
}

/**
 * @param {string} text
 * @param {number} from
 * @param {string} closer
 * @param {StyleScan} scan
 * @returns {number}
 */
function afterNested(text, from, closer, scan) {
  const closers = [closer];
  let i = from;
  while (closers.length > 0 && i < text.length) {
    const current = closers[closers.length - 1];
    if (current === CLOSER_OF_INTERPOLATION) {
      i = stepInInterpolation(text, i, closers, scan);
    } else if (QUOTES.has(current) && text[i] === '\n') {
      return i;
    } else if (text[i] === current) {
      closers.pop();
      i += 1;
    } else if (scan.interpolates && text.startsWith('#{', i)) {
      closers.push(CLOSER_OF_INTERPOLATION);
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
 * @param {StyleScan} scan
 * @returns {number}
 */
function afterNonComment(text, at, scan) {
  if (QUOTES.has(text[at])) return afterNested(text, at + 1, text[at], scan);
  const urlStart = afterUnquotedUrlOpening(text, at);
  if (urlStart >= 0) return afterNested(text, urlStart, CLOSER_OF_URL, scan);
  return afterChar(text, at);
}

/**
 * @param {string} text
 * @param {boolean} interpolates
 * @returns {CommentSpan[]}
 */
function styleCommentSpans(text, interpolates) {
  /** @type {StyleScan} */
  const scan = { interpolates, spans: [] };
  let at = 0;
  while (at < text.length) {
    const end = afterComment(text, at, scan.spans);
    at = end < 0 ? afterNonComment(text, at, scan) : end;
  }
  return scan.spans;
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
  return mergeContiguous(blocksAt(text, styleCommentSpans(text, extensionOf(file) === 'scss')));
}

/**
 * @param {{ text: string }} input
 * @returns {ExtractedBlock[]}
 */
export function markupBlocks({ text }) {
  return blocksAt(text, markupCommentSpans(text));
}
