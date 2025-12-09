from omnia.db.collections import locations
from omnia.models.world import Location


class LocationRepository:
    collection = locations()

    async def get(self, location_id: str) -> Location | None:
        doc = await self.collection.find_one({"id": location_id})
        return Location(**doc) if doc else None

    async def save(self, location: Location):
        await self.collection.replace_one(
            {"id": location.id}, location.model_dump(), upsert=True
        )
