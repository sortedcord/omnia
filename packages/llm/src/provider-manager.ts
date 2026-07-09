import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { LLMProviderInstance } from "./llm.js";

function getWorkspaceRoot() {
  let current = process.cwd();
  while (current !== "/" && current !== path.parse(current).root) {
    if (
      fs.existsSync(path.join(current, "pnpm-workspace.yaml")) ||
      fs.existsSync(path.join(current, "package.json"))
    ) {
      if (fs.existsSync(path.join(current, "pnpm-workspace.yaml"))) {
        return current;
      }
    }
    current = path.dirname(current);
  }
  return process.cwd();
}

function getSettingsDb() {
  const wsRoot = getWorkspaceRoot();
  const dbDir = path.resolve(wsRoot, "data");
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
      isActive INTEGER NOT NULL DEFAULT 0,
      modelName TEXT
    )
  `).run();

  try {
    db.prepare(`ALTER TABLE provider_instances ADD COLUMN modelName TEXT`).run();
  } catch {
    // ignore
  }
  
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
        modelName?: string;
      }[];
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        providerName: r.providerName,
        apiKey: r.apiKey,
        isActive: r.isActive === 1,
        modelName: r.modelName || undefined,
      }));
    } finally {
      db.close();
    }
  }

  static create(name: string, providerName: string, apiKey: string, modelName?: string): LLMProviderInstance {
    const db = getSettingsDb();
    try {
      const id = "provider-" + Date.now();
      const activeCount = db.prepare(`SELECT COUNT(*) as count FROM provider_instances WHERE isActive = 1`).get() as { count: number };
      const isActive = activeCount.count === 0 ? 1 : 0;
      
      db.prepare(`
        INSERT INTO provider_instances (id, name, providerName, apiKey, isActive, modelName)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, name, providerName, apiKey, isActive, modelName || null);
      
      return { id, name, providerName, apiKey, isActive: isActive === 1, modelName };
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

  static update(id: string, name: string, providerName: string, apiKey?: string, modelName?: string): void {
    const db = getSettingsDb();
    try {
      if (apiKey && apiKey.trim()) {
        db.prepare(`
          UPDATE provider_instances
          SET name = ?, providerName = ?, apiKey = ?, modelName = ?
          WHERE id = ?
        `).run(name, providerName, apiKey, modelName || null, id);
      } else {
        db.prepare(`
          UPDATE provider_instances
          SET name = ?, providerName = ?, modelName = ?
          WHERE id = ?
        `).run(name, providerName, modelName || null, id);
      }
    } finally {
      db.close();
    }
  }

  static getActive(): LLMProviderInstance | null {
    const db = getSettingsDb();
    try {
      // Query the DB
      const row = db.prepare(`SELECT * FROM provider_instances WHERE isActive = 1`).get() as {
        id: string;
        name: string;
        providerName: string;
        apiKey: string;
        isActive: number;
        modelName?: string;
      } | undefined;

      if (!row) {
        // Check if there are any rows at all
        const totalCount = db.prepare(`SELECT COUNT(*) as count FROM provider_instances`).get() as { count: number };
        if (totalCount.count === 0) {
          // Database is completely empty! Check if GOOGLE_API_KEY env is set.
          const envKey = process.env.GOOGLE_API_KEY;
          if (envKey && envKey.trim()) {
            // Auto-bootstrap default active instance from env
            const id = "provider-default-env";
            db.prepare(`
              INSERT INTO provider_instances (id, name, providerName, apiKey, isActive, modelName)
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(id, "Default (Env)", "google-genai", envKey, 1, "gemini-2.5-flash");

            return {
              id,
              name: "Default (Env)",
              providerName: "google-genai",
              apiKey: envKey,
              isActive: true,
              modelName: "gemini-2.5-flash",
            };
          }
        }
        return null;
      }

      return {
        id: row.id,
        name: row.name,
        providerName: row.providerName,
        apiKey: row.apiKey,
        isActive: true,
        modelName: row.modelName || undefined,
      };
    } catch {
      // Lock or write issue fallback: return an in-memory active key if env key exists
      const envKey = process.env.GOOGLE_API_KEY;
      if (envKey) {
        return {
          id: "provider-default-env-fallback",
          name: "Default (Env Fallback)",
          providerName: "google-genai",
          apiKey: envKey,
          isActive: true,
          modelName: "gemini-2.5-flash",
        };
      }
      return null;
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
