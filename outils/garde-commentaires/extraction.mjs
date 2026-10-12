import ts from 'typescript';

import { extensionOf } from './perimetre.mjs';

/** @typedef {{ raw: string, startLine: number, endLine: number, column: number, emptyBlock: boolean }} ExtractedBlock */
/** @typedef {{ pos: number, end: number }} CommentSpan */
/** @typedef {{ text: string, getLineAndCharacterOfPosition(pos: number): import('typescript').LineAndCharacter }} LocatedText */
/** @typedef {{ end: number, spans: CommentSpan[] }} UrlRead */
/** @typedef {{ steps: number, budget: number }} StyleWork */
/** @typedef {{ interpolates: boolean, spans: CommentSpan[], urls: Map<number, UrlRead>, depth: number, work: StyleWork }} StyleScan */

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
 * @param {number} pos
 * @returns {CommentSpan | undefined}
 */
function lastSpanBefore(spans, pos) {
  let low = 0;
  let high = spans.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (spans[middle].pos < pos) low = middle + 1;
    else high = middle;
  }
  return spans[low - 1];
}

/**
 * @param {CommentSpan[]} spans
 * @param {CommentSpan} range
 * @returns {boolean}
 */
function isInside(spans, range) {
  const span = lastSpanBefore(spans, range.pos);
  return span !== undefined && range.end < span.end;
}

/**
 * @param {CommentSpan[]} spans
 * @param {CommentSpan} range
 * @returns {boolean}
 */
function startsIn(spans, range) {
  const span = lastSpanBefore(spans, range.pos + 1);
  return span !== undefined && range.pos < span.end;
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
  /** @type {CommentSpan[]} */
  const jsxTexts = [];
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
    if (ts.isJsxText(node)) jsxTexts.push({ pos: node.pos, end: node.end });
    scan(leading, node.getFullStart(), ts.getLeadingCommentRanges);
    scan(trailing, node.getEnd(), ts.getTrailingCommentRanges);
  }
  const empty = outermost(spans);
  return mergeContiguous(
    [...comments.values()]
      .filter((range) => !startsIn(jsxTexts, range))
      .map((range) => blockAt(sf, range, isInside(empty, range))),
  );
}

