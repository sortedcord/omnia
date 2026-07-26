import type { RuntimeSnapshot } from "../snapshot.js";

export function createRuntimeSnapshot(
    overrides: Partial<RuntimeSnapshot> = {},
): RuntimeSnapshot {
    return {
        id: "sim-test",
        status: "running",
        turn: 1,
        maxTurns: 20,
        scenarioName: "Test scenario",
        scenarioDescription: "",
        entities: [],
        log: [],
        entityIndex: 0,
        ...overrides,
    };
}
