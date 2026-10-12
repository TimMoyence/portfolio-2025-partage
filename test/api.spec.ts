import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  AI_LEVELS,
  AUDIT_PROCESSING_STATUSES,
  BUDGET_TIERS,
  COOKIE_CONSENT_ACTIONS,
  COOKIE_CONSENT_SOURCES,
  LOCALES_SUPPORTEES,
  PILLAR_KEYS,
  type AiLevel,
  type AuditCompletedEvent,
  type AuditStreamEvent,
  type AuthUser,
  type ClientReport,
  type ContactRequest,
  type PillarKey,
  type PresentationInteractions,
  type PromptEntry,
  type RegisterUserPayload,
  type SupportedLocale,
  type TemplateEntry,
  type ToolkitRequest,
  type WorkflowEntry,
} from '../src/api';
import type { StatutScore } from '../src/score';

const LISTES_FERMEES: readonly (readonly [string, readonly string[], readonly string[]])[] = [
  [
    'PILLAR_KEYS',
    PILLAR_KEYS,
    [
      'seo',
      'performance',
      'technical',
      'trust',
      'conversion',
      'aiVisibility',
      'citationWorthiness',
    ],
  ],
  [
    'AUDIT_PROCESSING_STATUSES',
    AUDIT_PROCESSING_STATUSES,
    ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'],
  ],
  ['AI_LEVELS', AI_LEVELS, ['debutant', 'intermediaire', 'avance']],
  ['BUDGET_TIERS', BUDGET_TIERS, ['0', '60', '120']],
  ['COOKIE_CONSENT_SOURCES', COOKIE_CONSENT_SOURCES, ['banner', 'settings']],
  [
    'COOKIE_CONSENT_ACTIONS',
    COOKIE_CONSENT_ACTIONS,
    ['accept_all', 'essential_only', 'save_preferences', 'withdraw'],
  ],
  ['LOCALES_SUPPORTEES', LOCALES_SUPPORTEES, ['fr', 'en']],
];

describe('api — listes fermées', () => {
  it.each(LISTES_FERMEES)('%s porte exactement ses valeurs', (_nom, liste, attendu) => {
    expect(liste).toEqual(attendu);
  });

  it.each(LISTES_FERMEES)('%s est gelée', (_nom, liste) => {
    expect(Object.isFrozen(liste)).toBe(true);
  });

  it('chaque type fermé est l union de sa liste', () => {
    expectTypeOf<PillarKey>().toEqualTypeOf<(typeof PILLAR_KEYS)[number]>();
    expectTypeOf<AiLevel>().toEqualTypeOf<'debutant' | 'intermediaire' | 'avance'>();
    expectTypeOf<SupportedLocale>().toEqualTypeOf<'fr' | 'en'>();
  });
});

describe('api — formes du fil', () => {
  it('la page toolkit sert des montants en nombres et un niveau fermé', () => {
    expectTypeOf<WorkflowEntry['monthlyCost']>().toEqualTypeOf<number>();
    expectTypeOf<TemplateEntry['minBudget']>().toEqualTypeOf<number>();
    expectTypeOf<PromptEntry['level']>().toEqualTypeOf<AiLevel>();
  });

  it('les dates d une demande voyagent en chaînes', () => {
    expectTypeOf<ToolkitRequest['termsAcceptedAt']>().toEqualTypeOf<string>();
    expectTypeOf<ContactRequest['termsAcceptedAt']>().toEqualTypeOf<string | undefined>();
  });

  it('le flux de l audit nomme chacun de ses événements, délai dépassé compris', () => {
    expectTypeOf<AuditStreamEvent['type']>().toEqualTypeOf<
      'progress' | 'completed' | 'failed' | 'timeout' | 'heartbeat'
    >();
    expectTypeOf<AuditCompletedEvent['clientReport']>().toEqualTypeOf<ClientReport | null>();
    expectTypeOf<ClientReport['pillarScorecard'][number]['status']>().toEqualTypeOf<StatutScore>();
  });

  it('l utilisateur servi dit s il a un mot de passe et une adresse vérifiée', () => {
    expectTypeOf<AuthUser['hasPassword']>().toEqualTypeOf<boolean>();
    expectTypeOf<AuthUser['emailVerified']>().toEqualTypeOf<boolean>();
    expectTypeOf<RegisterUserPayload>().not.toHaveProperty('roles');
  });

  it('une présentation sert ses interactions par écran', () => {
    expectTypeOf<keyof PresentationInteractions['interactions']>().toEqualTypeOf<string>();
  });
});
