import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';

const manifeste = JSON.parse(readFileSync('package.json', 'utf8'));
const exiger = createRequire(import.meta.url);
const ATTENDUS = {
  api: {
    listes: [
      'LOCALES_SUPPORTEES',
      'PILLAR_KEYS',
      'AUDIT_PROCESSING_STATUSES',
      'AI_LEVELS',
      'BUDGET_TIERS',
      'COOKIE_CONSENT_SOURCES',
      'COOKIE_CONSENT_ACTIONS',
    ],
    types: [
      'SupportedLocale',
      'ChampsAntiRobot',
      'ReponseDeCreation',
      'PillarKey',
      'AuditProcessingStatus',
      'AuditContactMethod',
      'AuditRequestPayload',
      'AuditCreateResponse',
      'AuditSynthesis',
      'AuditSummaryResponse',
      'ReportSeverity',
      'ClientReportFinding',
      'ClientReportEngineScore',
      'ClientReportPillar',
      'ClientReportQuickWin',
      'ClientReportCta',
      'ClientReport',
      'AuditProgressEvent',
      'AuditCompletedEvent',
      'AuditFailedEvent',
      'AuditTimeoutEvent',
      'AuditStreamEvent',
      'AiLevel',
      'BudgetTier',
      'InteractionProfile',
      'ToolkitRequest',
      'ToolkitResponse',
      'CheatsheetEntry',
      'PromptEntry',
      'WorkflowStep',
      'WorkflowEntry',
      'TemplateEntry',
      'ToolkitPage',
      'ContactRequest',
      'CookieConsentSource',
      'CookieConsentAction',
      'CookieConsentPreferences',
      'CookieConsentPayload',
      'PollInteraction',
      'ReflectionInteraction',
      'SlideInteractions',
      'PresentationInteractions',
      'AuthUser',
      'AuthSession',
      'AuthActionMessage',
      'LoginCredentials',
      'GoogleAuthPayload',
      'RegisterUserPayload',
      'ForgotPasswordPayload',
      'ResendVerificationPayload',
      'ResetPasswordPayload',
      'SetPasswordPayload',
      'ChangePasswordPayload',
      'UpdateProfilePayload',
    ],
  },
  contrats: {
    fonctions: ['surLaJumelle'],
    listes: [
      'TYPES_QUESTION',
      'DIFFUSIONS',
      'ETATS_PULSE',
      'PHASES_DE_VOTE',
      'PACING_MODES',
      'MODALITES',
      'REGIMES_DE_VERROU',
      'CHAMPS_EXTRAITS_DU_CAS',
      'STATUTS_DE_SEANCE',
      'STATUTS_DE_REPONSE_LIBRE',
      'RAISONS_DE_FIN',
      'BOITES_DE_REVISION',
    ],
    types: [
      'TypeQuestion',
      'Diffusion',
      'EtatPulse',
      'VotePhase',
      'PacingMode',
      'FreeRange',
      'Modalite',
      'RegimeVerrou',
      'MetadonneesBrique',
      'Tolerance',
      'FormeFormule',
      'ValeurProduction',
      'ConfusionComptee',
      'Decompte',
      'DecomptesParCle',
      'ResultatQuestion',
      'ResultatsSeance',
      'StatistiquesSeance',
      'ComptesJalon',
      'ProgressionEnigme',
      'ResumeBareme',
      'ResultatsEnDirect',
      'RegleDeNotation',
      'ContenuDeBrique',
      'ContenuPublie',
      'OptionPublique',
      'VotePublic',
      'RecallQuestionPublique',
      'NumeriquePublic',
      'ExitBilletPublic',
      'QuoteCitation',
      'QuestionLibre',
      'CasProfessionnel',
      'ProCas',
      'LigneDuDossier',
      'WorkedEtape',
      'WorkedExemple',
      'ParametreCurseur',
      'Reglages',
      'Prereglage',
      'DefinitionReglable',
      'EtapeDeMachine',
      'Concept4Definition',
      'TraitSerie',
      'PlotAxe',
      'PlotBornesOrdonnee',
      'PlotSerie',
      'PlotDefinition',
      'StoryVisuel',
      'StoryVideo',
      'PresentationDuRecit',
      'StoryRecit',
      'ChallengeProblemePublic',
      'PlanEtaye',
      'SheetPlanPublic',
      'CardsortPlanPublic',
      'RoleColonne',
      'TableColonneServie',
      'TableSynthese',
      'TableBuildPlanPublic',
      'EscapeEnigmePublique',
      'EscapeParcoursPublic',
      'PulseSondage',
      'SpacedRappel',
      'BoiteDeRevision',
      'SpacedQuestionPublique',
      'OrdreQuestions',
      'QuestionDeQuestionnaire',
      'DonneesParBrique',
      'ChampExtraitDuCas',
      'CadrageDuRenvoi',
      'ExplicationDeCorrection',
      'PieceJointePublique',
      'PieceJointeServieEnSeance',
      'PieceJointeServie',
      'GuideFormateur',
      'CorrigePresentateur',
      'CorrigeEcranPresentateur',
      'QuestionCorrigee',
      'ReflexionServie',
      'CorrectionServie',
      'EcranPublic',
      'CoursPublic',
      'CoursPublicCatalogue',
      'QuestionDuDeroule',
      'EcranDeroule',
      'DerouleCours',
      'LivretPublie',
      'StatutDeSeance',
      'RaisonDeFin',
      'PilotageEcran',
      'PilotageDemande',
      'CommandePilotage',
      'EtatSession',
      'SeanceOuverte',
      'InscriptionParticipant',
      'Rattachement',
      'ParticipantDeSeance',
      'ValeurSaisie',
      'ValeurReponse',
      'ReponseEtudiant',
      'ProductionEtudiante',
      'TentativeEnigme',
      'TentativeDefi',
      'ReponseLibreEtudiant',
      'ReponseLibreEnregistree',
      'IncidentEtudiant',
      'DetailDeVerdict',
      'VerdictDeReponseServi',
      'VerdictDeProductionServi',
      'VerdictDeTentativeServi',
      'StrategieServie',
      'StrategiesDuDefi',
      'RappelsDus',
      'QuestionDue',
      'QuestionsDues',
      'SyntheseConcept',
      'EnigmeResolue',
      'ProgressionDesEnigmes',
      'ReponseDuParticipant',
      'EtatParticipant',
      'StatutDeReponseLibre',
      'ReponseLibreFormateur',
      'AnnotationFormateur',
      'ReponseRapportee',
      'ReponseLibreRapportee',
      'ParticipantRapporte',
      'RapportSeance',
    ],
  },
  formule: {
    fonctions: [
      'lettreColonne',
      'nomCellule',
      'lireNombreSaisi',
      'lireNombreSaisiAvecUnite',
      'estUneFormule',
      'arrondirMoitieLoinDeZero',
      'evaluerFeuille',
      'evaluerCellule',
      'evaluerExpression',
      'surfaceDeFormule',
      'formeR1C1',
      'decalerFormule',
      'formaterResultat',
      'remplirGabarit',
    ],
    constantes: ['LONGUEUR_MAX_FORMULE', 'PROFONDEUR_MAX', 'NOMBRE_MAX_CELLULES'],
    erreurs: ['FeuilleHorsLimitesError'],
    types: [
      'CodeErreur',
      'ValeurFormule',
      'ResultatFormule',
      'ResultatNumerique',
      'Feuille',
      'OptionsEvaluation',
      'SurfaceFormule',
    ],
  },
  html: {
    fonctions: [
      'escapeHtml',
      'estUrlAutorisee',
      'escapeUrl',
      'safeCss',
      'safeHtml',
      'safeHtmlInteractif',
    ],
    types: ['EscapedHtml', 'UrlEchappee', 'FeuilleDeStyle'],
  },
  score: {
    fonctions: ['statutDuScore'],
    objets: ['LIBELLES_DU_STATUT'],
    types: ['StatutScore'],
  },
  valeurs: {
    fonctions: [
      'estObjet',
      'objetOuNull',
      'estMembre',
      'estEntierPositif',
      'estEntierStrictementPositif',
      'borner',
      'messageDErreur',
      'echapperPourRegex',
      'sansFin',
      'sansDebut',
      'sansBords',
      'cueillirDansArbre',
      'cueillirSous',
    ],
    types: ['Retenir'],
  },
};
const OUTILS = {
  'outils/depot': { fonctions: ['racineDuDepot'] },
  'outils/dossier-temporaire': {
    fonctions: ['avecDossierPlante', 'planterDossier', 'ecrireFichiers', 'supprimerDossier'],
  },
  'outils/porte-de-duplication': {
    fonctions: [
      'verdictSurDepotPlante',
      'scenariosDeLaPorte',
      'ecartsDesConfigurations',
      'ecartsDuBranchement',
    ],
    chaines: ['CANARI_TS'],
    types: ['Moteur', 'Porte', 'Verdict', 'DemandeDeVerdict', 'CasDePorte', 'Scenario'],
  },
  'outils/workflow-github': { fonctions: ['blocsDesJobs', 'etapesDuJob'] },
};

