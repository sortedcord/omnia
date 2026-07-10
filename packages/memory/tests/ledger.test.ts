import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { LedgerRepository, LedgerEntry } from "../src/ledger";

describe("LedgerRepository", () => {
  let db: Database.Database;
  let repo: LedgerRepository;

  beforeEach(() => {
    db = new Database(":memory:");
    
    // We need to create a dummy objects table to satisfy foreign keys
    db.exec(`
      CREATE TABLE objects (
        id TEXT PRIMARY KEY
      );
    `);

    db.exec(`
      INSERT INTO objects (id) VALUES ('alice'), ('bob'), ('charlie');
    `);

    repo = new LedgerRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it("should save and load a ledger entry", () => {
    const entry: LedgerEntry = {
      id: "mem1",
      ownerId: "alice",
      timestamp: new Date().toISOString(),
      locationId: "loc1",
      involvedEntityIds: ["bob", "charlie"],
      content: "Alice met Bob and Charlie at the market.",
      quotes: ["Hi guys!"],
      importance: 5,
      embedding: [0.1, 0.2, 0.3],
    };

    repo.save(entry);

    const loaded = repo.load("mem1");
    expect(loaded).toBeDefined();
    expect(loaded?.id).toBe("mem1");
    expect(loaded?.ownerId).toBe("alice");
    expect(loaded?.locationId).toBe("loc1");
    expect(loaded?.involvedEntityIds.sort()).toEqual(["bob", "charlie"].sort());
    expect(loaded?.content).toBe(entry.content);
    expect(loaded?.quotes).toEqual(entry.quotes);
    expect(loaded?.importance).toBe(5);
    
    // Check float precision
    expect(loaded?.embedding[0]).toBeCloseTo(0.1);
    expect(loaded?.embedding[1]).toBeCloseTo(0.2);
    expect(loaded?.embedding[2]).toBeCloseTo(0.3);
  });

  it("should return null for non-existent entry", () => {
    const loaded = repo.load("missing");
    expect(loaded).toBeNull();
  });

  it("should retrieve relevant memories based on Phase 1 heuristics", () => {
    repo.save({
      id: "mem_high_salience",
      ownerId: "alice",
      timestamp: "2024-01-01T10:00:00.000Z",
      locationId: "loc2",
      involvedEntityIds: [],
      content: "Alice found a magical sword.",
      quotes: [],
      importance: 9, // high salience
      embedding: [],
    });

    repo.save({
      id: "mem_location",
      ownerId: "alice",
      timestamp: "2024-01-02T10:00:00.000Z",
      locationId: "loc1", // matches query
      involvedEntityIds: [],
      content: "Alice sat on a bench.",
      quotes: [],
      importance: 2,
      embedding: [],
    });

    repo.save({
      id: "mem_social",
      ownerId: "alice",
      timestamp: "2024-01-03T10:00:00.000Z",
      locationId: "loc2",
      involvedEntityIds: ["bob"], // matches query
      content: "Alice waved at Bob.",
      quotes: [],
      importance: 3,
      embedding: [],
    });

    repo.save({
      id: "mem_irrelevant",
      ownerId: "alice",
      timestamp: "2024-01-04T10:00:00.000Z",
      locationId: "loc3",
      involvedEntityIds: ["charlie"],
      content: "Alice sneezed.",
      quotes: [],
      importance: 2,
      embedding: [],
    });

    const relevant = repo.getRelevant("alice", "loc1", ["bob"]);
    
    expect(relevant).toHaveLength(3);
    const ids = relevant.map((r) => r.id);
    expect(ids).toContain("mem_high_salience"); // due to importance >= 8
    expect(ids).toContain("mem_location"); // due to locationId
    expect(ids).toContain("mem_social"); // due to involvedEntityIds
    expect(ids).not.toContain("mem_irrelevant");
  });
});
