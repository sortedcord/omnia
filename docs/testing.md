# Testing Strategy

This document outlines the testing architecture for the Omnia project. The central design problem is that most of the system is deterministic and highly testable, but a few critical parts (specifically, LLM behavior) are non-deterministic.

Treating these two categories the same way—either mocking everything (which provides false confidence) or hitting the real LLM API for everything (which is slow, expensive, flaky, and non-repeatable)—is an anti-pattern. Our test architecture makes this split explicit rather than papering over it.

## Test Tiers

We use a three-tiered system, categorized by what the tests actually depend on.

### Tier 1: Unit Tests (Per-Package, No LLM)

Unit tests reside within each package's `tests/` directory. They do not use LLMs and do not perform I/O.

This tier should cover the majority of the codebase, as most of Omnia's specific logic is deterministic. Examples of logic that must be fully covered by unit tests include:

- `hasAccess()` / ACL grant-revoke logic.
- `addAttribute` rejecting duplicate names.
- `WorldClock.advance()` / `getTimeOfDay()` boundaries.
- The spatial bubble-up algorithm (fully mechanical: given a constructed graph and portal properties, assert exactly who perceives what at each step).
- Zod schemas rejecting malformed input at each boundary.

**Execution:** Runs on every save and every commit.

### Tier 2: Integration Tests (Cross-Package, Mocked LLM)

Integration tests live in the root `tests/integration/` directory. They test cross-package flows using a mocked LLM to ensure speed, determinism, and zero cost.

This is where the `MockLLMProvider` earns its keep. It implements the `ILLMProvider` interface and returns canned responses that satisfy whatever Zod schema is requested.

**Mock Implementation:**

```typescript
export class MockLLMProvider implements ILLMProvider {
  providerName = "mock";
  constructor(private responses: unknown[]) {}
  private callCount = 0;

  async generateStructuredResponse<T extends z.ZodTypeAny>(
    request: LLMRequest<T>,
  ): Promise<LLMResponse<z.infer<T>>> {
    const next = this.responses[this.callCount++];
    return { success: true, data: request.schema.parse(next) };
  }
}
```

This tier tests our actual logic—e.g., does the Architect apply a delta correctly? Does the consequence generator mutate `WorldState` correctly? Does a scripted CLI conversation end in the expected state?—without ever depending on the model behaving a particular way.

**Shared Contract Suite**
Included in this tier is a shared contract test suite run against _both_ `MockLLMProvider` and `GeminiProvider`. The suite verifies:

1. Given a schema, the provider returns data matching it.
2. Given a malformed response, it fails predictably.

This enforces `ILLMProvider`'s reason for existing: real interchangeability, not just nominal conformance.

### Tier 3: Evals (Real API, Run Deliberately)

Evals live in the root `tests/evals/` directory. They use real LLM APIs and are run manually via a separate script (`test:evals`), excluded from the default Vitest run.

This tier is where our privacy guarantee actually lives. It requires a fundamentally different shape of test because of a critical distinction:

- A Tier 1 test on `hasAccess()` proves the _mechanism_ is correct.
- It says nothing about whether the model, given a correctly-filtered context, actually holds its tongue.
- It says nothing about whether some prompt-building code accidentally used the raw `.attributes/getValue()` path instead of `getVisibleAttributesFor()` (an unenforced-convention risk).

Both of these failure modes are invisible to unit tests. Therefore, evals are run _N_ times and scored, not asserted once.

**Example Eval Structure:**

```typescript
// tests/evals/privacy-leak.eval.ts
const RUNS = 15;
let leaks = 0;

for (let i = 0; i < RUNS; i++) {
  const response = await askAboutPrivateFact(npcWithoutAccess, secretFact);
  if (containsFact(response, secretFact)) leaks++;
}

// Any leak here is a real failure worth investigating, not noise to average away.
expect(leaks).toBe(0);
```

**Execution:** Run deliberately (e.g., weekly or pre-release). It costs real money and shouldn't fire on every save.

## Directory Structure

```text
omnia/
  packages/
    core/       src/  tests/        # Tier 1: Unit — no I/O, no LLM
    intent/     src/  tests/
    spatial/    src/  tests/
    memory/     src/  tests/
    architect/  src/  tests/
    llm/        src/  tests/        # Includes MockLLMProvider + shared contract suite
  tests/
    integration/                    # Tier 2: Cross-package flows, mocked LLM
    evals/                         # Tier 3: Real LLM calls, slow/costly/non-deterministic
```
