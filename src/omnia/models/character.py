from typing import List, Optional
from pydantic import BaseModel, Field
from enum import Enum
from omnia.models.base import BaseEntity
from omnia.models.world import GlobalTimelineEntry, Location


class Stats(BaseModel):
    strength: int = 0
    dexterity: int = 0
    intellect: int = 0
    vitality: int = 0
    mana: int = 0
    age: int = 0


class StatusState(BaseModel):
    health: int = 100
    mana: int = 100
    stamina: int = 100
    status_effects: List[str] = []


class PersonalityTraits(BaseModel):
    impulsiveness: float = 0.0
    curiosity: float = 0.0
    fear: float = 0.0
    empathy: float = 0.0
    evil_good_alignment: float = 0.0


class MemoryType(str, Enum):
    FILLER = "filler"
    IMPORTANT = "important"


class MemoryEntry(BaseModel):
    id: str
    summary: str
    importance: str
    timestamp: str
    global_timeline_entry: GlobalTimelineEntry


class CharacterRelation(str, Enum):
    FRIENDLY = "friendly"
    NEUTRAL = "neutral"
    HOSTILE = "hostile"
    UNKNOWN = "unknown"


class CharacterImpression(BaseModel):
    character_id: str
    relation: CharacterRelation

    trust: float = 0.0
    respect: float = 0.0

    impression: str


class Knowledge(BaseModel):
    memories: List[MemoryEntry] = []
    impressions: List[CharacterImpression] = []


class Character(BaseEntity):
    name: str
    species: str
    class_: str = Field(alias="class")

    stats: Stats
    state: StatusState
    traits: PersonalityTraits
    knowledge: Knowledge
    occupation: str

    objectives: List[str] = []
    inventory: List[str] = []  # item ids

    last_location: Optional[Location]
