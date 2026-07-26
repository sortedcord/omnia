import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { SQLiteRepository } from "@omnia/core";
import { BufferRepository, LedgerRepository } from "@omnia/memory";
import { Architect, AliasDeltaGenerator } from "@omnia/architect";
import { ProviderManager, buildEmbeddingProvider } from "@omnia/llm";
import type { ModelProviderInstance, IEmbeddingProvider } from "@omnia/llm";
import { ScenarioLoader } from "@omnia/scenario";
import type { RuntimeSession } from "./session.js";
import type { EntityInfo, RuntimeSnapshot } from "./snapshot.js";
import { resolveProviders } from "./providers.js";
import { SQLiteSessionStore } from "./persistence/sqlite-session-store.js";
import type { SessionStore } from "./persistence/types.js";
import {
    preparePlayerTurn,
    processNpcTurn,
    executePlayerAction,
} from "./turn-executor.js";
import { runAliasResolution, runHandoffResolution } from "./alias-handoff.js";

export interface RuntimeServiceOptions {
    dataDir?: string;
    store?: SessionStore;
    idFactory?: () => string;
}

export class RuntimeService {
    private readonly sessions = new Map<string, RuntimeSession>();
    private readonly pending = new Map<string, Promise<unknown>>();
    private readonly store: SessionStore;
    private readonly idFactory: () => string;
    private lastTimestamp = 0;

    constructor(options: RuntimeServiceOptions = {}) {
        this.store =
            options.store ??
            new SQLiteSessionStore(
                options.dataDir ?? path.resolve(process.cwd(), "data"),
            );
        this.idFactory =
            options.idFactory ??
            (() => {
                this.lastTimestamp = Math.max(Date.now(), this.lastTimestamp + 1);
                return `sim-${this.lastTimestamp}`;
            });
    }

    async create(
        scenarioPath: string,
        playEntityName?: string,
        providerInstanceId?: string,
        customName?: string,
    ): Promise<RuntimeSnapshot> {
        let activeInstance: ModelProviderInstance | null = providerInstanceId
            ? (ProviderManager.list().find((item) => item.id === providerInstanceId) ??
                null)
            : ProviderManager.getActive("generative");
        if (!activeInstance && process.env.GOOGLE_API_KEY) {
            activeInstance = ProviderManager.create(
                "Default (Env)",
                "google-genai",
                process.env.GOOGLE_API_KEY,
                undefined,
                "generative",
            );
        }
        if (!activeInstance) return this.providerErrorSnapshot();

        const scenarioJson = JSON.parse(fs.readFileSync(scenarioPath, "utf-8"));
        const id = this.idFactory();
        fs.mkdirSync(this.store.dataDir, { recursive: true });
        const dbPath = path.join(this.store.dataDir, `${id}.db`);
        const db = new Database(dbPath);
        const coreRepo = new SQLiteRepository(db);
        const bufferRepo = new BufferRepository(db);
        const ledgerRepo = new LedgerRepository(db);
        await new ScenarioLoader(coreRepo, bufferRepo).initializeWorld(
            scenarioJson,
            id,
        );

        const worldState = coreRepo.loadWorldState(id);
        if (!worldState) {
            db.close();
            return this.errorSnapshot("Failed to load world state after initialization.");
        }
        const rawEntities = Array.from(worldState.entities.values());
        const entities: EntityInfo[] = rawEntities.map((entity) => ({
            id: entity.id,
            name:
                (entity.attributes.get("name")?.getValue() as string | undefined) ??
                entity.id,
            isPlayer: false,
            isAgent: entity.isAgent,
        }));
        const playerEntityId = this.resolvePlayerEntity(
            rawEntities,
            entities,
            playEntityName,
        );
        const mappings = ProviderManager.getMappings();
        const providers = resolveProviders(mappings, {
            fallbackInstance: activeInstance,
        });
        const session: RuntimeSession = {
            db,
            dbPath,
            coreRepo,
            bufferRepo,
            ledgerRepo,
            worldInstanceId: id,
            scenarioName: customName || scenarioJson.name,
            scenarioDescription: scenarioJson.description || "",
            turn: 1,
            maxTurns: 20,
            entities,
            playerEntityId,
            entityIndex: 0,
            ...providers,
            architect: new Architect(
                {
                    validator: providers.validatorProvider,
                    timedelta: providers.timedeltaProvider,
                },
                coreRepo,
            ),
            aliasGenerator: new AliasDeltaGenerator(providers.actorProvider),
            log: [],
            status: "running",
            aliasDoneForTurn: false,
            providerMappings: mappings,
        };
        this.sessions.set(id, session);
        this.store.save(session);
        return this.snapshot(session);
    }