const RESOLUTIONS = {
  node10: { module: ts.ModuleKind.CommonJS, moduleResolution: ts.ModuleResolutionKind.Node10 },
  nodenext: { module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext },
  bundler: { module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler },
};

const nomsAttendus = ({
  fonctions = [],
  listes = [],
  objets = [],
  constantes = [],
  chaines = [],
  erreurs = [],
  types = [],
}) => [...fonctions, ...listes, ...objets, ...constantes, ...chaines, ...erreurs, ...types];

assert.deepEqual(
  Object.keys(manifeste.exports).sort(),
  [...Object.keys(ATTENDUS), ...Object.keys(OUTILS)].map((entree) => `./${entree}`).sort(),
  'chaque entrée du paquet doit être vérifiée ici',
);

for (const [entree, attendus] of Object.entries(ATTENDUS)) {
  const { fonctions = [], listes = [], objets = [], constantes = [], erreurs = [] } = attendus;
  const specificateur = `${manifeste.name}/${entree}`;
  const chargements = { import: await import(specificateur), require: exiger(specificateur) };
  for (const [condition, module] of Object.entries(chargements)) {
    const ici = `${specificateur} (${condition})`;
    for (const fonction of fonctions) {
      assert.equal(typeof module[fonction], 'function', `${ici} : ${fonction}`);
    }
    for (const liste of listes) {
      assert.ok(
        Array.isArray(module[liste]) && Object.isFrozen(module[liste]),
        `${ici} : ${liste} doit être une liste gelée`,
      );
    }
    for (const objet of objets) {
      assert.ok(
        typeof module[objet] === 'object' &&
          !Array.isArray(module[objet]) &&
          Object.isFrozen(module[objet]),
        `${ici} : ${objet} doit être un objet gelé`,
      );
    }
    for (const constante of constantes) {
      assert.equal(typeof module[constante], 'number', `${ici} : ${constante}`);
    }
    for (const erreur of erreurs) {
      assert.ok(
        typeof module[erreur] === 'function' && module[erreur].prototype instanceof Error,
        `${ici} : ${erreur} doit être une classe d erreur`,
      );
    }
  }
}

