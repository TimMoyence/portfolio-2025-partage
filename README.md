# portfolio-2025-partage

Code commun à [portfolio-2025-back](https://github.com/TimMoyence/portfolio-2025-back) et
[portfolio-2025-front](https://github.com/TimMoyence/portfolio-2025-front), écrit une seule fois :

- `portfolio-2025-partage/contrats` : les listes fermées (types de question, phases de vote,
  modalités…) et les types de résultats que l'API des formations sert au front ;
- `portfolio-2025-partage/formule` : le moteur de formules du tableur (analyse, évaluation,
  forme R1C1, surface d'une formule), sans `eval`, et la lecture d'un nombre saisi, avec ou
  sans unité finale ;
- `portfolio-2025-partage/html` : l'échappement HTML et d'URL, et les gabarits sûrs
  `safeHtml` (règle stricte, pour les courriels) et `safeHtmlInteractif` (attributs `data-*`,
  `aria-*` et fragments d'attributs des briques du cours) ;
- `portfolio-2025-partage/score` : le statut d'un score sur 100 (`ok`, `warning`, `critical`).

Le paquet est compilé deux fois (ESM et CommonJS) et n'est pas publié sur npm : chaque tag `v*`
attache l'archive `npm pack` à sa release GitHub, et les deux dépôts dépendent de l'URL de
cette archive. Ils doivent citer la même URL.

```bash
npm ci
npm run ci:check
```

Publier une version : monter `version` dans `package.json`, puis pousser le tag `v<version>`.