    async load(id: string): Promise<RuntimeSnapshot | null> {
        return this.exclusive(id, async () => {
            const active = this.sessions.get(id);
            if (active) return this.snapshot(active);
            const dbPath = path.join(this.store.dataDir, `${id}.db`);
            if (!fs.existsSync(dbPath)) return null;

            let db: Database.Database | undefined;
            try {
                db = new Database(dbPath);
                const state = this.store.loadState(db, id);
                if (!state) {
                    db.close();
                    return null;
                }
                const providers = resolveProviders(state.providerMappings || {}, {
                    required: true,
                });
                const coreRepo = new SQLiteRepository(db);
                const bufferRepo = new BufferRepository(db);
                const ledgerRepo = new LedgerRepository(db);
                const session: RuntimeSession = {
                    ...state,
                    db,
                    dbPath,
                    coreRepo,
                    bufferRepo,
                    ledgerRepo,
                    worldInstanceId: id,
                    ...providers,
                    architect: new Architect(
                        {
                            validator: providers.validatorProvider,
                            timedelta: providers.timedeltaProvider,
                        },
                        coreRepo,
                    ),
                    aliasGenerator: new AliasDeltaGenerator(providers.actorProvider),
                    entities: state.entities || [],
                    log: state.log || [],
                    aliasDoneForTurn: state.aliasDoneForTurn || false,
                    providerMappings: state.providerMappings || {},
                };
                this.sessions.set(id, session);
                return this.snapshot(session);
            } catch (error) {
                if (db?.open) db.close();
                console.error(`Failed to load session ${id}:`, error);
                return null;
            }
        });
    }

    close(id: string): void {
        const session = this.sessions.get(id);
        if (session) session.db.close();
        this.sessions.delete(id);
    }

    deleteSession(id: string): void {
        this.close(id);
        this.store.delete(id);
    }

    listSavedSessions(): RuntimeSnapshot[] {
        return this.store.list(this.sessions, (session) => this.snapshot(session));
    }

    getSnapshot(id: string): RuntimeSnapshot | null {
        const session = this.sessions.get(id);
        return session ? this.snapshot(session) : null;
    }

    async rename(id: string, newName: string): Promise<RuntimeSnapshot | null> {
        if (!this.sessions.has(id)) await this.load(id);
        return this.exclusive(id, async () => {
            const session = this.sessions.get(id);
            if (!session) return null;
            session.scenarioName = newName;
            this.store.save(session);
            return this.snapshot(session);
        });
    }

    async step(id: string): Promise<RuntimeSnapshot | null> {
        return this.exclusive(id, async () => {
            const session = this.sessions.get(id);
            if (!session) return null;
            if (session.status !== "running") return this.snapshot(session);
            try {
                if (session.turn > session.maxTurns) {
                    session.status = "done";
                } else if (!session.aliasDoneForTurn && session.entityIndex === 0) {
                    await runAliasResolution(session);
                    await runHandoffResolution(session);
                    session.aliasDoneForTurn = true;
                } else if (session.entityIndex >= session.entities.length) {
                    session.turn++;
                    session.entityIndex = 0;
                    session.aliasDoneForTurn = false;
                } else {
                    const info = session.entities[session.entityIndex];
                    if (!info.isAgent) session.entityIndex++;
                    else if (info.isPlayer) await preparePlayerTurn(session, info);
                    else {
                        await processNpcTurn(session, info);
                        session.entityIndex++;
                    }
                }
            } catch (error) {
                session.status = "error";
                session.error = error instanceof Error ? error.message : String(error);
            }
            this.store.save(session);
            return this.snapshot(session);
        });
    }

    async submitPlayerAction(
        id: string,
        prose: string,
    ): Promise<RuntimeSnapshot | null> {
        return this.exclusive(id, async () => {
            const session = this.sessions.get(id);
            if (!session) return null;
            if (session.status !== "waiting_player" || !session.waitingEntity) {
                return this.snapshot(session);
            }
            const context = session.waitingEntity;
            session.waitingEntity = undefined;
            session.status = "running";
            try {
                await executePlayerAction(session, context, prose);
                session.entityIndex++;
            } catch (error) {
                session.status = "error";
                session.error = error instanceof Error ? error.message : String(error);
            }
            this.store.save(session);
            return this.snapshot(session);
        });
    }

