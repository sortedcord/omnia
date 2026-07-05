"use client";

import { useState, useEffect } from "react";

function generateUUID(): string {
  if (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface Attribute {
  name: string;
  value: string;
  visibility: "PUBLIC" | "PRIVATE";
  allowedEntities: string[];
}

interface Entity {
  id: string;
  attributes: Attribute[];
}

interface WorldData {
  id: string;
  attributes: Attribute[];
  entities: Entity[];
}

export default function Home() {
  const [worldsList, setWorldsList] = useState<{ id: string; name: string }[]>([]);
  const [selectedWorldId, setSelectedWorldId] = useState<string>("");
  const [worldData, setWorldData] = useState<WorldData | null>(null);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  // Temp state for adding new attributes / entities
  const [newWorldAttribute, setNewWorldAttribute] = useState<{ name: string; value: string; visibility: "PUBLIC" | "PRIVATE" }>({ name: "", value: "", visibility: "PUBLIC" });
  const [newEntityAttribute, setNewEntityAttribute] = useState<Record<string, { name: string; value: string; visibility: "PUBLIC" | "PRIVATE" }>>({});

  const fetchWorlds = async () => {
    try {
      const res = await fetch("/api/world");
      if (!res.ok) throw new Error("Failed to fetch worlds");
      const data = await res.json();
      setWorldsList(data.worlds || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load worlds list";
      setError(msg);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchWorlds();
  }, []);

  const handleCreateNewWorld = () => {
    const newId = generateUUID();
    setWorldData({
      id: newId,
      attributes: [{ name: "name", value: "New World", visibility: "PUBLIC", allowedEntities: [] }],
      entities: []
    });
    setSelectedWorldId("");
    setStatus("Created new world locally. Don't forget to save!");
    setError("");
  };

  const handleLoadWorld = async (id: string) => {
    if (!id) return;
    try {
      setStatus(`Loading world ${id}...`);
      setError("");
      const res = await fetch(`/api/world?id=${id}`);
      if (!res.ok) throw new Error("Failed to load world data");
      const data = await res.json();
      setWorldData(data);
      setSelectedWorldId(id);
      setStatus(`Loaded world successfully!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load world";
      setError(msg);
      setStatus("");
    }
  };

  const handleSaveWorld = async () => {
    if (!worldData) return;
    try {
      setStatus("Saving world to database...");
      setError("");
      const res = await fetch("/api/world", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(worldData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save world");
      
      setStatus("World saved successfully!");
      fetchWorlds();
      setSelectedWorldId(worldData.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save world";
      setError(msg);
      setStatus("");
    }
  };

  // World Attribute management
  const addWorldAttribute = () => {
    if (!worldData || !newWorldAttribute.name.trim()) return;
    if (worldData.attributes.some(a => a.name === newWorldAttribute.name)) {
      setError(`Attribute "${newWorldAttribute.name}" already exists on world.`);
      return;
    }
    setWorldData({
      ...worldData,
      attributes: [
        ...worldData.attributes,
        { name: newWorldAttribute.name, value: newWorldAttribute.value, visibility: newWorldAttribute.visibility, allowedEntities: [] }
      ]
    });
    setNewWorldAttribute({ name: "", value: "", visibility: "PUBLIC" });
    setError("");
  };

  const removeWorldAttribute = (name: string) => {
    if (!worldData) return;
    setWorldData({
      ...worldData,
      attributes: worldData.attributes.filter(a => a.name !== name)
    });
  };

  const updateWorldAttributeValue = (name: string, value: string) => {
    if (!worldData) return;
    setWorldData({
      ...worldData,
      attributes: worldData.attributes.map(a => a.name === name ? { ...a, value } : a)
    });
  };

  const updateWorldAttributeVisibility = (name: string, visibility: "PUBLIC" | "PRIVATE") => {
    if (!worldData) return;
    setWorldData({
      ...worldData,
      attributes: worldData.attributes.map(a => a.name === name ? { ...a, visibility, allowedEntities: visibility === "PUBLIC" ? [] : a.allowedEntities } : a)
    });
  };

  // Entity management
  const handleAddEntity = () => {
    if (!worldData) return;
    const newId = generateUUID();
    const newEntity: Entity = {
      id: newId,
      attributes: [{ name: "name", value: "New Entity", visibility: "PRIVATE", allowedEntities: [] }]
    };
    setWorldData({
      ...worldData,
      entities: [...worldData.entities, newEntity]
    });
  };

  const handleRemoveEntity = (entityId: string) => {
    if (!worldData) return;
    // Also clean up this entity from all attribute ACL lists
    const updatedEntities = worldData.entities.filter(e => e.id !== entityId).map(e => ({
      ...e,
      attributes: e.attributes.map(a => ({
        ...a,
        allowedEntities: a.allowedEntities.filter(id => id !== entityId)
      }))
    }));

    const updatedWorldAttributes = worldData.attributes.map(a => ({
      ...a,
      allowedEntities: a.allowedEntities.filter(id => id !== entityId)
    }));

    setWorldData({
      ...worldData,
      attributes: updatedWorldAttributes,
      entities: updatedEntities
    });
  };

  // Entity Attribute management
  const addEntityAttribute = (entityId: string) => {
    if (!worldData) return;
    const input = newEntityAttribute[entityId];
    if (!input || !input.name.trim()) return;

    const entity = worldData.entities.find(e => e.id === entityId);
    if (!entity) return;

    if (entity.attributes.some(a => a.name === input.name)) {
      setError(`Attribute "${input.name}" already exists on entity.`);
      return;
    }

    const updatedEntities = worldData.entities.map(e => {
      if (e.id === entityId) {
        return {
          ...e,
          attributes: [
            ...e.attributes,
            { name: input.name, value: input.value, visibility: input.visibility, allowedEntities: [] }
          ]
        };
      }
      return e;
    });

    setWorldData({ ...worldData, entities: updatedEntities });
    setNewEntityAttribute({
      ...newEntityAttribute,
      [entityId]: { name: "", value: "", visibility: "PRIVATE" }
    });
    setError("");
  };

  const removeEntityAttribute = (entityId: string, attrName: string) => {
    if (!worldData) return;
    const updatedEntities = worldData.entities.map(e => {
      if (e.id === entityId) {
        return {
          ...e,
          attributes: e.attributes.filter(a => a.name !== attrName)
        };
      }
      return e;
    });
    setWorldData({ ...worldData, entities: updatedEntities });
  };

  const updateEntityAttributeValue = (entityId: string, attrName: string, value: string) => {
    if (!worldData) return;
    const updatedEntities = worldData.entities.map(e => {
      if (e.id === entityId) {
        return {
          ...e,
          attributes: e.attributes.map(a => a.name === attrName ? { ...a, value } : a)
        };
      }
      return e;
    });
    setWorldData({ ...worldData, entities: updatedEntities });
  };

  const updateEntityAttributeVisibility = (entityId: string, attrName: string, visibility: "PUBLIC" | "PRIVATE") => {
    if (!worldData) return;
    const updatedEntities = worldData.entities.map(e => {
      if (e.id === entityId) {
        return {
          ...e,
          attributes: e.attributes.map(a => a.name === attrName ? { ...a, visibility, allowedEntities: visibility === "PUBLIC" ? [] : a.allowedEntities } : a)
        };
      }
      return e;
    });
    setWorldData({ ...worldData, entities: updatedEntities });
  };

  const toggleEntityAcl = (targetEntityId: string, attrName: string, allowedEntityId: string, checked: boolean) => {
    if (!worldData) return;
    const updatedEntities = worldData.entities.map(e => {
      if (e.id === targetEntityId) {
        return {
          ...e,
          attributes: e.attributes.map(a => {
            if (a.name === attrName) {
              const currentAcl = a.allowedEntities;
              const newAcl = checked
                ? [...currentAcl, allowedEntityId]
                : currentAcl.filter(id => id !== allowedEntityId);
              return { ...a, allowedEntities: newAcl };
            }
            return a;
          })
        };
      }
      return e;
    });
    setWorldData({ ...worldData, entities: updatedEntities });
  };

  const toggleWorldAcl = (attrName: string, allowedEntityId: string, checked: boolean) => {
    if (!worldData) return;
    setWorldData({
      ...worldData,
      attributes: worldData.attributes.map(a => {
        if (a.name === attrName) {
          const currentAcl = a.allowedEntities;
          const newAcl = checked
            ? [...currentAcl, allowedEntityId]
            : currentAcl.filter(id => id !== allowedEntityId);
          return { ...a, allowedEntities: newAcl };
        }
        return a;
      })
    });
  };

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Omnia Scenario Builder</h1>
      <hr />

      {/* Persistence Controls */}
      <section style={{ marginBottom: "20px" }}>
        <h2>World Persistence</h2>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button onClick={handleCreateNewWorld}>Create New World</button>
          <span>or Load Existing:</span>
          <select
            value={selectedWorldId}
            onChange={(e) => handleLoadWorld(e.target.value)}
          >
            <option value="">-- Select World --</option>
            {worldsList.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.id})
              </option>
            ))}
          </select>
          {worldData && (
            <>
              <button onClick={handleSaveWorld} style={{ fontWeight: "bold" }}>
                Save World to DB
              </button>
              <button onClick={() => handleLoadWorld(worldData.id)}>
                Reload / Discard Changes
              </button>
            </>
          )}
        </div>
      </section>

      {/* Status Messages */}
      {status && <div style={{ color: "green", margin: "10px 0" }}><strong>Status:</strong> {status}</div>}
      {error && <div style={{ color: "red", margin: "10px 0" }}><strong>Error:</strong> {error}</div>}

      {worldData ? (
        <div>
          <hr />
          {/* World Information */}
          <section style={{ marginBottom: "30px" }}>
            <h2>World Attributes (ID: {worldData.id})</h2>
            
            <table border={1} cellPadding={5} style={{ borderCollapse: "collapse", width: "100%", marginBottom: "10px" }}>
              <thead>
                <tr>
                  <th>Attribute Name</th>
                  <th>Value</th>
                  <th>Visibility</th>
                  <th>ACL (Allowed Entities for PRIVATE)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {worldData.attributes.map((attr) => (
                  <tr key={attr.name}>
                    <td><strong>{attr.name}</strong></td>
                    <td>
                      <input
                        type="text"
                        value={attr.value}
                        onChange={(e) => updateWorldAttributeValue(attr.name, e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        value={attr.visibility}
                        onChange={(e) => updateWorldAttributeVisibility(attr.name, e.target.value as "PUBLIC" | "PRIVATE")}
                      >
                        <option value="PUBLIC">PUBLIC</option>
                        <option value="PRIVATE">PRIVATE</option>
                      </select>
                    </td>
                    <td>
                      {attr.visibility === "PRIVATE" ? (
                        <div>
                          {worldData.entities.length === 0 ? (
                            <span style={{ color: "gray" }}>No entities in world to grant access to</span>
                          ) : (
                            worldData.entities.map((e) => {
                              const entName = e.attributes.find(a => a.name === "name")?.value || e.id;
                              return (
                                <label key={e.id} style={{ display: "block" }}>
                                  <input
                                    type="checkbox"
                                    checked={attr.allowedEntities.includes(e.id)}
                                    onChange={(evt) => toggleWorldAcl(attr.name, e.id, evt.target.checked)}
                                  />{" "}
                                  {entName} ({e.id.slice(0, 8)}...)
                                </label>
                              );
                            })
                          )}
                        </div>
                      ) : (
                        <span style={{ color: "gray" }}>N/A (Visible to all)</span>
                      )}
                    </td>
                    <td>
                      <button onClick={() => removeWorldAttribute(attr.name)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Add World Attribute */}
            <div style={{ background: "#f5f5f5", padding: "10px", border: "1px solid #ccc" }}>
              <h4>Add World Attribute</h4>
              Name:{" "}
              <input
                type="text"
                value={newWorldAttribute.name}
                onChange={(e) => setNewWorldAttribute({ ...newWorldAttribute, name: e.target.value })}
                placeholder="e.g. description"
              />{" "}
              Value:{" "}
              <input
                type="text"
                value={newWorldAttribute.value}
                onChange={(e) => setNewWorldAttribute({ ...newWorldAttribute, value: e.target.value })}
                placeholder="e.g. A lush land"
              />{" "}
              Visibility:{" "}
              <select
                value={newWorldAttribute.visibility}
                onChange={(e) => setNewWorldAttribute({ ...newWorldAttribute, visibility: e.target.value as "PUBLIC" | "PRIVATE" })}
              >
                <option value="PUBLIC">PUBLIC</option>
                <option value="PRIVATE">PRIVATE</option>
              </select>{" "}
              <button onClick={addWorldAttribute}>Add Attribute</button>
            </div>
          </section>

          <hr />

          {/* Entities section */}
          <section style={{ marginBottom: "30px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2>World Entities</h2>
              <button onClick={handleAddEntity}>+ Add New Entity</button>
            </div>

            {worldData.entities.length === 0 ? (
              <p>No entities found in this world. Click &quot;+ Add New Entity&quot; to add one.</p>
            ) : (
              worldData.entities.map((entity, index) => {
                const entName = entity.attributes.find(a => a.name === "name")?.value || "Unnamed Entity";
                const entInputState = newEntityAttribute[entity.id] || { name: "", value: "", visibility: "PRIVATE" };

                return (
                  <div key={entity.id} style={{ border: "1px solid #999", padding: "15px", marginBottom: "20px", background: "#fafafa" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h3>Entity #{index + 1}: {entName} <span style={{ fontSize: "12px", color: "gray", fontWeight: "normal" }}>({entity.id})</span></h3>
                      <button onClick={() => handleRemoveEntity(entity.id)} style={{ color: "red" }}>Delete Entity</button>
                    </div>

                    <table border={1} cellPadding={5} style={{ borderCollapse: "collapse", width: "100%", marginBottom: "10px", background: "white" }}>
                      <thead>
                        <tr>
                          <th>Attribute Name</th>
                          <th>Value</th>
                          <th>Visibility</th>
                          <th>ACL (Allowed Entities for PRIVATE)</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entity.attributes.map((attr) => (
                          <tr key={attr.name}>
                            <td><strong>{attr.name}</strong></td>
                            <td>
                              <input
                                type="text"
                                value={attr.value}
                                onChange={(e) => updateEntityAttributeValue(entity.id, attr.name, e.target.value)}
                              />
                            </td>
                            <td>
                              <select
                                value={attr.visibility}
                                onChange={(e) => updateEntityAttributeVisibility(entity.id, attr.name, e.target.value as "PUBLIC" | "PRIVATE")}
                              >
                                <option value="PUBLIC">PUBLIC</option>
                                <option value="PRIVATE">PRIVATE</option>
                              </select>
                            </td>
                            <td>
                              {attr.visibility === "PRIVATE" ? (
                                <div>
                                  {worldData.entities.filter(e => e.id !== entity.id).length === 0 ? (
                                    <span style={{ color: "gray" }}>No other entities in world to grant access to</span>
                                  ) : (
                                    worldData.entities
                                      .filter(e => e.id !== entity.id)
                                      .map((e) => {
                                        const otherName = e.attributes.find(a => a.name === "name")?.value || e.id;
                                        return (
                                          <label key={e.id} style={{ display: "block" }}>
                                            <input
                                              type="checkbox"
                                              checked={attr.allowedEntities.includes(e.id)}
                                              onChange={(evt) => toggleEntityAcl(entity.id, attr.name, e.id, evt.target.checked)}
                                            />{" "}
                                            {otherName} ({e.id.slice(0, 8)}...)
                                          </label>
                                        );
                                      })
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: "gray" }}>N/A (Visible to all)</span>
                              )}
                            </td>
                            <td>
                              <button onClick={() => removeEntityAttribute(entity.id, attr.name)}>Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Add Entity Attribute */}
                    <div style={{ background: "#eee", padding: "10px", border: "1px dashed #777" }}>
                      <h5>Add Attribute to {entName}</h5>
                      Name:{" "}
                      <input
                        type="text"
                        value={entInputState.name}
                        onChange={(e) => setNewEntityAttribute({
                          ...newEntityAttribute,
                          [entity.id]: { ...entInputState, name: e.target.value }
                        })}
                        placeholder="e.g. title"
                      />{" "}
                      Value:{" "}
                      <input
                        type="text"
                        value={entInputState.value}
                        onChange={(e) => setNewEntityAttribute({
                          ...newEntityAttribute,
                          [entity.id]: { ...entInputState, value: e.target.value }
                        })}
                        placeholder="e.g. Witcher"
                      />{" "}
                      Visibility:{" "}
                      <select
                        value={entInputState.visibility}
                        onChange={(e) => setNewEntityAttribute({
                          ...newEntityAttribute,
                          [entity.id]: { ...entInputState, visibility: e.target.value as "PUBLIC" | "PRIVATE" }
                        })}
                      >
                        <option value="PUBLIC">PUBLIC</option>
                        <option value="PRIVATE">PRIVATE</option>
                      </select>{" "}
                      <button onClick={() => addEntityAttribute(entity.id)}>Add Attribute</button>
                    </div>
                  </div>
                );
              })
            )}
          </section>
        </div>
      ) : (
        <div style={{ padding: "40px 0", textAlign: "center", color: "gray" }}>
          Please select a world to load or click &quot;Create New World&quot; to begin.
        </div>
      )}
    </div>
  );
}
