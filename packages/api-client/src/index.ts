import {
    createSimulationRequestV1,
    eventEnvelopeV1,
    logPageV1,
    modelListV1,
    operationV1,
    playerActionRequestV1,
    problemDetailsV1,
    providerCatalogEntryV1,
    providerCreateRequestV1,
    providerMappingV1,
    providerSummaryV1,
    providerUpdateRequestV1,
    renameSimulationRequestV1,
    scenarioV1,
    simulationSnapshotV1,
    simulationSummaryV1,
    stepSimulationRequestV1,
} from "@omnia/api-contracts";
import type {
    CreateSimulationRequestV1,
    EventEnvelopeV1,
    LogPageV1,
    ModelListV1,
    OperationV1,
    PlayerActionRequestV1,
    ProblemDetailsV1,
    ProviderCatalogEntryV1,
    ProviderCreateRequestV1,
    ProviderMappingV1,
    ProviderSummaryV1,
    ProviderUpdateRequestV1,
    RenameSimulationRequestV1,
    ScenarioV1,
    SimulationSnapshotV1,
    SimulationSummaryV1,
    StepSimulationRequestV1,
} from "@omnia/api-contracts";

export interface ApiClientOptions {
    baseUrl: string;
    token?: string;
    fetch?: typeof globalThis.fetch;
    requestIdFactory?: () => string;
}

export interface ListResponse<T> {
    items: T[];
    page: {
        nextCursor: string | null;
        hasMore: boolean;
    };
}

export class ApiClientError extends Error {
    readonly status: number;
    readonly problem: ProblemDetailsV1 | null;

    constructor(status: number, message: string, problem: ProblemDetailsV1 | null) {
        super(message);
        this.name = "ApiClientError";
        this.status = status;
        this.problem = problem;
    }
}

export class OmniaApiClient {
    private readonly baseUrl: string;
    private readonly token?: string;
    private readonly fetchImpl: typeof globalThis.fetch;
    private readonly requestIdFactory: () => string;

    constructor(options: ApiClientOptions) {
        this.baseUrl = options.baseUrl.replace(/\/$/, "");
        this.token = options.token;
        this.fetchImpl = options.fetch ?? globalThis.fetch;
        this.requestIdFactory =
            options.requestIdFactory ?? (() => crypto.randomUUID());
    }

    async listSimulations(query: { cursor?: string; limit?: number } = {}): Promise<ListResponse<SimulationSummaryV1>> {
        const params = new URLSearchParams();
        if (query.cursor) params.set("cursor", query.cursor);
        if (query.limit !== undefined) params.set("limit", String(query.limit));
        const result = await this.request<unknown>(
            `/api/v1/simulations${params.size ? `?${params}` : ""}`,
        );
        return parseOrThrow(
            simulationListResponseV1,
            result,
            "Invalid simulation list response",
        );
    }

    async createSimulation(
        input: CreateSimulationRequestV1,
        options: { idempotencyKey?: string } = {},
    ): Promise<SimulationSnapshotV1 | OperationV1> {
        const body = createSimulationRequestV1.parse(input);
        const result = await this.request<unknown>("/api/v1/simulations", {
            method: "POST",
            body,
            idempotencyKey: options.idempotencyKey,
        });
        return parseOrThrow(
            simulationSnapshotV1.or(operationV1),
            result,
            "Invalid create simulation response",
        );
    }

    async getSimulation(id: string): Promise<SimulationSnapshotV1> {
        const result = await this.request<unknown>(`/api/v1/simulations/${encodeURIComponent(id)}`);
        return parseOrThrow(simulationSnapshotV1, result, "Invalid simulation response");
    }

    async renameSimulation(
        id: string,
        input: RenameSimulationRequestV1,
        options: { etag: string; idempotencyKey?: string },
    ): Promise<SimulationSnapshotV1> {
        const body = renameSimulationRequestV1.parse(input);
        const result = await this.request<unknown>(
            `/api/v1/simulations/${encodeURIComponent(id)}`,
            { method: "PATCH", body, etag: options.etag, idempotencyKey: options.idempotencyKey },
        );
        return parseOrThrow(simulationSnapshotV1, result, "Invalid rename simulation response");
    }

