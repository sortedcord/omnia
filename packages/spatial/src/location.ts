import { AttributableObject } from "@omnia/core";

export class Location extends AttributableObject {
  parentId: string | null;
  connections: PortalConnection[] = [];

  constructor(id?: string, parentId: string | null = null) {
    super(id);
    this.parentId = parentId;
  }
}

export interface PortalConnection {
  targetId: string;
  portalName?: string;
  portalStateDescriptor?: string;
  visionProp: number; // 0–10
  soundProp: number; // 0–10
  bidirectional: boolean;
}
