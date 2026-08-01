export class RuntimeError extends Error {
    constructor(
        message: string,
        readonly code: string,
        options?: ErrorOptions,
    ) {
        super(message, options);
        this.name = "RuntimeError";
    }
}

export class SessionNotFoundError extends RuntimeError {
    constructor(sessionId: string) {
        super(`Runtime session not found: ${sessionId}`, "SESSION_NOT_FOUND");
        this.name = "SessionNotFoundError";
    }
}

export class ProviderUnavailableError extends RuntimeError {
    constructor(message: string) {
        super(message, "PROVIDER_UNAVAILABLE");
        this.name = "ProviderUnavailableError";
    }
}
