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
}
