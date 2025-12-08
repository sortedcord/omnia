from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class BaseEntity(BaseModel):
    id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    summary: Optional[str]
