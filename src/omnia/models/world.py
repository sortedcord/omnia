from enum import Enum
from typing import List, Dict, Optional
from pydantic import BaseModel
from omnia.models.base import BaseEntity


class Biome(str, Enum):
    INDOOR = "indoor"
    HILLS = "hills"
    PLAINS = "plains"


class Environment(BaseModel):
    biome: Biome
    temperature_celsius: float


class Location(BaseModel):
    id: str
    summary: str
    parent_location_id: Optional[str]


class GlobalTimelineEntry(BaseModel):
    id: str
    timestamp: str
    event: str
    location: Location
    involved_entity_ids: List[str] = []  # List of involved entity IDs


class World(BaseEntity):
    current_date: str
    current_time: str

    flags: Dict[str, bool] = {}
    timeline: List[GlobalTimelineEntry] = []
