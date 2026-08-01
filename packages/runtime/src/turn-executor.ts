import {
    ActorAgent,
    ActorPromptBuilder,
    buildBufferEntryForIntent,
} from "@omnia/actor";
import type { IActorProseGenerator } from "@omnia/actor";
import type { RuntimeSession } from "./session.js";
import type {
    EntityInfo,
    IntentInfo,
    LogEntry,
    WaitingContext,
    ValidatorCall,
} from "./snapshot.js";

class FixedProseGenerator implements IActorProseGenerator {
    constructor(private readonly prose: string) { }

    async generate(): Promise<string> {
        return this.prose;
    }
}

type RuntimeIntent = Parameters<typeof buildBufferEntryForIntent>[0];

async function processIntents(
    intents: RuntimeIntent[],
    actorEntityId: string,
    entity: { locationId: string | null },
    worldState: NonNullable<ReturnType<RuntimeSession["coreRepo"]["loadWorldState"]>>,
    session: RuntimeSession,
): Promise<{ intentInfos: IntentInfo[]; validatorCalls: ValidatorCall[] }> {
    const intentInfos: IntentInfo[] = [];
    const validatorCalls: ValidatorCall[] = [];

    for (const [intentIndex, intent] of intents.entries()) {
        const outcome = await session.architect.processIntent(worldState, intent);
        const timestamp = worldState.clock.get().toISOString();
        intentInfos.push({
            type: intent.type,
            content: intent.content,
            modifiers: intent.modifiers || [],
            targetIds: intent.targetIds,
            isValid: outcome.isValid,
            reason: outcome.reason,
            minutesToAdvance: outcome.timeDelta?.minutesToAdvance,
        });

        if (intent.type === "action" && session.architect.validator.lastResult) {
            const result = session.architect.validator.lastResult;
            validatorCalls.push({
                intentIndex,
                intentContent: intent.content,
                prompt: {
                    systemPrompt: result.systemPrompt || "",
                    userContext: result.userContext || "",
                    components: result.components,
                },
                response: { isValid: outcome.isValid, reason: outcome.reason },
                usage: session.validatorProvider.lastCalls?.at(-1)?.usage,
            });
        } else {
            const reason =
                intent.type === "dialogue"
                    ? "Dialogue intents represent verbal/communication actions and are automatically valid."
                    : "Monologue/thought intents represent internal reflections and bypass validation.";
            validatorCalls.push({
                intentIndex,
                intentContent: intent.content,
                response: {
                    isValid: true,
                    reason: outcome.reason || reason,
                },
            });
        }

        const actorEntry = buildBufferEntryForIntent(
            intent,
            timestamp,
            entity.locationId,
        );
        if (intent.type === "action") {
            actorEntry.outcome = { isValid: outcome.isValid, reason: outcome.reason };
        }
        session.bufferRepo.save(actorEntry);

        if (
            entity.locationId &&
            (intent.type === "dialogue" || intent.type === "action")
        ) {
            for (const other of worldState.entities.values()) {
                if (
                    other.id === actorEntityId ||
                    other.locationId !== entity.locationId
                ) {
                    continue;
                }
                const observerEntry = buildBufferEntryForIntent(
                    intent,
                    timestamp,
                    entity.locationId,
                );
                if (intent.type === "action") {
                    observerEntry.outcome = {
                        isValid: outcome.isValid,
                        reason: outcome.reason,
                    };
                }
                session.bufferRepo.save({ ...observerEntry, ownerId: other.id });
            }
        }
    }
    return { intentInfos, validatorCalls };
}

function attachDecoderDetails(
    session: RuntimeSession,
    entry: LogEntry,
): void {
    const call = session.decoderProvider.lastCalls?.at(-1);
    if (!call) return;
    const proseHeader = "=== NARRATIVE PROSE ===";
    const index = call.userContext.indexOf(proseHeader);
    const context =
        index === -1 ? call.userContext : call.userContext.substring(0, index).trim();
    const prose = index === -1 ? "" : call.userContext.substring(index).trim();
    entry.decoderPrompt = {
        systemPrompt: call.systemPrompt,
        userContext: call.userContext,
        components: [
            { label: "System Prompt", type: "system", content: call.systemPrompt },
            { label: "Decoder Context", type: "world", content: context },
            { label: "Narrative Prose", type: "input", content: prose },
        ],
    };
    entry.decoderUsage = call.usage;
}

