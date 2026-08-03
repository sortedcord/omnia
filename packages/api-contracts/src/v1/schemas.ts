import { z } from "zod";

export const apiVersionV1 = z.literal("1");

export const runtimeStatusV1 = z.enum([
    "running",
    "waiting_player",
    "done",
    "error",
]);

export const simulationIdV1 = z.string().regex(
    /^(?:sim-[0-9]+|[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i,
    "Invalid simulation identifier",
);

export const operationIdV1 = z.string().regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    "Invalid operation identifier",
);

export const isoTimestampV1 = z.string().datetime({ offset: true });

export const entityV1 = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    isPlayer: z.boolean(),
    isAgent: z.boolean(),
    aliases: z.record(z.string(), z.string()).nullable(),
});

export const intentV1 = z.object({
    type: z.string().min(1),
    content: z.string(),
    modifiers: z.array(z.string()),
    targetIds: z.array(z.string()),
    isValid: z.boolean().nullable(),
    reason: z.string().nullable(),
    minutesToAdvance: z.number().nullable(),
});

export const tokenUsageV1 = z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
    modelName: z.string().nullable(),
    providerInstanceName: z.string().nullable(),
    maxContext: z.number().int().nonnegative().nullable(),
});

export const handoffChunkV1 = z.object({
    content: z.string(),
    importance: z.number(),
    quotes: z.array(z.string()).nullable(),
    retainInBuffer: z.boolean().nullable(),
    involvedEntityIds: z.array(z.string()).nullable(),
});

/** Public log data intentionally excludes prompts and model diagnostic payloads. */
export const logEntryV1 = z.object({
    turn: z.number().int().nonnegative(),
    entityId: z.string().min(1),
    entityName: z.string().min(1),
    narrativeProse: z.string(),
    intents: z.array(intentV1),
    timestamp: isoTimestampV1,
    isHandoff: z.boolean(),
    handoffResult: z.object({ chunks: z.array(handoffChunkV1) }).nullable(),
    decodedIntents: z.array(intentV1).nullable(),
    usage: tokenUsageV1.nullable(),
});

/** Public player context deliberately contains no prompt material. */
export const waitingPlayerV1 = z.object({
    entityId: z.string().min(1),
    name: z.string().min(1),
});

export const simulationSummaryV1 = z.object({
    apiVersion: apiVersionV1,
    id: simulationIdV1,
    status: runtimeStatusV1,
    turn: z.number().int().nonnegative(),
    maxTurns: z.number().int().positive(),
    scenarioName: z.string(),
    scenarioDescription: z.string(),
    entityCount: z.number().int().nonnegative(),
    updatedAt: isoTimestampV1.nullable(),
});

export const simulationSnapshotV1 = z.object({
    apiVersion: apiVersionV1,
    id: simulationIdV1,
    status: runtimeStatusV1,
    turn: z.number().int().nonnegative(),
    maxTurns: z.number().int().positive(),
    scenarioName: z.string(),
    scenarioDescription: z.string(),
    entities: z.array(entityV1),
    entityIndex: z.number().int().nonnegative(),
    waitingPlayer: waitingPlayerV1.nullable(),
    error: z.string().nullable(),
    worldTime: isoTimestampV1.nullable(),
    currentLocation: z.string().nullable(),
    revision: z.number().int().nonnegative().nullable(),
    updatedAt: isoTimestampV1.nullable(),
});

export const pageInfoV1 = z.object({
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
});

export const logPageV1 = z.object({
    items: z.array(logEntryV1),
    page: pageInfoV1,
});

export const createSimulationRequestV1 = z.object({
    scenarioId: z.string().min(1).max(128),
    playEntity: z.string().min(1).max(256).nullable().optional(),
    providerInstanceId: z.string().min(1).max(256).nullable().optional(),
    customName: z.string().trim().min(1).max(256).nullable().optional(),
});

export const renameSimulationRequestV1 = z.object({
    name: z.string().trim().min(1).max(256),
});

export const playerActionRequestV1 = z.object({
    prose: z.string().trim().min(1).max(32_000),
});

export const stepSimulationRequestV1 = z.object({
    waitForCompletion: z.boolean().default(false),
});

export const providerTypeV1 = z.enum(["generative", "embedding"]);

export const providerSummaryV1 = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    providerName: z.string().min(1),
    hasCredential: z.boolean(),
    isActive: z.boolean(),
    modelName: z.string().nullable(),
    type: providerTypeV1,
    maxContext: z.number().int().nonnegative().nullable(),
    endpointUrl: z.string().url().nullable(),
});

/** Credentials are accepted on writes only and are never part of provider reads. */
export const providerCredentialInputV1 = z.object({
    apiKey: z.string().max(16_384).nullable().optional(),
});