    async deleteSimulation(
        id: string,
        options: { etag: string; idempotencyKey?: string },
    ): Promise<void> {
        await this.request<unknown>(`/api/v1/simulations/${encodeURIComponent(id)}`, {
            method: "DELETE",
            etag: options.etag,
            idempotencyKey: options.idempotencyKey,
        });
    }

    async stepSimulation(
        id: string,
        input: StepSimulationRequestV1 = {},
        options: { etag: string; idempotencyKey?: string },
    ): Promise<OperationV1> {
        const body = stepSimulationRequestV1.parse(input);
        const result = await this.request<unknown>(
            `/api/v1/simulations/${encodeURIComponent(id)}/steps`,
            { method: "POST", body, etag: options.etag, idempotencyKey: options.idempotencyKey },
        );
        return parseOrThrow(operationV1, result, "Invalid step operation response");
    }

    async submitPlayerAction(
        id: string,
        input: PlayerActionRequestV1,
        options: { etag: string; idempotencyKey?: string },
    ): Promise<OperationV1> {
        const body = playerActionRequestV1.parse(input);
        const result = await this.request<unknown>(
            `/api/v1/simulations/${encodeURIComponent(id)}/player-actions`,
            { method: "POST", body, etag: options.etag, idempotencyKey: options.idempotencyKey },
        );
        return parseOrThrow(operationV1, result, "Invalid player action operation response");
    }

    async listSimulationLogs(
        id: string,
        query: { cursor?: string; limit?: number } = {},
    ): Promise<LogPageV1> {
        const params = new URLSearchParams();
        if (query.cursor) params.set("cursor", query.cursor);
        if (query.limit !== undefined) params.set("limit", String(query.limit));
        const result = await this.request<unknown>(
            `/api/v1/simulations/${encodeURIComponent(id)}/logs${params.size ? `?${params}` : ""}`,
        );
        return parseOrThrow(logPageV1, result, "Invalid log page response");
    }

    async getOperation(id: string): Promise<OperationV1> {
        const result = await this.request<unknown>(`/api/v1/operations/${encodeURIComponent(id)}`);
        return parseOrThrow(operationV1, result, "Invalid operation response");
    }

    async cancelOperation(id: string): Promise<OperationV1> {
        const result = await this.request<unknown>(`/api/v1/operations/${encodeURIComponent(id)}`, {
            method: "DELETE",
        });
        return parseOrThrow(operationV1, result, "Invalid cancellation response");
    }

    async listScenarios(): Promise<ScenarioV1[]> {
        const result = await this.request<unknown>("/api/v1/scenarios");
        return parseOrThrow(zArray(scenarioV1), result, "Invalid scenarios response");
    }

    async listProviders(): Promise<ProviderSummaryV1[]> {
        const result = await this.request<unknown>("/api/v1/admin/providers");
        return parseOrThrow(zArray(providerSummaryV1), result, "Invalid providers response");
    }

    async createProvider(input: ProviderCreateRequestV1): Promise<ProviderSummaryV1> {
        const result = await this.request<unknown>("/api/v1/admin/providers", {
            method: "POST",
            body: providerCreateRequestV1.parse(input),
        });
        return parseOrThrow(providerSummaryV1, result, "Invalid provider response");
    }

