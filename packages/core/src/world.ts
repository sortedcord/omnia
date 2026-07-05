import { AttributableObject } from "./attribute.js";
import { Entity } from "./entity.js";

export class WorldState extends AttributableObject {
  /**
   * WorldState is the live, evolving instance you get from loading a Scenario and playing it forward.
   * Universe's current state (distinct from how it started)
   */
  readonly entities: Map<string, Entity> = new Map();

  constructor(id?: string) {
    super(id);
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
