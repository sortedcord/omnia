"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getConfigStatus,
  listProviderInstances,
  createProviderInstance,
  deleteProviderInstance,
  setActiveProviderInstance,
  getProviderMappings,
  setProviderMapping,
  updateProviderInstance,
  getAvailableProviders,
  regenerateEmbeddings,
} from "@/app/play/actions";
import type { ModelProviderInstance, ModelProviderMeta } from "@omnia/llm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ConfigStatus {
  apiKeySet: boolean;
  apiKeyPreview: string;
  model: string;
  availableScenarios: { path: string; name: string }[];
}

export default function ConfigPage() {
  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [instances, setInstances] = useState<ModelProviderInstance[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [availableProviders, setAvailableProviders] = useState<ModelProviderMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editProvider, setEditProvider] = useState("google-genai");
  const [editKey, setEditKey] = useState("");
  const [editModel, setEditModel] = useState("gemini-2.5-flash");
  const [editIsActive, setEditIsActive] = useState(false);
  const [editType, setEditType] = useState<"generative" | "embedding">("generative");
  const [editMaxContext, setEditMaxContext] = useState<number>(32768);

  useEffect(() => {
    if (selectedInstanceId === null) {
      setEditName("");
      setEditProvider("google-genai");
      setEditKey("");
      setEditModel("gemini-2.5-flash");
      setEditIsActive(false);
      setEditType("generative");
      setEditMaxContext(32768);
    } else if (selectedInstanceId === "new") {
      setEditName("");
      const defaultProvider = "google-genai";
      setEditProvider(defaultProvider);
      setEditKey("");
      setEditType("generative");
      const pMeta = availableProviders.find((p) => p.id === defaultProvider);
      setEditModel(pMeta?.defaultModel || "gemini-2.5-flash");
      setEditIsActive(false);
      setEditMaxContext(32768);
    } else {
      const inst = instances.find((i) => i.id === selectedInstanceId);
      if (inst) {
        setEditName(inst.name);
        setEditProvider(inst.providerName);
        setEditKey("");
        setEditType(inst.type || "generative");
        const pMeta = availableProviders.find((p) => p.id === inst.providerName);
        setEditModel(inst.modelName || (inst.type === "embedding" ? pMeta?.defaultEmbeddingModel : pMeta?.defaultModel) || "gemini-2.5-flash");
        setEditIsActive(inst.isActive);
        setEditMaxContext(inst.maxContext !== undefined && inst.maxContext !== null ? inst.maxContext : 32768);
      }
    }
  }, [selectedInstanceId, instances, availableProviders]);

  const handleProviderChange = (providerId: string) => {
    setEditProvider(providerId);
    const pMeta = availableProviders.find((p) => p.id === providerId);
    setEditModel(editType === "embedding" ? pMeta?.defaultEmbeddingModel || "" : pMeta?.defaultModel || "");
  };

  const handleTypeChange = (type: "generative" | "embedding") => {
    setEditType(type);
    const pMeta = availableProviders.find((p) => p.id === editProvider);
    setEditModel(type === "embedding" ? pMeta?.defaultEmbeddingModel || "" : pMeta?.defaultModel || "");
  };

  const loadInstances = useCallback(async () => {
    const list = await listProviderInstances();
    setInstances(list);
  }, []);

  const loadMappings = useCallback(async () => {
    const maps = await getProviderMappings();
    setMappings(maps);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const status = await getConfigStatus();
      setConfig(status);
      await loadInstances();
      await loadMappings();
      const provs = await getAvailableProviders();
      setAvailableProviders(provs);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [loadInstances, loadMappings]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      setError("Name is required.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      let shouldRegenerate = false;
      let targetInstanceId = selectedInstanceId;

      if (selectedInstanceId === "new") {
        if (!editKey.trim()) {
          setError("API Key is required for new instances.");
          setLoading(false);
          return;
        }
        const created = await createProviderInstance(editName, editProvider, editKey, editModel || undefined, editType, editType === "generative" ? editMaxContext : 0);
        if (editIsActive) {
          await setActiveProviderInstance(created.id);
        }
        targetInstanceId = created.id;
        setSelectedInstanceId(created.id);
      } else {
        if (!selectedInstanceId) return;
        const inst = instances.find((i) => i.id === selectedInstanceId);
        if (inst && inst.type === "embedding") {
          const isMapped = mappings["embeddings"] === selectedInstanceId;
          const isActive = inst.isActive && !mappings["embeddings"];
          if (isMapped || isActive) {
            const hasChanged = inst.providerName !== editProvider || inst.modelName !== editModel;
            if (hasChanged) {
              const confirmChange = window.confirm(
                "You have changed the configuration of the active embedding provider. This will delete all existing embeddings and regenerate them from scratch. Are you sure you want to do this?"
              );
              if (!confirmChange) {
                setLoading(false);
                return;
              }
              shouldRegenerate = true;
            }
          }
        }

        await updateProviderInstance(selectedInstanceId, editName, editProvider, editKey || undefined, editModel || undefined, editType, editType === "generative" ? editMaxContext : 0);
        if (editIsActive) {
          await setActiveProviderInstance(selectedInstanceId);
        }
      }

      await loadInstances();
      await loadMappings();

      if (shouldRegenerate && targetInstanceId && targetInstanceId !== "new") {
        await regenerateEmbeddings(targetInstanceId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (selectedInstanceId === "new" || selectedInstanceId === null) return;
    if (!confirm("Are you sure you want to delete this provider instance?")) return;

    try {
      setLoading(true);
      setError("");
      await deleteProviderInstance(selectedInstanceId);
      setSelectedInstanceId(null);
      await loadInstances();
      await loadMappings();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMapping = async (task: string, providerInstanceId: string) => {
    if (task === "embeddings" && mappings[task] !== providerInstanceId) {
      const confirmChange = window.confirm(
        "Changing the embeddings provider will delete all existing embeddings and regenerate them from scratch. Are you sure you want to do this?"
      );
      if (!confirmChange) return;
    }

    try {
      setLoading(true);
      await setProviderMapping(task, providerInstanceId);
      if (task === "embeddings") {
        await regenerateEmbeddings(providerInstanceId);
      }
      await loadMappings();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-[800px] px-4 py-8">
      <h1 className="mb-6 text-2xl">Configuration</h1>

      {config === null && loading && <p>Loading configuration...</p>}
      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {config && (
        <div className={loading ? "opacity-60 pointer-events-none transition-opacity duration-200" : "transition-opacity duration-200"}>
          <section className="mb-8 pb-6">
            <h2 className="mb-3 text-lg">LLM Provider Instances</h2>
            <div className="mt-4 grid min-h-[400px] grid-cols-1 overflow-hidden rounded-xl border border-gray-200 bg-white md:grid-cols-[30%_70%]">
              {/* 30% area */}
              <div className="flex flex-col border-r border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between border-b border-gray-200 bg-gray-100 px-4 py-4">
                  <h3 className="m-0 text-[0.95rem] font-semibold text-[#111]">
                    Instances
                  </h3>
                  <Button
                    onClick={() => setSelectedInstanceId("new")}
                    size="sm"
                    className="bg-emerald-500 text-white hover:bg-emerald-600"
                  >
                    + Add
                  </Button>
                </div>
                <div className="flex flex-1 flex-col overflow-y-auto">
                  {instances.length === 0 ? (
                    <div className="px-4 py-8 text-center text-xs text-gray-400">
                      No instances configured
                    </div>
                  ) : (
                    instances.map((inst) => (
                      <div
                        key={inst.id}
                        onClick={() => setSelectedInstanceId(inst.id)}
                        className={`cursor-pointer border-b border-gray-200 border-l-[3px] px-4 py-4 transition-all hover:bg-gray-100 ${
                          selectedInstanceId === inst.id
                            ? "border-l-blue-500 bg-blue-50"
                            : "border-l-transparent"
                        }`}
                      >
                        <div className="text-sm font-medium text-[#111]">
                          {inst.name}
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                          <span>{inst.providerName} ({inst.type || "generative"})</span>
                            {inst.isActive && (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                              Active
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 70% area */}
              <div className="flex flex-col bg-white">
                {selectedInstanceId === null ? (
                  <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-sm text-gray-400">
                    Press + to add or select an existing Instance to edit
                  </div>
                ) : (
                  <form onSubmit={handleSave} className="flex h-full flex-col justify-between">
                    <div className="flex flex-1 flex-col gap-5 p-6">
                      <h3 className="m-0 mb-2 text-lg font-semibold text-[#111]">
                        {selectedInstanceId === "new"
                          ? "Create New Provider Instance"
                          : `Configure: ${editName}`}
                      </h3>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="formName">Friendly Name</Label>
                        <Input
                          id="formName"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="e.g. Gemini - Production"
                          required
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label>Instance Type</Label>
                        <Select value={editType} onValueChange={(v) => handleTypeChange(v as "generative" | "embedding")}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="generative">Generative (Chat / Text Completion)</SelectItem>
                            <SelectItem value="embedding">Embedding (Vector generation)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label>Provider Type</Label>
                        <Select value={editProvider} onValueChange={handleProviderChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableProviders.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.displayName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {editProvider && availableProviders.length > 0 && (
                          <span className="mt-1 block rounded border border-2 bg-muted px-3 py-2 text-xs text-muted-foreground">
                            {availableProviders.find((p) => p.id === editProvider)?.description}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="formKey">API Key</Label>
                        <Input
                          id="formKey"
                          type="password"
                          value={editKey}
                          onChange={(e) => setEditKey(e.target.value)}
                          placeholder={
                            selectedInstanceId === "new"
                              ? "AIzaSy..."
                              : "•••••••• (unchanged)"
                          }
                          required={selectedInstanceId === "new"}
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="formModel">Model Name</Label>
                        <Input
                          id="formModel"
                          value={editModel}
                          onChange={(e) => setEditModel(e.target.value)}
                          placeholder="e.g. gemini-2.5-flash, gemini-2.5-pro"
                        />
                      </div>

                      {editType === "generative" && (
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="formMaxContext">Max Context Length (Tokens, 0 for infinite)</Label>
                          <Input
                            id="formMaxContext"
                            type="number"
                            value={editMaxContext}
                            onChange={(e) => setEditMaxContext(parseInt(e.target.value) || 0)}
                            min={0}
                            placeholder="e.g. 32768"
                          />
                        </div>
                      )}

                      <div className="mt-1 flex flex-row items-center gap-2">
                        <Checkbox
                          id="formActive"
                          checked={editIsActive}
                          onCheckedChange={(v) => setEditIsActive(v === true)}
                        />
                        <Label htmlFor="formActive" className="cursor-pointer">
                          Set as Active Instance
                        </Label>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t-2 bg-muted/50 px-6 py-4">
                      <div>
                        {selectedInstanceId !== "new" && (
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={loading}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                      <div>
                        <Button
                          type="submit"
                          disabled={loading}
                        >
                          {loading ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </section>

          <section className="mb-8 pb-6">
            <h2 className="mb-3 text-lg">Task Provider Routing</h2>
            <p className="my-4 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              Configure which LLM Provider Key Instance should handle each
              specific simulation task. Mappings default to the currently{" "}
              <strong>Active</strong> instance if not specified.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {[
                { key: "actor-prose", label: "Actor Prose Generation", desc: "Generates roleplay/narrative prose for Non-Player Characters.", type: "generative" },
                { key: "llm-validator", label: "LLM Validator", desc: "Arbitrates and validates proposed actions against the world state rules.", type: "generative" },
                { key: "intent-decoder", label: "Intent Decoder", desc: "Splits raw prose actions into structured intents (Player and NPC).", type: "generative" },
                { key: "timedelta", label: "TimeDelta Generator", desc: "Calculates the duration of character actions to advance the game clock.", type: "generative" },
                { key: "handoff", label: "Memory Handoff Engine", desc: "Promotes entities' working memories to the long-term Ledger via LLM summarization and pruning.", type: "generative" },
                { key: "embeddings", label: "Text Embeddings Generator", desc: "Generates vector embeddings for long-term memory retrieval.", type: "embedding" },
              ].map((task) => (
                <div
                  key={task.key}
                  className="flex flex-col justify-between gap-3 rounded-lg border-2 bg-card p-4"
                >
                  <div className="flex flex-col gap-1 text-xs">
                    <strong className="text-sm text-foreground">
                      {task.label}
                    </strong>
                    <span className="mt-0.5 text-muted-foreground">{task.desc}</span>
                  </div>
                  <select
                    value={mappings[task.key] || ""}
                    onChange={(e) =>
                      handleUpdateMapping(task.key, e.target.value)
                    }
                    className="w-full rounded border-2 bg-input px-2 py-1.5 text-xs shadow-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <option value="">-- Use Active Key (Default) --</option>
                    {instances
                      .filter((inst) => (inst.type || "generative") === task.type)
                      .map((inst) => (
                        <option key={inst.id} value={inst.id}>
                          {inst.name} ({inst.providerName}){inst.isActive ? " [Active]" : ""}
                        </option>
                      ))}
                  </select>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-8 pb-6">
            <h2 className="mb-3 text-lg">Available Scenarios</h2>
            {config.availableScenarios.length === 0 ? (
              <p className="mt-3 rounded border border-amber-200 bg-amber-100 px-3 py-2 text-xs text-amber-800">
                No scenarios found in{" "}
                <code className="font-mono text-xs">
                  content/demo/scenarios/
                </code>
                .
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Path</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {config.availableScenarios.map((s) => (
                    <TableRow key={s.path}>
                      <TableCell>{s.name}</TableCell>
                      <TableCell>
                        <code className="font-mono text-xs text-blue-600">
                          {s.path}
                        </code>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
