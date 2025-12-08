from pydantic import BaseModel
from typing import Optional
from omnia.models.base import BaseEntity


class ItemProperties(BaseModel):
    rarity: str
    value: int


class ItemEffects(BaseModel):
    passive: Optional[str] = None
    active: Optional[str] = None


class ItemState(BaseModel):
    durability: float = 1.0
    identified: bool = True


class Item(BaseEntity):
    name: str
    type: str

    properties: ItemProperties
    effects: ItemEffects
    state: ItemState
    current_holder_id: Optional[str] = None  # Character ID who currently holds the item
