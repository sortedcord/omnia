import { toJSONSchema, z } from "zod";
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
} from "./schemas.js";

export interface OpenApiDocumentV1 {
    openapi: "3.1.0";
    info: {
        title: string;
        version: string;
        description: string;
    };
    jsonSchemaDialect: string;
    paths: Record<string, unknown>;
    components: {
        schemas: Record<string, unknown>;
        responses: Record<string, unknown>;
        parameters: Record<string, unknown>;
        securitySchemes: Record<string, unknown>;
    };
}

function schema(input: unknown): unknown {
    return toJSONSchema(input as Parameters<typeof toJSONSchema>[0], {
        target: "draft-2020-12",
    });
}

const jsonContent = (schemaName: string, status = "200") => ({
    [status]: {
        description: "JSON response",
        content: {
            "application/json": {
                schema: { $ref: `#/components/schemas/${schemaName}` },
            },
        },
    },
});

export const openApiDocumentV1: OpenApiDocumentV1 = {
    openapi: "3.1.0",
    info: {
        title: "Omnia API",
        version: "1.0.0",
        description: "Versioned REST contract for Omnia runtime and administration.",
    },
    jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
    paths: {
        "/api/v1/simulations": {
            get: {
                operationId: "listSimulations",
                security: [{ bearerAuth: [] }],
                responses: jsonContent("SimulationSummaryPageV1"),
            },
            post: {
                operationId: "createSimulation",
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/CreateSimulationRequestV1" },
                        },
                    },
                },
                responses: {
                    ...jsonContent("SimulationSnapshotV1", "201"),
                    "400": { $ref: "#/components/responses/ProblemDetails" },
                },
            },
        },
        "/api/v1/simulations/{simulationId}": {
            get: {
                operationId: "getSimulation",
                security: [{ bearerAuth: [] }],
                parameters: [{ $ref: "#/components/parameters/SimulationId" }],
                responses: {
                    ...jsonContent("SimulationSnapshotV1"),
                    "404": { $ref: "#/components/responses/ProblemDetails" },
                },
            },
            patch: {
                operationId: "renameSimulation",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { $ref: "#/components/parameters/SimulationId" },
                    { $ref: "#/components/parameters/IfMatch" },
                ],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/RenameSimulationRequestV1" },
                        },
                    },
                },
                responses: jsonContent("SimulationSnapshotV1"),
            },
            delete: {
                operationId: "deleteSimulation",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { $ref: "#/components/parameters/SimulationId" },
                    { $ref: "#/components/parameters/IfMatch" },
                ],
                responses: { "204": { description: "Simulation deleted" } },
            },
        },
        "/api/v1/simulations/{simulationId}/steps": {
            post: {
                operationId: "stepSimulation",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { $ref: "#/components/parameters/SimulationId" },
                    { $ref: "#/components/parameters/IfMatch" },
                    { $ref: "#/components/parameters/IdempotencyKey" },
                ],
                requestBody: {
                    required: false,
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/StepSimulationRequestV1" },
                        },
                    },
                },
                responses: jsonContent("OperationV1", "202"),
            },
        },
        "/api/v1/simulations/{simulationId}/player-actions": {
            post: {
                operationId: "submitPlayerAction",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { $ref: "#/components/parameters/SimulationId" },
                    { $ref: "#/components/parameters/IfMatch" },
                    { $ref: "#/components/parameters/IdempotencyKey" },
                ],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/PlayerActionRequestV1" },
                        },
                    },
                },
                responses: jsonContent("OperationV1", "202"),
            },
        },
        "/api/v1/simulations/{simulationId}/logs": {
            get: {
                operationId: "listSimulationLogs",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { $ref: "#/components/parameters/SimulationId" },
                    { $ref: "#/components/parameters/Cursor" },
                    { $ref: "#/components/parameters/Limit" },
                ],
                responses: jsonContent("LogPageV1"),
            },
        },
        "/api/v1/simulations/{simulationId}/events": {
            get: {
                operationId: "subscribeSimulationEvents",
                security: [{ bearerAuth: [] }],
                parameters: [{ $ref: "#/components/parameters/SimulationId" }],
                responses: {
                    "200": {
                        description: "Server-sent event stream",
                        content: { "text/event-stream": { schema: { type: "string" } } },
                    },
                },
            },
        },
        "/api/v1/operations/{operationId}": {
            get: {
                operationId: "getOperation",
                security: [{ bearerAuth: [] }],
                parameters: [{ $ref: "#/components/parameters/OperationId" }],
                responses: jsonContent("OperationV1"),
            },
            delete: {
                operationId: "cancelOperation",
                security: [{ bearerAuth: [] }],
                parameters: [{ $ref: "#/components/parameters/OperationId" }],
                responses: jsonContent("OperationV1"),
            },
        },
        "/api/v1/scenarios": {
            get: {
                operationId: "listScenarios",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": {
                        description: "Available scenarios",
                        content: {
                            "application/json": {
                                schema: { type: "array", items: { $ref: "#/components/schemas/ScenarioV1" } },
                            },
                        },
                    },
                },
            },
        },
        "/api/v1/admin/providers": {
            get: {
                operationId: "listProviders",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": {
                        description: "Redacted provider configurations",
                        content: {
                            "application/json": {
                                schema: { type: "array", items: { $ref: "#/components/schemas/ProviderSummaryV1" } },
                            },
                        },
                    },
                },
            },
            post: {
                operationId: "createProvider",
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/ProviderCreateRequestV1" },
                        },
                    },
                },
                responses: jsonContent("ProviderSummaryV1", "201"),
            },
        },
        "/api/v1/events": {
            get: {
                operationId: "subscribeEvents",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": {
                        description: "Server-sent event stream",
                        content: { "text/event-stream": { schema: { type: "string" } } },
                    },
                },
            },
        },
    },
    components: {
        schemas: {
            CreateSimulationRequestV1: schema(createSimulationRequestV1),
            RenameSimulationRequestV1: schema(renameSimulationRequestV1),
            PlayerActionRequestV1: schema(playerActionRequestV1),
            StepSimulationRequestV1: schema(stepSimulationRequestV1),
            SimulationSummaryV1: schema(simulationSummaryV1),
            SimulationSnapshotV1: schema(simulationSnapshotV1),
            SimulationSummaryPageV1: schema(
                z.object({ items: z.array(simulationSummaryV1), page: z.object({ nextCursor: z.string().nullable(), hasMore: z.boolean() }) }),
            ),
            LogPageV1: schema(logPageV1),
            OperationV1: schema(operationV1),
            ProviderSummaryV1: schema(providerSummaryV1),
            ProviderCreateRequestV1: schema(providerCreateRequestV1),
            ProviderUpdateRequestV1: schema(providerUpdateRequestV1),
            ProviderMappingV1: schema(providerMappingV1),
            ProviderCatalogEntryV1: schema(providerCatalogEntryV1),
            ScenarioV1: schema(scenarioV1),
            EventEnvelopeV1: schema(eventEnvelopeV1),
            ModelListV1: schema(modelListV1),
            ProblemDetailsV1: schema(problemDetailsV1),
        },
        responses: {
            ProblemDetails: {
                description: "RFC 9457 problem details",
                content: {
                    "application/problem+json": {
                        schema: { $ref: "#/components/schemas/ProblemDetailsV1" },
                    },
                },
            },
        },
        parameters: {
            SimulationId: {
                name: "simulationId",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
            OperationId: {
                name: "operationId",
                in: "path",
                required: true,
                schema: { type: "string", format: "uuid" },
            },
            Cursor: {
                name: "cursor",
                in: "query",
                required: false,
                schema: { type: "string" },
            },
            Limit: {
                name: "limit",
                in: "query",
                required: false,
                schema: { type: "integer", minimum: 1, maximum: 100, default: 25 },
            },
            IfMatch: {
                name: "If-Match",
                in: "header",
                required: true,
                schema: { type: "string" },
            },
            IdempotencyKey: {
                name: "Idempotency-Key",
                in: "header",
                required: false,
                schema: { type: "string", minLength: 1, maxLength: 256 },
            },
        },
        securitySchemes: {
            bearerAuth: { type: "http", scheme: "bearer" },
        },
    },
};

export function getOpenApiDocumentV1(): OpenApiDocumentV1 {
    return openApiDocumentV1;
}
