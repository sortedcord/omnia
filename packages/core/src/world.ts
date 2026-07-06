import { AttributableObject } from "./attribute.js";
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

  override serialize(): string {
    const lines: string[] = [];

    // 1. Serialize self attributes (world attributes)
    const selfSerialized = super.serialize();
    if (selfSerialized) {
      lines.push("World Attributes:");
      lines.push(selfSerialized.split("\n").map(l => "  " + l).join("\n"));
    }

    // 2. Serialize entities
    lines.push("Entities:");
    if (this.entities.size > 0) {
      for (const entity of this.entities.values()) {
        lines.push(`  - Entity [ID: ${entity.id}]:`);
        const entitySerialized = entity.serialize();
        if (entitySerialized) {
          lines.push(entitySerialized.split("\n").map(l => "      " + l).join("\n"));
        } else {
          lines.push("      * (No attributes)");
        }
      }
    } else {
      lines.push("  (No entities)");
    }

    return lines.join("\n");
  }
}
