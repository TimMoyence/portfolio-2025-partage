import fc from 'fast-check';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  borner,
  cueillirDansArbre,
  cueillirSous,
  echapperPourRegex,
  estEntierPositif,
  estEntierStrictementPositif,
  estMembre,
  estObjet,
  messageDErreur,
  objetOuNull,
  sansBords,
  sansDebut,
  sansFin,
} from '../src/valeurs';

describe('estObjet', () => {
  it.each([[{}], [{ a: 1 }], [Object.create(null)]])('reconnaît %o', (valeur) => {
    expect(estObjet(valeur)).toBe(true);
  });

  it.each([[null], [undefined], [[]], [[1]], ['texte'], [1], [true]])('refuse %o', (valeur) => {
    expect(estObjet(valeur)).toBe(false);
  });
});

describe('objetOuNull', () => {
  it('rend l objet tel quel', () => {
    const objet = { a: 1 };
    expect(objetOuNull(objet)).toBe(objet);
  });

  it.each([[null], [[]], ['x'], [3]])('rend null pour %o', (valeur) => {
    expect(objetOuNull(valeur)).toBeNull();
  });
});

describe('estMembre', () => {
  const COULEURS = ['rouge', 'vert'] as const;

  it('reconnaît un membre de la liste fermée et restreint son type', () => {
    const valeur: unknown = 'vert';
    expect(estMembre(COULEURS, valeur)).toBe(true);
    if (estMembre(COULEURS, valeur)) {
      expectTypeOf(valeur).toEqualTypeOf<'rouge' | 'vert'>();
    }
  });

  it.each([['bleu'], [''], [null], [undefined], [0], [['rouge']]])('refuse %o', (valeur) => {
    expect(estMembre(COULEURS, valeur)).toBe(false);
  });
});

describe('estEntierPositif', () => {
  it.each([[0], [1], [Number.MAX_SAFE_INTEGER]])('accepte %d', (valeur) => {
    expect(estEntierPositif(valeur)).toBe(true);
  });

  it.each([
    [-1],
    [1.5],
    [Number.NaN],
    [Number.POSITIVE_INFINITY],
    [Number.MAX_SAFE_INTEGER + 1],
    ['1'],
    [null],
  ])('refuse %o', (valeur) => {
    expect(estEntierPositif(valeur)).toBe(false);
  });

  it('garde le type number dans la branche fausse', () => {
    const lire = (valeur: number): boolean => {
      if (!estEntierPositif(valeur)) expectTypeOf(valeur).toEqualTypeOf<number>();
      return estEntierPositif(valeur);
    };
    expect(lire(1.5)).toBe(false);
  });
});

describe('estEntierStrictementPositif', () => {
  it.each([[1], [Number.MAX_SAFE_INTEGER]])('accepte %d', (valeur) => {
    expect(estEntierStrictementPositif(valeur)).toBe(true);
  });

  it.each([
    [0],
    [-0],
    [-1],
    [1.5],
    [Number.NaN],
    [Number.POSITIVE_INFINITY],
    [Number.MAX_SAFE_INTEGER + 1],
    [1e21],
    ['1'],
    [null],
  ])('refuse %o', (valeur) => {
    expect(estEntierStrictementPositif(valeur)).toBe(false);
  });

  it('restreint une valeur inconnue a un entier utilisable comme number', () => {
    const valeur: unknown = 3;
    if (estEntierStrictementPositif(valeur)) expectTypeOf(valeur).toExtend<number>();
  });

  it('garde le type number dans la branche fausse', () => {
    const lire = (valeur: number): boolean => {
      if (!estEntierStrictementPositif(valeur)) expectTypeOf(valeur).toEqualTypeOf<number>();
      return estEntierStrictementPositif(valeur);
    };
    expect(lire(0)).toBe(false);
  });
});

