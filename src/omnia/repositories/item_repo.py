from omnia.db.collections import items
from omnia.models.item import Item


class ItemRepository:
    collection = items()

    async def get(self, item_id: str) -> Item | None:
        doc = await self.collection.find_one({"id": item_id})
        return Item(**doc) if doc else None

    async def save(self, item: Item):
        await self.collection.replace_one(
            {"id": item.id}, item.model_dump(), upsert=True
        )
