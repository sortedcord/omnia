import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { LLMProviderInstance } from "@omnia/llm";

export type { LLMProviderInstance };

function getSettingsDb() {
  const dbDir = path.resolve(process.cwd(), "data");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const dbPath = path.join(dbDir, "settings.db");
  const db = new Database(dbPath);
  
  db.prepare(`
    CREATE TABLE IF NOT EXISTS provider_instances (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      providerName TEXT NOT NULL,
      apiKey TEXT NOT NULL,
      isActive INTEGER NOT NULL DEFAULT 0
    )
  `).run();
  
  return db;
}

export class ProviderManager {
  static list(): LLMProviderInstance[] {
    const db = getSettingsDb();
    try {
      const rows = db.prepare(`SELECT * FROM provider_instances`).all() as {
        id: string;
        name: string;
        providerName: string;
        apiKey: string;
        isActive: number;
      }[];
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        providerName: r.providerName,
        apiKey: r.apiKey,
        isActive: r.isActive === 1,
      }));
    } finally {
      db.close();
    }
  }

  static create(name: string, providerName: string, apiKey: string): LLMProviderInstance {
    const db = getSettingsDb();
    try {
      const id = "provider-" + Date.now();
      const activeCount = db.prepare(`SELECT COUNT(*) as count FROM provider_instances WHERE isActive = 1`).get() as { count: number };
      const isActive = activeCount.count === 0 ? 1 : 0;
      
      db.prepare(`
        INSERT INTO provider_instances (id, name, providerName, apiKey, isActive)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, name, providerName, apiKey, isActive);
      
      return { id, name, providerName, apiKey, isActive: isActive === 1 };
    } finally {
      db.close();
    }
  }

  static delete(id: string): void {
    const db = getSettingsDb();
    try {
      const provider = db.prepare(`SELECT isActive FROM provider_instances WHERE id = ?`).get(id) as { isActive: number } | undefined;
      db.prepare(`DELETE FROM provider_instances WHERE id = ?`).run(id);
      
      if (provider && provider.isActive === 1) {
        const next = db.prepare(`SELECT id FROM provider_instances LIMIT 1`).get() as { id: string } | undefined;
        if (next) {
          db.prepare(`UPDATE provider_instances SET isActive = 1 WHERE id = ?`).run(next.id);
        }
      }
    } finally {
      db.close();
    }
  }

  static setActive(id: string): void {
    const db = getSettingsDb();
    try {
      db.prepare(`UPDATE provider_instances SET isActive = 0`).run();
      db.prepare(`UPDATE provider_instances SET isActive = 1 WHERE id = ?`).run(id);
    } finally {
      db.close();
    }
  }

  static getActive(): LLMProviderInstance | null {
    const db = getSettingsDb();
    try {
      const row = db.prepare(`SELECT * FROM provider_instances WHERE isActive = 1`).get() as {
        id: string;
        name: string;
        providerName: string;
        apiKey: string;
        isActive: number;
      } | undefined;
      if (!row) return null;
      return {
        id: row.id,
        name: row.name,
        providerName: row.providerName,
        apiKey: row.apiKey,
        isActive: true,
      };
    } finally {
      db.close();
    }
  }

  static getMappings(): Record<string, string> {
    const db = getSettingsDb();
    try {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS provider_mappings (
          task TEXT PRIMARY KEY,
          providerInstanceId TEXT NOT NULL
        )
      `).run();
      const rows = db.prepare(`SELECT * FROM provider_mappings`).all() as {
        task: string;
        providerInstanceId: string;
      }[];
      const mappings: Record<string, string> = {};
      for (const row of rows) {
        mappings[row.task] = row.providerInstanceId;
      }
      return mappings;
    } finally {
      db.close();
    }
  }

  static setMapping(task: string, providerInstanceId: string): void {
    const db = getSettingsDb();
    try {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS provider_mappings (
          task TEXT PRIMARY KEY,
          providerInstanceId TEXT NOT NULL
        )
      `).run();
      if (!providerInstanceId) {
        db.prepare(`DELETE FROM provider_mappings WHERE task = ?`).run(task);
      } else {
        db.prepare(`
          INSERT INTO provider_mappings (task, providerInstanceId)
          VALUES (?, ?)
          ON CONFLICT(task) DO UPDATE SET providerInstanceId = excluded.providerInstanceId
        `).run(task, providerInstanceId);
      }
    } finally {
      db.close();
    }
  }
}