    async updateProvider(id: string, input: ProviderUpdateRequestV1): Promise<ProviderSummaryV1> {
        const result = await this.request<unknown>(`/api/v1/admin/providers/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: providerUpdateRequestV1.parse(input),
        });
        return parseOrThrow(providerSummaryV1, result, "Invalid provider response");
    }

    async listProviderMappings(): Promise<ProviderMappingV1> {
        const result = await this.request<unknown>("/api/v1/admin/provider-mappings");
        return parseOrThrow(providerMappingV1, result, "Invalid provider mappings response");
    }

    async listProviderCatalog(): Promise<ProviderCatalogEntryV1[]> {
        const result = await this.request<unknown>("/api/v1/admin/provider-catalog");
        return parseOrThrow(zArray(providerCatalogEntryV1), result, "Invalid provider catalog response");
    }

    async discoverModelsForProvider(id: string): Promise<ModelListV1> {
        const result = await this.request<unknown>(`/api/v1/admin/providers/${encodeURIComponent(id)}/models`);
        return parseOrThrow(modelListV1, result, "Invalid model discovery response");
    }

    async *events(signal?: AbortSignal): AsyncGenerator<EventEnvelopeV1> {
        const response = await this.fetchRequest("/api/v1/events", { signal });
        if (!response.body) throw new Error("API event stream has no body");
        yield* parseEventStream(response.body, eventEnvelopeV1, signal);
    }

    async *simulationEvents(id: string, signal?: AbortSignal): AsyncGenerator<EventEnvelopeV1> {
        const response = await this.fetchRequest(
            `/api/v1/simulations/${encodeURIComponent(id)}/events`,
            { signal },
        );
        if (!response.body) throw new Error("Simulation event stream has no body");
        yield* parseEventStream(response.body, eventEnvelopeV1, signal);
    }

    private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
        const response = await this.fetchRequest(path, options);
        if (response.status === 204) return undefined as T;
        return (await response.json()) as T;
    }

    private async fetchRequest(path: string, options: RequestOptions = {}): Promise<Response> {
        const headers = new Headers(options.headers);
        headers.set("Accept", "application/json");
        headers.set("X-Request-Id", this.requestIdFactory());
        if (options.body !== undefined) {
            headers.set("Content-Type", "application/json");
        }
        if (this.token) headers.set("Authorization", `Bearer ${this.token}`);
        if (options.etag) headers.set("If-Match", options.etag);
        if (options.idempotencyKey) headers.set("Idempotency-Key", options.idempotencyKey);

        const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
            method: options.method ?? "GET",
            headers,
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
            signal: options.signal,
        });
        if (!response.ok) {
            const contentType = response.headers.get("content-type") ?? "";
            const problem = contentType.includes("application/problem+json")
                ? parseOrNull(problemDetailsV1, await response.json())
                : null;
            throw new ApiClientError(
                response.status,
                problem?.detail ?? `Omnia API request failed with status ${response.status}`,
                problem,
            );
        }
        return response;
    }
}

interface RequestOptions {
    method?: string;
    body?: unknown;
    headers?: HeadersInit;
    etag?: string;
    idempotencyKey?: string;
    signal?: AbortSignal;
}

const zArray = <T extends z.ZodType>(item: T) => z.array(item);

import { z } from "zod";

const simulationListResponseV1 = z.object({
    items: z.array(simulationSummaryV1),
    page: z.object({ nextCursor: z.string().nullable(), hasMore: z.boolean() }),
});

function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown, message: string): T {
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new Error(`${message}: ${parsed.error.message}`);
    return parsed.data;
}

function parseOrNull<T>(schema: z.ZodType<T>, input: unknown): T | null {
    const parsed = schema.safeParse(input);
    return parsed.success ? parsed.data : null;
}

async function* parseEventStream<T>(
    body: ReadableStream<Uint8Array>,
    schema: z.ZodType<T>,
    signal?: AbortSignal,
): AsyncGenerator<T> {
    const reader = body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    try {
        while (!signal?.aborted) {
            const result = await reader.read();
            if (result.done) break;
            buffer += result.value;
            const frames = buffer.split("\n\n");
            buffer = frames.pop() ?? "";
            for (const frame of frames) {
                const data = frame
                    .split("\n")
                    .filter((line) => line.startsWith("data:"))
                    .map((line) => line.slice(5).trimStart())
                    .join("\n");
                if (!data) continue;
                yield parseOrThrow(schema, JSON.parse(data), "Invalid API event");
            }
        }
    } finally {
        await reader.cancel();
    }
}

export type {
    CreateSimulationRequestV1,
    EventEnvelopeV1,
    LogPageV1,
    OperationV1,
    PlayerActionRequestV1,
    ProblemDetailsV1,
    ProviderCatalogEntryV1,
    ModelListV1,
    ProviderCreateRequestV1,
    ProviderMappingV1,
    ProviderSummaryV1,
    ProviderUpdateRequestV1,
    RenameSimulationRequestV1,
    ScenarioV1,
    SimulationSnapshotV1,
    SimulationSummaryV1,
    StepSimulationRequestV1,
};
