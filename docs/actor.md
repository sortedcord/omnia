# Actor Agent Architecture

The Actor Agent is the system component that embodies a single entity and produces narrative prose describing what that entity does, says, or thinks next. It is the "inner voice" of an NPC (or player character), generating behavior proposals that are then validated and executed by the rest of the engine.

## Design Principles

1. **Epistemic boundedness** — The actor only sees what its entity would perceive: public attributes of other entities, private attributes explicitly ACL'd to it, its own memory buffer, and co-located entities. It does not have system-level access to all world state.

2. **Proposal, not mutation** — The actor generates a _proposal_ (narrative prose). It never mutates world state, persists to the database, or writes to memory directly. Validation, execution, and persistence are the Architect's job. This cleanly separates the creative generation layer from the deterministic enforcement layer.

3. **Free prose → structured intents** — The actor outputs free natural-language prose. This is then fed to the existing `IntentDecoder`, which splits and classifies it into a sequence of typed intents. This reuses the entire decode pipeline unchanged and keeps the actor unconstrained.

## Prompt Structure

The actor prompt is assembled by `ActorPromptBuilder` (`packages/actor/src/actor-prompt-builder.ts`) and has two parts:

### System Prompt

Establishes the role, rules, and output contract:

- The LLM **is** the character, not a narrator or system.
- The character may produce three kinds of behavior, each of which maps to an intent type:
  - **Spoken dialogue** → `dialogue` intent. Other entities perceive it.
  - **Physical/logical action** → `action` intent. Subject to the World Architect's validation.
  - **Inner thought / reflection** → `monologue` intent. Purely internal — no one else perceives it, and it bypasses validation entirely (written straight to memory).
- The character must stay in-character, respect its knowledge bounds, and refer to others by subjective aliases (not system UUIDs).
- Not every turn requires an outward action — internal monologue alone is valid.
- The character controls only itself.

### User Context

Epistemically bounded, with these sections:

| Section                      | Content                                                                                            | Source                                                                 |
| ---------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Current moment               | The subjective present time                                                                        | `worldState.clock.get().toISOString()`                                 |
| The world as you perceive it | Self-visible attributes, co-located entities + their visible attributes, other presences elsewhere | `serializeSubjectiveWorldState()` (`packages/core/src/world.ts:72`)    |
| Your recent memory           | Recent `BufferEntry`s, alias-substituted, with `naturalizeTime`-relative phrasing                  | `serializeSubjectiveBufferEntry()` + `BufferRepository.listForOwner()` |

No system UUIDs, no private attributes the entity lacks ACL access to, and no objective-world-state dump are present.

## The Monologue Intent Type

Monologue (`"monologue"`) is the third intent type alongside `dialogue` and `action`. Its properties:

- **No perceiver** — `targetIds` is always `[]`. No other entity perceives or can react to a monologue.
- **No validation** — The Architect's `processIntent` short-circuits for monologues: no call to `LLMValidator`, no `TimeDeltaGenerator`, no clock advance, no world-state mutation (`packages/architect/src/architect.ts:35`).
- **Direct-to-memory** — The caller writes a `BufferEntry` for the monologue directly to the actor's buffer with no `outcome` field. Monologue bypasses the entire validation/persistence pipeline.
- **Defensive guard** — `LLMValidator.validate` also has an early-return guard (`llm-validator.ts:19`) so a stray monologue can never reach the validation LLM.

## Flow

```
[ActorAgent.act()]
  │
  ├─ 1. ActorPromptBuilder.build(entity, worldState)
  │      → system prompt + user context (subjective world + memory + time)
  │
  ├─ 2. ILLMProvider.generateStructuredResponse({ schema: ActorResponseSchema })
  │      → { narrativeProse: string }
  │
  ├─ 3. IntentDecoder.decode(worldState, actorId, prose)
  │      → IntentSequence (dialogue | action | monologue intents)
  │
  └─ returns { narrativeProse, intents }

[Caller (e.g. game loop)]
  │
  ├─ for each intent in intents:
  │   │
  │   ├─ if intent.type === "monologue":
  │   │   ├─ Architect.processIntent → short-circuit (no-op, 0-min delta)
  │   │   └─ BufferRepository.save(BufferEntry { intent, no outcome })
  │   │
  │   ├─ if intent.type === "dialogue":
  │   │   ├─ Architect.processIntent → validates (always valid), 0-min delta
  │   │   └─ BufferRepository.save(BufferEntry { intent, no outcome })
  │   │
  │   └─ if intent.type === "action":
  │       ├─ Architect.processIntent → validates, generates time delta, advances clock
  │       └─ BufferRepository.save(BufferEntry { intent, outcome })
  │
  └─ world state persisted to DB (by Architect for actions; monologue/dialogue skip this)
```

## Key Files

| File                                         | Role                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `packages/actor/src/actor-prompt-builder.ts` | Assembles the epistemically-bounded actor prompt (system + user context)                         |
| `packages/actor/src/actor.ts`                | `ActorAgent` class: orchestrates prompt → LLM → decoder flow; `buildBufferEntryForIntent` helper |
| `packages/actor/src/index.ts`                | Package exports                                                                                  |
| `packages/core/src/world.ts:72`              | `serializeSubjectiveWorldState()` — viewer-relative world serializer                             |
| `packages/intent/src/intent.ts:8`            | `IntentTypeSchema` — includes `"monologue"`                                                      |
| `packages/intent/src/intent-decoder.ts:30`   | Decoder system prompt — classifies inner thoughts as monologue                                   |
| `packages/architect/src/architect.ts:35`     | Monologue short-circuit in `processIntent`                                                       |
| `packages/architect/src/llm-validator.ts:19` | Defensive monologue guard                                                                        |

## Integration Test

`tests/integration/actor-monologue.test.ts` covers the full flow:

- Actor produces prose containing a monologue, dialogue, and action.
- Decoder splits into 3 intents.
- Architect only validates dialogue+action; clock advances by the action's delta only.
- All 3 intents written to memory; monologue entry has no `outcome`.
- Subjective world serializer hides another entity's private attributes.
