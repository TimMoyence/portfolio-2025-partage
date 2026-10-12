import type { StatutScore } from './score.js';

export const LOCALES_SUPPORTEES = Object.freeze(['fr', 'en'] as const);
export type SupportedLocale = (typeof LOCALES_SUPPORTEES)[number];

export interface ChampsAntiRobot {
  readonly website?: string;
  readonly formStartedAt?: number;
}

export interface ReponseDeCreation {
  readonly message: string;
  readonly httpCode: number;
}

export const PILLAR_KEYS = Object.freeze([
  'seo',
  'performance',
  'technical',
  'trust',
  'conversion',
  'aiVisibility',
  'citationWorthiness',
] as const);
export type PillarKey = (typeof PILLAR_KEYS)[number];

export const AUDIT_PROCESSING_STATUSES = Object.freeze([
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
] as const);
export type AuditProcessingStatus = (typeof AUDIT_PROCESSING_STATUSES)[number];

export type AuditContactMethod = 'EMAIL' | 'PHONE';

export interface AuditRequestPayload extends ChampsAntiRobot {
  readonly websiteName: string;
  readonly contactMethod: AuditContactMethod;
  readonly contactValue: string;
  readonly locale?: SupportedLocale;
}

export interface AuditCreateResponse extends ReponseDeCreation {
  readonly auditId: string;
  readonly status: AuditProcessingStatus;
}

export interface AuditSynthesis {
  readonly summaryText: string | null;
  readonly keyChecks: Readonly<Record<string, unknown>>;
  readonly quickWins: readonly string[];
  readonly pillarScores: Readonly<Record<string, number>>;
}

export interface AuditSummaryResponse extends AuditSynthesis {
  readonly auditId: string;
  readonly ready: boolean;
  readonly status: AuditProcessingStatus;
  readonly progress: number;
}

export type ReportSeverity = 'high' | 'medium' | 'low';

export interface ClientReportFinding {
  readonly title: string;
  readonly impact: string;
  readonly severity: ReportSeverity;
}

export interface ClientReportEngineScore {
  readonly score: number;
  readonly summary: string;
}

export interface ClientReportPillar {
  readonly pillar: string;
  readonly score: number;
  readonly target: number;
  readonly status: StatutScore;
}

export interface ClientReportQuickWin {
  readonly title: string;
  readonly businessImpact: string;
  readonly effort: ReportSeverity;
}

export interface ClientReportCta {
  readonly title: string;
  readonly description: string;
  readonly actionLabel: string;
}

export interface ClientReport {
  readonly executiveSummary: string;
  readonly topFindings: readonly ClientReportFinding[];
  readonly googleVsAiMatrix: {
    readonly googleVisibility: ClientReportEngineScore;
    readonly aiVisibility: ClientReportEngineScore;
  };
  readonly pillarScorecard: readonly ClientReportPillar[];
  readonly quickWins: readonly ClientReportQuickWin[];
  readonly cta: ClientReportCta;
}

export interface AuditProgressEvent {
  readonly auditId: string;
  readonly status: AuditProcessingStatus;
  readonly progress: number;
  readonly step: string | null;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly done: boolean;
  readonly updatedAt: string;
}

export interface AuditCompletedEvent extends AuditSynthesis {
  readonly auditId: string;
  readonly status: 'COMPLETED';
  readonly progress: number;
  readonly done: boolean;
  readonly clientReport: ClientReport | null;
  readonly updatedAt: string;
}

export interface AuditFailedEvent {
  readonly auditId: string;
  readonly status: 'FAILED';
  readonly progress: number;
  readonly done: boolean;
  readonly error: string | null;
  readonly updatedAt: string;
}

export interface AuditTimeoutEvent {
  readonly auditId: string;
  readonly status: 'TIMEOUT';
  readonly error: string;
  readonly updatedAt: string;
}

export type AuditStreamEvent =
  | { readonly type: 'progress'; readonly data: AuditProgressEvent }
  | { readonly type: 'completed'; readonly data: AuditCompletedEvent }
  | { readonly type: 'failed'; readonly data: AuditFailedEvent }
  | { readonly type: 'timeout'; readonly data: AuditTimeoutEvent }
  | { readonly type: 'heartbeat'; readonly data: { readonly ts: string } };

export const AI_LEVELS = Object.freeze(['debutant', 'intermediaire', 'avance'] as const);
export type AiLevel = (typeof AI_LEVELS)[number];

export const BUDGET_TIERS = Object.freeze(['0', '60', '120'] as const);
export type BudgetTier = (typeof BUDGET_TIERS)[number];

export interface InteractionProfile {
  readonly aiLevel: AiLevel | null;
  readonly toolsAlreadyUsed: readonly string[];
  readonly budgetTier: BudgetTier | null;
  readonly sector: string | null;
  readonly generatedPrompt: string | null;
}

