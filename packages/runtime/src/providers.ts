import {
    MockLLMProvider,
    MockEmbeddingProvider,
    ProviderManager,
    buildLLMProvider,
    buildEmbeddingProvider,
} from "@omnia/llm";
import type {
    ILLMProvider,
    IEmbeddingProvider,
    ModelProviderInstance,
} from "@omnia/llm";

export interface ResolvedProviders {
    actorProvider: ILLMProvider;
    validatorProvider: ILLMProvider;
    decoderProvider: ILLMProvider;
    timedeltaProvider: ILLMProvider;
    handoffProvider: ILLMProvider;
    embeddingProvider: IEmbeddingProvider;
}

export interface ProviderResolverOptions {
    fallbackInstance?: ModelProviderInstance | null;
    required?: boolean;
}

export function resolveProviders(
    mappings: Record<string, string>,
    options: ProviderResolverOptions = {},
): ResolvedProviders {
    const { fallbackInstance = null, required = false } = options;
    const list = ProviderManager.list();
    const activeGenerative =
        ProviderManager.getActive("generative") ?? fallbackInstance ?? null;

    const resolveGenerative = (task: string): ILLMProvider => {
        const mappedId = mappings[task];
        let inst: ModelProviderInstance | null = mappedId
            ? (list.find((provider) => provider.id === mappedId) ?? null)
            : null;

        if (!inst || inst.type !== "generative") inst = activeGenerative;
        if (!inst && process.env.GOOGLE_API_KEY) {
            inst = ProviderManager.create(
                "Default (Env)",
                "google-genai",
                process.env.GOOGLE_API_KEY,
                undefined,
                "generative",
            );
        }
        if (!inst) {
            if (required) {
                throw new Error(
                    `No active LLM Provider Instance found for task "${task}". Please configure a key in Settings first.`,
                );
            }
            return new MockLLMProvider([]);
        }
        return buildLLMProvider(inst);
    };

    const resolveEmbedding = (): IEmbeddingProvider => {
        const mappedId = mappings.embeddings;
        let inst: ModelProviderInstance | null = mappedId
            ? (list.find((provider) => provider.id === mappedId) ?? null)
            : null;

        if (!inst || inst.type !== "embedding") {
            inst = ProviderManager.getActive("embedding");
        }
        if (!inst && process.env.GOOGLE_API_KEY) {
            inst = ProviderManager.create(
                "Default Embed (Env)",
                "google-genai",
                process.env.GOOGLE_API_KEY,
                "gemini-embedding-001",
                "embedding",
            );
        }
        if (!inst) {
            if (required) {
                throw new Error(
                    "No active Embedding Provider Instance found. Please configure an embedding key in Settings first.",
                );
            }
            return new MockEmbeddingProvider(undefined);
        }
        return buildEmbeddingProvider(inst);
    };

    return {
        actorProvider: resolveGenerative("actor-prose"),
        validatorProvider: resolveGenerative("llm-validator"),
        decoderProvider: resolveGenerative("intent-decoder"),
        timedeltaProvider: resolveGenerative("timedelta"),
        handoffProvider: resolveGenerative("handoff"),
        embeddingProvider: resolveEmbedding(),
    };
}
