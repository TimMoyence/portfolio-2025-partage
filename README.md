# portfolio-2025-partage

Code commun à [portfolio-2025-back](https://github.com/TimMoyence/portfolio-2025-back) et
[portfolio-2025-front](https://github.com/TimMoyence/portfolio-2025-front), écrit une seule fois :
chaque action n'existe qu'à un seul endroit, et les deux dépôts l'importent d'ici.

## Entrées compilées (ESM et CommonJS)

- `portfolio-2025-partage/api` : les modèles des routes hors formations (audit de croissance et
  son flux SSE, rapport client, toolkit, contact, consentement aux cookies, présentations,
  authentification) et leurs listes fermées (`PILLAR_KEYS`, `AI_LEVELS`, `BUDGET_TIERS`…) ;
- `portfolio-2025-partage/contrats` : les listes fermées et les types que l'API des formations
  sert au front — données de chaque brique, cours servi et déroulé, séance, réponses, verdicts
  et rapport de séance ;
- `portfolio-2025-partage/formule` : le moteur de formules du tableur (analyse, évaluation,
  forme R1C1, décalage d'une formule recopiée, surface d'une formule), sans `eval`, et la
  lecture d'un nombre saisi, avec ou sans unité finale ;
- `portfolio-2025-partage/html` : l'échappement HTML et d'URL, l'allowlist des URL
  (`estUrlAutorisee`) et les gabarits sûrs `safeHtml` (règle stricte, pour les courriels) et
  `safeHtmlInteractif` (attributs `data-*`, `aria-*` et fragments d'attributs des briques) ;
- `portfolio-2025-partage/score` : le statut d'un score sur 100 (`ok`, `warning`, `critical`)
  et son libellé (`LIBELLES_DU_STATUT`) ;
- `portfolio-2025-partage/valeurs` : les gardes et utilitaires de valeurs (`estObjet`,
  `estMembre`, `estEntierPositif`, `estEntierStrictementPositif`, `borner`, `messageDErreur`, `echapperPourRegex`, `sansBords`,
  `cueillirDansArbre`…).

## Outils de développement (ESM, Node)

- binaire `garde-commentaires` : la garde des commentaires narratifs, à cliquet. Elle lit les
  fichiers suivis par git (`git ls-files`) du périmètre déclaré et refuse tout commentaire qui
  ne cite pas une source vérifiable (URL, RFC, dépendance déclarée). Le consommateur la
  configure dans son `package.json` :

  ```json
  "guard-no-comments": { "maxOffenses": 0, "perimetre": ["src/", "test/", "scripts/"] }
  ```

  `garde-commentaires --root .` joue la garde, `--count` affiche le compte, `--tighten`
  abaisse le plafond au compte mesuré. Elle exige `typescript` (dépendance pair optionnelle).

Chaque outil est un module ESM livré avec ses déclarations (`dist/outils/*.d.mts`, condition
`types` de l'export `import`) :

- `portfolio-2025-partage/outils/depot` : `racineDuDepot(import.meta.url)` rend le dossier du
  `package.json` le plus proche au-dessus du script appelant, chemin décodé, et lève s'il n'y en
  a aucun ;
- `portfolio-2025-partage/outils/dossier-temporaire` : planter un dépôt jetable pour un test de
  script (`avecDossierPlante`, `planterDossier`, `ecrireFichiers`, `supprimerDossier`) ;
- `portfolio-2025-partage/outils/porte-de-duplication` : les scénarios canaris des portes jscpd
  v5 et v4, l'écart des configurations et l'écart du branchement (`ci:check`, `pre-push:check`,
  workflow) ;
- `portfolio-2025-partage/outils/workflow-github` : la lecture des jobs et des étapes d'un
  workflow GitHub Actions.

## Publication

Le paquet n'est pas publié sur npm : chaque tag `v*` attache l'archive `npm pack` à sa release
GitHub, et les deux dépôts dépendent de l'URL de cette archive. Ils doivent citer la même URL.

```bash
npm ci
npm run ci:check
```

Publier une version : monter `version` dans `package.json`, puis pousser le tag `v<version>`.
