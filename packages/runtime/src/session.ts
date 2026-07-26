import type Database from "better-sqlite3";
import type { SQLiteRepository } from "@omnia/core";
import type { BufferRepository, LedgerRepository } from "@omnia/memory";
import type { Architect, AliasDeltaGenerator } from "@omnia/architect";
import type { ILLMProvider, IEmbeddingProvider } from "@omnia/llm";
import type {
    EntityInfo,
    LogEntry,
    RuntimeStatus,
    WaitingContext,
} from "./snapshot.js";

export interface SavedSessionState {
    scenarioName: string;
    scenarioDescription: string;
    turn: number;
    maxTurns: number;
    entities: EntityInfo[];
    playerEntityId: string | undefined;
    entityIndex: number;
    status: RuntimeStatus;
    error?: string;
    waitingEntity?: WaitingContext;
    aliasDoneForTurn: boolean;
    log: LogEntry[];
    providerMappings: Record<string, string>;
}

export interface RuntimeSession extends SavedSessionState {
    db: Database.Database;
    dbPath: string;
    coreRepo: SQLiteRepository;
    bufferRepo: BufferRepository;
    ledgerRepo: LedgerRepository;
    worldInstanceId: string;
    actorProvider: ILLMProvider;
    validatorProvider: ILLMProvider;
    decoderProvider: ILLMProvider;
    timedeltaProvider: ILLMProvider;
    handoffProvider: ILLMProvider;
    embeddingProvider: IEmbeddingProvider;
    architect: Architect;
    aliasGenerator: AliasDeltaGenerator;
}

/** @deprecated Use RuntimeSession. */
export type SimSession = RuntimeSession;
/** @deprecated Use SavedSessionState. */
export type SavedState = SavedSessionState;
