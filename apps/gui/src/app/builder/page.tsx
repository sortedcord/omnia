"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
} from "@/components/ui/sidebar";
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
  MenubarRadioGroup,
  MenubarRadioItem,
} from "@/components/ui/menubar";
import { getConfigStatus, loadScenarioJson, saveScenario } from "@/app/actions";
import type { Scenario } from "@omnia/scenario";
import {
  Save,
  FileJson,
  Globe,
  MapPin,
  Users,
  Info,
  Eye,
  Pencil,
} from "lucide-react";

// Import refactored builder components
import { MetadataTab } from "@/components/builder/MetadataTab";
import { LocationsTab } from "@/components/builder/LocationsTab";
import { EntitiesTab } from "@/components/builder/EntitiesTab";
import { JsonTab } from "@/components/builder/JsonTab";
import type {
  LocationData,
  EntityData,
  AttributeData,
} from "@/components/builder/types";

const generateUUID = () => {
  if (
    typeof window !== "undefined" &&
    window.crypto &&
    window.crypto.randomUUID
  ) {
    return window.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export default function BuilderPage() {
  const router = useRouter();

  // Load scenarios templates list
  const [availableScenarios, setAvailableScenarios] = useState<
    { path: string; name: string; description: string }[]
  >([]);

  // Tabs: "metadata", "locations", "entities", "json"
  const [activeTab, setActiveTab] = useState<
    "metadata" | "locations" | "entities" | "json"
  >("metadata");

  // Form State
  const [scenarioId, setScenarioId] = useState("");
  const [name, setName] = useState("My Custom Scenario");
  const [description, setDescription] = useState(
    "A custom scenario template created via builder.",
  );
  const [startTime, setStartTime] = useState("2026-07-06T12:00:00.000Z");
  const [worldAttributes, setWorldAttributes] = useState<AttributeData[]>([]);
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [entities, setEntities] = useState<EntityData[]>([]);

  // Selected sub-items for active editing lists
  const [selectedLocIndex, setSelectedLocIndex] = useState(0);
  const [selectedEntIndex, setSelectedEntIndex] = useState(0);

  // Status & Notification Banners
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize dynamic UUIDs client-side to prevent NextJS SSR hydration mismatch
  useEffect(() => {
    if (!scenarioId) {
      const uId = generateUUID();
      const locId = generateUUID();
      const entId = generateUUID();

      setScenarioId(uId);
      setLocations([{ id: locId, attributes: [], connections: [] }]);
      setEntities([
        {
          id: entId,
          locationId: locId,
          attributes: [
            {
              name: "role",
              value: "adventurer",
              visibility: "PUBLIC",
              allowedEntities: [],
            },
          ],
          aliases: {},
          initialMemories: [],
        },
      ]);
    }
  }, [scenarioId]);

  // Fetch available templates on load
  useEffect(() => {
    async function loadTemplates() {
      try {
        const config = await getConfigStatus();
        setAvailableScenarios(config.availableScenarios);
      } catch (err) {
        console.error("Failed to load scenario list:", err);
      }
    }
    loadTemplates();
  }, []);

  // Set timeout to dismiss messages
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => {
        setStatusMessage(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  // Populate helper lists
  const locationIds = useMemo(
    () => locations.map((l) => l.id).filter(Boolean),
    [locations],
  );
  const entityIds = useMemo(
    () => entities.map((e) => e.id).filter(Boolean),
    [entities],
  );

  // Load selected template
  const handleLoadTemplate = async (path: string) => {
    if (!path) return;
    setStatusMessage({ text: "Loading template...", type: "info" });
    try {
      const res = await loadScenarioJson(path);
      if (!res.ok) {
        setStatusMessage({
          text: res.error || "Failed to load template.",
          type: "error",
        });
        return;
      }

      const s = res.scenario as Scenario;
      if (!s) {
        setStatusMessage({
          text: "Scenario template was empty.",
          type: "error",
        });
        return;
      }

      setScenarioId(s.id || "custom-scenario");
      setName(s.name || "Loaded Scenario");
      setDescription(s.description || "");
      setStartTime(s.startTime || "2026-07-06T12:00:00.000Z");

      // World attributes
      const wAttrs = (s.world?.attributes || []).map((a) => ({
        name: a.name,
        value: a.value,
        visibility: a.visibility,
        allowedEntities: a.allowedEntities || [],
      }));
      setWorldAttributes(wAttrs);

      // Locations
      const locs = (s.locations || []).map((l) => ({
        id: l.id,
        parentId: l.parentId || undefined,
        attributes: (l.attributes || []).map((a) => ({
          name: a.name,
          value: a.value,
          visibility: a.visibility,
          allowedEntities: a.allowedEntities || [],
        })),
        connections: (l.connections || []).map((c) => ({
          targetId: c.targetId,
          portalName: c.portalName,
          portalStateDescriptor: c.portalStateDescriptor,
          visionProp: c.visionProp,
          soundProp: c.soundProp,
          bidirectional: c.bidirectional ?? true,
        })),
      }));
      setLocations(
        locs.length > 0
          ? locs
          : [{ id: generateUUID(), attributes: [], connections: [] }],
      );
      setSelectedLocIndex(0);

      // Entities
      const ents = (s.entities || []).map((e) => ({
        id: e.id,
        locationId: e.locationId || undefined,
        attributes: (e.attributes || []).map((a) => ({
          name: a.name,
          value: a.value,
          visibility: a.visibility,
          allowedEntities: a.allowedEntities || [],
        })),
        aliases: e.aliases || {},
        initialMemories: (e.initialMemories || []).map((m) => ({
          id: m.id || generateUUID(),
          timestamp: m.timestamp || s.startTime,
          locationId: m.locationId || null,
          intent: {
            type: m.intent.type,
            originalText: m.intent.originalText,
            description: m.intent.description,
            selfDescription: m.intent.selfDescription,
            actorId: m.intent.actorId || e.id,
            targetIds: m.intent.targetIds || [],
            modifiers: m.intent.modifiers || [],
          },
          outcome: m.outcome
            ? {
                isValid: m.outcome.isValid,
                reason: m.outcome.reason,
              }
            : undefined,
        })),
      }));
      setEntities(
        ents.length > 0
          ? ents
          : [
              {
                id: generateUUID(),
                locationId: locs[0]?.id || generateUUID(),
                attributes: [],
                aliases: {},
                initialMemories: [],
              },
            ],
      );
      setSelectedEntIndex(0);

      setStatusMessage({
        text: "Template loaded successfully!",
        type: "success",
      });
    } catch (err) {
      setStatusMessage({
        text: err instanceof Error ? err.message : String(err),
        type: "error",
      });
    }
  };

  // Compile full scenario object
  const compiledScenario = useMemo(() => {
    return {
      id: scenarioId.trim(),
      name: name.trim(),
      description: description.trim(),
      startTime: startTime.trim(),
      world:
        worldAttributes.length > 0
          ? {
              attributes: worldAttributes.map((a) => ({
                name: a.name.trim(),
                value: a.value.trim(),
                visibility: a.visibility,
                ...(a.visibility === "PRIVATE" && a.allowedEntities.length > 0
                  ? { allowedEntities: a.allowedEntities }
                  : {}),
              })),
            }
          : undefined,
      locations: locations.map((l) => ({
        id: l.id.trim(),
        ...(l.parentId ? { parentId: l.parentId } : {}),
        ...(l.attributes.length > 0
          ? {
              attributes: l.attributes.map((a) => ({
                name: a.name.trim(),
                value: a.value.trim(),
                visibility: a.visibility,
                ...(a.visibility === "PRIVATE" && a.allowedEntities.length > 0
                  ? { allowedEntities: a.allowedEntities }
                  : {}),
              })),
            }
          : {}),
        ...(l.connections.length > 0
          ? {
              connections: l.connections.map((c) => ({
                targetId: c.targetId,
                ...(c.portalName ? { portalName: c.portalName.trim() } : {}),
                ...(c.portalStateDescriptor
                  ? { portalStateDescriptor: c.portalStateDescriptor.trim() }
                  : {}),
                visionProp: Number(c.visionProp),
                soundProp: Number(c.soundProp),
                bidirectional: !!c.bidirectional,
              })),
            }
          : {}),
      })),
      entities: entities.map((e) => ({
        id: e.id.trim(),
        ...(e.locationId ? { locationId: e.locationId } : {}),
        ...(e.attributes.length > 0
          ? {
              attributes: e.attributes.map((a) => ({
                name: a.name.trim(),
                value: a.value.trim(),
                visibility: a.visibility,
                ...(a.visibility === "PRIVATE" && a.allowedEntities.length > 0
                  ? { allowedEntities: a.allowedEntities }
                  : {}),
              })),
            }
          : {}),
        ...(Object.keys(e.aliases).length > 0 ? { aliases: e.aliases } : {}),
        ...(e.initialMemories.length > 0
          ? {
              initialMemories: e.initialMemories.map((m) => ({
                id: m.id,
                timestamp: m.timestamp,
                locationId: m.locationId,
                intent: {
                  type: m.intent.type,
                  originalText: m.intent.originalText.trim(),
                  description: m.intent.description.trim(),
                  ...(m.intent.selfDescription
                    ? { selfDescription: m.intent.selfDescription.trim() }
                    : {}),
                  actorId: m.intent.actorId,
                  targetIds: m.intent.targetIds,
                  ...(m.intent.modifiers && m.intent.modifiers.length > 0
                    ? { modifiers: m.intent.modifiers }
                    : []),
                },
                ...(m.outcome
                  ? {
                      outcome: {
                        isValid: !!m.outcome.isValid,
                        reason: m.outcome.reason.trim(),
                      },
                    }
                  : {}),
              })),
            }
          : {}),
      })),
    };
  }, [
    scenarioId,
    name,
    description,
    startTime,
    worldAttributes,
    locations,
    entities,
  ]);

  // Save scenario to server
  const handleSaveToServer = async () => {
    if (!scenarioId.trim()) {
      setStatusMessage({
        text: "Scenario Template ID is required to save.",
        type: "error",
      });
      return;
    }
    setIsSubmitting(true);
    setStatusMessage({ text: "Saving scenario file...", type: "info" });
    try {
      const res = await saveScenario(compiledScenario);
      if (res.ok) {
        setStatusMessage({
          text: `Scenario template saved as ${scenarioId}.json successfully!`,
          type: "success",
        });
        // Refresh template list
        const config = await getConfigStatus();
        setAvailableScenarios(config.availableScenarios);
      } else {
        setStatusMessage({
          text: res.error || "Failed to save scenario.",
          type: "error",
        });
      }
    } catch (err) {
      setStatusMessage({
        text: err instanceof Error ? err.message : String(err),
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Download scenario file directly
  const handleDownloadJson = () => {
    try {
      const jsonStr = JSON.stringify(compiledScenario, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${scenarioId || "scenario"}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setStatusMessage({ text: "JSON download initiated.", type: "success" });
    } catch {
      setStatusMessage({ text: "Download failed.", type: "error" });
    }
  };

  const handleResetScenario = () => {
    setScenarioId("");
    setName("My Custom Scenario");
    setDescription("A custom scenario template created via builder.");
    setStartTime("2026-07-06T12:00:00.000Z");
    setWorldAttributes([]);
    setSelectedLocIndex(0);
    setSelectedEntIndex(0);
    setStatusMessage({ text: "Scenario reset successfully.", type: "success" });
  };

  const handleAddLocation = () => {
    const newId = generateUUID();
    setLocations([
      ...locations,
      { id: newId, attributes: [], connections: [] },
    ]);
    setSelectedLocIndex(locations.length);
    setActiveTab("locations");
  };

  const handleAddEntity = () => {
    const newId = generateUUID();
    setEntities([
      ...entities,
      {
        id: newId,
        locationId: locationIds[0] || "",
        attributes: [],
        aliases: {},
        initialMemories: [],
        isAgent: true,
      },
    ]);
    setSelectedEntIndex(entities.length);
    setActiveTab("entities");
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full bg-background overflow-hidden">
      {/* Save Status Banner */}
      {statusMessage && (
        <div
          className={`fixed top-14 right-4 z-50 max-w-sm border p-4 shadow-lg animate-fade-in ${
            statusMessage.type === "success"
              ? "bg-emerald-950/80 border-emerald-500 text-emerald-300"
              : statusMessage.type === "error"
                ? "bg-destructive/10 border-destructive text-destructive"
                : "bg-secondary/90 border-border text-foreground"
          }`}
        >
          <div className="flex items-start gap-3">
            <Info className="size-4 shrink-0 mt-0.5" />
            <div className="text-xs">{statusMessage.text}</div>
          </div>
        </div>
      )}

      {/* Menubar spanning full page width right below navbar */}
      <div className="w-full border-b border-border/20 bg-card py-1.5 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-xs font-head text-primary tracking-wider font-bold flex items-center gap-1.5">
            <Pencil className="size-4 text-primary" />
          </span>
          <Menubar className="border-none shadow-none bg-transparent h-7 p-0">
            <MenubarMenu>
              <MenubarTrigger className="cursor-pointer">File</MenubarTrigger>
              <MenubarContent>
                <MenubarSub>
                  <MenubarSubTrigger className="cursor-pointer">
                    Load Template
                  </MenubarSubTrigger>
                  <MenubarSubContent>
                    {availableScenarios.length === 0 ? (
                      <MenubarItem disabled>No templates</MenubarItem>
                    ) : (
                      availableScenarios.map((sc) => (
                        <MenubarItem
                          key={sc.path}
                          className="cursor-pointer"
                          onClick={() => {
                            handleLoadTemplate(sc.path);
                          }}
                        >
                          {sc.name}
                        </MenubarItem>
                      ))
                    )}
                  </MenubarSubContent>
                </MenubarSub>
                <MenubarSeparator />
                <MenubarItem
                  className="cursor-pointer"
                  onClick={handleSaveToServer}
                  disabled={isSubmitting || !scenarioId.trim()}
                >
                  <Save className="size-4 mr-2 inline" /> Save to Server
                </MenubarItem>
                <MenubarItem
                  className="cursor-pointer"
                  onClick={handleDownloadJson}
                >
                  <FileJson className="size-4 mr-2 inline" /> Export JSON
                </MenubarItem>
              </MenubarContent>
            </MenubarMenu>

            <MenubarMenu>
              <MenubarTrigger className="cursor-pointer">Edit</MenubarTrigger>
              <MenubarContent>
                <MenubarItem
                  className="cursor-pointer"
                  onClick={handleResetScenario}
                >
                  Reset Scenario
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem
                  className="cursor-pointer"
                  onClick={handleAddLocation}
                >
                  Add New Location
                </MenubarItem>
                <MenubarItem
                  className="cursor-pointer"
                  onClick={handleAddEntity}
                >
                  Add New Entity
                </MenubarItem>
              </MenubarContent>
            </MenubarMenu>

            <MenubarMenu>
              <MenubarTrigger className="cursor-pointer">View</MenubarTrigger>
              <MenubarContent>
                <MenubarRadioGroup
                  value={activeTab}
                  onValueChange={(val) => setActiveTab(val as typeof activeTab)}
                >
                  <MenubarRadioItem value="metadata" className="cursor-pointer">
                    World Metadata
                  </MenubarRadioItem>
                  <MenubarRadioItem
                    value="locations"
                    className="cursor-pointer"
                  >
                    Locations
                  </MenubarRadioItem>
                  <MenubarRadioItem value="entities" className="cursor-pointer">
                    Entities
                  </MenubarRadioItem>
                  <MenubarRadioItem value="json" className="cursor-pointer">
                    Live JSON Preview
                  </MenubarRadioItem>
                </MenubarRadioGroup>
              </MenubarContent>
            </MenubarMenu>
          </Menubar>
        </div>
        <div className="text-[10px] font-mono text-muted-foreground">
          {scenarioId ? `ID: ${scenarioId}` : "Unsaved Scenario"}
        </div>
      </div>

      <SidebarProvider className="flex-1 min-h-0">
        <div className="flex flex-1 min-h-0 w-full overflow-hidden">
          {/* Viewport-level Vertical Sidebar on the Left Side */}
          <Sidebar
            collapsible="none"
            className="h-full border-r border-border/30 bg-card shrink-0"
          >
            <SidebarContent className="flex flex-col justify-between h-full bg-card p-6">
              <div className="flex flex-col gap-2 font-head">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-2">
                  Configuration
                </span>

                <button
                  onClick={() => setActiveTab("metadata")}
                  className={`w-full text-left px-4 py-2.5 text-xs font-mono font-bold tracking-wide border transition-all flex items-center gap-2 cursor-pointer ${
                    activeTab === "metadata"
                      ? "border-primary bg-primary/10 text-primary shadow-[2px_2px_0_0_var(--primary)] font-bold"
                      : "border-border/30 hover:bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Globe className="size-3.5" />
                  <span>World Metadata</span>
                </button>

                <button
                  onClick={() => setActiveTab("locations")}
                  className={`w-full text-left px-4 py-2.5 text-xs font-mono font-bold tracking-wide border transition-all flex items-center gap-2 cursor-pointer ${
                    activeTab === "locations"
                      ? "border-primary bg-primary/10 text-primary shadow-[2px_2px_0_0_var(--primary)] font-bold"
                      : "border-border/30 hover:bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <MapPin className="size-3.5" />
                  <span>Locations</span>
                  <span className="ml-auto text-[10px] font-mono border border-muted-foreground/20 bg-muted/10 px-1 rounded">
                    {locations.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("entities")}
                  className={`w-full text-left px-4 py-2.5 text-xs font-mono font-bold tracking-wide border transition-all flex items-center gap-2 cursor-pointer ${
                    activeTab === "entities"
                      ? "border-primary bg-primary/10 text-primary shadow-[2px_2px_0_0_var(--primary)] font-bold"
                      : "border-border/30 hover:bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Users className="size-3.5" />
                  <span>Entities</span>
                  <span className="ml-auto text-[10px] font-mono border border-muted-foreground/20 bg-muted/10 px-1 rounded">
                    {entities.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("json")}
                  className={`w-full text-left px-4 py-2.5 text-xs font-mono font-bold tracking-wide border transition-all flex items-center gap-2 cursor-pointer ${
                    activeTab === "json"
                      ? "border-primary bg-primary/10 text-primary shadow-[2px_2px_0_0_var(--primary)] font-bold"
                      : "border-border/30 hover:bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Eye className="size-3.5" />
                  <span>Live JSON Preview</span>
                </button>
              </div>

              {/* Sidebar Footer link */}
              <div className="border-t border-border/10 pt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                <button
                  onClick={() => router.push("/")}
                  className="w-full py-1 text-center hover:text-foreground text-primary font-bold uppercase transition-colors cursor-pointer"
                >
                  Back to Dashboard
                </button>
              </div>
            </SidebarContent>
          </Sidebar>

          {/* Main Centered Content Pane on the Right */}
          <main className="flex-1 overflow-y-auto px-10 py-8 min-h-0 flex flex-col">
            <div className="mx-auto max-w-[1200px] w-full flex-1 flex flex-col min-h-0 gap-6">
              {/* Header block with Page Name */}
              <div className="shrink-0">
                <h1 className="text-headline-md text-primary flex items-center gap-2 font-head">
                  Scenario Builder
                </h1>
              </div>

              {/* Active configuration tab form */}
              <div className="flex-1 min-h-0">
                {/* TAB 1: World Metadata & Attributes */}
                {activeTab === "metadata" && (
                  <MetadataTab
                    scenarioId={scenarioId}
                    setScenarioId={setScenarioId}
                    name={name}
                    setName={setName}
                    description={description}
                    setDescription={setDescription}
                    startTime={startTime}
                    setStartTime={setStartTime}
                    worldAttributes={worldAttributes}
                    setWorldAttributes={setWorldAttributes}
                    entityIds={entityIds}
                    entities={entities}
                  />
                )}

                {/* TAB 2: Locations & Spatial connections */}
                {activeTab === "locations" && (
                  <LocationsTab
                    locations={locations}
                    setLocations={setLocations}
                    entities={entities}
                    locationIds={locationIds}
                    entityIds={entityIds}
                    selectedLocIndex={selectedLocIndex}
                    setSelectedLocIndex={setSelectedLocIndex}
                    generateUUID={generateUUID}
                  />
                )}

                {/* TAB 3: Entities */}
                {activeTab === "entities" && (
                  <EntitiesTab
                    entities={entities}
                    setEntities={setEntities}
                    locations={locations}
                    locationIds={locationIds}
                    entityIds={entityIds}
                    selectedEntIndex={selectedEntIndex}
                    setSelectedEntIndex={setSelectedEntIndex}
                    startTime={startTime}
                    generateUUID={generateUUID}
                  />
                )}

                {/* TAB 4: Live JSON Preview */}
                {activeTab === "json" && (
                  <JsonTab
                    compiledScenario={compiledScenario}
                    onCopySuccess={() =>
                      setStatusMessage({
                        text: "JSON copied to clipboard!",
                        type: "success",
                      })
                    }
                  />
                )}
              </div>
            </div>
          </main>
        </div>
      </SidebarProvider>
    </div>
  );
}