export interface ToolkitRequest extends ChampsAntiRobot {
  readonly firstName: string;
  readonly email: string;
  readonly formationSlug: string;
  readonly termsVersion: string;
  readonly termsLocale: string;
  readonly termsAcceptedAt: string;
  readonly profile?: InteractionProfile;
}

export interface ToolkitResponse {
  readonly message: string;
  readonly accessToken?: string;
}

export interface CheatsheetEntry {
  readonly tool: string;
  readonly category: string;
  readonly price: string;
  readonly url: string;
  readonly tip: string;
  readonly decision: string;
  readonly alreadyUsed: boolean;
}

export interface PromptEntry {
  readonly category: string;
  readonly title: string;
  readonly level: AiLevel;
  readonly prompt: string;
  readonly tool: string;
  readonly description?: string;
  readonly example?: string;
  readonly tip?: string;
}

export interface WorkflowStep {
  readonly step: number;
  readonly action: string;
  readonly tool: string;
  readonly detail: string;
}

export interface WorkflowEntry {
  readonly title: string;
  readonly description: string;
  readonly setupTime: string;
  readonly monthlyCost: number;
  readonly steps: readonly WorkflowStep[];
  readonly tools: readonly string[];
}

export interface TemplateEntry {
  readonly name: string;
  readonly platform: string;
  readonly url: string;
  readonly description: string;
  readonly minBudget: number;
}

export interface ToolkitPage {
  readonly recap: {
    readonly firstName: string;
    readonly aiLevel: string | null;
    readonly sector: string | null;
    readonly budgetTier: string | null;
  };
  readonly cheatsheet: readonly CheatsheetEntry[];
  readonly prompts: readonly PromptEntry[];
  readonly workflows: readonly WorkflowEntry[];
  readonly templates: readonly TemplateEntry[];
  readonly generatedPrompt: string | null;
}

export interface ContactRequest extends ChampsAntiRobot {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly message: string;
  readonly phone?: string | null;
  readonly subject: string;
  readonly role: string;
  readonly terms: boolean;
  readonly termsVersion?: string;
  readonly termsLocale?: string;
  readonly termsMethod?: string;
  readonly termsAcceptedAt?: string;
}

export const COOKIE_CONSENT_SOURCES = Object.freeze(['banner', 'settings'] as const);
export type CookieConsentSource = (typeof COOKIE_CONSENT_SOURCES)[number];

export const COOKIE_CONSENT_ACTIONS = Object.freeze([
  'accept_all',
  'essential_only',
  'save_preferences',
  'withdraw',
] as const);
export type CookieConsentAction = (typeof COOKIE_CONSENT_ACTIONS)[number];

export interface CookieConsentPreferences {
  readonly essential: boolean;
  readonly preferences: boolean;
  readonly analytics: boolean;
  readonly marketing: boolean;
}

export interface CookieConsentPayload {
  readonly policyVersion: string;
  readonly locale: string;
  readonly region: string;
  readonly source: CookieConsentSource;
  readonly action: CookieConsentAction;
  readonly preferences: CookieConsentPreferences;
}

export interface PollInteraction {
  readonly type: 'poll';
  readonly question: string;
  readonly options: readonly string[];
  readonly multiSelect?: boolean;
}

export interface ReflectionInteraction {
  readonly type: 'reflection';
  readonly question: string;
  readonly placeholder: string;
  readonly rows?: number;
}

export interface SlideInteractions {
  readonly present?: readonly PollInteraction[];
  readonly scroll?: readonly ReflectionInteraction[];
}

export interface PresentationInteractions {
  readonly slug: string;
  readonly interactions: Readonly<Record<string, SlideInteractions>>;
}

export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string | null;
  readonly isActive: boolean;
  readonly roles: readonly string[];
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly updatedOrCreatedBy: string | null;
  readonly hasPassword: boolean;
  readonly emailVerified: boolean;
}

export interface AuthSession {
  readonly accessToken: string;
  readonly expiresIn: number;
  readonly user: AuthUser;
}

export interface AuthActionMessage {
  readonly message: string;
}

export interface LoginCredentials {
  readonly email: string;
  readonly password: string;
}

export interface GoogleAuthPayload {
  readonly idToken: string;
}

export interface RegisterUserPayload {
  readonly email: string;
  readonly password: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone?: string | null;
}

export interface ForgotPasswordPayload {
  readonly email: string;
}

export interface ResendVerificationPayload {
  readonly email: string;
}

export interface ResetPasswordPayload {
  readonly token: string;
  readonly newPassword: string;
}

export interface SetPasswordPayload {
  readonly newPassword: string;
}

export interface ChangePasswordPayload {
  readonly currentPassword: string;
  readonly newPassword: string;
}

export interface UpdateProfilePayload {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly phone?: string | null;
}
