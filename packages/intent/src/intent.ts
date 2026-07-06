import { z } from "zod";

/**
 * Intent types as classified by the Intent Decoder.
 * - "dialogue": Speech or conversation directed at another entity.
 * - "action": A physical or logical action performed in the world.
 */
export const IntentTypeSchema = z.enum(["dialogue", "action"]);
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
   * what object is being interacted with).
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