export const providerCreateRequestV1 = providerCredentialInputV1.extend({
    name: z.string().trim().min(1).max(256),
    providerName: z.string().min(1).max(128),
    modelName: z.string().trim().max(256).nullable().optional(),
    type: providerTypeV1.default("generative"),
    maxContext: z.number().int().positive().nullable().optional(),
    endpointUrl: z.string().url().nullable().optional(),
});

export const providerUpdateRequestV1 = providerCreateRequestV1.partial().extend({
    apiKey: z.string().max(16_384).nullable().optional(),
});

export const providerMappingV1 = z.record(z.string().min(1), z.string().min(1));

export const modelV1 = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    ownedBy: z.string().nullable(),
});

export const modelListV1 = z.array(modelV1);

export const providerCatalogEntryV1 = z.object({
    id: z.string().min(1),
    displayName: z.string().min(1),
    description: z.string(),
    defaultModel: z.string(),
    defaultEmbeddingModel: z.string(),
});

export const scenarioV1 = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string(),
    entities: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) })),
});

export const operationStatusV1 = z.enum([
    "queued",
    "running",
    "completed",
    "failed",
    "cancelled",
]);

export const operationV1 = z.object({
    apiVersion: apiVersionV1,
    id: operationIdV1,
    kind: z.enum(["step", "run", "player_action", "embedding_regeneration"]),
    status: operationStatusV1,
    progress: z.number().min(0).max(1).nullable(),
    resultSimulationId: simulationIdV1.nullable(),
    errorCode: z.string().nullable(),
    createdAt: isoTimestampV1,
    updatedAt: isoTimestampV1,
});

export const problemDetailsV1 = z.object({
    type: z.string().url(),
    title: z.string().min(1),
    status: z.number().int().min(400).max(599),
    detail: z.string(),
    instance: z.string().nullable(),
    code: z.string().min(1),
    requestId: z.string().min(1),
});

export const eventTypeV1 = z.enum([
    "simulation.created",
    "simulation.status.changed",
    "simulation.turn.started",
    "simulation.turn.completed",
    "simulation.player_input.requested",
    "simulation.player_action.accepted",
    "simulation.log_entry.appended",
    "simulation.completed",
    "simulation.failed",
    "operation.progress",
    "operation.completed",
    "operation.failed",
    "operation.cancelled",
]);

export const eventEnvelopeV1 = z.object({
    apiVersion: apiVersionV1,
    eventId: z.string().min(1),
    sequence: z.number().int().nonnegative(),
    revision: z.number().int().nonnegative().nullable(),
    occurredAt: isoTimestampV1,
    type: eventTypeV1,
    simulationId: simulationIdV1.nullable(),
    operationId: operationIdV1.nullable(),
    data: z.unknown(),
});

export const listQueryV1 = z.object({
    cursor: z.string().max(512).nullable().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type ApiVersionV1 = z.infer<typeof apiVersionV1>;
export type RuntimeStatusV1 = z.infer<typeof runtimeStatusV1>;
export type SimulationIdV1 = z.infer<typeof simulationIdV1>;
export type OperationIdV1 = z.infer<typeof operationIdV1>;
export type EntityV1 = z.infer<typeof entityV1>;
export type IntentV1 = z.infer<typeof intentV1>;
export type LogEntryV1 = z.infer<typeof logEntryV1>;
export type SimulationSummaryV1 = z.infer<typeof simulationSummaryV1>;
export type SimulationSnapshotV1 = z.infer<typeof simulationSnapshotV1>;
export type CreateSimulationRequestV1 = z.infer<typeof createSimulationRequestV1>;
export type RenameSimulationRequestV1 = z.infer<typeof renameSimulationRequestV1>;
export type PlayerActionRequestV1 = z.infer<typeof playerActionRequestV1>;
export type StepSimulationRequestV1 = z.infer<typeof stepSimulationRequestV1>;
export type ProviderSummaryV1 = z.infer<typeof providerSummaryV1>;
export type ProviderCreateRequestV1 = z.infer<typeof providerCreateRequestV1>;
export type ProviderUpdateRequestV1 = z.infer<typeof providerUpdateRequestV1>;
export type ProviderMappingV1 = z.infer<typeof providerMappingV1>;
export type ModelV1 = z.infer<typeof modelV1>;
export type ModelListV1 = z.infer<typeof modelListV1>;
export type ProviderCatalogEntryV1 = z.infer<typeof providerCatalogEntryV1>;
export type ScenarioV1 = z.infer<typeof scenarioV1>;
export type OperationV1 = z.infer<typeof operationV1>;
export type ProblemDetailsV1 = z.infer<typeof problemDetailsV1>;
export type EventEnvelopeV1 = z.infer<typeof eventEnvelopeV1>;
export type ListQueryV1 = z.infer<typeof listQueryV1>;
