import { AttributableObject, serializeAttributes } from "./attribute.js";
import { Entity } from "./entity.js";
import { WorldClock } from "./clock.js";

export class WorldState extends AttributableObject {
  /**
   * WorldState is the live, evolving instance you get from loading a Scenario and playing it forward.
   * Universe's current state (distinct from how it started)
   */
  readonly entities: Map<string, Entity> = new Map();
  readonly clock: WorldClock;

  constructor(id?: string, startTime?: Date) {
    super(id);
    this.clock = new WorldClock(startTime);
  }

  addEntity(entity: Entity): void {
    if (this.entities.has(entity.id)) {
      throw new Error(
        `Entity with ID ${entity.id} already exists in the world`,
      );
    }
    this.entities.set(entity.id, entity);
  }

  getEntity(id: string): Entity | undefined {
    return this.entities.get(id);
  }
}

/**
 * Objective world state serializer for system LLM tasks.
 * Bypasses epistemic privacy bounds for system/physics validation.
 */
export function serializeObjectiveWorldState(worldState: WorldState): string {
  const lines: string[] = [];

  // Serialize world attributes
  if (worldState.attributes.size > 0) {
    lines.push("World Attributes:");
    const worldAttrsStr = serializeAttributes(Array.from(worldState.attributes.values()));
    lines.push(worldAttrsStr.split("\n").map(l => "  " + l).join("\n"));
  }

  // Serialize entities and their attributes
  lines.push("Entities:");
  if (worldState.entities.size > 0) {
    for (const entity of worldState.entities.values()) {
      lines.push(`  - Entity [ID: ${entity.id}]:`);
      if (entity.locationId) {
        lines.push(`      * Location ID: ${entity.locationId}`);
      }
      if (entity.attributes.size > 0) {
        const entityAttrsStr = serializeAttributes(Array.from(entity.attributes.values()));
        lines.push(entityAttrsStr.split("\n").map(l => "      " + l).join("\n"));
      } else {
        lines.push("      * (No attributes)");
      }
    }
  } else {
    lines.push("  (No entities)");
  }

  return lines.join("\n");
}