for (const [entree, attendus] of Object.entries(OUTILS)) {
  const { types: _typesSansValeur, ...valeurs } = attendus;
  const { fonctions = [], chaines = [] } = valeurs;
  const specificateur = `${manifeste.name}/${entree}`;
  const module = await import(specificateur);
  assert.deepEqual(
    Object.keys(module).sort(),
    nomsAttendus(valeurs).sort(),
    `${specificateur} : chaque export doit figurer dans OUTILS, et lui seul`,
  );
  for (const fonction of fonctions) {
    assert.equal(typeof module[fonction], 'function', `${specificateur} : ${fonction}`);
  }
  for (const chaine of chaines) {
    assert.equal(typeof module[chaine], 'string', `${specificateur} : ${chaine}`);
  }
}

function exportsDeclares(fichier) {
  const programme = ts.createProgram([fichier], {
    ...RESOLUTIONS.nodenext,
    noEmit: true,
    types: [],
  });
  const verificateur = programme.getTypeChecker();
  const source = programme.getSourceFile(fichier);
  const module = source && verificateur.getSymbolAtLocation(source);
  assert.ok(module, `${fichier} : déclarations introuvables`);
  return verificateur
    .getExportsOfModule(module)
    .map((symbole) => symbole.name)
    .sort();
}

