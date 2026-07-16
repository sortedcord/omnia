/**
 * ModelLister — fetches available models from each provider's REST API.
 * Results are cached in-memory with a 5-minute TTL to avoid repeated calls.
 */

export interface ModelInfo {
  id: string;
  name: string;
  ownedBy?: string;
}

interface CacheEntry {
  models: ModelInfo[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const FETCH_TIMEOUT_MS = 10_000; // 10 seconds

// Cache key is "providerName:apiKey-or-endpoint" (we don't hash since it's in-process)
const modelCache = new Map<string, CacheEntry>();

function cacheKey(
  providerName: string,
  apiKey: string,
  endpointUrl?: string,
): string {
  return `${providerName}:${endpointUrl || apiKey}`;
}

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchGeminiModels(apiKey: string): Promise<ModelInfo[]> {
  const models: ModelInfo[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(
      "https://generativelanguage.googleapis.com/v1beta/models",
    );
    url.searchParams.set("key", apiKey);
    url.searchParams.set("pageSize", "100");
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const res = await fetchWithTimeout(url.toString());
    if (!res.ok) return models;

    const json = (await res.json()) as {
      models?: { name: string; displayName?: string }[];
      nextPageToken?: string;
    };

    for (const m of json.models ?? []) {
      // m.name is like "models/gemini-2.5-flash"; strip "models/" prefix
      const id = m.name.replace(/^models\//, "");
      models.push({ id, name: m.displayName || id });
    }

    pageToken = json.nextPageToken;
  } while (pageToken);

  return models;
}

async function fetchOpenAICompatibleModels(
  baseUrl: string,
  apiKey: string,
): Promise<ModelInfo[]> {
  const res = await fetchWithTimeout(`${baseUrl}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) return [];

  const json = (await res.json()) as {
    data?: { id: string; owned_by?: string; name?: string }[];
  };

  return (json.data ?? []).map((m) => ({
    id: m.id,
    name: m.name || m.id,
    ownedBy: m.owned_by,
  }));
}

async function fetchAnthropicModels(apiKey: string): Promise<ModelInfo[]> {
  const models: ModelInfo[] = [];
  let afterId: string | undefined;

  do {
    const url = new URL("https://api.anthropic.com/v1/models");
    url.searchParams.set("limit", "1000");
    if (afterId) {
      url.searchParams.set("after_id", afterId);
    }

    const res = await fetchWithTimeout(url.toString(), {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        Accept: "application/json",
      },
    });
    if (!res.ok) return models;

    const json = (await res.json()) as {
      data?: { id: string; display_name?: string }[];
      has_more?: boolean;
      last_id?: string;
    };

    for (const m of json.data ?? []) {
      models.push({ id: m.id, name: m.display_name || m.id });
    }

    afterId = json.has_more ? json.last_id : undefined;
  } while (afterId);

  return models;
}

async function fetchOllamaModels(endpointUrl: string): Promise<ModelInfo[]> {
  const base = endpointUrl.replace(/\/$/, "");
  const res = await fetchWithTimeout(`${base}/api/tags`);
  if (!res.ok) return [];

  const json = (await res.json()) as {
    models?: { name: string; model?: string }[];
  };

  return (json.models ?? []).map((m) => ({
    id: m.name,
    name: m.name,
  }));
}

async function fetchOpenRouterModels(apiKey: string): Promise<ModelInfo[]> {
  const res = await fetchWithTimeout(
    "https://openrouter.ai/api/v1/models",
    apiKey
      ? {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
        }
      : { headers: { Accept: "application/json" } },
  );
  if (!res.ok) return [];

  const json = (await res.json()) as {
    data?: { id: string; name?: string; owned_by?: string }[];
  };

  return (json.data ?? []).map((m) => ({
    id: m.id,
    name: m.name || m.id,
    ownedBy: m.owned_by,
  }));
}

export class ModelLister {
  /**
   * List available models for a given provider. Results are cached for 5 minutes.
   *
   * @param providerName  The provider ID (e.g. "openai", "google-genai")
   * @param apiKey        The API key for the provider (or "none" for Ollama)
   * @param endpointUrl   The endpoint URL (required for Ollama, ignored otherwise)
   * @returns             Array of ModelInfo objects, or [] on any error
   */
  static async listModels(
    providerName: string,
    apiKey: string,
    endpointUrl?: string,
  ): Promise<ModelInfo[]> {
    if (providerName === "mock") {
      return [{ id: "mock", name: "Mock Model" }];
    }

    const key = cacheKey(providerName, apiKey, endpointUrl);
    const cached = modelCache.get(key);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.models;
    }

    let models: ModelInfo[] = [];
    try {
      switch (providerName) {
        case "google-genai":
          models = await fetchGeminiModels(apiKey);
          break;
        case "openai":
          models = await fetchOpenAICompatibleModels(
            "https://api.openai.com/v1",
            apiKey,
          );
          break;
        case "anthropic":
          models = await fetchAnthropicModels(apiKey);
          break;
        case "groq":
          models = await fetchOpenAICompatibleModels(
            "https://api.groq.com/openai/v1",
            apiKey,
          );
          break;
        case "deepseek":
          models = await fetchOpenAICompatibleModels(
            "https://api.deepseek.com",
            apiKey,
          );
          break;
        case "ollama":
          models = await fetchOllamaModels(
            endpointUrl || "http://localhost:11434",
          );
          break;
        case "openrouter":
          models = await fetchOpenRouterModels(apiKey);
          break;
        default:
          models = [];
      }
    } catch {
      // Network error, invalid key, timeout — return empty array for graceful degradation
      models = [];
    }

    modelCache.set(key, { models, fetchedAt: Date.now() });
    return models;
  }

  /** Invalidate the cache entry for a specific provider+key combination. */
  static invalidateCache(
    providerName: string,
    apiKey: string,
    endpointUrl?: string,
  ): void {
    modelCache.delete(cacheKey(providerName, apiKey, endpointUrl));
  }

  /** Clear the entire model cache. */
  static clearCache(): void {
    modelCache.clear();
  }
}