const QUOTES = new Set(['"', "'"]);
const UNQUOTED_CSS_URL = /(?<![\w\u0080-￿-])url\(\s*(?!["'\s])/iy;
const SCSS_URL = /(?<![\w\u0080-￿-])(?:-[\w\u0080-￿]+-)?url\(/iy;
const CSS_WHITESPACE = /[ \t\n\r\f]/;
const CSS_WHITESPACES = /[ \t\n\r\f]*/y;
const CSS_ESCAPE = /\\(?:[\da-f]{1,6}[ \t\n\r\f]?|[^\n\r\f])/iy;
export const MAX_RAW_URL_NESTING = 32;
export const RAW_URL_STEPS_PER_CHAR = 16;
const CLOSER_OF_INTERPOLATION = '}';
const CLOSER_OF_URL = ')';
const STATEMENT_BOUNDARIES = new Set(['{', ';', '}']);

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
 * @param {RegExp} sticky
 * @param {string} text
 * @param {number} at
 * @returns {number}
 */
function afterSticky(sticky, text, at) {
  sticky.lastIndex = at;
  return sticky.test(text) ? sticky.lastIndex : -1;
}

/**
 * @param {string} char
 * @returns {boolean}
 */
const isRawUrlChar = (char) =>
  char === '!' || char === '%' || char === '&' || (char >= '*' && char <= '~') || char >= '\u0080';

/**
 * @param {string} text
 * @param {number} at
 * @returns {boolean}
 */
const opensExpressionSyntax = (text, at) =>
  text[at] === '{' ||
  text[at] === CLOSER_OF_INTERPOLATION ||
  (text[at] === '/' && (text[at + 1] === '/' || text[at + 1] === '*'));

/**
 * @param {string} text
 * @param {number} at
 * @param {StyleScan} attempt
 * @returns {number}
 */
function stepInRawUrl(text, at, attempt) {
  const char = text[at];
  if (char === '\\') return afterSticky(CSS_ESCAPE, text, at);
  if (text.startsWith('#{', at)) {
    return afterNested(text, at + 2, CLOSER_OF_INTERPOLATION, attempt);
  }
  if (CSS_WHITESPACE.test(char)) {
    const next = afterSticky(CSS_WHITESPACES, text, at);
    return text[next] === CLOSER_OF_URL ? next : -1;
  }
  return isRawUrlChar(char) ? at + 1 : -1;
}

/**
 * @param {string} text
 * @param {number} from
 * @param {StyleScan} scan
 * @returns {UrlRead}
 */
function readScssUrl(text, from, scan) {
  /** @type {StyleScan} */
  const attempt = { ...scan, spans: [], depth: scan.depth + 1 };
  let divergence = -1;
  let at = afterSticky(CSS_WHITESPACES, text, from);
  while (at < text.length && text[at] !== CLOSER_OF_URL) {
    scan.work.steps += 1;
    if (divergence < 0 && opensExpressionSyntax(text, at)) divergence = at;
    const next = stepInRawUrl(text, at, attempt);
    if (next < 0) break;
    at = next;
  }
  if (text[at] === CLOSER_OF_URL) return { end: at + 1, spans: attempt.spans };
  const resume = divergence < 0 ? at : divergence;
  return { end: resume, spans: attempt.spans.filter((span) => span.end <= resume) };
}

/**
 * @param {string} text
 * @param {number} at
 * @param {StyleScan} scan
 * @returns {number}
 */
function afterUrl(text, at, scan) {
  if (!scan.interpolates) {
    const from = afterSticky(UNQUOTED_CSS_URL, text, at);
    return from < 0 ? -1 : afterNested(text, from, CLOSER_OF_URL, scan);
  }
  const from = afterSticky(SCSS_URL, text, at);
  if (from < 0) return -1;
  let read = scan.urls.get(at);
  if (!read) {
    const { work } = scan;
    if (scan.depth >= MAX_RAW_URL_NESTING || work.steps >= work.budget) return -1;
    read = readScssUrl(text, from, scan);
    scan.urls.set(at, read);
  }
  for (const span of read.spans) scan.spans.push(span);
  return read.end;
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
  const urlEnd = afterUrl(text, at, scan);
  if (urlEnd >= 0) return urlEnd;
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
    scan.work.steps += 1;
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
  if (scan.interpolates && text.startsWith('#{', at)) {
    return afterNested(text, at + 2, CLOSER_OF_INTERPOLATION, scan);
  }
  const urlEnd = afterUrl(text, at, scan);
  return urlEnd >= 0 ? urlEnd : afterChar(text, at);
}

/**
 * @param {string} text
 * @param {number} at
 * @param {StyleScan} scan
 * @returns {number}
 */
function afterStatementComment(text, at, scan) {
  if (!scan.interpolates || !text.startsWith('/*', at)) return afterComment(text, at, scan.spans);
  /** @type {StyleScan} */
  const inside = { ...scan, spans: [] };
  let i = at + 2;
  while (i < text.length && !text.startsWith('*/', i)) {
    i = text.startsWith('#{', i)
      ? afterNested(text, i + 2, CLOSER_OF_INTERPOLATION, inside)
      : i + 1;
  }
  const end = Math.min(i + 2, text.length);
  scan.spans.push({ pos: at, end });
  return end;
}

/**
 * @param {string} text
 * @param {boolean} interpolates
 * @returns {CommentSpan[]}
 */
function styleCommentSpans(text, interpolates) {
  /** @type {StyleScan} */
  const scan = {
    interpolates,
    spans: [],
    urls: new Map(),
    depth: 0,
    work: { steps: 0, budget: RAW_URL_STEPS_PER_CHAR * text.length },
  };
  let at = 0;
  let statement = true;
  while (at < text.length) {
    const end = statement
      ? afterStatementComment(text, at, scan)
      : afterComment(text, at, scan.spans);
    if (end >= 0) {
      at = end;
    } else {
      if (!CSS_WHITESPACE.test(text[at])) statement = STATEMENT_BOUNDARIES.has(text[at]);
      at = afterNonComment(text, at, scan);
    }
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