for (const [entree, attendus] of Object.entries(ATTENDUS)) {
  assert.deepEqual(
    exportsDeclares(`dist/esm/${entree}.d.ts`),
    nomsAttendus(attendus).sort(),
    `${entree} : chaque export déclaré doit figurer dans ATTENDUS, et lui seul`,
  );
}

for (const [entree, attendus] of Object.entries(OUTILS)) {
  assert.deepEqual(
    exportsDeclares(`dist/${entree}.d.mts`),
    nomsAttendus(attendus).sort(),
    `${entree} : chaque export déclaré doit figurer dans OUTILS, et lui seul`,
  );
}

function sonder(dossier, { fichier, entrees, resolutions }) {
  const sonde = join(dossier, fichier);
  const reexportations = Object.entries(entrees).map(
    ([entree, attendus]) =>
      `export type { ${nomsAttendus(attendus).join(', ')} } from '${manifeste.name}/${entree}';`,
  );
  writeFileSync(sonde, `${reexportations.join('\n')}\n`);
  const hote = {
    getCanonicalFileName: (chemin) => chemin,
    getCurrentDirectory: () => dossier,
    getNewLine: () => '\n',
  };
  for (const resolution of resolutions) {
    const programme = ts.createProgram([sonde], {
      ...RESOLUTIONS[resolution],
      strict: true,
      noEmit: true,
      target: ts.ScriptTarget.ES2022,
      lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
      types: [],
    });
    const diagnostics = ts.getPreEmitDiagnostics(programme);
    assert.equal(
      diagnostics.length,
      0,
      `${fichier} : déclarations lues en ${resolution} :\n${ts.formatDiagnostics(diagnostics, hote)}`,
    );
  }
}

const RESOLUTIONS_ESM = ['nodenext', 'bundler'];

const dossier = mkdtempSync(join(tmpdir(), 'sonde-partage-'));
try {
  mkdirSync(join(dossier, 'node_modules'));
  symlinkSync(process.cwd(), join(dossier, 'node_modules', manifeste.name), 'dir');
  sonder(dossier, {
    fichier: 'sonde.ts',
    entrees: ATTENDUS,
    resolutions: Object.keys(RESOLUTIONS),
  });
  sonder(dossier, { fichier: 'sonde-outils.mts', entrees: OUTILS, resolutions: RESOLUTIONS_ESM });
} finally {
  rmSync(dossier, { recursive: true, force: true });
}

const [archive] = JSON.parse(
  execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { encoding: 'utf8' }),
);
const livres = new Set(archive.files.map((fichier) => fichier.path));
const cibles = [
  ...Object.values(manifeste.bin),
  ...Object.values(manifeste.exports).flatMap((cible) =>
    JSON.stringify(cible)
      .match(/\.\/[^"]+/g)
      .map((chemin) => chemin.slice(2)),
  ),
];
for (const cible of cibles) {
  assert.ok(livres.has(cible), `l archive doit livrer ${cible}`);
}
for (const bin of Object.values(manifeste.bin)) {
  assert.ok(
    readFileSync(bin, 'utf8').startsWith('#!/usr/bin/env node\n'),
    `${bin} doit s exécuter par node`,
  );
}
const FICHIER_DE_TEST = /(^|\/)[^/]+\.(spec|test)\.[^/]+$/;
const TOUJOURS_LIVRES = new Set(['package.json', 'README.md']);
const estLivrable = (chemin) =>
  !FICHIER_DE_TEST.test(chemin) &&
  (TOUJOURS_LIVRES.has(chemin) ||
    manifeste.files.some((dossier) => chemin.startsWith(`${dossier}/`)));
assert.deepEqual(
  [...livres].filter((chemin) => !estLivrable(chemin)),
  [],
  `l archive ne livre que ${manifeste.files.join('/, ')}/, package.json et README.md, sans aucun fichier de test`,
);

console.log(
  `${manifeste.name} : entrées ESM et CJS résolues par leur nom de paquet, outils ESM chargés, exports déclarés égaux à ATTENDUS et OUTILS, déclarations lues en ${Object.keys(RESOLUTIONS).join(', ')} (outils en ${RESOLUTIONS_ESM.join(', ')}), archive de ${livres.size} fichiers livrant bin et entrées`,
);