    async regenerateAllEmbeddings(
        newProviderInstanceId?: string,
    ): Promise<void> {
        if (!fs.existsSync(this.store.dataDir)) return;
        let instance = newProviderInstanceId
            ? (ProviderManager.list().find((item) => item.id === newProviderInstanceId) ??
                null)
            : null;
        if (!instance || instance.type !== "embedding") {
            instance = ProviderManager.getActive("embedding");
        }
        if (!instance) {
            instance = process.env.GOOGLE_API_KEY
                ? {
                    id: "regen-env-fallback",
                    name: "Gemini Embed (Env)",
                    providerName: "google-genai",
                    apiKey: process.env.GOOGLE_API_KEY,
                    isActive: true,
                    modelName: "gemini-embedding-001",
                    type: "embedding",
                    maxContext: 0,
                }
                : {
                    id: "regen-mock-fallback",
                    name: "Mock Embed (Fallback)",
                    providerName: "mock",
                    apiKey: "",
                    isActive: true,
                    modelName: undefined,
                    type: "embedding",
                    maxContext: 0,
                };
        }
        const embeddingProvider: IEmbeddingProvider = buildEmbeddingProvider(instance);
        const files = fs
            .readdirSync(this.store.dataDir)
            .filter((file) => file.startsWith("sim-") && file.endsWith(".db"));
        for (const file of files) {
            const id = file.slice(0, -3);
            const active = this.sessions.get(id);
            const db = active?.db ?? new Database(path.join(this.store.dataDir, file));
            try {
                const rows = db
                    .prepare("SELECT id, content FROM ledger_entries")
                    .all() as { id: string; content: string }[];
                for (const row of rows) {
                    const vector = await embeddingProvider.embed(row.content);
                    db.prepare("UPDATE ledger_entries SET embedding = ? WHERE id = ?").run(
                        Buffer.from(new Float32Array(vector).buffer),
                        row.id,
                    );
                }
            } catch (error) {
                console.error(`Failed to regenerate embeddings for ${file}:`, error);
            } finally {
                if (!active) db.close();
            }
        }
    }

    private snapshot(session: RuntimeSession): RuntimeSnapshot {
        const worldState = session.coreRepo.loadWorldState(session.worldInstanceId);
        const entities = session.entities.map((entity) => {
            const actual = worldState?.getEntity(entity.id);
            return {
                ...entity,
                aliases: actual ? Object.fromEntries(actual.aliases) : {},
            };
        });
        let currentLocation: string | undefined;
        if (
            worldState &&
            session.entityIndex >= 0 &&
            session.entityIndex < session.entities.length
        ) {
            const actual = worldState.getEntity(
                session.entities[session.entityIndex].id,
            );
            currentLocation = actual?.locationId
                ? worldState.getLocation(actual.locationId)?.id
                : undefined;
        }
        return {
            id: session.worldInstanceId,
            status: session.status,
            turn: session.turn,
            maxTurns: session.maxTurns,
            scenarioName: session.scenarioName,
            scenarioDescription: session.scenarioDescription,
            entities,
            log: session.log,
            entityIndex: session.entityIndex,
            waitingEntity: session.waitingEntity,
            error: session.error,
            worldTime: worldState?.clock.get().toISOString(),
            currentLocation,
        };
    }

    private resolvePlayerEntity(
        rawEntities: Array<{
            id: string;
            attributes: Map<string, { getValue(): unknown }>;
        }>,
        entities: EntityInfo[],
        name?: string,
    ): string | undefined {
        if (!name) return undefined;
        const query = name.toLowerCase();
        const matched =
            rawEntities.find((entity) => entity.id === name) ??
            rawEntities.find(
                (entity) =>
                    String(entity.attributes.get("name")?.getValue()).toLowerCase() ===
                    query,
            ) ??
            rawEntities.find((entity) => {
                const entityName = String(
                    entity.attributes.get("name")?.getValue() ?? "",
                ).toLowerCase();
                return entityName.includes(query) || entity.id.toLowerCase().includes(query);
            });
        if (!matched) return undefined;
        const info = entities.find((entity) => entity.id === matched.id);
        if (info) info.isPlayer = true;
        return matched.id;
    }

    private exclusive<T>(id: string, operation: () => Promise<T>): Promise<T> {
        const previous = this.pending.get(id) ?? Promise.resolve();
        const current = previous.catch(() => undefined).then(operation);
        this.pending.set(id, current);
        void current.then(() => {
            if (this.pending.get(id) === current) this.pending.delete(id);
        }, () => {
            if (this.pending.get(id) === current) this.pending.delete(id);
        });
        return current;
    }

    private providerErrorSnapshot(): RuntimeSnapshot {
        return this.errorSnapshot(
            "No active LLM Provider Instance found. Please configure a key in Settings first.",
        );
    }

    private errorSnapshot(error: string): RuntimeSnapshot {
        return {
            id: "",
            status: "error",
            turn: 0,
            maxTurns: 20,
            scenarioName: "",
            scenarioDescription: "",
            entities: [],
            log: [],
            entityIndex: 0,
            error,
        };
    }
}

/** @deprecated Use RuntimeService. */
export class SimulationManager extends RuntimeService { }
