![Omnia](./docs/assets/logo.jpg)

A structured, LLM-assisted RPG world engine.

---

Omnia is an experimental engine designed around a principle of separation of world simulation, game logic and language generation into distinct layers.

The goal here si to create persistant and scalable narrive worlds and not to rely on blown up prompts and let the LLM "hallucinate" game state.

## How

### 1. The world exists outside the LLM

All world data including characters, locations, items and the global timeline is stored as structured documents using Pydantic models.
The LLM does not hold or *remember* the world. So this makes sure the output is consistent and scalable.

### 2. Engine logic is deterministic

LLMs do not control movement, combat, item use, perception, or world updates. Validation is done by game engine algorithms and then the actions such as reachability checks, env constraints, time progression, etc are applied.

### 3. Dynamically Built Context

Instead of passing entire character histories or world information to the LLM, Omnia builds a "scene context" based on relevance depending on:

- characters in the shared location
- recent globaltimeline
- character-specific memories
- tiems or locations involved
- active objectives

## Patch Merging System

The patch merging system is Omnia's mechanism for updating world state in a deterministic way based on deltas produced by the LLM. So, LLM output **never directly mutates the databse** and malformed output cannot corrupt state.

The LLM outputs structured data (`JSON` for example):

```json
{
  "intent": {
    "character": "alina",
    "action": "move",
    "target": "observatory"
  },
  "patch": {
    "characters": {
      "alina": {
        "traits": {
          "curiosity": "+0.03"
        },
        "location_id": "observatory"
      }
    }
  }
}

```

### State Validation

![Validation](./docs/assets/validator_flow.jpg)
> _Sorry for this, it's just a rough sketch right now_
