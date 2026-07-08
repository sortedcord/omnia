import { z } from "zod";

/**
 * Intent types as classified by the Intent Decoder.
 * - "dialogue": Speech or conversation directed at another entity.
 * - "action": A physical or logical action performed in the world.
 * - "monologue": An inner thought or internal monologue. Not perceivable by
 *   any other entity. Bypasses the Architect/validators entirely and is
 *   written directly to the actor's memory buffer with no outcome.
 */
export const IntentTypeSchema = z.enum(["dialogue", "action", "monologue"]);
export type IntentType = z.infer<typeof IntentTypeSchema>;

/**
 * A single decoded intent extracted from narrative prose.
 */
export const IntentSchema = z.object({
  /** The type of intent. */
  type: IntentTypeSchema,

  /** The original narrative text fragment this intent was extracted from. */
  originalText: z.string(),

  /** A concise, structured description of the intent's action or dialogue. */
  description: z.string(),

  /** The entity ID of the actor performing the intent. */
  actorId: z.string(),

  /**
   * Entity IDs of the receiving parties (e.g., who is being spoken to,
   * what object is being interacted with). Always an empty array for
   * "monologue" intents, since they are not perceivable by anyone.
   */
  targetIds: z.array(z.string()),
});

export type Intent = z.infer<typeof IntentSchema>;

/**
 * The full output of the Intent Decoder: an ordered sequence of intents
 * extracted from a single narrative prose block.
 */
export const IntentSequenceSchema = z.object({
  intents: z.array(IntentSchema),
});

export type IntentSequence = z.infer<typeof IntentSequenceSchema>;
