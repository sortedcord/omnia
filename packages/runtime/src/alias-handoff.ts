import { HandoffEngine, checkHandoffTrigger } from "@omnia/memory";
import type { HandoffResult } from "./snapshot.js";
import type { RuntimeSession } from "./session.js";

function isHandoffResult(value: unknown): value is HandoffResult {
    if (!value || typeof value !== "object") return false;
    return Array.isArray((value as { chunks?: unknown }).chunks);
}

export async function runHandoffResolution(
    session: RuntimeSession,
): Promise<void> {
    const worldState = session.coreRepo.loadWorldState(session.worldInstanceId);
    if (!worldState) throw new Error("World state lost");

    const handoffEngine = new HandoffEngine(
        session.handoffProvider,
        session.embeddingProvider,
        session.bufferRepo,
        session.ledgerRepo,
    );

    for (const entity of worldState.entities.values()) {
        if (!entity.isAgent) continue;
        const bufferEntries = session.bufferRepo.listForOwner(entity.id);
        const trigger = checkHandoffTrigger(
            entity,
            bufferEntries,
            worldState.clock.get(),
            session.handoffProvider.maxContext ?? 32768,
        );
        if (trigger === "none") continue;

        const ran = await handoffEngine.runHandoff(
            entity,
            bufferEntries,
            worldState.clock.get(),
        );
        if (!ran) continue;

        const lastResult = handoffEngine.lastResult;
        const lastCall = session.handoffProvider.lastCalls?.at(-1);
        const entityName =
            session.entities.find((item) => item.id === entity.id)?.name ?? entity.id;
        session.log.push({
            turn: session.turn,
            entityId: entity.id,
            entityName,
            narrativeProse: `Handoff triggered for ${entityName}: memories were transferred from Cognitive Buffer to Memory Ledger`,
            intents: [],
            timestamp: worldState.clock.get().toISOString(),
            isHandoff: true,
            rawPrompt: lastResult
                ? {
                    systemPrompt: lastResult.systemPrompt || "",
                    userContext: lastResult.userContext || "",
                    components: lastResult.promptComponents,
                }
                : undefined,
            usage: lastCall?.usage,
            handoffResult: isHandoffResult(lastResult?.response)
                ? lastResult.response
                : isHandoffResult(lastCall?.response)
                    ? lastCall.response
                    : undefined,
        });
    }
}

export async function runAliasResolution(
    session: RuntimeSession,
): Promise<void> {
    const worldState = session.coreRepo.loadWorldState(session.worldInstanceId);
    if (!worldState) throw new Error("World state lost");

    const entities = Array.from(worldState.entities.values());
    for (const viewer of entities) {
        if (!viewer.isAgent || !viewer.locationId) continue;
        for (const target of entities) {
            if (
                viewer.id !== target.id &&
                target.locationId === viewer.locationId &&
                !viewer.aliases.has(target.id)
            ) {
                viewer.aliases.set(
                    target.id,
                    await session.aliasGenerator.generate(viewer, target),
                );
                session.coreRepo.saveEntity(viewer, worldState.id);
            }
        }
    }
}
