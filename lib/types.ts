/* Shared shapes of Visible. Pure types — safe on client and server. */

export interface BusinessProfile {
  name: string;
  website: string;
  domain: string;
  /** What the business is, in plain words: "dentist", "italian restaurant". */
  category: string;
  /** The main thing customers buy, plural/plain: "teeth whitening", "pizza". Optional. */
  service: string;
  city: string;
  /** ISO 3166-1 alpha-2, e.g. "US", "GB", "NL". */
  country: string;
  /** "local" businesses get questions with a place; "online" ones without. */
  reach: "local" | "online";
  /** Which values the owner confirmed (the scan only guessed the others). */
  confirmed: boolean;
}

export type CheckStatus = "good" | "improve" | "missing";

export interface ReadinessCheck {
  id: string;
  group: GroupId;
  label: string;
  status: CheckStatus;
  /** What this means for the owner, one sentence. */
  why: string;
  /** What to do about it, one sentence. */
  fix: string;
  /** Proof: the page or file where it was (not) found. */
  evidence?: string;
  weight: number;
}

export type GroupId = "read" | "understand" | "trust" | "answers";

export interface Readiness {
  score: number;
  groups: { id: GroupId; title: string; score: number }[];
  checks: ReadinessCheck[];
  pagesRead: number;
}

export interface Question {
  id: string;
  text: string;
  /** Short plain label: "Best in town", "Near me", "Price". */
  intent: string;
}

export type Mention = "named" | "linked" | "absent";

export interface AnswerRecord {
  questionId: string;
  question: string;
  text: string;
  sources: string[];
  /** Businesses the AI recommended, in order. */
  businesses: { name: string; website?: string }[];
  mention: Mention;
  /** 1-based place in the list of recommended businesses, when named. */
  position?: number;
  askedAt: string;
  model: string;
  costUsd: number;
  cached: boolean;
}

export interface Round {
  id: string;
  scanId: string;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "done" | "stopped";
  /** Official rounds count for scores and history. Demo rounds (sample answers) never do. */
  kind: "official" | "demo";
  questionIds: string[];
  answers: AnswerRecord[];
  error?: string;
  costUsd: number;
  triggeredBy: "visitor" | "account" | "schedule";
}

export interface Scan {
  id: string;
  createdAt: string;
  updatedAt: string;
  profile: BusinessProfile;
  readiness: Readiness;
  questions: Question[];
  /** Account that saved this scan (absent for anonymous scans). */
  ownerId?: string;
  /** Latest official round id, and the history of official round summaries. */
  lastRoundId?: string;
  /** The round shown on the result page (latest official, or a sample round in development). */
  viewRoundId?: string;
  history: RoundSummary[];
  /** Hash of the anonymous visitor key that may open this scan before it is saved to an account. */
  visitorHash: string;
}

export interface RoundSummary {
  roundId: string;
  date: string;
  named: number;
  total: number;
  readiness: number;
}

export interface CompetitorRow {
  name: string;
  website?: string;
  count: number;
  isYou: boolean;
}
