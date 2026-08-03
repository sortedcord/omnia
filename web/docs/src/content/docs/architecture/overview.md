---
title: Architecture Overview
description: High-level architecture of the Omnia engine
---

Omnia is organized as a monorepo with the following subsystems:

```
omnia/
  packages/
    core/        entities, attributes, world state, clock, SQLite persistence
    intent/      intent types (dialogue/action/monologue) and the prose decoder
    architect/   World Architect: LLM validation plus time-delta generation
    actor/       actor agent: epistemically-bounded prompts, pluggable prose generators
    memory/      Cognitive Buffer; Memory Ledger (vector archive), dossier, and affect vectors
    spatial/     location and POI graph, portal-based perception
    llm/         ILLMProvider interface plus Gemini and deterministic mock implementations
    scenario/    scenario JSON schema and loader (JSON → SQLite)
    runtime/     session lifecycle, turn execution, provider routing, and simulation persistence
  apps/
    gui/         Next.js UI and server actions; instantiates RuntimeService
  content/
    demo/              bundled scenarios (talking-room)
  tests/
    integration/ cross-package tests against a mocked LLM
    evals/       deliberate real-API evaluation runs
  web/
    landing/     Vite-based landing page
    docs/        Astro-based documentation site
```

The engine core deliberately knows nothing about domain content (stats, traits, genres). Scenarios are plain JSON the loader ingests; what an attribute means is the scenario's business, not the engine's.

`@omnia/runtime` is an application library hosted by the Next.js server, not a
separately deployed backend service. Browser requests reach GUI server actions,
which delegate simulation lifecycle and turn execution to `RuntimeService`.

## Core Data Flow

1. A browser action reaches a Next.js server action in `apps/gui`.
2. `RuntimeService` loads the session and asks an **Actor Agent** for narrative prose when the active entity is an NPC.
3. The **Intent Decoder** splits prose into typed intents (`dialogue`, `action`, `monologue`).
4. The **World Architect** validates action intents against objective world state and generates structured deltas.
5. Deterministic code applies deltas to the **World State** (SQLite), writes per-character memory through **Subjective Aliases**, and persists the runtime session.

## A Research Instrument

Omnia's architecture doubles as an apparatus for studying how language models behave _as characters_ under controlled epistemic conditions. Monologue intents provide a window into private reasoning; attribute ACLs let you administer information with precision; identical initial conditions with swappable model providers enable reproducible experiments.
