import { Entity, WorldState } from "@omnia/core";
import { ILLMProvider } from "@omnia/llm";
import {
  BufferEntry,
  BufferRepository,
} from "@omnia/memory";
import {
  Intent,
  IntentDecoder,
  IntentSequence,
} from "@omnia/intent";
import { ActorPromptBuilder, ActorResponse, ActorResponseSchema } from "./actor-prompt-builder.js";

/**
 * Result of a single actor turn.
 */
export interface ActorTurnResult {
  /** The raw narrative prose the actor produced. */
  narrativeProse: string;
  /** The decoded intent sequence (split/classified from the prose). */
  intents: IntentSequence;
}

/**
 * The Actor Agent: embodies a single entity and generates its next beat of
 * behavior as narrative prose, then decodes that prose into a structured
 * intent sequence via the IntentDecoder.
 *
 * The actor itself does NOT mutate world state or write memory — that is
 * the responsibility of the caller (who routes intents through the
 * Architect and writes buffer entries). The actor only produces the
 * proposal. This keeps the actor's role cleanly separated from
 * validation and persistence.
 */
export class ActorAgent {
  private promptBuilder: ActorPromptBuilder;
  private decoder: IntentDecoder;

  constructor(
    private llmProvider: ILLMProvider,
    bufferRepo?: BufferRepository,
    memoryLimit?: number,
  ) {
    this.promptBuilder = new ActorPromptBuilder(bufferRepo, memoryLimit);
    this.decoder = new IntentDecoder(llmProvider);
  }

  /**
   * Has the entity produce its next beat of behavior.
   *
   * 1. Builds an epistemically-bounded prompt for the entity.
   * 2. Asks the LLM for narrative prose.
   * 3. Decodes the prose into a structured IntentSequence.
   */
  async act(
    worldState: WorldState,
    entity: Entity,
  ): Promise<ActorTurnResult> {
    const { systemPrompt, userContext } = this.promptBuilder.build(
      worldState,
      entity,
    );

    const response = await this.llmProvider.generateStructuredResponse({
      systemPrompt,
      userContext,
      schema: ActorResponseSchema,
    });

    if (!response.success || !response.data) {
      throw new Error(
        `Actor generation failed for entity "${entity.id}": ${response.error || "Unknown LLM error"}`,
      );
    }

    const prose: ActorResponse = response.data;
    const intents = await this.decoder.decode(
      worldState,
      entity.id,
      prose.narrativeProse,
    );

    return {
      narrativeProse: prose.narrativeProse,
      intents,
    };
  }
}

/**
 * Helper: builds a BufferEntry for an intent produced on behalf of an
 * entity. For "action" intents the caller should attach an `outcome`
 * after the Architect has processed it; for "dialogue" and "monologue"
 * intents no outcome is needed (dialogue is always valid; monologue
 * bypasses validation entirely).
 */
export function buildBufferEntryForIntent(
  intent: Intent,
  timestamp: string,
  locationId: string | null,
): BufferEntry {
  return {
    id: crypto.randomUUID(),
    ownerId: intent.actorId,
    timestamp,
    locationId,
    intent,
  };
}
