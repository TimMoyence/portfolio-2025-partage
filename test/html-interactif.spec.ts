import { describe, expect, it } from 'vitest';
import { escapeHtml, escapeUrl, safeCss, safeHtml, safeHtmlInteractif } from '../src/html';

const LIEN_PIEGE = 'javascript:alert(1)';
const DESACTIVE = safeHtmlInteractif`disabled`;
const VIDE = safeHtmlInteractif``;

type Rendu = () => unknown;

describe('safeHtmlInteractif — ce que les briques du cours ajoutent à la règle stricte', () => {
  const ADMIS_EN_INTERACTIF: readonly (readonly [string, Rendu, Rendu, string])[] = [
    [
      'un attribut data-*',
      () => safeHtmlInteractif`<p data-option="${escapeHtml('a"b')}"></p>`,
      () => safeHtml`<p data-option="${escapeHtml('a"b')}"></p>`,
      '<p data-option="a&quot;b"></p>',
    ],
    [
      'un attribut aria-*',
      () => safeHtmlInteractif`<div aria-describedby="${escapeHtml('aide')}"></div>`,
      () => safeHtml`<div aria-describedby="${escapeHtml('aide')}"></div>`,
      '<div aria-describedby="aide"></div>',
    ],
    [
      'la valeur d’un champ',
      () => safeHtmlInteractif`<input value="${escapeHtml('12,5')}" />`,
      () => safeHtml`<input value="${escapeHtml('12,5')}" />`,
      '<input value="12,5" />',
    ],
    [
      'le libellé lié à un champ',
      () => safeHtmlInteractif`<label for="${escapeHtml('champ-1')}"></label>`,
      () => safeHtml`<label for="${escapeHtml('champ-1')}"></label>`,
      '<label for="champ-1"></label>',
    ],
    [
      'un attribut booléen constant dans la balise',
      () => safeHtmlInteractif`<button type="button" ${DESACTIVE}>ok</button>`,
      () => safeHtml`<button type="button" ${DESACTIVE}>ok</button>`,
      '<button type="button" disabled>ok</button>',
    ],
    [
      'un fragment vide dans la balise',
      () => safeHtmlInteractif`<button type="button" ${VIDE}>ok</button>`,
      () => safeHtml`<button type="button" ${VIDE}>ok</button>`,
      '<button type="button" >ok</button>',
    ],
    [
      'un attribut data-* assemblé en fragment, collé à la valeur précédente',
      () =>
        safeHtmlInteractif`<div data-testid="histogramme"${safeHtmlInteractif` data-vote="${escapeHtml('oui')}"`}></div>`,
      () =>
        safeHtml`<div data-testid="histogramme"${safeHtmlInteractif` data-vote="${escapeHtml('oui')}"`}></div>`,
      '<div data-testid="histogramme" data-vote="oui"></div>',
    ],
    [
      'un champ en lecture seule',
      () => safeHtmlInteractif`<input ${safeHtmlInteractif`readonly`}>`,
      () => safeHtml`<input ${safeHtmlInteractif`readonly`}>`,
      '<input readonly>',
    ],
    [
      'l’affiche d’une vidéo',
      () => safeHtmlInteractif`<video poster="${escapeUrl('/affiche.jpg')}"></video>`,
      () => safeHtml`<video poster="${escapeUrl('/affiche.jpg')}"></video>`,
      '<video poster="/affiche.jpg"></video>',
    ],
  ];

  it.each(ADMIS_EN_INTERACTIF)('admet %s', (_nom, interactif, _strict, attendu) => {
    expect(String(interactif())).toBe(attendu);
  });

  it.each(ADMIS_EN_INTERACTIF)('la règle stricte refuse %s', (_nom, _interactif, strict) => {
    expect(strict).toThrow(/Interpolation refusée/);
  });
});

describe('safeHtmlInteractif — ce qu’aucune règle n’admet', () => {
  const REFUSES: readonly (readonly [string, Rendu])[] = [
    [
      'un gestionnaire injecté dans la balise par une donnée échappée',
      () => safeHtmlInteractif`<button ${escapeHtml('onclick=alert(1)')}>ok</button>`,
    ],
    [
      'une donnée seulement échappée dans l’affiche d’une vidéo',
      () => safeHtmlInteractif`<video poster="${escapeHtml(LIEN_PIEGE)}"></video>`,
    ],
    [
      'une donnée seulement échappée dans un href assemblé en fragment',
      () => safeHtmlInteractif`<a ${safeHtmlInteractif`href="${escapeHtml(LIEN_PIEGE)}"`}>x</a>`,
    ],
    [
      'une donnée seulement échappée dans une affiche assemblée en fragment',
      () =>
        safeHtmlInteractif`<video ${safeHtmlInteractif`poster="${escapeHtml(LIEN_PIEGE)}"`}></video>`,
    ],
    [
      'une URL assemblée en fragment, dont la valeur n’a été lue que comme du texte',
      () =>
        safeHtmlInteractif`<video playsinline ${safeHtmlInteractif`poster="${escapeUrl('/a.jpg')}"`}></video>`,
    ],
    [
      'un fragment qui prolonge le nom d’un attribut',
      () => safeHtmlInteractif`<video playsinline${DESACTIVE}></video>`,
    ],
    [
      'un style injecté dans la balise',
      () => safeHtmlInteractif`<div ${safeHtmlInteractif`style="color:red"`}></div>`,
    ],
    [
      'une valeur sans guillemets injectée dans la balise',
      () => safeHtmlInteractif`<div ${escapeHtml('data-x=y')}></div>`,
    ],
    ['un fragment collé au nom de la balise', () => safeHtmlInteractif`<div${DESACTIVE}></div>`],
    [
      'un fragment collé au nom d’un attribut',
      () => safeHtmlInteractif`<button on${escapeHtml('click')}="x"></button>`,
    ],
    ['une URL dans la balise', () => safeHtmlInteractif`<a ${escapeUrl('https://a.fr')}>x</a>`],
    [
      'une feuille de style dans la balise',
      () => safeHtmlInteractif`<div ${safeCss`color: red;`}></div>`,
    ],
    [
      'une URL partielle dans un href',
      () => safeHtmlInteractif`<a href="/cours/${escapeUrl('demo')}">x</a>`,
    ],
    [
      'une donnée seulement échappée dans un href',
      () => safeHtmlInteractif`<a href="${escapeHtml(LIEN_PIEGE)}">x</a>`,
    ],
    [
      'un gestionnaire onclick',
      () => safeHtmlInteractif`<button onclick="${escapeHtml('x')}"></button>`,
    ],
    ['un attribut style', () => safeHtmlInteractif`<span style="${escapeHtml('width:0')}"></span>`],
    ['le contenu d’un script', () => safeHtmlInteractif`<script>${escapeHtml('x')}</script>`],
    [
      'un attribut inconnu',
      () => safeHtmlInteractif`<form action="${escapeHtml('/envoi')}"></form>`,
    ],
  ];

  it.each(REFUSES)('refuse %s', (_nom, rendre) => {
    expect(rendre).toThrow(/Interpolation refusée/);
  });

  it('rend inerte un href pris à escapeUrl dont le schéma est refusé', () => {
    expect(String(safeHtmlInteractif`<a href="${escapeUrl(LIEN_PIEGE)}">x</a>`)).toBe(
      '<a href="#">x</a>',
    );
  });

  it('admet un nombre dans un attribut style, qui ne peut porter aucune charge', () => {
    expect(String(safeHtmlInteractif`<span style="width:${58}%"></span>`)).toBe(
      '<span style="width:58%"></span>',
    );
  });
});
