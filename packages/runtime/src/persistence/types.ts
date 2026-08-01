import type Database from "better-sqlite3";
import type { RuntimeSession, SavedSessionState } from "../session.js";
import type { RuntimeSnapshot } from "../snapshot.js";

export interface SessionStore {
    readonly dataDir: string;
    loadState(db: Database.Database, id: string): SavedSessionState | null;
    save(session: RuntimeSession): void;
    delete(id: string): void;
    list(
        activeSessions: ReadonlyMap<string, RuntimeSession>,
        snapshot: (session: RuntimeSession) => RuntimeSnapshot,
    ): RuntimeSnapshot[];
}
