from fastapi import APIRouter, HTTPException
from omnia.models.world import Location
from omnia.db.collections import locations

router = APIRouter()


@router.get("/{loc_id}", response_model=Location)
async def get_location(loc_id: str):
    doc = await locations().find_one({"id": loc_id})
    if not doc:
        raise HTTPException(404, "Location not found")
    return Location(**doc)


@router.post("/", response_model=Location)
async def create_location(location: Location):
    await locations().insert_one(location.model_dump())
    return location
