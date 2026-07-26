export interface CreateRuntimeCommand {
    scenarioPath: string;
    playEntityName?: string;
    providerInstanceId?: string;
    customName?: string;
}

export interface SubmitPlayerActionCommand {
    sessionId: string;
    prose: string;
}

export interface RenameRuntimeCommand {
    sessionId: string;
    name: string;
}
