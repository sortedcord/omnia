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
} from "@/app/play/actions";
import type { LLMProviderInstance } from "@/lib/provider-manager";

interface ConfigStatus {
  apiKeySet: boolean;
  apiKeyPreview: string;
  model: string;
  availableScenarios: { path: string; name: string }[];
}

export default function ConfigPage() {
  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [instances, setInstances] = useState<LLMProviderInstance[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newName, setNewName] = useState("");
  const [newProvider, setNewProvider] = useState("google-genai");
  const [newKey, setNewKey] = useState("");

  const loadInstances = useCallback(async () => {
    try {
      const list = await listProviderInstances();
      setInstances(list);
    } catch {
      // ignore
    }
  }, []);

  const loadMappings = useCallback(async () => {
    try {
      const maps = await getProviderMappings();
      setMappings(maps);
    } catch {
      // ignore
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getConfigStatus();
      setConfig(result);
      await loadInstances();
      await loadMappings();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [loadInstances, loadMappings]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleAddInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newKey.trim()) return;
    try {
      setLoading(true);
      await createProviderInstance(newName, newProvider, newKey);
      setNewName("");
      setNewKey("");
      await loadInstances();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInstance = async (id: string) => {
    if (!confirm("Are you sure you want to delete this provider instance?")) return;
    try {
      setLoading(true);
      await deleteProviderInstance(id);
      await loadInstances();
      await loadMappings();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSetActiveInstance = async (id: string) => {
    try {
      setLoading(true);
      await setActiveProviderInstance(id);
      await loadInstances();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMapping = async (task: string, providerInstanceId: string) => {
    try {
      setLoading(true);
      await setProviderMapping(task, providerInstanceId);
      await loadMappings();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="config-page">
      <h1>Configuration</h1>

      {loading && <p>Loading configuration...</p>}
      {error && <div className="error-banner">{error}</div>}

      {config && !loading && (
        <>
          <section className="config-section">
            <h2>LLM Provider Instances</h2>
            <div className="instances-container">
              {instances.length === 0 ? (
                <div className="config-hint">
                  No custom LLM provider instances configured. Defaulting to the environment <code>GOOGLE_API_KEY</code> if present.
                </div>
              ) : (
                <table className="scenario-table">
                  <thead>
                    <tr>
                      <th>Friendly Name</th>
                      <th>Provider Type</th>
                      <th>API Key Preview</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {instances.map((inst) => (
                      <tr key={inst.id}>
                        <td><strong>{inst.name}</strong></td>
                        <td><code>{inst.providerName}</code></td>
                        <td>
                          <code>
                            {inst.apiKey.substring(0, 10)}...{inst.apiKey.substring(inst.apiKey.length - 4)}
                          </code>
                        </td>
                        <td>
                          {inst.isActive ? (
                            <span className="status-pill active">Active</span>
                          ) : (
                            <span className="status-pill inactive">Inactive</span>
                          )}
                        </td>
                        <td>
                          <div className="action-buttons">
                            {!inst.isActive && (
                              <button onClick={() => handleSetActiveInstance(inst.id)} className="btn-sm">
                                Make Active
                              </button>
                            )}
                            <button onClick={() => handleDeleteInstance(inst.id)} className="btn-sm delete-btn">
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <form onSubmit={handleAddInstance} className="add-instance-form">
              <h3>Add LLM Provider Instance</h3>
              <div className="form-fields">
                <div className="field">
                  <label htmlFor="instName">Friendly Name</label>
                  <input
                    id="instName"
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Gemini - Production"
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="instProvider">Provider Type</label>
                  <select
                    id="instProvider"
                    value={newProvider}
                    onChange={(e) => setNewProvider(e.target.value)}
                  >
                    <option value="google-genai">Google Gemini (Gemini-2.5-flash)</option>
                    <option value="mock">Mock LLM Provider</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="instKey">API Key</label>
                  <input
                    id="instKey"
                    type="password"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="AIzaSy..."
                    required
                  />
                </div>
                <button type="submit" disabled={loading} className="btn-add">
                  Add Instance
                </button>
              </div>
            </form>
          </section>

          <section className="config-section">
            <h2>Task Provider Routing</h2>
            <p className="config-hint" style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a", margin: "1rem 0" }}>
              Configure which LLM Provider Key Instance should handle each specific simulation task. Mappings default to the currently <strong>Active</strong> instance if not specified.
            </p>
            <div className="mappings-grid">
              {[
                { key: "actor-prose", label: "Actor Prose Generation", desc: "Generates roleplay/narrative prose for Non-Player Characters." },
                { key: "llm-validator", label: "LLM Validator", desc: "Arbitrates and validates proposed actions against the world state rules." },
                { key: "intent-decoder", label: "Intent Decoder", desc: "Splits raw prose actions into structured intents (Player and NPC)." },
                { key: "timedelta", label: "TimeDelta Generator", desc: "Calculates the duration of character actions to advance the game clock." },
              ].map((task) => (
                <div key={task.key} className="mapping-card">
                  <div className="mapping-info">
                    <strong>{task.label}</strong>
                    <span className="text-gray" style={{ fontSize: "0.75rem", marginTop: "0.125rem" }}>{task.desc}</span>
                  </div>
                  <select
                    value={mappings[task.key] || ""}
                    onChange={(e) => handleUpdateMapping(task.key, e.target.value)}
                  >
                    <option value="">-- Use Active Key (Default) --</option>
                    {instances.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name} ({inst.providerName}){inst.isActive ? " [Active]" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </section>

          <section className="config-section">
            <h2>Environment Variables Default</h2>
            <div className="config-row">
              <span className="config-label">Default Model</span>
              <span className="config-value">
                <code>{config.model}</code>
              </span>
            </div>
            <div className="config-row">
              <span className="config-label">Default API Key (.env)</span>
              <span
                className={
                  config.apiKeySet
                    ? "config-value status-ok"
                    : "config-value status-error"
                }
              >
                {config.apiKeySet
                  ? `✓ Set (${config.apiKeyPreview})`
                  : "✗ NOT SET"}
              </span>
            </div>
          </section>

          <section className="config-section">
            <h2>Available Scenarios</h2>
            {config.availableScenarios.length === 0 ? (
              <p className="config-hint">
                No scenarios found in <code>content/demo/scenarios/</code>.
              </p>
            ) : (
              <table className="scenario-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Path</th>
                  </tr>
                </thead>
                <tbody>
                  {config.availableScenarios.map((s) => (
                    <tr key={s.path}>
                      <td>{s.name}</td>
                      <td>
                        <code>{s.path}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="config-section">
            <h2>Engine Packages</h2>
            <p className="config-hint">
              All <code>@omnia/*</code> workspace packages are consumed via{" "}
              <code>transpilePackages</code> in <code>next.config.ts</code>.
              The native <code>better-sqlite3</code> module is externalized via{" "}
              <code>serverExternalPackages</code>.
            </p>
          </section>
        </>
      )}

      <style>{`
        .config-page {
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem 1rem;
        }
        .config-page h1 {
          font-size: 1.5rem;
          margin-bottom: 1.5rem;
        }
        .config-section {
          margin-bottom: 2rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid #e5e7eb;
        }
        .config-section h2 {
          font-size: 1.125rem;
          margin-bottom: 0.75rem;
        }
        .config-row {
          display: flex;
          justify-content: space-between;
          padding: 0.375rem 0;
          border-bottom: 1px solid #f3f4f6;
        }
        .config-label {
          color: #555;
          font-size: 0.875rem;
        }
        .config-value {
          font-size: 0.875rem;
        }
        .status-ok {
          color: #16a34a;
        }
        .status-error {
          color: #dc2626;
          font-weight: 500;
        }
        .config-hint {
          margin-top: 0.75rem;
          padding: 0.5rem 0.75rem;
          background: #fef3c7;
          border: 1px solid #fde68a;
          border-radius: 4px;
          font-size: 0.8125rem;
          color: #92400e;
        }
        .config-hint code {
          background: rgba(0,0,0,0.06);
          padding: 0.125rem 0.25rem;
          border-radius: 2px;
          font-size: 0.75rem;
        }
        .error-banner {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fca5a5;
          border-radius: 4px;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          margin-bottom: 1rem;
        }
        .scenario-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }
        .scenario-table th {
          text-align: left;
          padding: 0.5rem;
          border-bottom: 2px solid #e5e7eb;
          color: #555;
          font-weight: 500;
        }
        .scenario-table td {
          padding: 0.5rem;
          border-bottom: 1px solid #f3f4f6;
        }
        .scenario-table code {
          font-size: 0.8125rem;
          color: #2563eb;
        }
        code {
          font-family: monospace;
          font-size: 0.875rem;
        }

        /* Pill and List Styles */
        .status-pill {
          display: inline-block;
          padding: 0.125rem 0.5rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
        }
        .status-pill.active {
          background: #dcfce7;
          color: #15803d;
        }
        .status-pill.inactive {
          background: #f3f4f6;
          color: #4b5563;
        }
        .action-buttons {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }
        .btn-sm {
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
          background: #3b82f6;
          color: #fff;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        .btn-sm:hover {
          background: #2563eb;
        }
        .btn-sm.delete-btn {
          background: #ef4444;
        }
        .btn-sm.delete-btn:hover {
          background: #dc2626;
        }
        .add-instance-form {
          margin-top: 1.5rem;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 1.25rem;
        }
        .add-instance-form h3 {
          font-size: 0.95rem;
          margin-bottom: 0.75rem;
          color: #111;
        }
        .form-fields {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
          align-items: flex-end;
        }
        @media (min-width: 768px) {
          .form-fields {
            grid-template-columns: 1fr 1fr 1.5fr auto;
          }
        }
        .form-fields .field {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .form-fields .field label {
          font-size: 0.75rem;
          font-weight: 500;
        }
        .form-fields .field input,
        .form-fields .field select {
          padding: 0.375rem 0.5rem;
          font-size: 0.8125rem;
          border: 1px solid #ccc;
          border-radius: 4px;
          background: #fff;
        }
        .btn-add {
          padding: 0.375rem 1rem;
          font-size: 0.8125rem;
          background: #10b981;
          color: #fff;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        .btn-add:hover {
          background: #059669;
        }

        /* Task Provider Routing Styles */
        .mappings-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
          margin-top: 1rem;
        }
        @media (min-width: 768px) {
          .mappings-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
        .mapping-card {
          border: 1px solid #e5e7eb;
          background: #f9fafb;
          border-radius: 8px;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 0.75rem;
        }
        .mapping-info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          font-size: 0.8125rem;
        }
        .mapping-info strong {
          font-size: 0.875rem;
          color: #111;
        }
        .mapping-card select {
          padding: 0.375rem 0.5rem;
          font-size: 0.8125rem;
          border: 1px solid #ccc;
          border-radius: 4px;
          background: #fff;
          width: 100%;
        }
        .text-gray {
          color: #6b7280;
        }
      `}</style>
    </div>
  );
}
