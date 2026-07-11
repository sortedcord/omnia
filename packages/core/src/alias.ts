import { Entity } from "./entity.js";

export function resolveAlias(viewer: Entity, targetId: string): string {
  if (targetId === viewer.id) return "you";
  return viewer.aliases.get(targetId) ?? "an unfamiliar figure";
}