describe('borner', () => {
  it.each([
    [5, 0, 10, 5],
    [-3, 0, 10, 0],
    [12, 0, 10, 10],
    [0.5, 0, 1, 0.5],
  ])('borne %d entre %d et %d en %d', (valeur, minimum, maximum, attendu) => {
    expect(borner(valeur, minimum, maximum)).toBe(attendu);
  });

  it('fait primer le minimum quand les bornes se croisent : un index sur une liste vide reste 0', () => {
    expect(borner(3, 0, -1)).toBe(0);
    expect(borner(-5, 0, -1)).toBe(0);
  });

  it('reste dans les bornes pour toute valeur finie quand minimum <= maximum', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true }),
        fc.double({ noNaN: true }),
        fc.double({ noNaN: true }),
        (valeur, a, b) => {
          const [minimum, maximum] = a <= b ? [a, b] : [b, a];
          const borne = borner(valeur, minimum, maximum);
          return borne >= minimum && borne <= maximum;
        },
      ),
    );
  });
});

describe('messageDErreur', () => {
  it('lit le message d une Error', () => {
    expect(messageDErreur(new TypeError('refusé'))).toBe('refusé');
  });

  it.each([
    ['texte', 'texte'],
    [42, '42'],
    [null, 'null'],
    [undefined, 'undefined'],
  ])('convertit %o en %s', (erreur, attendu) => {
    expect(messageDErreur(erreur)).toBe(attendu);
  });
});

describe('sansFin, sansDebut, sansBords', () => {
  it.each([
    ['https://exemple.fr///', 'https://exemple.fr'],
    ['/', ''],
    ['', ''],
    ['a/b', 'a/b'],
  ])('sansFin(%s) rend %s', (texte, attendu) => {
    expect(sansFin(texte, '/')).toBe(attendu);
  });

  it.each([
    ['///a/b', 'a/b'],
    ['/', ''],
    ['a/', 'a/'],
  ])('sansDebut(%s) rend %s', (texte, attendu) => {
    expect(sansDebut(texte, '/')).toBe(attendu);
  });

  it.each([
    ['--slug-de-page--', 'slug-de-page'],
    ['----', ''],
    ['slug', 'slug'],
  ])('sansBords(%s) rend %s', (texte, attendu) => {
    expect(sansBords(texte, '-')).toBe(attendu);
  });

  it('ne retire que le caractère demandé, en toute longueur', () => {
    fc.assert(
      fc.property(fc.string(), fc.nat({ max: 20 }), (coeur, n) => {
        const nu = sansBords(coeur, '/');
        return sansBords(`${'/'.repeat(n)}${nu}${'/'.repeat(n)}`, '/') === nu;
      }),
    );
  });
});

describe('echapperPourRegex', () => {
  it('neutralise chaque caractère spécial d une expression régulière', () => {
    expect(echapperPourRegex('a.b*c+d?e^f$g{h}i(j)k|l[m]n\\o')).toBe(
      'a\\.b\\*c\\+d\\?e\\^f\\$g\\{h\\}i\\(j\\)k\\|l\\[m\\]n\\\\o',
    );
  });

  it('laisse un texte sans caractère spécial tel quel', () => {
    expect(echapperPourRegex('quality:dup-tests_2')).toBe('quality:dup-tests_2');
  });

  it('rend un motif qui reconnaît exactement le texte d origine, et lui seul', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (texte, autre) => {
        const motif = new RegExp(`^${echapperPourRegex(texte)}$`, 'u');
        return motif.test(texte) && (autre === texte || !motif.test(autre));
      }),
    );
  });
});

describe('cueillirDansArbre et cueillirSous', () => {
  const textes = (cle: string, element: unknown): readonly string[] | null => {
    if (cle === 'cache') {
      return [];
    }
    return typeof element === 'string' ? [element] : null;
  };

  it('parcourt objets et tableaux et garde ce que la règle retient', () => {
    const arbre = { a: 'un', b: ['deux', { c: 'trois', cache: 'non' }], d: 4 };
    expect(cueillirDansArbre(arbre, textes)).toEqual(['un', 'deux', 'trois']);
  });

  it('cueillirDansArbre ignore une feuille posée à la racine, cueillirSous la soumet à la règle', () => {
    expect(cueillirDansArbre('racine', textes)).toEqual([]);
    expect(cueillirSous('', 'racine', textes)).toEqual(['racine']);
    expect(cueillirSous('', ['a', ['b']], textes)).toEqual(['a', 'b']);
  });

  it('une clé retenue écarte tout son sous-arbre', () => {
    expect(cueillirSous('cache', { a: 'x' }, textes)).toEqual([]);
  });
});
