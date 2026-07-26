import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import type { RuntimeSession, SavedSessionState } from "../session.js";
import type { RuntimeSnapshot } from "../snapshot.js";
import type { SessionStore } from "./types.js";

const RUNTIME_META = "runtime_meta";
const LEGACY_META = "gui_meta";

export class SQLiteSessionStore implements SessionStore {
    constructor(
        readonly dataDir: string = path.resolve(process.cwd(), "data"),
    ) { }

    loadState(db: Database.Database, id: string): SavedSessionState | null {
        try {
            this.ensureRuntimeTable(db);
            let row = this.readRow(db, RUNTIME_META, id);
            if (!row && this.tableExists(db, LEGACY_META)) {
                row = this.readRow(db, LEGACY_META, id);
                if (row) this.writeStateJson(db, id, row.state_json);
            }
            return row ? (JSON.parse(row.state_json) as SavedSessionState) : null;
        } catch {
            return null;
        }
    }

    save(session: RuntimeSession): void {
        const state: SavedSessionState = {
            scenarioName: session.scenarioName,
            scenarioDescription: session.scenarioDescription,
            turn: session.turn,
            maxTurns: session.maxTurns,
            entities: session.entities,
            playerEntityId: session.playerEntityId,
            entityIndex: session.entityIndex,
            status: session.status,
            error: session.error,
            waitingEntity: session.waitingEntity,
            aliasDoneForTurn: session.aliasDoneForTurn,
            log: session.log,
            providerMappings: session.providerMappings,
        };
        this.ensureRuntimeTable(session.db);
        this.writeStateJson(
            session.db,
            session.worldInstanceId,
            JSON.stringify(state),
        );
    }

    delete(id: string): void {
        const dbPath = this.pathFor(id);
        if (!fs.existsSync(dbPath)) return;
        try {
            fs.unlinkSync(dbPath);
        } catch (error) {
            console.error(`Failed to delete session file ${dbPath}:`, error);
        }
    }

    list(
        activeSessions: ReadonlyMap<string, RuntimeSession>,
        snapshot: (session: RuntimeSession) => RuntimeSnapshot,
    ): RuntimeSnapshot[] {
        if (!fs.existsSync(this.dataDir)) return [];
        const snapshots: RuntimeSnapshot[] = [];
        const files = fs
            .readdirSync(this.dataDir)
            .filter((file) => file.startsWith("sim-") && file.endsWith(".db"));

        for (const file of files) {
            const id = file.slice(0, -3);
            const active = activeSessions.get(id);
            if (active) {
                snapshots.push(snapshot(active));
                continue;
            }
            try {
                const db = new Database(this.pathFor(id));
                const state = this.loadState(db, id);
                db.close();
                if (state) {
                    snapshots.push({
                        id,
                        status: state.status,
                        turn: state.turn,
                        maxTurns: state.maxTurns,
                        scenarioName: state.scenarioName,
                        scenarioDescription: state.scenarioDescription,
                        entities: state.entities || [],
                        log: state.log || [],
                        entityIndex: state.entityIndex,
                        waitingEntity: state.waitingEntity,
                        error: state.error,
                    });
                }
            } catch {
                // Skip corrupt or locked session files.
            }
        }
        return snapshots.sort(
            (a, b) =>
                (Number.parseInt(b.id.replace("sim-", ""), 10) || 0) -
                (Number.parseInt(a.id.replace("sim-", ""), 10) || 0),
        );
    }

    pathFor(id: string): string {
        return path.join(this.dataDir, `${id}.db`);
    }

    private ensureRuntimeTable(db: Database.Database): void {
        db.prepare(
            `CREATE TABLE IF NOT EXISTS runtime_meta (
        id TEXT PRIMARY KEY,
        state_json TEXT
      )`,
        ).run();
    }

    private tableExists(db: Database.Database, table: string): boolean {
        return Boolean(
            db
                .prepare(
                    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
                )
                .get(table),
        );
    }

    private readRow(
        db: Database.Database,
        table: typeof RUNTIME_META | typeof LEGACY_META,
        id: string,
    ): { state_json: string } | undefined {
        return db
            .prepare(`SELECT state_json FROM ${table} WHERE id = ?`)
            .get(id) as { state_json: string } | undefined;
    }

    private writeStateJson(
        db: Database.Database,
        id: string,
        stateJson: string,
    ): void {
        db.prepare(
            `INSERT INTO runtime_meta (id, state_json)
       VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET state_json = excluded.state_json`,
        ).run(id, stateJson);
    }
}

export const DATA_DIR = path.resolve(process.cwd(), "data");
const defaultStore = new SQLiteSessionStore(DATA_DIR);

export const loadSessionState = defaultStore.loadState.bind(defaultStore);
export const saveSession = defaultStore.save.bind(defaultStore);
export const deleteSessionFile = defaultStore.delete.bind(defaultStore);
export const listSavedSessions = defaultStore.list.bind(defaultStore);