export async function preparePlayerTurn(
    session: RuntimeSession,
    info: EntityInfo,
): Promise<void> {
    const worldState = session.coreRepo.loadWorldState(session.worldInstanceId);
    if (!worldState) throw new Error("World state lost");
    const entity = worldState.getEntity(info.id);
    if (!entity) throw new Error(`Entity "${info.id}" not found`);
    const prompt = new ActorPromptBuilder(
        session.bufferRepo,
        session.ledgerRepo,
        20,
    ).build(worldState, entity);
    session.waitingEntity = {
        entityId: info.id,
        name: info.name,
        systemPrompt: prompt.systemPrompt,
        userContext: prompt.userContext,
    };
    session.status = "waiting_player";
}

export async function processNpcTurn(
    session: RuntimeSession,
    info: EntityInfo,
): Promise<void> {
    const worldState = session.coreRepo.loadWorldState(session.worldInstanceId);
    if (!worldState) throw new Error("World state lost");
    const entity = worldState.getEntity(info.id);
    if (!entity) throw new Error(`Entity "${info.id}" not found`);

    const result = await new ActorAgent(
        { actor: session.actorProvider, decoder: session.decoderProvider },
        session.bufferRepo,
        session.ledgerRepo,
        20,
    ).act(worldState, entity);
    const entry: LogEntry = {
        turn: session.turn,
        entityId: info.id,
        entityName: info.name,
        narrativeProse: result.narrativeProse,
        intents: [],
        timestamp: worldState.clock.get().toISOString(),
        rawPrompt: {
            systemPrompt: result.systemPrompt || "",
            userContext: result.userContext || "",
            components: result.promptComponents,
        },
        usage: session.actorProvider.lastCalls?.at(-1)?.usage,
    };
    attachDecoderDetails(session, entry);
    const processed = await processIntents(
        result.intents.intents,
        info.id,
        entity,
        worldState,
        session,
    );
    entry.intents = processed.intentInfos;
    entry.validatorCalls = processed.validatorCalls;
    entry.decodedIntents = result.intents.intents.map((intent) => ({
        type: intent.type,
        content: intent.content,
        modifiers: intent.modifiers || [],
        targetIds: intent.targetIds,
    }));
    session.log.push(entry);
    session.coreRepo.saveWorldState(worldState);
}

export async function executePlayerAction(
    session: RuntimeSession,
    context: WaitingContext,
    prose: string,
): Promise<void> {
    const worldState = session.coreRepo.loadWorldState(session.worldInstanceId);
    if (!worldState) throw new Error("World state lost");
    const entity = worldState.getEntity(context.entityId);
    if (!entity) throw new Error(`Player entity "${context.entityId}" not found`);

    const result = await new ActorAgent(
        { actor: session.actorProvider, decoder: session.decoderProvider },
        session.bufferRepo,
        session.ledgerRepo,
        20,
        new FixedProseGenerator(prose),
    ).act(worldState, entity);
    const entry: LogEntry = {
        turn: session.turn,
        entityId: context.entityId,
        entityName: context.name,
        narrativeProse: result.narrativeProse,
        intents: [],
        timestamp: worldState.clock.get().toISOString(),
        rawPrompt: {
            systemPrompt: result.systemPrompt || context.systemPrompt,
            userContext: result.userContext || context.userContext,
            components: result.promptComponents,
        },
    };
    attachDecoderDetails(session, entry);
    const processed = await processIntents(
        result.intents.intents,
        context.entityId,
        entity,
        worldState,
        session,
    );
    entry.intents = processed.intentInfos;
    entry.validatorCalls = processed.validatorCalls;
    entry.decodedIntents = result.intents.intents.map((intent) => ({
        type: intent.type,
        content: intent.content,
        modifiers: intent.modifiers || [],
        targetIds: intent.targetIds,
    }));
    session.log.push(entry);
    session.coreRepo.saveWorldState(worldState);
}
