import { Candidate, ExtenderEntry, StarterEntry } from './analysis-output';
import { AnalysisGoal } from './analysis-goal';
import { AiSettings } from './ai-settings';
import { AnalysisScope } from './prompt';
import { AiErrorCode, Effort } from './providers';
import { StagedRecord } from './staged';

// The records an analysis leaves behind and the state shown while one runs.

/** A line the model mentions without writing it out (CR-006): never counted as found. */
export interface ExploredEntry {
  name: string;
  handCardIds: number[];
  extraDeckCardIds: number[];
  finalBoardCardIds: number[];
  routeName: string;
  note: string;
}

export type RunStatus = 'succeeded' | 'failed' | 'cancelled';

/** One analysis, as recorded (G22-6). Stored in the meta store, never in backups. */
export interface AnalysisRun {
  id: string;
  deckId: string;
  deckName: string;
  deckVersion: number;
  deckFingerprint: string;
  cardDataVersion: string;
  assumptions: string[];
  provider: AiSettings['provider'];
  model: string;
  servedModel?: string;
  /** ChatGPT plan usage: store/stream are fixed and max output is not supported (CR-005). */
  params: { effort?: Effort; maxOutputTokens?: number; timeoutSeconds: number; temperature?: number; store?: boolean; stream?: boolean; structuredOutput?: boolean };
  scope: AnalysisScope;
  /** CR-006: the goal as applied to this deck (absent in older records). */
  goal?: AnalysisGoal;
  promptVersion: string;
  cacheKey: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: RunStatus;
  error?: { code: AiErrorCode; message: string };
  usage?: { inputTokens: number; outputTokens: number; estimatedCostUsd?: number };
  summary?: string;
  starters?: StarterEntry[];
  extenders?: ExtenderEntry[];
  candidates?: Candidate[];
  explored?: ExploredEntry[];
  /** CR-008: the record of a phased analysis (absent for a one-shot analysis). */
  staged?: StagedRecord;
}

export type Phase = 'idle' | 'preparing' | 'requesting' | 'validating' | 'done' | 'failed' | 'cancelled';

export interface RunState {
  phase: Phase;
  startedAt?: number;
  receivedChars: number;
  runId?: string;
  fromCache?: boolean;
  message?: string;
  /** CR-008: which phase and combination a phased analysis is working on. */
  progress?: string;
}
