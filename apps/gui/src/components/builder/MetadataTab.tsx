"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AttributeEditor } from "./AttributeEditor";
import type { AttributeData, EntityData } from "./types";

interface MetadataTabProps {
  scenarioId: string;
  setScenarioId: (val: string) => void;
  name: string;
  setName: (val: string) => void;
  description: string;
  setDescription: (val: string) => void;
  startTime: string;
  setStartTime: (val: string) => void;
  worldAttributes: AttributeData[];
  setWorldAttributes: (attrs: AttributeData[]) => void;
  entityIds: string[];
  entities: EntityData[];
}

export function MetadataTab({
  scenarioId,
  name,
  setName,
  description,
  setDescription,
  startTime,
  setStartTime,
  worldAttributes,
  setWorldAttributes,
  entityIds,
  entities,
}: MetadataTabProps) {
  const addWorldAttribute = () => {
    setWorldAttributes([
      ...worldAttributes,
      { name: "", value: "", visibility: "PUBLIC", allowedEntities: [] },
    ]);
  };

  // Parse initial state from ISO string (or fallback to now)
  const parsedDate = useMemo(() => {
    try {
      const d = new Date(startTime);
      if (isNaN(d.getTime())) return new Date();
      return d;
    } catch {
      return new Date();
    }
  }, [startTime]);

  const dateValue = useMemo(() => {
    return parsedDate.toISOString().split("T")[0];
  }, [parsedDate]);

  const timeValue = useMemo(() => {
    return parsedDate.toISOString().split("T")[1].slice(0, 8);
  }, [parsedDate]);

  const handleDateChange = (newDateStr: string) => {
    if (!newDateStr) return;
    const combined = `${newDateStr}T${timeValue}.000Z`;
    setStartTime(combined);
  };

  const handleTimeChange = (newTimeStr: string) => {
    if (!newTimeStr) return;
    const formattedTime =
      newTimeStr.split(":").length === 2 ? `${newTimeStr}:00` : newTimeStr;
    const combined = `${dateValue}T${formattedTime}.000Z`;
    setStartTime(combined);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
      {/* Basic Fields */}
      <div className="lg:col-span-2 space-y-5 border border-border/20 bg-card p-6 shadow-[2px_2px_0_0_var(--border)]">
        <h2 className="text-body-lg text-primary font-bold border-b border-border/20 pb-2">
          Scenario Metadata
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="sc-id">Scenario Template ID</Label>
            <Input
              id="sc-id"
              value={scenarioId}
              readOnly
              className="font-mono text-xs bg-muted cursor-not-allowed text-muted-foreground"
            />
            <span className="text-[10px] text-muted-foreground">
              Unique filename ID. Alphanumeric, hyphens and underscores only.
            </span>
          </div>

          <div className="space-y-1.5">
            <Label>Start Time</Label>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Input
                  type="date"
                  value={dateValue}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
              <div className="flex-1 space-y-1">
                <Input
                  type="time"
                  step="1"
                  value={timeValue}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground">
              Global clock starting date and time (stored in ISO UTC).
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sc-name">Scenario Name</Label>
          <Input
            id="sc-name"
            placeholder="e.g. The Quiet Tavern"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sc-desc">Description</Label>
          <Textarea
            id="sc-desc"
            placeholder="Describe the starting setup..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="text-xs h-24"
          />
        </div>
      </div>

      {/* World level Attributes */}
      <div className="border border-border/20 bg-card p-6 shadow-[2px_2px_0_0_var(--border)]">
        <AttributeEditor
          title="World Attributes"
          attributes={worldAttributes}
          onChange={setWorldAttributes}
          onAdd={addWorldAttribute}
          entityIds={entityIds}
          entities={entities}
        />
      </div>
    </div>
  );
}
