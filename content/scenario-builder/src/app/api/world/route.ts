import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import { WorldState, Entity, SQLiteRepository, AttributeVisibility } from "@omnia/core";
import path from "path";

const DB_PATH = path.resolve("/home/sortedcord/Projects/omnia_umbrella/omnia/omnia.db");

function getRepo() {
  const db = new Database(DB_PATH);
  // Enable foreign keys
  db.exec("PRAGMA foreign_keys = ON;");
  return { repo: new SQLiteRepository(db), db };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    const { repo, db } = getRepo();

    try {
      if (id) {
        const world = repo.loadWorldState(id);
        if (!world) {
          return NextResponse.json({ error: `World with ID ${id} not found` }, { status: 404 });
        }

        // Serialize world
        const serialized = {
          id: world.id,
          attributes: Array.from(world.attributes.values()).map(attr => ({
            name: attr.name,
            value: attr.getValue(),
            visibility: attr.getVisibility(),
            allowedEntities: Array.from(attr.getAllowedEntities())
          })),
          entities: Array.from(world.entities.values()).map(entity => ({
            id: entity.id,
            attributes: Array.from(entity.attributes.values()).map(attr => ({
              name: attr.name,
              value: attr.getValue(),
              visibility: attr.getVisibility(),
              allowedEntities: Array.from(attr.getAllowedEntities())
            }))
          }))
        };
        return NextResponse.json(serialized);
      } else {
        // List all worlds
        const rows = db.prepare("SELECT id FROM objects WHERE type = 'world'").all() as { id: string }[];
        const worlds = [];
        for (const row of rows) {
          const world = repo.loadWorldState(row.id);
          if (world) {
            const nameAttr = world.attributes.get("name")?.getValue() || "Unnamed World";
            worlds.push({
              id: world.id,
              name: nameAttr
            });
          }
        }
        return NextResponse.json({ worlds });
      }
    } finally {
      db.close();
    }
  } catch (error) {
    console.error("API GET Error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    if (!payload.id) {
      return NextResponse.json({ error: "World ID is required" }, { status: 400 });
    }

    const { repo, db } = getRepo();

    try {
      const world = new WorldState(payload.id);

      // Add attributes to world
      if (payload.attributes && Array.isArray(payload.attributes)) {
        for (const attr of payload.attributes) {
          world.addAttribute(
            attr.name,
            attr.value,
            attr.visibility || AttributeVisibility.PUBLIC,
            attr.allowedEntities ? new Set(attr.allowedEntities) : null
          );
        }
      }

      // Add entities to world
      if (payload.entities && Array.isArray(payload.entities)) {
        for (const ent of payload.entities) {
          const entity = new Entity(ent.id);
          if (ent.attributes && Array.isArray(ent.attributes)) {
            for (const attr of ent.attributes) {
              entity.addAttribute(
                attr.name,
                attr.value,
                attr.visibility || AttributeVisibility.PRIVATE,
                attr.allowedEntities ? new Set(attr.allowedEntities) : null
              );
            }
          }
          world.addEntity(entity);
        }
      }

      repo.saveWorldState(world);
      return NextResponse.json({ success: true, worldId: world.id });
    } finally {
      db.close();
    }
  } catch (error) {
    console.error("API POST Error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
